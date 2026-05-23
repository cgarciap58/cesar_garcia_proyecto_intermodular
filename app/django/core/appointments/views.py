import json
import math
from datetime import timedelta

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.contrib.auth import get_user_model

from .models import AvailableSlot, Appointment
from core.accounts.models import PatientProfile, PsychologistProfile


# ─── Auth ─────────────────────────────────────────────────────────────────────

def require_auth(request):
    return request.user if request.user.is_authenticated else None


# ─── Credit helpers ───────────────────────────────────────────────────────────

def credit_cost(duration_minutes):
    """1 credit per 55 minutes, rounded up."""
    return math.ceil(duration_minutes / 55)


def _refund(appointment):
    """Add credits back to the patient. Call inside an atomic block."""
    cost    = credit_cost(appointment.slot.duration_minutes)
    profile = appointment.patient
    profile.credits += cost
    profile.save(update_fields=['credits'])
    return profile.credits   # return new balance so callers can include it in responses


# ─── Status computation ───────────────────────────────────────────────────────

def compute_status(appointment):
    """
    Returns the effective display status.
    Only 'confirmed' appointments are upgraded to 'in_progress' or 'done'.
    All other stored statuses pass through unchanged.
    """
    if appointment.status != Appointment.STATUS_CONFIRMED:
        return appointment.status

    now   = timezone.now()
    start = appointment.slot.start_time
    end   = start + timedelta(minutes=appointment.slot.duration_minutes)

    if now >= end:   return 'done'
    if now >= start: return 'in_progress'
    return 'confirmed'


def _slot_has_active_requests(slot):
    """True if any pending_request appointments exist on this slot."""
    return slot.appointments.filter(
        status=Appointment.STATUS_PENDING_REQUEST
    ).exists()


# ─── Serialisers ─────────────────────────────────────────────────────────────

def slot_to_dict(slot):
    """
    Includes pending_request_count so /slots can show the psych how many
    patients are waiting without exposing who they are.
    """
    pending_count = slot.appointments.filter(
        status=Appointment.STATUS_PENDING_REQUEST
    ).count()
    return {
        'id':                   slot.id,
        'start_time':           slot.start_time.isoformat(),
        'duration_minutes':     slot.duration_minutes,
        'status':               slot.status,
        'pending_request_count': pending_count,
        'created_at':           slot.created_at.isoformat(),
    }


def appointment_to_dict(appointment, for_role, patient_credits=None):
    """
    patient_credits – when provided, included in the response so the frontend
    can update AuthContext without an extra /api/auth/me/ round-trip.
    """
    data = {
        'id':            appointment.id,
        'status':        compute_status(appointment),
        'stored_status': appointment.status,
        'slot':          slot_to_dict(appointment.slot),
        'patient': {
            'id':         appointment.patient.user.id,
            'first_name': appointment.patient.user.first_name,
            'last_name':  appointment.patient.user.last_name,
            'email':      appointment.patient.user.email,
        },
        'psychologist': {
            'id':         appointment.slot.psychologist.user.id,
            'first_name': appointment.slot.psychologist.user.first_name,
            'last_name':  appointment.slot.psychologist.user.last_name,
            'email':      appointment.slot.psychologist.user.email,
        },
        'patient_notes': appointment.patient_notes,
        'meet_link':     appointment.meet_link,
        'created_at':    appointment.created_at.isoformat(),
        'updated_at':    appointment.updated_at.isoformat(),
    }
    if for_role == 'psychologist':
        data['private_notes'] = appointment.private_notes
    if patient_credits is not None:
        data['patient_credits'] = patient_credits
    return data


# ─── Slot views ───────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def slots_list(request):
    """
    GET  /api/appointments/slots/  — psychologist's own non-deleted slots
    POST /api/appointments/slots/  — create slots
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        if user.role != 'psychologist':
            return JsonResponse({'error': 'Only psychologists can view their slots'}, status=403)
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        slots = AvailableSlot.objects.filter(
            psychologist=profile,
        ).exclude(status=AvailableSlot.SLOT_DELETED).prefetch_related('appointments')

        return JsonResponse({'slots': [slot_to_dict(s) for s in slots]})

    # ── POST ─────────────────────────────────────────────────────────────────
    if request.method == 'POST':
        if user.role != 'psychologist':
            return JsonResponse({'error': 'Only psychologists can create slots'}, status=403)
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        start_times = payload.get('start_times')
        if not isinstance(start_times, list) or not start_times:
            return JsonResponse({'error': 'start_times must be a non-empty list'}, status=400)

        created, errors = [], []
        for raw in start_times:
            dt = parse_datetime(raw)
            if dt is None:
                errors.append(f'Invalid datetime: {raw}')
                continue
            slot = AvailableSlot.objects.create(
                psychologist     = profile,
                start_time       = dt,
                duration_minutes = profile.session_duration_minutes,
                status           = AvailableSlot.SLOT_OPEN,
            )
            created.append(slot_to_dict(slot))

        return JsonResponse({'created': created, 'errors': errors}, status=201)


@csrf_exempt
@require_http_methods(['DELETE'])
def slot_detail(request, slot_id):
    """
    DELETE /api/appointments/slots/<id>/

    Rules:
      - Only 'open' slots can be deleted (not 'confirmed').
      - If the slot has pending_request appointments, they are all
        rejected and credits refunded before soft-deleting.
      - Sets status='deleted' (soft delete — kept for history).
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can delete slots'}, status=403)

    try:
        slot = AvailableSlot.objects.prefetch_related('appointments').get(
            id=slot_id, psychologist=user.psychologist_profile
        )
    except AvailableSlot.DoesNotExist:
        return JsonResponse({'error': 'Slot not found'}, status=404)

    if slot.status == AvailableSlot.SLOT_CONFIRMED:
        return JsonResponse(
            {'error': 'Cancel the confirmed appointment before deleting this slot.'},
            status=409,
        )
    if slot.status == AvailableSlot.SLOT_DELETED:
        return JsonResponse({'error': 'Slot is already deleted.'}, status=409)

    with transaction.atomic():
        # Reject all pending requests and refund their credits
        for appt in slot.appointments.filter(status=Appointment.STATUS_PENDING_REQUEST):
            _refund(appt)
            appt.status = Appointment.STATUS_REJECTED
            appt.save(update_fields=['status', 'updated_at'])

        slot.status = AvailableSlot.SLOT_DELETED
        slot.save(update_fields=['status'])

    return JsonResponse({'message': 'Slot deleted.'})


@require_http_methods(['GET'])
def available_slots(request):
    """
    GET /api/appointments/slots/available/

    Patient-facing. Returns all future open slots grouped by psychologist.
    Slots with pending requests are still shown — patients don't see the
    request count or who else has requested.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'patient':
        return JsonResponse({'error': 'Only patients can browse available slots'}, status=403)

    now   = timezone.now()
    slots = (
        AvailableSlot.objects
        .filter(status=AvailableSlot.SLOT_OPEN, start_time__gt=now)
        .select_related('psychologist__user')
        .order_by('psychologist__id', 'start_time')
    )

    psychologists = {}
    for slot in slots:
        psych = slot.psychologist
        pid   = psych.user.id
        if pid not in psychologists:
            psychologists[pid] = {
                'id':                       pid,
                'first_name':               psych.user.first_name,
                'last_name':                psych.user.last_name,
                'session_price':            str(psych.session_price),
                'session_duration_minutes': psych.session_duration_minutes,
                'is_verified':              psych.is_verified,
                'slots':                    [],
            }
        # Minimal slot dict for patients — no pending_request_count
        psychologists[pid]['slots'].append({
            'id':               slot.id,
            'start_time':       slot.start_time.isoformat(),
            'duration_minutes': slot.duration_minutes,
        })

    return JsonResponse({'psychologists': list(psychologists.values())})


# ─── Appointment views ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def appointments_list(request):
    """
    GET  /api/appointments/  — fetch appointments for the authenticated user
    POST /api/appointments/  — patient requests a slot
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs_kwargs = dict(select_related=['slot__psychologist__user', 'patient__user'])

        if user.role == 'patient':
            try:
                profile = user.patient_profile
            except PatientProfile.DoesNotExist:
                return JsonResponse({'error': 'Patient profile not found'}, status=404)
            appts = Appointment.objects.filter(patient=profile).select_related(
                'slot__psychologist__user', 'patient__user'
            )
            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'patient') for a in appts]
            })

        if user.role == 'psychologist':
            try:
                profile = user.psychologist_profile
            except PsychologistProfile.DoesNotExist:
                return JsonResponse({'error': 'Psychologist profile not found'}, status=404)
            appts = Appointment.objects.filter(
                slot__psychologist=profile
            ).select_related('slot__psychologist__user', 'patient__user')
            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'psychologist') for a in appts]
            })

        return JsonResponse({'error': 'Invalid role'}, status=403)

    # ── POST — patient requests a slot ────────────────────────────────────────
    if request.method == 'POST':
        if user.role != 'patient':
            return JsonResponse({'error': 'Only patients can request appointments'}, status=403)

        try:
            patient_profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({'error': 'Patient profile not found'}, status=404)

        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        slot_id = payload.get('slot_id')
        if not slot_id:
            return JsonResponse({'error': 'slot_id is required'}, status=400)

        try:
            slot = AvailableSlot.objects.get(id=slot_id)
        except AvailableSlot.DoesNotExist:
            return JsonResponse({'error': 'Slot not found'}, status=404)

        if slot.status != AvailableSlot.SLOT_OPEN:
            return JsonResponse({'error': 'This slot is no longer available.'}, status=409)

        cost = credit_cost(slot.duration_minutes)
        if patient_profile.credits < cost:
            return JsonResponse({
                'error':             'Insufficient credits',
                'credits_required':  cost,
                'credits_available': patient_profile.credits,
            }, status=402)

        # Guard: no double-requesting the same slot
        if Appointment.objects.filter(
            slot=slot,
            patient=patient_profile,
            status__in=[Appointment.STATUS_PENDING_REQUEST, Appointment.STATUS_CONFIRMED],
        ).exists():
            return JsonResponse(
                {'error': 'You already have an active request for this slot.'},
                status=409,
            )

        with transaction.atomic():
            patient_profile.credits -= cost
            patient_profile.save(update_fields=['credits'])

            appt = Appointment.objects.create(
                slot    = slot,
                patient = patient_profile,
                status  = Appointment.STATUS_PENDING_REQUEST,
            )
            # Slot status stays OPEN — multiple pending requests are allowed

        return JsonResponse(
            appointment_to_dict(appt, 'patient', patient_credits=patient_profile.credits),
            status=201,
        )


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    """
    PATCH /api/appointments/<id>/confirm/

    Psychologist confirms one pending_request.
    All OTHER pending_request appointments on the same slot are rejected
    and their credits refunded. Slot moves to 'confirmed'.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can confirm appointments'}, status=403)

    try:
        appt = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            slot__psychologist=user.psychologist_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appt.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Cannot confirm an appointment with status: {appt.status}'},
            status=409,
        )

    with transaction.atomic():
        appt.status = Appointment.STATUS_CONFIRMED
        appt.save(update_fields=['status', 'updated_at'])

        # Reject all other pending requests on this slot
        others = appt.slot.appointments.filter(
            status=Appointment.STATUS_PENDING_REQUEST,
        ).exclude(id=appt.id).select_related('patient')

        for other in others:
            _refund(other)
            other.status = Appointment.STATUS_REJECTED
            other.save(update_fields=['status', 'updated_at'])

        appt.slot.status = AvailableSlot.SLOT_CONFIRMED
        appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, 'psychologist'))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_reject(request, appointment_id):
    """
    PATCH /api/appointments/<id>/reject/

    Psychologist rejects one specific pending_request without confirming
    anyone else. Credits are refunded to that patient. Slot stays open
    (or reopens if it was somehow confirmed — guard prevents that case).
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can reject appointment requests'}, status=403)

    try:
        appt = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            slot__psychologist=user.psychologist_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appt.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Only pending requests can be rejected (current status: {appt.status})'},
            status=409,
        )

    with transaction.atomic():
        _refund(appt)
        appt.status = Appointment.STATUS_REJECTED
        appt.save(update_fields=['status', 'updated_at'])

        # If no more pending requests remain AND slot was somehow not open, reopen it
        if not _slot_has_active_requests(appt.slot):
            if appt.slot.status != AvailableSlot.SLOT_OPEN:
                appt.slot.status = AvailableSlot.SLOT_OPEN
                appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, 'psychologist'))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_withdraw(request, appointment_id):
    """
    PATCH /api/appointments/<id>/withdraw/

    Patient withdraws their own pending request before the psychologist
    acts. Status → 'withdrawn'. Credits refunded. Slot unaffected.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'patient':
        return JsonResponse({'error': 'Only patients can withdraw their requests'}, status=403)

    try:
        appt = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            patient=user.patient_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appt.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Only pending requests can be withdrawn (current status: {appt.status})'},
            status=409,
        )

    with transaction.atomic():
        new_balance = _refund(appt)
        appt.status = Appointment.STATUS_WITHDRAWN
        appt.save(update_fields=['status', 'updated_at'])
        # Slot status intentionally unchanged — still open

    return JsonResponse(
        appointment_to_dict(appt, 'patient', patient_credits=new_balance)
    )


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    """
    PATCH /api/appointments/<id>/cancel/

    Either role can cancel a CONFIRMED appointment (not pending — use
    withdraw/reject for that).

    Behaviour:
      confirmed   → cancelled; credits refunded to patient
      in_progress → cancelled; NO credit refund (session already started)
      done / cancelled / rejected / withdrawn → 409

    When cancelled, slot reverts to 'open'.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if user.role == 'patient':
        try:
            appt = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id,
                patient=user.patient_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)

    elif user.role == 'psychologist':
        try:
            appt = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id,
                slot__psychologist=user.psychologist_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)

    else:
        return JsonResponse({'error': 'Invalid role'}, status=403)

    effective = compute_status(appt)

    TERMINAL = {'done', 'cancelled', 'rejected', 'withdrawn'}
    if effective in TERMINAL:
        return JsonResponse({'error': f'Appointment is already {effective}.'}, status=409)

    if effective == 'pending_request':
        return JsonResponse(
            {'error': 'Use the withdraw endpoint to cancel a pending request.'},
            status=409,
        )

    # effective is 'confirmed' or 'in_progress'
    new_balance = None
    with transaction.atomic():
        if effective == 'confirmed':
            new_balance = _refund(appt)
        # in_progress: no refund

        appt.status = Appointment.STATUS_CANCELLED
        appt.save(update_fields=['status', 'updated_at'])

        appt.slot.status = AvailableSlot.SLOT_OPEN
        appt.slot.save(update_fields=['status'])

    return JsonResponse(
        appointment_to_dict(appt, user.role, patient_credits=new_balance)
    )


# ─── Appointment history ──────────────────────────────────────────────────────

@require_http_methods(['GET'])
def appointment_history(request):
    """
    GET /api/appointments/history/?with=<user_id>

    Returns up to 3 past 'done' appointments between the authenticated user
    and the given counterpart. Used by AppointmentDetail's PreviousSessions.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    with_user_id = request.GET.get('with')
    if not with_user_id:
        return JsonResponse({'error': 'Missing ?with=<user_id> parameter'}, status=400)

    now = timezone.now()

    if user.role == 'patient':
        try:
            patient_profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({'error': 'Patient profile not found'}, status=404)
        try:
            psych_user    = get_user_model().objects.get(id=with_user_id, role='psychologist')
            psych_profile = psych_user.psychologist_profile
        except Exception:
            return JsonResponse({'error': 'Psychologist not found'}, status=404)

        candidates = (
            Appointment.objects
            .filter(
                patient=patient_profile,
                slot__psychologist=psych_profile,
                status=Appointment.STATUS_CONFIRMED,
            )
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')
        )
        done = [
            a for a in candidates
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        return JsonResponse({'history': [appointment_to_dict(a, 'patient') for a in done]})

    if user.role == 'psychologist':
        try:
            psych_profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)
        try:
            patient_user    = get_user_model().objects.get(id=with_user_id, role='patient')
            patient_profile = patient_user.patient_profile
        except Exception:
            return JsonResponse({'error': 'Patient not found'}, status=404)

        candidates = (
            Appointment.objects
            .filter(
                patient=patient_profile,
                slot__psychologist=psych_profile,
                status=Appointment.STATUS_CONFIRMED,
            )
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')
        )
        done = [
            a for a in candidates
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        return JsonResponse({'history': [appointment_to_dict(a, 'psychologist') for a in done]})

    return JsonResponse({'error': 'Invalid role'}, status=403)

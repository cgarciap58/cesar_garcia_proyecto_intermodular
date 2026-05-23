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
    return profile.credits


# ─── Status computation ───────────────────────────────────────────────────────

def compute_status(appointment):
    """
    Effective display status. 'confirmed' is upgraded to 'in_progress' or
    'done' based on wall-clock time. All other stored statuses pass through.
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
    return slot.appointments.filter(status=Appointment.STATUS_PENDING_REQUEST).exists()


# ─── Serialisers ─────────────────────────────────────────────────────────────

def slot_to_dict(slot):
    pending_count = slot.appointments.filter(
        status=Appointment.STATUS_PENDING_REQUEST
    ).count()
    return {
        'id':                    slot.id,
        'start_time':            slot.start_time.isoformat(),
        'duration_minutes':      slot.duration_minutes,
        'status':                slot.status,
        'pending_request_count': pending_count,
        'created_at':            slot.created_at.isoformat(),
    }


def appointment_to_dict(appointment, for_role, patient_credits=None):
    """
    patient_credits – when provided, included so the frontend can update
    AuthContext without a second /api/auth/me/ round-trip.
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
    POST /api/appointments/slots/  — create one or more slots

    POST overlap rule: a new slot [start, start+duration) may not overlap with
    any existing non-deleted slot for the same psychologist.  In a batch
    request, overlapping slots are silently skipped (added to `errors`) while
    the rest are created normally.
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

        duration = profile.session_duration_minutes
        created, errors = [], []

        # Load all existing non-deleted slots once; we extend this list as we
        # create new ones so intra-batch overlaps are also caught.
        existing = list(
            AvailableSlot.objects.filter(
                psychologist=profile,
            ).exclude(status=AvailableSlot.SLOT_DELETED)
            .values_list('start_time', 'duration_minutes')
        )

        for raw in start_times:
            dt = parse_datetime(raw)
            if dt is None:
                errors.append(f'Invalid datetime: {raw}')
                continue

            # Interval: [dt, dt + duration)
            # Overlaps existing [ex_start, ex_start + ex_dur) when:
            #   dt < ex_start + ex_dur  AND  dt + duration > ex_start
            new_end = dt + timedelta(minutes=duration)
            overlap = any(
                dt < (ex_start + timedelta(minutes=ex_dur)) and new_end > ex_start
                for ex_start, ex_dur in existing
            )
            if overlap:
                errors.append(f'Overlap skipped: {raw}')
                continue

            slot = AvailableSlot.objects.create(
                psychologist     = profile,
                start_time       = dt,
                duration_minutes = duration,
                status           = AvailableSlot.SLOT_OPEN,
            )
            created.append(slot_to_dict(slot))
            existing.append((dt, duration))   # guard intra-batch overlaps

        return JsonResponse({'created': created, 'errors': errors}, status=201)


@csrf_exempt
@require_http_methods(['DELETE'])
def slot_detail(request, slot_id):
    """
    DELETE /api/appointments/slots/<id>/

    Only 'open' slots may be deleted (not 'confirmed').
    Any pending_request appointments are auto-rejected with credit refunds.
    Status → 'deleted' (soft delete).
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
    Pending-request count is intentionally omitted from patient view.
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
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
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

        return JsonResponse(
            appointment_to_dict(appt, 'patient', patient_credits=patient_profile.credits),
            status=201,
        )


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    """
    Psychologist confirms one pending_request.
    All OTHER pending_request appointments on the same slot are rejected
    and their credits refunded. Response includes the confirmed appointment
    AND a 'rejected_appointments' list so the frontend can update all
    sibling requests in one go.
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

    rejected_dicts = []

    with transaction.atomic():
        appt.status = Appointment.STATUS_CONFIRMED
        appt.save(update_fields=['status', 'updated_at'])

        others = appt.slot.appointments.filter(
            status=Appointment.STATUS_PENDING_REQUEST,
        ).exclude(id=appt.id).select_related('patient')

        for other in others:
            new_bal = _refund(other)
            other.status = Appointment.STATUS_REJECTED
            other.save(update_fields=['status', 'updated_at'])
            # Include patient_credits so the OTHER patient's UI can also update
            # if they happen to be polling (or we push via websockets later).
            rejected_dicts.append(
                appointment_to_dict(other, 'psychologist', patient_credits=new_bal)
            )

        appt.slot.status = AvailableSlot.SLOT_CONFIRMED
        appt.slot.save(update_fields=['status'])

    response = appointment_to_dict(appt, 'psychologist')
    response['rejected_appointments'] = rejected_dicts
    return JsonResponse(response)


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_reject(request, appointment_id):
    """
    Psychologist rejects one specific pending_request without confirming
    anyone else. Credits refunded. Slot stays open.
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
            {'error': f'Only pending requests can be rejected (current: {appt.status})'},
            status=409,
        )

    with transaction.atomic():
        new_bal = _refund(appt)
        appt.status = Appointment.STATUS_REJECTED
        appt.save(update_fields=['status', 'updated_at'])

        if not _slot_has_active_requests(appt.slot):
            if appt.slot.status != AvailableSlot.SLOT_OPEN:
                appt.slot.status = AvailableSlot.SLOT_OPEN
                appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, 'psychologist', patient_credits=new_bal))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_withdraw(request, appointment_id):
    """
    Patient withdraws their own pending_request. Credits refunded. Slot unaffected.
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
            {'error': f'Only pending requests can be withdrawn (current: {appt.status})'},
            status=409,
        )

    with transaction.atomic():
        new_balance = _refund(appt)
        appt.status = Appointment.STATUS_WITHDRAWN
        appt.save(update_fields=['status', 'updated_at'])

    return JsonResponse(appointment_to_dict(appt, 'patient', patient_credits=new_balance))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    """
    Cancel a confirmed appointment (either role).
      confirmed   → cancelled + refund
      in_progress → cancelled, no refund
      done / cancelled / rejected / withdrawn → 409
      pending_request → 409 (use withdraw/reject)
    Slot reverts to 'open'.
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

    new_balance = None
    with transaction.atomic():
        if effective == 'confirmed':
            new_balance = _refund(appt)

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
    Returns up to 3 past 'done' confirmed appointments with a given counterpart.
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
            .filter(patient=patient_profile, slot__psychologist=psych_profile,
                    status=Appointment.STATUS_CONFIRMED)
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
            .filter(patient=patient_profile, slot__psychologist=psych_profile,
                    status=Appointment.STATUS_CONFIRMED)
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')
        )
        done = [
            a for a in candidates
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        return JsonResponse({'history': [appointment_to_dict(a, 'psychologist') for a in done]})

    return JsonResponse({'error': 'Invalid role'}, status=403)

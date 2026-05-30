import json
import math
import uuid
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
    """
    Serialise a slot.  end_time is computed from start_time + duration_minutes
    and included as a convenience field — it is NOT stored in the DB.
    """
    pending_count = slot.appointments.filter(
        status=Appointment.STATUS_PENDING_REQUEST
    ).count()
    end_time = slot.start_time + timedelta(minutes=slot.duration_minutes)
    return {
        'id':                    slot.id,
        'start_time':            slot.start_time.isoformat(),
        'end_time':              end_time.isoformat(),          # computed, read-only
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
            existing.append((dt, duration))

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
    end_time is included for display convenience.
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
        end_time = slot.start_time + timedelta(minutes=slot.duration_minutes)
        psychologists[pid]['slots'].append({
            'id':               slot.id,
            'start_time':       slot.start_time.isoformat(),
            'end_time':         end_time.isoformat(),
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
            return JsonResponse({'error': 'Insufficient credits'}, status=402)

        already = Appointment.objects.filter(
            slot=slot, patient=patient_profile,
            status__in=[Appointment.STATUS_PENDING_REQUEST, Appointment.STATUS_CONFIRMED],
        ).exists()
        if already:
            return JsonResponse({'error': 'already_requested'}, status=409)

        with transaction.atomic():
            patient_profile.credits -= cost
            patient_profile.save(update_fields=['credits'])

            appt = Appointment.objects.create(
                slot=slot, patient=patient_profile,
                status=Appointment.STATUS_PENDING_REQUEST,
            )

        return JsonResponse(
            appointment_to_dict(appt, 'patient', patient_credits=patient_profile.credits),
            status=201,
        )


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    """
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
            rejected_dicts.append(
                appointment_to_dict(other, 'psychologist', patient_credits=new_bal)
            )

        appt.slot.status = AvailableSlot.SLOT_CONFIRMED
        appt.slot.save(update_fields=['status'])

    appt = maybe_attach_meet_link(appt)

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
        return JsonResponse({'error': 'Only psychologists can reject appointments'}, status=403)

    try:
        appt = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            slot__psychologist=user.psychologist_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appt.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Cannot reject an appointment with status: {appt.status}'},
            status=409,
        )

    with transaction.atomic():
        new_bal = _refund(appt)
        appt.status = Appointment.STATUS_REJECTED
        appt.save(update_fields=['status', 'updated_at'])

    return JsonResponse(appointment_to_dict(appt, 'psychologist', patient_credits=new_bal))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_withdraw(request, appointment_id):
    """Patient withdraws their own pending request. Credits refunded."""
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'patient':
        return JsonResponse({'error': 'Only patients can withdraw appointments'}, status=403)

    try:
        appt = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            patient=user.patient_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appt.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Cannot withdraw an appointment with status: {appt.status}'},
            status=409,
        )

    with transaction.atomic():
        new_bal = _refund(appt)
        appt.status = Appointment.STATUS_WITHDRAWN
        appt.save(update_fields=['status', 'updated_at'])

        if not _slot_has_active_requests(appt.slot):
            appt.slot.status = AvailableSlot.SLOT_OPEN
            appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, 'patient', patient_credits=new_bal))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    """
    Either party can cancel a confirmed appointment.
    Credits refunded only if the session has NOT started yet.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    try:
        if user.role == 'patient':
            appt = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id, patient=user.patient_profile,
            )
        elif user.role == 'psychologist':
            appt = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id, slot__psychologist=user.psychologist_profile,
            )
        else:
            return JsonResponse({'error': 'Invalid role'}, status=403)
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    effective = compute_status(appt)
    if effective not in ('confirmed', 'in_progress'):
        return JsonResponse(
            {'error': f'Cannot cancel an appointment with status: {effective}'},
            status=409,
        )

    new_bal = None
    with transaction.atomic():
        if effective != 'in_progress':
            new_bal = _refund(appt)

        appt.status = Appointment.STATUS_CANCELLED
        appt.save(update_fields=['status', 'updated_at'])

        appt.slot.status = AvailableSlot.SLOT_OPEN
        appt.slot.save(update_fields=['status'])

    return JsonResponse(
        appointment_to_dict(appt, user.role, patient_credits=new_bal)
    )


@require_http_methods(['GET'])
def appointment_history(request):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    now = timezone.now()

    if user.role == 'patient':
        try:
            profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({'error': 'Patient profile not found'}, status=404)
        candidates = (
            Appointment.objects
            .filter(patient=profile, status=Appointment.STATUS_CONFIRMED)
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
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)
        candidates = (
            Appointment.objects
            .filter(slot__psychologist=profile, status=Appointment.STATUS_CONFIRMED)
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')
        )
        done = [
            a for a in candidates
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        return JsonResponse({'history': [appointment_to_dict(a, 'psychologist') for a in done]})

    return JsonResponse({'error': 'Invalid role'}, status=403)


# ─── Link generation ──────────────────────────────────────────────────────────

def generate_meet_link():
    code = uuid.uuid4().hex
    return f"https://meet.google.com/{code[:3]}-{code[3:7]}-{code[7:10]}"

MEET_LINK_WINDOW_MINUTES = 30

def maybe_attach_meet_link(appt):
    """
    Generates and saves a meet_link if ALL conditions are met:
      - stored status is confirmed
      - no link exists yet
      - start_time is within 30 minutes (or already in progress)
    """
    if appt.status != Appointment.STATUS_CONFIRMED:
        return appt
    if appt.meet_link:
        return appt

    now = timezone.now()
    minutes_until = (appt.slot.start_time - now).total_seconds() / 60
    if minutes_until > MEET_LINK_WINDOW_MINUTES:
        return appt

    with transaction.atomic():
        locked = (
            Appointment.objects
            .select_for_update()
            .get(id=appt.id)
        )
        if locked.meet_link:
            return locked
        locked.meet_link = generate_meet_link()
        locked.save(update_fields=['meet_link', 'updated_at'])
        return locked


@require_http_methods(['GET'])
def appointment_detail(request, appointment_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    try:
        if user.role == 'patient':
            appt = Appointment.objects.select_related(
                'slot', 'patient__user', 'slot__psychologist__user'
            ).get(id=appointment_id, patient=user.patient_profile)
        elif user.role == 'psychologist':
            appt = Appointment.objects.select_related(
                'slot', 'patient__user', 'slot__psychologist__user'
            ).get(id=appointment_id, slot__psychologist=user.psychologist_profile)
        else:
            return JsonResponse({'error': 'Invalid role'}, status=403)
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    appt = maybe_attach_meet_link(appt)
    return JsonResponse(appointment_to_dict(appt, user.role))

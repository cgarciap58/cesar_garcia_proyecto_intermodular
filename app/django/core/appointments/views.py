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

# ─── Auth helper ─────────────────────────────────────────────────────────────

def require_auth(request):
    if not request.user.is_authenticated:
        return None
    return request.user


# ─── Credit helpers ───────────────────────────────────────────────────────────

def credit_cost(duration_minutes):
    """1 credit per 55 minutes, rounded up."""
    return math.ceil(duration_minutes / 55)


def refund_credits(appointment):
    """
    Add the appointment's credit cost back to the patient's balance.
    Call this whenever a pending_request or pre-in_progress confirmed
    appointment is rejected or cancelled.
    """
    cost = credit_cost(appointment.slot.duration_minutes)
    profile = appointment.patient
    profile.credits += cost
    profile.save(update_fields=['credits'])


# ─── Status computation ───────────────────────────────────────────────────────

def compute_status(appointment):
    """
    Returns the effective status for an appointment, upgrading 'confirmed'
    to 'in_progress' or 'done' based on the current time.

    Only 'confirmed' appointments are time-upgraded — all other stored
    statuses are returned as-is.
    """
    stored = appointment.status
    if stored != Appointment.STATUS_CONFIRMED:
        return stored

    now   = timezone.now()
    start = appointment.slot.start_time
    end   = start + timedelta(minutes=appointment.slot.duration_minutes)

    if now >= end:
        return 'done'
    if now >= start:
        return 'in_progress'
    return 'confirmed'


# ─── Serialisers ─────────────────────────────────────────────────────────────

def slot_to_dict(slot, include_psychologist=False):
    data = {
        'id':               slot.id,
        'start_time':       slot.start_time.isoformat(),
        'duration_minutes': slot.duration_minutes,
        'status':           slot.status,
        'created_at':       slot.created_at.isoformat(),
    }
    if include_psychologist:
        p = slot.psychologist
        data['psychologist'] = {
            'id':                  p.user.id,
            'first_name':          p.user.first_name,
            'last_name':           p.user.last_name,
            'session_price':       str(p.session_price),
            'is_verified':         p.is_verified,
            'verification_status': p.verification_status,
        }
    return data


def appointment_to_dict(appointment, for_role):
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
    return data


# ─── Slot views ───────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def slots_list(request):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if request.method == 'GET':
        if user.role != 'psychologist':
            return JsonResponse({'error': 'Only psychologists can view their slots'}, status=403)
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        slots = AvailableSlot.objects.filter(
            psychologist=profile,
        ).exclude(status=AvailableSlot.SLOT_DELETED)

        return JsonResponse({'slots': [slot_to_dict(s) for s in slots]})

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
        if not isinstance(start_times, list) or len(start_times) == 0:
            return JsonResponse({'error': 'start_times must be a non-empty list'}, status=400)

        created = []
        errors  = []

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
    Soft-delete a slot.  Only 'open' slots may be deleted.
    Pending requests on the slot are auto-rejected with credit refunds.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can delete slots'}, status=403)

    try:
        slot = AvailableSlot.objects.get(id=slot_id, psychologist=user.psychologist_profile)
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
        pending = slot.appointments.filter(status=Appointment.STATUS_PENDING_REQUEST)
        for appt in pending:
            refund_credits(appt)
            appt.status = Appointment.STATUS_REJECTED
            appt.save(update_fields=['status', 'updated_at'])

        slot.status = AvailableSlot.SLOT_DELETED
        slot.save(update_fields=['status'])

    return JsonResponse({'message': 'Slot deleted.'})


@require_http_methods(['GET'])
def available_slots(request):
    """
    GET /api/appointments/slots/available/
    Returns future open slots grouped by psychologist.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'patient':
        return JsonResponse({'error': 'Only patients can browse available slots'}, status=403)

    now = timezone.now()
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
                'verification_status':      psych.verification_status,
                'slots':                    [],
            }
        psychologists[pid]['slots'].append(slot_to_dict(slot))

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

            appointments = Appointment.objects.filter(
                patient=profile,
            ).select_related('slot__psychologist__user', 'patient__user')

            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'patient') for a in appointments]
            })

        if user.role == 'psychologist':
            try:
                profile = user.psychologist_profile
            except PsychologistProfile.DoesNotExist:
                return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

            appointments = Appointment.objects.filter(
                slot__psychologist=profile,
            ).select_related('slot__psychologist__user', 'patient__user')

            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'psychologist') for a in appointments]
            })

        return JsonResponse({'error': 'Invalid role'}, status=403)

    # POST — patient requests a slot
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
            slot = AvailableSlot.objects.select_related('psychologist').get(id=slot_id)
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

        already = Appointment.objects.filter(
            slot=slot,
            patient=patient_profile,
            status__in=[Appointment.STATUS_PENDING_REQUEST, Appointment.STATUS_CONFIRMED],
        ).exists()
        if already:
            return JsonResponse(
                {'error': 'You already have an active request for this slot.'},
                status=409,
            )

        with transaction.atomic():
            patient_profile.credits -= cost
            patient_profile.save(update_fields=['credits'])

            appointment = Appointment.objects.create(
                slot    = slot,
                patient = patient_profile,
                status  = Appointment.STATUS_PENDING_REQUEST,
            )

        return JsonResponse(appointment_to_dict(appointment, 'patient'), status=201)


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can confirm appointments'}, status=403)

    try:
        appointment = Appointment.objects.select_related('slot', 'patient').get(
            id=appointment_id,
            slot__psychologist=user.psychologist_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appointment.status != Appointment.STATUS_PENDING_REQUEST:
        return JsonResponse(
            {'error': f'Cannot confirm an appointment with status: {appointment.status}'},
            status=409,
        )

    with transaction.atomic():
        appointment.status = Appointment.STATUS_CONFIRMED
        appointment.save(update_fields=['status', 'updated_at'])

        others = Appointment.objects.filter(
            slot=appointment.slot,
            status=Appointment.STATUS_PENDING_REQUEST,
        ).exclude(id=appointment.id).select_related('patient')

        for other in others:
            refund_credits(other)
            other.status = Appointment.STATUS_REJECTED
            other.save(update_fields=['status', 'updated_at'])

        appointment.slot.status = AvailableSlot.SLOT_CONFIRMED
        appointment.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appointment, 'psychologist'))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if user.role == 'patient':
        try:
            appointment = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id,
                patient=user.patient_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)

    elif user.role == 'psychologist':
        try:
            appointment = Appointment.objects.select_related('slot', 'patient').get(
                id=appointment_id,
                slot__psychologist=user.psychologist_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)
    else:
        return JsonResponse({'error': 'Invalid role'}, status=403)

    effective = compute_status(appointment)

    if effective in ('rejected', 'cancelled'):
        return JsonResponse({'error': f'Appointment is already {effective}.'}, status=409)
    if effective == 'done':
        return JsonResponse(
            {'error': 'Cannot cancel a session that has already finished.'},
            status=409,
        )

    with transaction.atomic():
        if effective == 'pending_request':
            refund_credits(appointment)
            appointment.status = Appointment.STATUS_REJECTED
            appointment.save(update_fields=['status', 'updated_at'])

        elif effective in ('confirmed', 'in_progress'):
            if effective == 'confirmed':
                refund_credits(appointment)

            appointment.status = Appointment.STATUS_CANCELLED
            appointment.save(update_fields=['status', 'updated_at'])

            appointment.slot.status = AvailableSlot.SLOT_OPEN
            appointment.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appointment, user.role))


@require_http_methods(['GET'])
def appointment_history(request):
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
        except (get_user_model().DoesNotExist, PsychologistProfile.DoesNotExist):
            return JsonResponse({'error': 'Psychologist not found'}, status=404)

        appointments = (
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
            a for a in appointments
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        role = 'patient'

    elif user.role == 'psychologist':
        try:
            psych_profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        try:
            patient_user    = get_user_model().objects.get(id=with_user_id, role='patient')
            patient_profile = patient_user.patient_profile
        except (get_user_model().DoesNotExist, PatientProfile.DoesNotExist):
            return JsonResponse({'error': 'Patient not found'}, status=404)

        appointments = (
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
            a for a in appointments
            if now >= a.slot.start_time + timedelta(minutes=a.slot.duration_minutes)
        ][:3]
        role = 'psychologist'

    else:
        return JsonResponse({'error': 'Invalid role'}, status=403)

    return JsonResponse({'history': [appointment_to_dict(a, role) for a in done]})

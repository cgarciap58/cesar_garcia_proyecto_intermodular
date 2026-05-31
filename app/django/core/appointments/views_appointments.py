"""
appointments/views_appointments.py
───────────────────────────────────
Appointment read/create endpoints:
  GET/POST /api/appointments/           → appointments_list
  GET      /api/appointments/<id>/      → appointment_detail
  GET      /api/appointments/history/   → appointment_history
"""

import json

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AvailableSlot, Appointment
from core.accounts.models import PatientProfile, PsychologistProfile
from .utils import (
    appointment_to_dict,
    compute_status,
    credit_cost,
    maybe_attach_meet_link,
    require_auth,
)


# ── appointments_list ─────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def appointments_list(request):
    """
    GET  — returns the caller's own appointments (role-aware).
    POST — patient requests a slot (debits credits).
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if request.method == 'GET':
        return _get_appointments(request, user)

    return _create_appointment(request, user)


def _get_appointments(request, user):
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


def _create_appointment(request, user):
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
            slot=slot,
            patient=patient_profile,
            status=Appointment.STATUS_PENDING_REQUEST,
        )

    return JsonResponse(
        appointment_to_dict(appt, 'patient', patient_credits=patient_profile.credits),
        status=201,
    )


# ── appointment_detail ────────────────────────────────────────────────────────

@require_http_methods(['GET'])
def appointment_detail(request, appointment_id):
    """
    GET /api/appointments/<id>/

    Returns the appointment for the owning patient or psychologist.
    Triggers meet_link generation if within the 30-minute window.
    """
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


# ── appointment_history ───────────────────────────────────────────────────────

@require_http_methods(['GET'])
def appointment_history(request):
    """
    GET /api/appointments/history/?with=<userId>

    Returns the last 3 'done' appointments between the caller and the user
    identified by ``with``.  Used to show previous-sessions summaries in the
    detail panel.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    now = timezone.now()

    if user.role == 'patient':
        try:
            profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({'error': 'Patient profile not found'}, status=404)

        with_user_id = request.GET.get('with')
        if not with_user_id:
            return JsonResponse({'error': 'with parameter is required'}, status=400)

        appts = (
            Appointment.objects
            .filter(
                patient=profile,
                slot__psychologist__user__id=with_user_id,
                status=Appointment.STATUS_CONFIRMED,
                slot__start_time__lt=now,
            )
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')[:3]
        )
        return JsonResponse({
            'history': [appointment_to_dict(a, 'patient') for a in appts]
        })

    if user.role == 'psychologist':
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        with_user_id = request.GET.get('with')
        if not with_user_id:
            return JsonResponse({'error': 'with parameter is required'}, status=400)

        appts = (
            Appointment.objects
            .filter(
                slot__psychologist=profile,
                patient__user__id=with_user_id,
                status=Appointment.STATUS_CONFIRMED,
                slot__start_time__lt=now,
            )
            .select_related('slot__psychologist__user', 'patient__user')
            .order_by('-slot__start_time')[:3]
        )
        return JsonResponse({
            'history': [appointment_to_dict(a, 'psychologist') for a in appts]
        })

    return JsonResponse({'error': 'Invalid role'}, status=403)

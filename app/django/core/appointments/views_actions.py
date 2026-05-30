"""
appointments/views_actions.py
──────────────────────────────
Appointment state-transition endpoints:
  PATCH /api/appointments/<id>/confirm/  → appointment_confirm
  PATCH /api/appointments/<id>/reject/   → appointment_reject
  PATCH /api/appointments/<id>/withdraw/ → appointment_withdraw
  PATCH /api/appointments/<id>/cancel/   → appointment_cancel
"""

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AvailableSlot, Appointment
from .utils import (
    appointment_to_dict,
    compute_status,
    maybe_attach_meet_link,
    refund,
    require_auth,
    slot_has_active_requests,
)


# ── appointment_confirm ───────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    """
    Psychologist confirms one pending_request.

    All OTHER pending_request appointments on the same slot are auto-rejected
    and their credits refunded.  Response includes the confirmed appointment
    AND a ``rejected_appointments`` list so the frontend can update all
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

        siblings = (
            appt.slot.appointments
            .filter(status=Appointment.STATUS_PENDING_REQUEST)
            .exclude(id=appt.id)
            .select_related('patient')
        )
        for sibling in siblings:
            new_bal = refund(sibling)
            sibling.status = Appointment.STATUS_REJECTED
            sibling.save(update_fields=['status', 'updated_at'])
            rejected_dicts.append(
                appointment_to_dict(sibling, 'psychologist', patient_credits=new_bal)
            )

        appt.slot.status = AvailableSlot.SLOT_CONFIRMED
        appt.slot.save(update_fields=['status'])

    appt = maybe_attach_meet_link(appt)

    response = appointment_to_dict(appt, 'psychologist')
    response['rejected_appointments'] = rejected_dicts
    return JsonResponse(response)


# ── appointment_reject ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_reject(request, appointment_id):
    """
    Psychologist rejects one specific pending_request without confirming
    anyone else.  Credits are refunded.  Slot stays open.
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
        new_bal = refund(appt)
        appt.status = Appointment.STATUS_REJECTED
        appt.save(update_fields=['status', 'updated_at'])

    return JsonResponse(appointment_to_dict(appt, 'psychologist', patient_credits=new_bal))


# ── appointment_withdraw ──────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_withdraw(request, appointment_id):
    """
    Patient withdraws their own pending request before the psychologist acts.
    Credits are refunded.  If no other pending requests remain the slot reverts
    to 'open'.
    """
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
        new_bal = refund(appt)
        appt.status = Appointment.STATUS_WITHDRAWN
        appt.save(update_fields=['status', 'updated_at'])

        if not slot_has_active_requests(appt.slot):
            appt.slot.status = AvailableSlot.SLOT_OPEN
            appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, 'patient', patient_credits=new_bal))


# ── appointment_cancel ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    """
    Either party can cancel a confirmed appointment.
    Credits are refunded only if the session has NOT started yet
    (i.e. effective status is 'confirmed', not 'in_progress').
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
            new_bal = refund(appt)

        appt.status = Appointment.STATUS_CANCELLED
        appt.save(update_fields=['status', 'updated_at'])

        appt.slot.status = AvailableSlot.SLOT_OPEN
        appt.slot.save(update_fields=['status'])

    return JsonResponse(appointment_to_dict(appt, user.role, patient_credits=new_bal))

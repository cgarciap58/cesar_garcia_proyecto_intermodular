"""
appointments/views_slots.py
───────────────────────────
Slot management endpoints:
  GET/POST /api/appointments/slots/           → slots_list
  DELETE   /api/appointments/slots/<id>/      → slot_detail
  GET      /api/appointments/slots/available/ → available_slots
"""

import json
from datetime import timedelta

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AvailableSlot, Appointment
from .utils import refund, require_auth, slot_to_dict
from core.accounts.utils import picture_url


# ── slots_list ────────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def slots_list(request):
    """
    GET  — psychologist's own non-deleted slots.
    POST — create one or more slots (batch).

    Overlap rule: a new slot [start, start+duration) may not overlap with any
    existing non-deleted slot for the same psychologist.  In a batch request,
    overlapping slots are silently skipped (added to ``errors``) while the
    rest are created normally.

    Validation rule: only psychologists with verification_status == 'approved'
    may create slots.  Un-validated psychologists receive a 403.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can manage slots'}, status=403)

    try:
        profile = user.psychologist_profile
    except Exception:
        return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

    # ── GET ───────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        slots = (
            AvailableSlot.objects
            .filter(psychologist=profile)
            .exclude(status=AvailableSlot.SLOT_DELETED)
            .prefetch_related('appointments')
            .order_by('start_time')
        )
        return JsonResponse({'slots': [slot_to_dict(s) for s in slots]})

    # ── POST ──────────────────────────────────────────────────────────────────

    # Enforce: only validated (approved) psychologists can create slots.
    if profile.verification_status != 'approved':
        return JsonResponse(
            {'error': 'Account not validated. Submit your profile data and wait for staff approval before opening slots.'},
            status=403,
        )

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    raw_times = payload.get('start_times', [])
    if not isinstance(raw_times, list) or not raw_times:
        return JsonResponse({'error': 'start_times must be a non-empty list'}, status=400)

    duration = profile.session_duration_minutes

    # Load existing non-deleted slots for overlap detection
    existing = list(
        AvailableSlot.objects
        .filter(psychologist=profile)
        .exclude(status=AvailableSlot.SLOT_DELETED)
        .values_list('start_time', 'duration_minutes')
    )

    created = []
    errors  = []

    for raw in raw_times:
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


# ── slot_detail ───────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['DELETE'])
def slot_detail(request, slot_id):
    """
    DELETE /api/appointments/slots/<id>/

    Only 'open' slots may be deleted (not 'confirmed').
    A slot with pending appointments returns 409.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can manage slots'}, status=403)

    try:
        profile = user.psychologist_profile
    except Exception:
        return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

    try:
        slot = AvailableSlot.objects.get(id=slot_id, psychologist=profile)
    except AvailableSlot.DoesNotExist:
        return JsonResponse({'error': 'Slot not found'}, status=404)

    if slot.status == AvailableSlot.SLOT_CONFIRMED:
        return JsonResponse({'error': 'Cannot delete a confirmed slot. Cancel the appointment first.'}, status=409)

    if slot.status == AvailableSlot.SLOT_DELETED:
        return JsonResponse({'error': 'Slot already deleted'}, status=409)

    # Check for pending appointments
    pending = slot.appointments.filter(status=Appointment.STATUS_PENDING_REQUEST).count()
    if pending > 0:
        return JsonResponse(
            {'error': f'Cannot delete slot with {pending} pending request(s).'},
            status=409,
        )

    slot.status = AvailableSlot.SLOT_DELETED
    slot.save()
    return JsonResponse({'deleted': True})


# ── available_slots ───────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET'])
def available_slots(request):
    """
    GET /api/appointments/slots/available/

    Returns open slots grouped by psychologist. Only accessible to patients.
    Excludes slots in the past.
    """
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    if user.role != 'patient':
        return JsonResponse({'error': 'Only patients can view available slots'}, status=403)

    now = timezone.now()
    slots = (
        AvailableSlot.objects
        .filter(status=AvailableSlot.SLOT_OPEN, start_time__gte=now)
        .select_related('psychologist__user')
        .order_by('psychologist_id', 'start_time')
    )

    # Group by psychologist
    grouped = {}
    for slot in slots:
        psych = slot.psychologist
        pid   = psych.user.id
        if pid not in grouped:
            grouped[pid] = {
                'id':               psych.user.id,
                'first_name':       psych.user.first_name,
                'last_name':        psych.user.last_name,
                'profile_picture':  picture_url(psych.user),
                'session_duration_minutes': psych.session_duration_minutes,
                'session_price':    str(psych.session_price),
                'slots':            [],
            }
        grouped[pid]['slots'].append(slot_to_dict(slot))

    return JsonResponse({'psychologists': list(grouped.values())})

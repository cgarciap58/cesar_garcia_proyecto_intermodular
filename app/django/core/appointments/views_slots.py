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
            refund(appt)
            appt.status = Appointment.STATUS_REJECTED
            appt.save(update_fields=['status', 'updated_at'])

        slot.status = AvailableSlot.SLOT_DELETED
        slot.save(update_fields=['status'])

    return JsonResponse({'message': 'Slot deleted.'})


# ── available_slots ───────────────────────────────────────────────────────────

@require_http_methods(['GET'])
def available_slots(request):
    """
    GET /api/appointments/slots/available/

    Patient-facing.  Returns all future open slots grouped by psychologist.
    Pending-request count is intentionally omitted from the patient view.
    ``end_time`` is included for display convenience.
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

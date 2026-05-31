"""
appointments/utils.py
─────────────────────
Shared helpers for all appointments sub-modules:
  • require_auth          — pull authenticated user from request
  • credit_cost / _refund — credit arithmetic
  • compute_status        — effective display status
  • slot_to_dict          — slot serializer
  • appointment_to_dict   — appointment serializer (role-aware)
  • maybe_attach_meet_link — lazy meet-link generation
"""

import math
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import AvailableSlot, Appointment
from core.accounts.utils import picture_url


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_auth(request):
    """Return the authenticated user or None."""
    return request.user if request.user.is_authenticated else None


# ── Credit helpers ────────────────────────────────────────────────────────────

def credit_cost(duration_minutes: int) -> int:
    """1 credit per 55 minutes, rounded up."""
    return math.ceil(duration_minutes / 55)


def refund(appointment) -> int:
    """
    Add credits back to the patient.
    Must be called inside an atomic block.
    Returns the new credit balance.
    """
    cost    = credit_cost(appointment.slot.duration_minutes)
    profile = appointment.patient
    profile.credits += cost
    profile.save(update_fields=['credits'])
    return profile.credits


# ── Status computation ────────────────────────────────────────────────────────

def compute_status(appointment) -> str:
    """
    Effective display status.
    'confirmed' is upgraded to 'in_progress' or 'done' based on wall-clock
    time.  All other stored statuses pass through unchanged.
    """
    if appointment.status != Appointment.STATUS_CONFIRMED:
        return appointment.status

    now   = timezone.now()
    start = appointment.slot.start_time
    end   = start + timedelta(minutes=appointment.slot.duration_minutes)

    if now >= end:   return 'done'
    if now >= start: return 'in_progress'
    return 'confirmed'


def slot_has_active_requests(slot) -> bool:
    return slot.appointments.filter(status=Appointment.STATUS_PENDING_REQUEST).exists()


# ── Serializers ───────────────────────────────────────────────────────────────

def slot_to_dict(slot) -> dict:
    """
    Serialize a slot.
    ``end_time`` is computed from ``start_time + duration_minutes``
    and included as a convenience field — it is NOT stored in the DB.
    """
    pending_count = slot.appointments.filter(
        status=Appointment.STATUS_PENDING_REQUEST
    ).count()
    end_time = slot.start_time + timedelta(minutes=slot.duration_minutes)
    return {
        'id':                    slot.id,
        'start_time':            slot.start_time.isoformat(),
        'end_time':              end_time.isoformat(),
        'duration_minutes':      slot.duration_minutes,
        'status':                slot.status,
        'pending_request_count': pending_count,
        'created_at':            slot.created_at.isoformat(),
    }


def appointment_to_dict(appointment, for_role: str, patient_credits=None) -> dict:
    """
    Serialize an appointment.

    ``patient_credits`` – when provided, included so the frontend can update
    AuthContext without a second /api/auth/me/ round-trip.
    ``for_role`` – 'psychologist' adds private_notes to the response.

    profile_picture for both patient and psychologist is returned as a Django
    proxy URL (/api/media/<path>) so the browser never hits S3 directly.
    """
    patient_user      = appointment.patient.user
    psychologist_user = appointment.slot.psychologist.user

    data = {
        'id':            appointment.id,
        'status':        compute_status(appointment),
        'stored_status': appointment.status,
        'slot':          slot_to_dict(appointment.slot),
        'patient': {
            'id':              patient_user.id,
            'first_name':      patient_user.first_name,
            'last_name':       patient_user.last_name,
            'email':           patient_user.email,
            'profile_picture': picture_url(patient_user),
        },
        'psychologist': {
            'id':              psychologist_user.id,
            'first_name':      psychologist_user.first_name,
            'last_name':       psychologist_user.last_name,
            'email':           psychologist_user.email,
            'profile_picture': picture_url(psychologist_user),
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


# ── Meet-link generation ──────────────────────────────────────────────────────

MEET_LINK_WINDOW_MINUTES = 30


def generate_meet_link() -> str:
    return f"https://meet.getbetter.app/{uuid.uuid4().hex[:10]}"


def maybe_attach_meet_link(appt):
    """
    Lazily generate a meet_link when:
      - stored status is confirmed
      - no link exists yet
      - start_time is within 30 minutes (or already in progress)

    Uses SELECT FOR UPDATE to prevent duplicate link generation under
    concurrent requests.
    """
    if appt.status != Appointment.STATUS_CONFIRMED or appt.meet_link:
        return appt

    now   = timezone.now()
    start = appt.slot.start_time
    end   = start + timedelta(minutes=appt.slot.duration_minutes)

    if now < start - timedelta(minutes=MEET_LINK_WINDOW_MINUTES):
        return appt
    if now >= end:
        return appt

    with transaction.atomic():
        locked = Appointment.objects.select_for_update().get(pk=appt.pk)
        if not locked.meet_link:
            locked.meet_link = generate_meet_link()
            locked.save(update_fields=['meet_link'])
        appt.meet_link = locked.meet_link

    return appt

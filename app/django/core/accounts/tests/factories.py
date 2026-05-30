"""
accounts/tests/factories.py
────────────────────────────
Lightweight test-fixture helpers shared by accounts and appointments tests.
No third-party factory library required — plain Django ORM calls.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from core.accounts.models import PatientProfile, PsychologistProfile
from core.appointments.models import AvailableSlot, Appointment

User = get_user_model()

_counter = 0


def _uid():
    global _counter
    _counter += 1
    return _counter


def make_patient(email=None, password="testpass123", first_name="Patient",
                 last_name="User", credits=10):
    n     = _uid()
    email = email or f"patient{n}@test.com"
    user  = User.objects.create_user(
        username=email, email=email,
        first_name=first_name, last_name=last_name,
        role="patient", password=password,
    )
    PatientProfile.objects.create(user=user, credits=credits)
    return user


def make_psychologist(email=None, password="testpass123", first_name="Dr",
                      last_name="Psych", session_duration_minutes=55,
                      session_price="1.0"):
    n     = _uid()
    email = email or f"psych{n}@test.com"
    user  = User.objects.create_user(
        username=email, email=email,
        first_name=first_name, last_name=last_name,
        role="psychologist", password=password,
    )
    PsychologistProfile.objects.create(
        user=user,
        license_number=f"LIC{n}",
        country_code="ES",
        session_duration_minutes=session_duration_minutes,
        session_price=session_price,
    )
    return user


def make_slot(psychologist_user, delta_hours=24, duration_minutes=55,
              status=AvailableSlot.SLOT_OPEN):
    return AvailableSlot.objects.create(
        psychologist=psychologist_user.psychologist_profile,
        start_time=timezone.now() + timedelta(hours=delta_hours),
        duration_minutes=duration_minutes,
        status=status,
    )


def make_appointment(patient_user, slot, status=Appointment.STATUS_PENDING_REQUEST):
    return Appointment.objects.create(
        patient=patient_user.patient_profile,
        slot=slot,
        status=status,
    )

"""
appointments/tests/test_slots.py
──────────────────────────────────
Tests for slot management endpoints.

Run:
  python manage.py test core.appointments.tests.test_slots
"""

import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.appointments.models import AvailableSlot, Appointment
from core.accounts.tests.factories import make_patient, make_psychologist, make_slot, make_appointment


def post_json(client, url, data):
    return client.post(url, json.dumps(data), content_type="application/json")


class SlotListTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()

    def _start_times(self, *deltas):
        return [
            (timezone.now() + timedelta(hours=h)).isoformat()
            for h in deltas
        ]

    def test_get_slots_returns_own_non_deleted(self):
        make_slot(self.psych, delta_hours=24)
        make_slot(self.psych, delta_hours=48)
        make_slot(self.psych, delta_hours=72, status=AvailableSlot.SLOT_DELETED)
        self.client.force_login(self.psych)
        r = self.client.get("/api/appointments/slots/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["slots"]), 2)

    def test_get_slots_patient_forbidden(self):
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/slots/")
        self.assertEqual(r.status_code, 403)

    def test_get_slots_unauthenticated(self):
        r = self.client.get("/api/appointments/slots/")
        self.assertEqual(r.status_code, 401)

    def test_create_slot_success(self):
        self.client.force_login(self.psych)
        r = post_json(self.client, "/api/appointments/slots/",
                      {"start_times": self._start_times(24, 48)})
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual(len(data["created"]), 2)
        self.assertEqual(len(data["errors"]), 0)

    def test_create_overlapping_slot_skipped(self):
        self.client.force_login(self.psych)
        times = self._start_times(24)
        post_json(self.client, "/api/appointments/slots/", {"start_times": times})
        r = post_json(self.client, "/api/appointments/slots/", {"start_times": times})
        data = r.json()
        self.assertEqual(len(data["created"]), 0)
        self.assertIn("Overlap skipped", data["errors"][0])

    def test_create_slot_invalid_datetime(self):
        self.client.force_login(self.psych)
        r = post_json(self.client, "/api/appointments/slots/",
                      {"start_times": ["not-a-date"]})
        self.assertIn("Invalid datetime", r.json()["errors"][0])

    def test_create_slot_patient_forbidden(self):
        self.client.force_login(self.patient)
        r = post_json(self.client, "/api/appointments/slots/",
                      {"start_times": self._start_times(24)})
        self.assertEqual(r.status_code, 403)

    def test_slot_response_includes_end_time(self):
        self.client.force_login(self.psych)
        r = post_json(self.client, "/api/appointments/slots/",
                      {"start_times": self._start_times(24)})
        slot = r.json()["created"][0]
        self.assertIn("end_time", slot)


class SlotDetailTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()

    def test_delete_open_slot(self):
        slot = make_slot(self.psych)
        self.client.force_login(self.psych)
        r = self.client.delete(f"/api/appointments/slots/{slot.id}/")
        self.assertEqual(r.status_code, 200)
        slot.refresh_from_db()
        self.assertEqual(slot.status, AvailableSlot.SLOT_DELETED)

    def test_delete_slot_with_pending_refunds_patient(self):
        slot    = make_slot(self.psych)
        patient = make_patient(credits=5)
        appt    = make_appointment(patient, slot)
        self.client.force_login(self.psych)
        self.client.delete(f"/api/appointments/slots/{slot.id}/")
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.STATUS_REJECTED)
        patient.patient_profile.refresh_from_db()
        self.assertEqual(patient.patient_profile.credits, 6)  # 5 + 1 refund

    def test_delete_confirmed_slot_blocked(self):
        slot = make_slot(self.psych, status=AvailableSlot.SLOT_CONFIRMED)
        self.client.force_login(self.psych)
        r = self.client.delete(f"/api/appointments/slots/{slot.id}/")
        self.assertEqual(r.status_code, 409)

    def test_delete_already_deleted_slot(self):
        slot = make_slot(self.psych, status=AvailableSlot.SLOT_DELETED)
        self.client.force_login(self.psych)
        r = self.client.delete(f"/api/appointments/slots/{slot.id}/")
        self.assertEqual(r.status_code, 409)

    def test_delete_other_psychologists_slot_not_found(self):
        other_psych = make_psychologist()
        slot = make_slot(other_psych)
        self.client.force_login(self.psych)
        r = self.client.delete(f"/api/appointments/slots/{slot.id}/")
        self.assertEqual(r.status_code, 404)

    def test_patient_cannot_delete_slot(self):
        slot = make_slot(self.psych)
        self.client.force_login(self.patient)
        r = self.client.delete(f"/api/appointments/slots/{slot.id}/")
        self.assertEqual(r.status_code, 403)


class AvailableSlotsTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()

    def test_available_slots_grouped_by_psychologist(self):
        make_slot(self.psych, delta_hours=24)
        make_slot(self.psych, delta_hours=48)
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/slots/available/")
        self.assertEqual(r.status_code, 200)
        psychologists = r.json()["psychologists"]
        self.assertEqual(len(psychologists), 1)
        self.assertEqual(len(psychologists[0]["slots"]), 2)

    def test_available_slots_excludes_past(self):
        make_slot(self.psych, delta_hours=-1)
        make_slot(self.psych, delta_hours=24)
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/slots/available/")
        psychologists = r.json()["psychologists"]
        self.assertEqual(len(psychologists[0]["slots"]), 1)

    def test_available_slots_excludes_non_open(self):
        make_slot(self.psych, delta_hours=24, status=AvailableSlot.SLOT_CONFIRMED)
        make_slot(self.psych, delta_hours=48)
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/slots/available/")
        self.assertEqual(len(r.json()["psychologists"][0]["slots"]), 1)

    def test_psychologist_cannot_browse_available_slots(self):
        self.client.force_login(self.psych)
        r = self.client.get("/api/appointments/slots/available/")
        self.assertEqual(r.status_code, 403)

    def test_unauthenticated_returns_401(self):
        r = self.client.get("/api/appointments/slots/available/")
        self.assertEqual(r.status_code, 401)

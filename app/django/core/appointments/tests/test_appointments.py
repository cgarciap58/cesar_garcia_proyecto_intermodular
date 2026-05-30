"""
appointments/tests/test_appointments.py
────────────────────────────────────────
Tests for appointment endpoints.

Run:
  python manage.py test core.appointments.tests.test_appointments
"""

import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.appointments.models import AvailableSlot, Appointment
from core.accounts.tests.factories import make_patient, make_psychologist, make_slot, make_appointment


def patch_json(client, url, data=None):
    return client.patch(url, json.dumps(data or {}), content_type="application/json")


class AppointmentsListTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient(credits=10)
        self.slot    = make_slot(self.psych)

    def test_patient_lists_own_appointments(self):
        make_appointment(self.patient, self.slot)
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["appointments"]), 1)

    def test_psychologist_lists_own_appointments(self):
        make_appointment(self.patient, self.slot)
        self.client.force_login(self.psych)
        r = self.client.get("/api/appointments/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["appointments"]), 1)

    def test_book_debits_credits(self):
        self.client.force_login(self.patient)
        r = self.client.post("/api/appointments/",
                             json.dumps({"slot_id": self.slot.id}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["patient_credits"], 9)  # 10 - 1

    def test_book_already_requested_returns_409(self):
        self.client.force_login(self.patient)
        payload = json.dumps({"slot_id": self.slot.id})
        self.client.post("/api/appointments/", payload, content_type="application/json")
        r = self.client.post("/api/appointments/", payload, content_type="application/json")
        self.assertEqual(r.status_code, 409)

    def test_book_insufficient_credits_returns_402(self):
        broke = make_patient(credits=0)
        self.client.force_login(broke)
        r = self.client.post("/api/appointments/",
                             json.dumps({"slot_id": self.slot.id}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 402)

    def test_book_non_open_slot_returns_409(self):
        confirmed_slot = make_slot(self.psych, status=AvailableSlot.SLOT_CONFIRMED)
        self.client.force_login(self.patient)
        r = self.client.post("/api/appointments/",
                             json.dumps({"slot_id": confirmed_slot.id}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 409)

    def test_psychologist_cannot_book(self):
        self.client.force_login(self.psych)
        r = self.client.post("/api/appointments/",
                             json.dumps({"slot_id": self.slot.id}),
                             content_type="application/json")
        self.assertEqual(r.status_code, 403)


class AppointmentDetailTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()
        self.slot    = make_slot(self.psych)
        self.appt    = make_appointment(self.patient, self.slot)

    def test_patient_fetches_own_appointment(self):
        self.client.force_login(self.patient)
        r = self.client.get(f"/api/appointments/{self.appt.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["id"], self.appt.id)

    def test_psychologist_response_includes_private_notes(self):
        self.client.force_login(self.psych)
        r = self.client.get(f"/api/appointments/{self.appt.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("private_notes", r.json())

    def test_other_patient_gets_404(self):
        other = make_patient()
        self.client.force_login(other)
        r = self.client.get(f"/api/appointments/{self.appt.id}/")
        self.assertEqual(r.status_code, 404)

    def test_unauthenticated_returns_401(self):
        r = self.client.get(f"/api/appointments/{self.appt.id}/")
        self.assertEqual(r.status_code, 401)


class ConfirmAppointmentTests(TestCase):

    def setUp(self):
        self.psych    = make_psychologist()
        self.patient1 = make_patient(credits=10)
        self.patient2 = make_patient(credits=10)
        self.slot     = make_slot(self.psych)
        self.appt1    = make_appointment(self.patient1, self.slot)
        self.appt2    = make_appointment(self.patient2, self.slot)

    def test_confirm_approves_one_and_rejects_siblings(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt1.id}/confirm/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["stored_status"], Appointment.STATUS_CONFIRMED)
        self.assertEqual(len(data["rejected_appointments"]), 1)
        self.assertEqual(data["rejected_appointments"][0]["id"], self.appt2.id)

    def test_confirm_refunds_rejected_sibling(self):
        self.client.force_login(self.psych)
        patch_json(self.client, f"/api/appointments/{self.appt1.id}/confirm/")
        self.patient2.patient_profile.refresh_from_db()
        self.assertEqual(self.patient2.patient_profile.credits, 11)

    def test_confirm_sets_slot_confirmed(self):
        self.client.force_login(self.psych)
        patch_json(self.client, f"/api/appointments/{self.appt1.id}/confirm/")
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailableSlot.SLOT_CONFIRMED)

    def test_confirm_non_pending_returns_409(self):
        self.appt1.status = Appointment.STATUS_CONFIRMED
        self.appt1.save()
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt1.id}/confirm/")
        self.assertEqual(r.status_code, 409)

    def test_patient_cannot_confirm(self):
        self.client.force_login(self.patient1)
        r = patch_json(self.client, f"/api/appointments/{self.appt1.id}/confirm/")
        self.assertEqual(r.status_code, 403)


class RejectAppointmentTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient(credits=10)
        self.slot    = make_slot(self.psych)
        self.appt    = make_appointment(self.patient, self.slot)

    def test_reject_refunds_and_leaves_slot_open(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/reject/")
        self.assertEqual(r.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.STATUS_REJECTED)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailableSlot.SLOT_OPEN)
        self.patient.patient_profile.refresh_from_db()
        self.assertEqual(self.patient.patient_profile.credits, 11)

    def test_reject_non_pending_returns_409(self):
        self.appt.status = Appointment.STATUS_CONFIRMED
        self.appt.save()
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/reject/")
        self.assertEqual(r.status_code, 409)

    def test_patient_cannot_reject(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/reject/")
        self.assertEqual(r.status_code, 403)


class WithdrawAppointmentTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient(credits=10)
        self.slot    = make_slot(self.psych)
        self.appt    = make_appointment(self.patient, self.slot)

    def test_withdraw_refunds_credits(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/withdraw/")
        self.assertEqual(r.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.STATUS_WITHDRAWN)
        self.patient.patient_profile.refresh_from_db()
        self.assertEqual(self.patient.patient_profile.credits, 11)

    def test_withdraw_last_pending_reopens_slot(self):
        self.client.force_login(self.patient)
        patch_json(self.client, f"/api/appointments/{self.appt.id}/withdraw/")
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailableSlot.SLOT_OPEN)

    def test_withdraw_non_pending_returns_409(self):
        self.appt.status = Appointment.STATUS_CONFIRMED
        self.appt.save()
        self.client.force_login(self.patient)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/withdraw/")
        self.assertEqual(r.status_code, 409)

    def test_psychologist_cannot_withdraw(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/withdraw/")
        self.assertEqual(r.status_code, 403)


class CancelAppointmentTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient(credits=10)
        self.slot    = make_slot(self.psych, delta_hours=24)
        self.appt    = make_appointment(self.patient, self.slot,
                                        status=Appointment.STATUS_CONFIRMED)

    def test_patient_can_cancel_confirmed(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.assertEqual(r.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.STATUS_CANCELLED)

    def test_cancel_confirmed_refunds_credits(self):
        self.client.force_login(self.patient)
        patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.patient.patient_profile.refresh_from_db()
        self.assertEqual(self.patient.patient_profile.credits, 11)

    def test_psychologist_can_cancel_confirmed(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.assertEqual(r.status_code, 200)

    def test_cancel_reopens_slot(self):
        self.slot.status = AvailableSlot.SLOT_CONFIRMED
        self.slot.save()
        self.client.force_login(self.patient)
        patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailableSlot.SLOT_OPEN)

    def test_cancel_in_progress_no_refund(self):
        self.slot.start_time = timezone.now() - timedelta(minutes=10)
        self.slot.save()
        self.client.force_login(self.patient)
        patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.patient.patient_profile.refresh_from_db()
        self.assertEqual(self.patient.patient_profile.credits, 10)  # unchanged

    def test_cancel_pending_returns_409(self):
        self.appt.status = Appointment.STATUS_PENDING_REQUEST
        self.appt.save()
        self.client.force_login(self.patient)
        r = patch_json(self.client, f"/api/appointments/{self.appt.id}/cancel/")
        self.assertEqual(r.status_code, 409)


class AppointmentHistoryTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()

    def _past_confirmed(self, hours_ago=48):
        slot = make_slot(self.psych, delta_hours=-hours_ago)
        slot.status = AvailableSlot.SLOT_CONFIRMED
        slot.save()
        return make_appointment(self.patient, slot, status=Appointment.STATUS_CONFIRMED)

    def test_history_returns_last_3_for_patient(self):
        for h in [24, 48, 72, 96]:
            self._past_confirmed(hours_ago=h)
        self.client.force_login(self.patient)
        r = self.client.get(f"/api/appointments/history/?with={self.psych.id}")
        self.assertEqual(r.status_code, 200)
        # Response key must be 'history' (consumed by PreviousSessions component)
        self.assertIn("history", r.json())
        self.assertEqual(len(r.json()["history"]), 3)

    def test_history_missing_with_param_returns_400(self):
        self.client.force_login(self.patient)
        r = self.client.get("/api/appointments/history/")
        self.assertEqual(r.status_code, 400)

    def test_history_unauthenticated_returns_401(self):
        r = self.client.get("/api/appointments/history/?with=1")
        self.assertEqual(r.status_code, 401)

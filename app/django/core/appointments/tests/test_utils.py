"""
appointments/tests/test_utils.py
──────────────────────────────────
Unit tests for pure appointment helpers.

Run:
  python manage.py test core.appointments.tests.test_utils
"""

from datetime import date, timedelta

from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from core.appointments.utils import compute_status, credit_cost, generate_meet_link
from core.appointments.models import Appointment, AvailableSlot
from core.accounts.tests.factories import make_patient, make_psychologist, make_slot, make_appointment


class CreditCostTests(SimpleTestCase):

    def test_55_minutes_costs_1_credit(self):
        self.assertEqual(credit_cost(55), 1)

    def test_56_minutes_costs_2_credits(self):
        self.assertEqual(credit_cost(56), 2)

    def test_110_minutes_costs_2_credits(self):
        self.assertEqual(credit_cost(110), 2)

    def test_111_minutes_costs_3_credits(self):
        self.assertEqual(credit_cost(111), 3)

    def test_30_minutes_costs_1_credit(self):
        self.assertEqual(credit_cost(30), 1)


class ComputeStatusTests(TestCase):

    def setUp(self):
        self.psych   = make_psychologist()
        self.patient = make_patient()

    def _appt_with_start(self, delta_minutes, status=Appointment.STATUS_CONFIRMED):
        slot = make_slot(self.psych, delta_hours=0)
        slot.start_time = timezone.now() + timedelta(minutes=delta_minutes)
        slot.save()
        return make_appointment(self.patient, slot, status=status)

    def test_pending_passes_through(self):
        appt = self._appt_with_start(60, status=Appointment.STATUS_PENDING_REQUEST)
        self.assertEqual(compute_status(appt), Appointment.STATUS_PENDING_REQUEST)

    def test_future_confirmed_stays_confirmed(self):
        appt = self._appt_with_start(60)
        self.assertEqual(compute_status(appt), 'confirmed')

    def test_in_progress_when_started(self):
        appt = self._appt_with_start(-10)
        self.assertEqual(compute_status(appt), 'in_progress')

    def test_done_when_past_end(self):
        appt = self._appt_with_start(-120)
        self.assertEqual(compute_status(appt), 'done')


class GenerateMeetLinkTests(SimpleTestCase):

    def test_link_starts_with_prefix(self):
        link = generate_meet_link()
        self.assertTrue(link.startswith("https://meet.getbetter.app/"))

    def test_links_are_unique(self):
        links = {generate_meet_link() for _ in range(50)}
        self.assertEqual(len(links), 50)

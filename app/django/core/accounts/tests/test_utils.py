"""
accounts/tests/test_utils.py
─────────────────────────────
Unit tests for pure account helpers (no HTTP, no DB needed for most).

Run:
  python manage.py test core.accounts.tests.test_utils
"""

from datetime import date

from django.test import SimpleTestCase

from core.accounts.utils import is_old_enough


class IsOldEnoughTests(SimpleTestCase):

    def test_exactly_16_is_allowed(self):
        today  = date.today()
        dob_16 = date(today.year - 16, today.month, today.day)
        self.assertTrue(is_old_enough(dob_16))

    def test_15_years_old_is_rejected(self):
        today  = date.today()
        dob_15 = date(today.year - 15, today.month, today.day)
        self.assertFalse(is_old_enough(dob_15))

    def test_adult_is_allowed(self):
        self.assertTrue(is_old_enough(date(1990, 1, 1)))

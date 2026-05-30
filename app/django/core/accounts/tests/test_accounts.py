"""
accounts/tests/test_accounts.py
────────────────────────────────
Tests for all accounts endpoints.

Run:
  python manage.py test core.accounts        # all accounts tests
  python manage.py test core.accounts.tests.test_accounts
"""

import json

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.accounts.models import PatientProfile, PsychologistProfile
from core.accounts.tests.factories import make_patient, make_psychologist

User = get_user_model()


def post_json(client, url, data):
    return client.post(url, json.dumps(data), content_type="application/json")


def patch_json(client, url, data):
    return client.patch(url, json.dumps(data), content_type="application/json")


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

class RegisterTests(TestCase):

    BASE = {
        "first_name":       "Ana",
        "last_name":        "García",
        "email":            "ana@test.com",
        "role":             "patient",
        "dob":              "1990-01-01",
        "password":         "secret123",
        "confirmPassword":  "secret123",
    }

    def test_register_patient_success(self):
        r = post_json(self.client, "/api/auth/register/", self.BASE)
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual(data["role"], "patient")
        self.assertIn("credits", data)

    def test_register_psychologist_success(self):
        payload = {**self.BASE, "email": "psych@test.com", "role": "psychologist",
                   "license_number": "LIC001", "country_code": "ES"}
        r = post_json(self.client, "/api/auth/register/", payload)
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual(data["role"], "psychologist")
        self.assertIn("license_number", data)

    def test_register_duplicate_email_returns_409(self):
        post_json(self.client, "/api/auth/register/", self.BASE)
        r = post_json(self.client, "/api/auth/register/", self.BASE)
        self.assertEqual(r.status_code, 409)
        self.assertIn("email", r.json()["errors"])

    def test_register_missing_fields_returns_422(self):
        r = post_json(self.client, "/api/auth/register/", {})
        self.assertEqual(r.status_code, 422)
        errors = r.json()["errors"]
        for field in ("first_name", "last_name", "email", "dob", "role", "password"):
            self.assertIn(field, errors, f"Expected error for {field}")

    def test_register_password_mismatch(self):
        r = post_json(self.client, "/api/auth/register/",
                      {**self.BASE, "confirmPassword": "wrong"})
        self.assertEqual(r.status_code, 422)
        self.assertIn("confirmPassword", r.json()["errors"])

    def test_register_too_young(self):
        r = post_json(self.client, "/api/auth/register/",
                      {**self.BASE, "dob": "2015-01-01"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["errors"]["dob"], "dob_too_young")

    def test_register_psych_missing_license(self):
        payload = {**self.BASE, "email": "psych2@test.com", "role": "psychologist",
                   "country_code": "ES"}
        r = post_json(self.client, "/api/auth/register/", payload)
        self.assertEqual(r.status_code, 422)
        self.assertIn("license_number", r.json()["errors"])

    def test_register_invalid_name_chars(self):
        r = post_json(self.client, "/api/auth/register/",
                      {**self.BASE, "first_name": "Ana123"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["errors"]["first_name"], "name_invalid")


# ─────────────────────────────────────────────────────────────────────────────
# Login / Logout
# ─────────────────────────────────────────────────────────────────────────────

class LoginLogoutTests(TestCase):

    def setUp(self):
        self.user = make_patient(email="login@test.com", password="testpass123")

    def test_login_success(self):
        r = post_json(self.client, "/api/auth/login/",
                      {"email": "login@test.com", "password": "testpass123"})
        self.assertEqual(r.status_code, 200)

    def test_login_wrong_password(self):
        r = post_json(self.client, "/api/auth/login/",
                      {"email": "login@test.com", "password": "wrong"})
        self.assertEqual(r.status_code, 401)

    def test_login_missing_fields(self):
        r = post_json(self.client, "/api/auth/login/", {})
        self.assertEqual(r.status_code, 422)

    def test_logout(self):
        self.client.force_login(self.user)
        r = self.client.post("/api/auth/logout/")
        self.assertEqual(r.status_code, 200)

    def test_get_user_authenticated(self):
        self.client.force_login(self.user)
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["email"], self.user.email)

    def test_get_user_unauthenticated(self):
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 401)


# ─────────────────────────────────────────────────────────────────────────────
# Profile update
# ─────────────────────────────────────────────────────────────────────────────

class UpdateProfileTests(TestCase):

    def setUp(self):
        self.patient = make_patient(email="patient@test.com", password="testpass123")
        self.psych   = make_psychologist(email="psych@test.com", password="testpass123")

    def test_update_first_name(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/", {"first_name": "Nuevo"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["first_name"], "Nuevo")

    def test_update_invalid_name(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/", {"first_name": "Bad123"})
        self.assertEqual(r.status_code, 422)

    def test_update_invalid_timezone(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/", {"timezone": "Mars/Olympus"})
        self.assertEqual(r.status_code, 422)

    def test_update_email_requires_current_password(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/", {"email": "new@test.com"})
        self.assertEqual(r.status_code, 422)
        self.assertIn("current_password", r.json()["errors"])

    def test_update_email_wrong_password(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/",
                       {"email": "new@test.com", "current_password": "wrongpass"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["errors"]["current_password"], "current_password_incorrect")

    def test_update_email_success(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/",
                       {"email": "new@test.com", "current_password": "testpass123"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["email"], "new@test.com")

    def test_update_psych_session_price(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, "/api/auth/profile/", {"session_price": 2.0})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["session_price"], "2.0")

    def test_update_psych_price_out_of_range(self):
        self.client.force_login(self.psych)
        r = patch_json(self.client, "/api/auth/profile/", {"session_price": 99.0})
        self.assertEqual(r.status_code, 422)

    def test_patient_cannot_set_psych_fields(self):
        self.client.force_login(self.patient)
        r = patch_json(self.client, "/api/auth/profile/", {"session_price": 2.0})
        self.assertEqual(r.status_code, 422)
        self.assertIn("role", r.json()["errors"])

    def test_update_license_resets_verification(self):
        profile = self.psych.psychologist_profile
        profile.is_verified         = True
        profile.verification_status = "verified"
        profile.save()

        self.client.force_login(self.psych)
        patch_json(self.client, "/api/auth/profile/", {"license_number": "NEW123"})

        profile.refresh_from_db()
        self.assertFalse(profile.is_verified)
        self.assertEqual(profile.verification_status, "pending")

    def test_unauthenticated_returns_401(self):
        r = patch_json(self.client, "/api/auth/profile/", {"first_name": "X"})
        self.assertEqual(r.status_code, 401)


# ─────────────────────────────────────────────────────────────────────────────
# Credits
# ─────────────────────────────────────────────────────────────────────────────

class AddCreditsTests(TestCase):

    def test_add_credits_patient(self):
        patient = make_patient(credits=5)
        self.client.force_login(patient)
        r = self.client.post("/api/auth/credits/add/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["added"], 10)
        self.assertEqual(data["credits"], 15)

    def test_add_credits_psychologist_forbidden(self):
        psych = make_psychologist()
        self.client.force_login(psych)
        r = self.client.post("/api/auth/credits/add/")
        self.assertEqual(r.status_code, 403)

    def test_add_credits_unauthenticated(self):
        r = self.client.post("/api/auth/credits/add/")
        self.assertEqual(r.status_code, 401)

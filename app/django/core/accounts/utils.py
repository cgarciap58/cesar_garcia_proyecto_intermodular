"""
accounts/utils.py
─────────────────
Shared validators, response helpers, and the _user_payload serializer.
Kept here so every accounts sub-module can import without circular deps.
"""
 
import re
from datetime import date
 
from django.core.validators import RegexValidator
from django.http import JsonResponse
 
from .models import PatientProfile, PsychologistProfile
 
 
# ── Regex validators (kept in sync with react/src/utils/validate.js) ─────────
 
NAME_RE  = re.compile(r"^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'\-]+$")
PHONE_RE = re.compile(r"^[0-9+\-]+$")
 
name_validator = RegexValidator(
    regex=NAME_RE.pattern,
    message="name_invalid",
)
 
MIN_AGE = 16
 
 
def is_old_enough(dob_date: date) -> bool:
    today  = date.today()
    cutoff = date(today.year - MIN_AGE, today.month, today.day)
    return dob_date <= cutoff
 
 
# ── Standard JSON response helpers ────────────────────────────────────────────
 
def err(code: str, status: int = 400) -> JsonResponse:
    """Return ``{"error": code}`` with the given HTTP status."""
    return JsonResponse({"error": code}, status=status)
 
 
def field_errors(errors_dict: dict, status: int = 422) -> JsonResponse:
    """Return ``{"errors": {...}}`` with the given HTTP status."""
    return JsonResponse({"errors": errors_dict}, status=status)
 
 
def picture_url(user) -> str | None:
    """
    Return the Django proxy URL for a user's profile picture, or None.
 
    We never expose the raw S3 URL to the browser — the bucket is private
    and objects would return 403.  All image requests go through Django at
    /api/media/<path>, which fetches from S3 server-side and streams the
    response back.  Nginx already forwards /api/* to Django so no extra
    routing is needed.
    """
    if not user.profile_picture:
        return None
    # user.profile_picture.name is the storage key, e.g. "profiles/7.png"
    return f"/api/media/{user.profile_picture.name}"
 
 
# ── User serializer ───────────────────────────────────────────────────────────
 
def user_payload(user) -> dict:
    """
    Build the canonical user dict returned by /api/auth/me/ and all auth
    mutations.  Role-specific fields (credits, psychologist settings) are
    appended when the corresponding profile exists.
 
    ``is_staff`` is included so the frontend can gate admin-only UI (e.g. the
    /bugs dispatcher page) without a separate request.
    """
    data = {
        'id':              user.id,
        'email':           user.email,
        'username':        user.username,
        'first_name':      user.first_name,
        'last_name':       user.last_name,
        'role':            user.role,
        'is_staff':        user.is_staff,
        'dob':             user.dob.isoformat() if user.dob else None,
        'city':            user.city,
        'phone_number':    user.phone_number,
        'timezone':        user.timezone,
        'profile_picture': picture_url(user),
    }
 
    if user.role == 'patient':
        try:
            p = user.patient_profile
            data['credits'] = p.credits
        except PatientProfile.DoesNotExist:
            pass
 
    elif user.role == 'psychologist':
        try:
            p = user.psychologist_profile
            data['session_duration_minutes'] = p.session_duration_minutes
            data['session_price']            = str(p.session_price)
            data['license_number']           = p.license_number
            data['country_code']             = p.country_code
            data['is_verified']              = p.is_verified
            data['verification_status']      = p.verification_status
        except PsychologistProfile.DoesNotExist:
            pass
 
    return data
 
 
# ── Allowed timezones ─────────────────────────────────────────────────────────
 
ALLOWED_TIMEZONES = {
    "UTC",
    "Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Europe/Rome", "Europe/Amsterdam", "Europe/Lisbon", "Europe/Warsaw",
    "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "America/Toronto", "America/Vancouver",
    "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Mexico_City",
    "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Kolkata",
    "Asia/Dubai", "Asia/Singapore",
    "Australia/Sydney", "Australia/Melbourne",
    "Pacific/Auckland",
    "Africa/Cairo", "Africa/Johannesburg",
}

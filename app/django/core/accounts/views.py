import json
import re

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.validators import RegexValidator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse

from .models import PatientProfile, PsychologistProfile


# ---------------------------------------------------------------------------
# Canonical validators — kept in sync with react/src/utils/validate.js
# ---------------------------------------------------------------------------

# Letters (a-z, A-Z, Spanish accented, ñ/Ñ), hyphen, space, apostrophe
NAME_RE = re.compile(r"^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'\-]+$")

# Digits, +, -
PHONE_RE = re.compile(r"^[0-9+\-]+$")

name_validator = RegexValidator(
    regex=NAME_RE.pattern,
    message="name_invalid",          # machine-readable code, translated on the frontend
)


def _err(code, status=400):
    """Return a single-error JSON response using a machine-readable code."""
    return JsonResponse({"error": code}, status=status)


def _field_errors(errors_dict, status=422):
    """
    Return a structured multi-field error response.
    Shape: { "errors": { "field_name": "error_code", ... } }
    The frontend maps each code through i18n.
    """
    return JsonResponse({"errors": errors_dict}, status=status)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_payload(user):
    """
    Shared dict returned by /api/auth/me/ and after login/register/profile update.
    Always returns the freshest data.
    """
    data = {
        'id':              user.id,
        'email':           user.email,
        'username':        user.username,
        'first_name':      user.first_name,
        'last_name':       user.last_name,
        'role':            user.role,
        'dob':             user.dob.isoformat() if user.dob else None,
        'city':            user.city,
        'phone_number':    user.phone_number,
        'timezone':        user.timezone,
        'profile_picture': user.profile_picture.url if user.profile_picture else None,
    }

    if user.role == 'patient':
        try:
            p = user.patient_profile
            data['credits']  = p.credits
            data['concerns'] = p.concerns
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


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _err("invalid_json")

    first_name       = (payload.get("first_name")      or "").strip()
    last_name        = (payload.get("last_name")        or "").strip()
    email            = (payload.get("email")            or "").strip().lower()
    role             =  payload.get("role")
    password         =  payload.get("password")         or ""
    confirm_password =  payload.get("confirmPassword")  or ""

    # ── Collect all field-level errors up-front ─────────────────────────────
    errors = {}

    if not first_name:
        errors["first_name"] = "required"
    elif not NAME_RE.match(first_name):
        errors["first_name"] = "name_invalid"

    if not last_name:
        errors["last_name"] = "required"
    elif not NAME_RE.match(last_name):
        errors["last_name"] = "name_invalid"

    if not email:
        errors["email"] = "required"

    if role not in {"patient", "psychologist"}:
        errors["role"] = "invalid_role"

    if not password:
        errors["password"] = "required"
    elif len(password) < 8:
        errors["password"] = "password_too_short"

    if not confirm_password:
        errors["confirmPassword"] = "required"
    elif confirm_password != password and "password" not in errors:
        errors["confirmPassword"] = "passwords_mismatch"

    if errors:
        return _field_errors(errors)

    # ── Cross-field checks ───────────────────────────────────────────────────
    User = get_user_model()
    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return _field_errors({"email": "email_already_exists"}, status=409)

    if role == "psychologist":
        license_number = (payload.get("license_number") or "").strip()
        country_code   = (payload.get("country_code")   or "").strip()
        psych_errors = {}
        if not license_number:
            psych_errors["license_number"] = "required"
        if not country_code:
            psych_errors["country_code"] = "required"
        if psych_errors:
            return _field_errors(psych_errors)

    # ── Create user ──────────────────────────────────────────────────────────
    user = User.objects.create_user(
        username=email,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=role,
        password=password,
    )

    if role == "psychologist":
        PsychologistProfile.objects.create(
            user=user,
            license_number=(payload.get("license_number") or "").strip(),
            country_code=(payload.get("country_code") or "").strip(),
        )
    elif role == "patient":
        PatientProfile.objects.create(
            user=user,
            concerns=(payload.get("concerns") or "").strip(),
        )

    login(request, user)
    return JsonResponse(_user_payload(user), status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _err("invalid_json")

    email    = (payload.get("email")    or "").strip().lower()
    password =  payload.get("password") or ""

    errors = {}
    if not email:
        errors["email"] = "required"
    if not password:
        errors["password"] = "required"
    if errors:
        return _field_errors(errors)

    user = authenticate(request, username=email, password=password)
    if user is None:
        return _field_errors({"form": "invalid_credentials"}, status=401)

    login(request, user)
    return JsonResponse({"message": "Log in was successful"}, status=200)


@require_http_methods(["GET"])
def get_user(request):
    if not request.user.is_authenticated:
        return _err("not_authenticated", 401)
    return JsonResponse(_user_payload(request.user))


@csrf_exempt
@require_http_methods(["POST"])
def logout_user(request):
    logout(request)
    return JsonResponse({"message": "Logged out"}, status=200)


# ---------------------------------------------------------------------------
# Profile update
# ---------------------------------------------------------------------------

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


@csrf_exempt
@require_http_methods(["PATCH"])
def update_profile(request):
    """
    PATCH /api/auth/profile/

    Validates all supplied fields and returns structured error codes on failure.
    Error shape: { "errors": { "field": "error_code" } }
    Success shape: full user payload (same as /api/auth/me/).
    """
    if not request.user.is_authenticated:
        return _err("not_authenticated", 401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return _err("invalid_json")

    user       = request.user
    errors     = {}
    user_dirty = False

    # ── Shared personal fields ──────────────────────────────────────────────

    if "first_name" in payload:
        v = (payload["first_name"] or "").strip()
        if not v:
            errors["first_name"] = "required"
        elif not NAME_RE.match(v):
            errors["first_name"] = "name_invalid"

    if "last_name" in payload:
        v = (payload["last_name"] or "").strip()
        if not v:
            errors["last_name"] = "required"
        elif not NAME_RE.match(v):
            errors["last_name"] = "name_invalid"

    if "phone_number" in payload:
        ph = (payload["phone_number"] or "").strip()
        if ph and not PHONE_RE.match(ph):
            errors["phone_number"] = "phone_invalid"

    if "dob" in payload:
        from django.utils.dateparse import parse_date
        raw = (payload["dob"] or "").strip()
        if raw and parse_date(raw) is None:
            errors["dob"] = "dob_invalid"

    if "timezone" in payload:
        tz = (payload["timezone"] or "").strip()
        if tz not in ALLOWED_TIMEZONES:
            errors["timezone"] = "timezone_invalid"

    # ── Sensitive fields ────────────────────────────────────────────────────

    sensitive_requested = "email" in payload or "new_password" in payload
    if sensitive_requested:
        current_password = payload.get("current_password") or ""
        if not user.check_password(current_password):
            errors["current_password"] = "current_password_incorrect"

        if "email" in payload and "current_password" not in errors:
            new_email = (payload["email"] or "").strip().lower()
            if not new_email:
                errors["email"] = "required"
            else:
                User = get_user_model()
                if User.objects.exclude(pk=user.pk).filter(email=new_email).exists():
                    errors["email"] = "email_already_exists"

        if "new_password" in payload and "current_password" not in errors:
            new_password = payload.get("new_password") or ""
            if len(new_password) < 8:
                errors["new_password"] = "password_too_short"

    # ── Psychologist-specific ───────────────────────────────────────────────

    psych_fields = {"session_duration_minutes", "session_price", "license_number", "country_code"}
    if psych_fields & payload.keys():
        if user.role != "psychologist":
            errors["role"] = "not_psychologist"
        else:
            if "session_duration_minutes" in payload:
                duration = payload["session_duration_minutes"]
                if not isinstance(duration, int) or not (15 <= duration <= 180):
                    errors["session_duration_minutes"] = "session_duration_range"

            if "session_price" in payload:
                try:
                    price = float(payload["session_price"])
                    if not (0.5 <= price <= 5.0) or round(price * 2) != price * 2:
                        errors["session_price"] = "session_price_range"
                except (TypeError, ValueError):
                    errors["session_price"] = "session_price_range"

    # ── Return all errors at once ───────────────────────────────────────────

    if errors:
        return _field_errors(errors)

    # ── Apply changes ───────────────────────────────────────────────────────

    if "first_name" in payload:
        user.first_name = (payload["first_name"] or "").strip()
        user_dirty = True
    if "last_name" in payload:
        user.last_name = (payload["last_name"] or "").strip()
        user_dirty = True
    if "city" in payload:
        user.city = (payload["city"] or "").strip()
        user_dirty = True
    if "phone_number" in payload:
        user.phone_number = (payload["phone_number"] or "").strip()
        user_dirty = True
    if "dob" in payload:
        from django.utils.dateparse import parse_date
        raw = (payload["dob"] or "").strip()
        user.dob = parse_date(raw) if raw else None
        user_dirty = True
    if "timezone" in payload:
        user.timezone = (payload["timezone"] or "").strip()
        user_dirty = True

    if sensitive_requested and not errors:
        if "email" in payload:
            new_email = (payload["email"] or "").strip().lower()
            user.email    = new_email
            user.username = new_email
            user_dirty = True
        if "new_password" in payload:
            user.set_password(payload["new_password"])
            user_dirty = True

    if user_dirty:
        user.save()

    # Patient-only
    if "concerns" in payload:
        if user.role != "patient":
            return _err("not_patient", 403)
        try:
            profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return _err("profile_not_found", 404)
        profile.concerns = (payload["concerns"] or "").strip()
        profile.save()

    # Psychologist-only
    if psych_fields & payload.keys() and user.role == "psychologist":
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return _err("profile_not_found", 404)

        psych_dirty        = False
        verification_reset = False

        if "session_duration_minutes" in payload:
            profile.session_duration_minutes = payload["session_duration_minutes"]
            psych_dirty = True
        if "session_price" in payload:
            from decimal import Decimal
            profile.session_price = Decimal(str(float(payload["session_price"])))
            psych_dirty = True
        if "license_number" in payload:
            profile.license_number = (payload["license_number"] or "").strip()
            psych_dirty        = True
            verification_reset = True
        if "country_code" in payload:
            profile.country_code = (payload["country_code"] or "").strip()
            psych_dirty        = True
            verification_reset = True

        if verification_reset:
            profile.verification_status = PsychologistProfile.VERIFICATION_PENDING
            profile.is_verified         = False

        if psych_dirty:
            profile.save()

    return JsonResponse(_user_payload(user))


# ---------------------------------------------------------------------------
# Credits (mock — will be replaced by Stripe)
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
def add_credits(request):
    if not request.user.is_authenticated:
        return _err("not_authenticated", 401)
    if request.user.role != "patient":
        return _err("not_patient", 403)
    try:
        profile = request.user.patient_profile
    except PatientProfile.DoesNotExist:
        return _err("profile_not_found", 404)

    CREDITS_PER_PURCHASE = 10
    profile.credits += CREDITS_PER_PURCHASE
    profile.save()
    return JsonResponse({"credits": profile.credits, "added": CREDITS_PER_PURCHASE})

import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.validators import RegexValidator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse

from .models import PatientProfile, PsychologistProfile


name_validator = RegexValidator(
    regex=r'^[a-zA-ZñÑáéíóúÁÉÍÓÚ-]+$',
    message='This field can only contain letters and hyphens.',
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_payload(user):
    """
    Shared dict returned by /api/auth/me/ and after login/register/profile update.
    Always returns the freshest data — call user.refresh_from_db() before this
    if you need to guarantee stale caches are bypassed.
    """
    data = {
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'dob': user.dob.isoformat() if user.dob else None,
        'city': user.city,
        'phone_number': user.phone_number,
        'timezone': user.timezone,
        'profile_picture': user.profile_picture.url if user.profile_picture else None,
    }

    if user.role == 'patient':
        try:
            p = user.patient_profile
            data['credits'] = p.credits
            data['concerns'] = p.concerns
        except PatientProfile.DoesNotExist:
            pass

    elif user.role == 'psychologist':
        try:
            p = user.psychologist_profile
            data['session_duration_minutes'] = p.session_duration_minutes
            data['session_price'] = str(p.session_price)   # Decimal → string is safe for JS
            data['license_number'] = p.license_number
            data['country_code'] = p.country_code
            data['is_verified'] = p.is_verified
            data['verification_status'] = p.verification_status
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
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    first_name = (payload.get("first_name") or "").strip()
    last_name  = (payload.get("last_name")  or "").strip()
    email      = (payload.get("email")      or "").strip().lower()
    role       = payload.get("role")
    password         = payload.get("password") or ""
    confirm_password = payload.get("confirmPassword") or ""

    if not first_name or not last_name or not email:
        return JsonResponse({"error": "first_name, last_name and email are required"}, status=400)

    try:
        name_validator(first_name)
        name_validator(last_name)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    if role not in {"patient", "psychologist"}:
        return JsonResponse({"error": "Invalid role"}, status=400)

    if len(password) < 8:
        return JsonResponse({"error": "Password must have at least 8 characters"}, status=400)

    if password != confirm_password:
        return JsonResponse({"error": "Passwords do not match"}, status=400)

    User = get_user_model()
    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return JsonResponse({"error": "A user with that email already exists"}, status=409)

    if role == "psychologist":
        license_number = (payload.get("license_number") or "").strip()
        country_code   = (payload.get("country_code")   or "").strip()
        if not license_number or not country_code:
            return JsonResponse(
                {"error": "License number and country are required for psychologists"},
                status=400,
            )

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
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    email    = (payload.get("email")    or "").strip().lower()
    password =  payload.get("password") or ""

    if not email or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)

    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid email or password"}, status=401)

    login(request, user)
    return JsonResponse({"message": "Log in was successful"}, status=200)


@require_http_methods(["GET"])
def get_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)
    return JsonResponse(_user_payload(request.user))


@csrf_exempt
@require_http_methods(["POST"])
def logout_user(request):
    logout(request)
    return JsonResponse({"message": "Logged out"}, status=200)


# ---------------------------------------------------------------------------
# Profile update
# ---------------------------------------------------------------------------

# Valid IANA timezones exposed to the UI.
# Keeping this explicit avoids accepting arbitrary strings.
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

    Handles all profile fields for all roles.  Only the keys present in the
    request body are touched — absent keys are left unchanged.

    Shared (all roles):
        first_name, last_name, city, phone_number, dob, timezone

    Sensitive (all roles, require current_password):
        email, new_password

    Patient-only:
        concerns

    Psychologist-only:
        session_duration_minutes  (int, 15–180)
        session_price             (float/str, 0.5–5.0, step 0.5)
        license_number            (resets verification to pending)
        country_code              (resets verification to pending)
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    user = request.user
    user_dirty = False   # track whether user model needs saving

    # ── Shared personal fields ──────────────────────────────────────────────

    if "first_name" in payload:
        v = (payload["first_name"] or "").strip()
        if not v:
            return JsonResponse({"error": "first_name cannot be blank"}, status=400)
        try:
            name_validator(v)
        except Exception as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        user.first_name = v
        user_dirty = True

    if "last_name" in payload:
        v = (payload["last_name"] or "").strip()
        if not v:
            return JsonResponse({"error": "last_name cannot be blank"}, status=400)
        try:
            name_validator(v)
        except Exception as exc:
            return JsonResponse({"error": str(exc)}, status=400)
        user.last_name = v
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
        if raw:
            parsed = parse_date(raw)
            if parsed is None:
                return JsonResponse({"error": "dob must be a valid date (YYYY-MM-DD)"}, status=400)
            user.dob = parsed
        else:
            user.dob = None
        user_dirty = True

    if "timezone" in payload:
        tz = (payload["timezone"] or "").strip()
        if tz not in ALLOWED_TIMEZONES:
            return JsonResponse({"error": f"Unsupported timezone: {tz}"}, status=400)
        user.timezone = tz
        user_dirty = True

    # ── Sensitive fields — require current_password ─────────────────────────

    sensitive_requested = "email" in payload or "new_password" in payload
    if sensitive_requested:
        current_password = payload.get("current_password") or ""
        if not user.check_password(current_password):
            return JsonResponse({"error": "Current password is incorrect"}, status=403)

        if "email" in payload:
            new_email = (payload["email"] or "").strip().lower()
            if not new_email:
                return JsonResponse({"error": "email cannot be blank"}, status=400)
            User = get_user_model()
            if User.objects.exclude(pk=user.pk).filter(email=new_email).exists():
                return JsonResponse({"error": "That email is already in use"}, status=409)
            user.email = new_email
            user.username = new_email   # username mirrors email
            user_dirty = True

        if "new_password" in payload:
            new_password = payload.get("new_password") or ""
            if len(new_password) < 8:
                return JsonResponse(
                    {"error": "New password must be at least 8 characters"}, status=400
                )
            user.set_password(new_password)
            user_dirty = True

    if user_dirty:
        user.save()

    # ── Patient-only fields ─────────────────────────────────────────────────

    if "concerns" in payload:
        if user.role != "patient":
            return JsonResponse({"error": "Only patients can set concerns"}, status=403)
        try:
            profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({"error": "Patient profile not found"}, status=404)
        profile.concerns = (payload["concerns"] or "").strip()
        profile.save()

    # ── Psychologist-only fields ────────────────────────────────────────────

    psych_fields = {"session_duration_minutes", "session_price", "license_number", "country_code"}
    if psych_fields & payload.keys():
        if user.role != "psychologist":
            return JsonResponse(
                {"error": "Only psychologists can update psychologist profile fields"},
                status=403,
            )
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({"error": "Psychologist profile not found"}, status=404)

        psych_dirty = False
        verification_reset = False

        if "session_duration_minutes" in payload:
            duration = payload["session_duration_minutes"]
            if not isinstance(duration, int) or not (15 <= duration <= 180):
                return JsonResponse(
                    {"error": "session_duration_minutes must be an integer between 15 and 180"},
                    status=400,
                )
            profile.session_duration_minutes = duration
            psych_dirty = True

        if "session_price" in payload:
            try:
                price = float(payload["session_price"])
            except (TypeError, ValueError):
                return JsonResponse({"error": "session_price must be a number"}, status=400)
            # Allowed range: 0.5–5.0, multiples of 0.5
            if not (0.5 <= price <= 5.0) or round(price * 2) != price * 2:
                return JsonResponse(
                    {"error": "session_price must be between 0.5 and 5.0 in steps of 0.5"},
                    status=400,
                )
            from decimal import Decimal
            profile.session_price = Decimal(str(price))
            psych_dirty = True

        # License / country changes → reset verification status
        if "license_number" in payload:
            profile.license_number = (payload["license_number"] or "").strip()
            psych_dirty = True
            verification_reset = True

        if "country_code" in payload:
            profile.country_code = (payload["country_code"] or "").strip()
            psych_dirty = True
            verification_reset = True

        if verification_reset:
            profile.verification_status = PsychologistProfile.VERIFICATION_PENDING
            profile.is_verified = False

        if psych_dirty:
            profile.save()

    return JsonResponse(_user_payload(user))


# ---------------------------------------------------------------------------
# Credits (mock — will be replaced by Stripe)
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["POST"])
def add_credits(request):
    """
    POST /api/auth/credits/add/

    Adds 10 credits to the authenticated patient's balance.
    This is a mock endpoint — real purchasing will go through Stripe.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    if request.user.role != "patient":
        return JsonResponse({"error": "Only patients have credits"}, status=403)

    try:
        profile = request.user.patient_profile
    except PatientProfile.DoesNotExist:
        return JsonResponse({"error": "Patient profile not found"}, status=404)

    CREDITS_PER_PURCHASE = 10
    profile.credits += CREDITS_PER_PURCHASE
    profile.save()

    return JsonResponse({
        "credits": profile.credits,
        "added": CREDITS_PER_PURCHASE,
    })

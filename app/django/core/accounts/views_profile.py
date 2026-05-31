"""
accounts/views_profile.py
─────────────────────────
Profile mutation endpoints: update_profile (PATCH) and add_credits (POST).
"""

import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

import imghdr
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


from .models import PatientProfile, PsychologistProfile
from .utils import (
    ALLOWED_TIMEZONES,
    NAME_RE,
    PHONE_RE,
    err,
    field_errors,
    is_old_enough,
    user_payload,
)


# ── update_profile ────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["PATCH"])
def update_profile(request):
    if not request.user.is_authenticated:
        return err("not_authenticated", 401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return err("invalid_json")

    user       = request.user
    errors     = {}
    user_dirty = False

    # ── Basic field validation ──────────────────────────────────────────────

    if "first_name" in payload:
        v = (payload["first_name"] or "").strip()
        if not v:                  errors["first_name"] = "required"
        elif not NAME_RE.match(v): errors["first_name"] = "name_invalid"

    if "last_name" in payload:
        v = (payload["last_name"] or "").strip()
        if not v:                  errors["last_name"] = "required"
        elif not NAME_RE.match(v): errors["last_name"] = "name_invalid"

    if "phone_number" in payload:
        ph = (payload["phone_number"] or "").strip()
        if ph and not PHONE_RE.match(ph):
            errors["phone_number"] = "phone_invalid"

    if "dob" in payload:
        raw = (payload["dob"] or "").strip()
        if raw:
            dob_date = parse_date(raw)
            if dob_date is None:
                errors["dob"] = "dob_invalid"
            elif not is_old_enough(dob_date):
                errors["dob"] = "dob_too_young"

    if "timezone" in payload:
        tz = (payload["timezone"] or "").strip()
        if tz not in ALLOWED_TIMEZONES:
            errors["timezone"] = "timezone_invalid"

    # ── Sensitive-field validation (requires current_password) ─────────────

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
            if len(payload.get("new_password") or "") < 8:
                errors["new_password"] = "password_too_short"

    # ── Psychologist-specific field validation ──────────────────────────────

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

    if errors:
        return field_errors(errors)

    # ── Apply user-model changes ────────────────────────────────────────────

    simple_user_fields = {
        "first_name": lambda v: (v or "").strip(),
        "last_name":  lambda v: (v or "").strip(),
        "city":       lambda v: (v or "").strip(),
        "phone_number": lambda v: (v or "").strip(),
        "timezone":   lambda v: (v or "").strip(),
    }
    for field, coerce in simple_user_fields.items():
        if field in payload:
            setattr(user, field, coerce(payload[field]))
            user_dirty = True

    if "dob" in payload:
        raw = (payload["dob"] or "").strip()
        user.dob = parse_date(raw) if raw else None
        user_dirty = True

    if sensitive_requested:
        if "email" in payload:
            new_email = (payload["email"] or "").strip().lower()
            user.email = new_email
            user.username = new_email
            user_dirty = True
        if "new_password" in payload:
            user.set_password(payload["new_password"])
            user_dirty = True

    if user_dirty:
        user.save()

    # ── Apply psychologist profile changes ──────────────────────────────────

    if psych_fields & payload.keys() and user.role == "psychologist":
        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return err("profile_not_found", 404)

        psych_dirty        = False
        verification_reset = False

        if "session_duration_minutes" in payload:
            profile.session_duration_minutes = payload["session_duration_minutes"]
            psych_dirty = True
        if "session_price" in payload:
            profile.session_price = Decimal(str(float(payload["session_price"])))
            psych_dirty = True
        if "license_number" in payload:
            profile.license_number   = (payload["license_number"] or "").strip()
            psych_dirty              = True
            verification_reset       = True
        if "country_code" in payload:
            profile.country_code = (payload["country_code"] or "").strip()
            psych_dirty          = True
            verification_reset   = True

        if verification_reset:
            profile.verification_status = PsychologistProfile.VERIFICATION_PENDING
            profile.is_verified         = False

        if psych_dirty:
            profile.save()

    return JsonResponse(user_payload(user))


# ── add_credits ───────────────────────────────────────────────────────────────

CREDITS_PER_PURCHASE = 10


@csrf_exempt
@require_http_methods(["POST"])
def add_credits(request):
    if not request.user.is_authenticated:
        return err("not_authenticated", 401)
    if request.user.role != "patient":
        return err("not_patient", 403)

    try:
        profile = request.user.patient_profile
    except PatientProfile.DoesNotExist:
        return err("profile_not_found", 404)

    profile.credits += CREDITS_PER_PURCHASE
    profile.save()
    return JsonResponse({"credits": profile.credits, "added": CREDITS_PER_PURCHASE})



# Max 5 MB
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {'rgb', 'gif', 'pbm', 'pgm', 'ppm', 'tiff', 'rast',
                       'xbm', 'jpeg', 'png', 'bmp', 'webp'}


# Subida de imágenes de perfil

@csrf_exempt
@require_http_methods(["POST"])
def upload_profile_picture(request):
    if not request.user.is_authenticated:
        return err("not_authenticated", 401)

    file = request.FILES.get("profile_picture")
    if not file:
        return err("no_file", 400)

    if file.size > MAX_AVATAR_BYTES:
        return err("file_too_large", 400)

    # Read first 512 bytes to check magic bytes \u2014 this is the real image check
    header = file.read(512)
    file.seek(0)
    image_type = imghdr.what(None, h=header)
    if image_type not in ALLOWED_IMAGE_TYPES:
        return err("not_an_image", 400)

    # Delete old picture from S3 if it exists
    user = request.user
    if user.profile_picture:
        try:
            default_storage.delete(user.profile_picture.name)
        except Exception:
            pass  # don't block the upload if delete fails

    # Save to S3 under profiles/<user_id>.<ext>
    ext = image_type if image_type != 'jpeg' else 'jpg'
    path = f"profiles/{user.id}.{ext}"
    default_storage.save(path, ContentFile(file.read()))

    # Store the path in the DB
    user.profile_picture = path
    user.save(update_fields=["profile_picture"])

    return JsonResponse({"profile_picture_url": default_storage.url(path)})
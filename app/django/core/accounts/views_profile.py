"""
accounts/views_profile.py
─────────────────────────
Profile mutation endpoints: update_profile, add_credits, upload_profile_picture.
"""

import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

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
        if tz and tz not in ALLOWED_TIMEZONES:
            errors["timezone"] = "timezone_invalid"

    # ── Sensitive fields (need current_password) ────────────────────────────

    sensitive_fields = {"email", "new_password"}
    sensitive_requested = sensitive_fields & payload.keys()

    if sensitive_requested:
        current_password = payload.get("current_password") or ""
        if not current_password:
            errors["current_password"] = "required"
        elif not user.check_password(current_password):
            errors["current_password"] = "current_password_incorrect"

    if "new_password" in payload:
        pw = payload.get("new_password") or ""
        if len(pw) < 8:
            errors["new_password"] = "password_too_short"

    # ── Psychologist-only fields ────────────────────────────────────────────

    psych_fields = {"session_duration_minutes", "session_price", "license_number", "country_code"}

    if "session_duration_minutes" in payload:
        try:
            dur = int(payload["session_duration_minutes"])
            if dur < 15 or dur > 180:
                errors["session_duration_minutes"] = "session_duration_range"
        except (TypeError, ValueError):
            errors["session_duration_minutes"] = "session_duration_range"

    if "session_price" in payload:
        try:
            price = float(payload["session_price"])
            valid_prices = [round(0.5 * i, 1) for i in range(1, 11)]  # 0.5 .. 5.0
            if price not in valid_prices:
                errors["session_price"] = "session_price_range"
        except (TypeError, ValueError):
            errors["session_price"] = "session_price_range"

    if errors:
        return field_errors(errors)

    # ── Apply user field changes ────────────────────────────────────────────

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


# ── upload_profile_picture ────────────────────────────────────────────────────

# Max 5 MB
MAX_AVATAR_BYTES = 5 * 1024 * 1024

# Recognised image magic-byte signatures checked by _detect_image_type().
# We don't rely on the file extension or Content-Type header supplied by the
# browser — those can be spoofed.  We inspect the raw bytes instead.
_MAGIC = {
    b'\xff\xd8\xff':     'jpg',   # JPEG
    b'\x89PNG\r\n':      'png',   # PNG
    b'GIF87a':           'gif',   # GIF 87a
    b'GIF89a':           'gif',   # GIF 89a
    b'RIFF':             'webp',  # WebP (RIFF....WEBP, checked below)
    b'BM':               'bmp',   # BMP
}


def _detect_image_type(header: bytes):
    """
    Return a short extension string ('jpg', 'png', 'gif', 'webp', 'bmp')
    or None if the header doesn't match a known image format.

    We implement our own magic-byte check because imghdr was deprecated in
    Python 3.11 and removed in 3.13.
    """
    if header[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if header[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if header[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    # WebP: bytes 0-3 == b'RIFF', bytes 8-12 == b'WEBP'
    if header[:4] == b'RIFF' and header[8:12] == b'WEBP':
        return 'webp'
    if header[:2] == b'BM':
        return 'bmp'
    return None


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

    # Read first 16 bytes to detect the image type via magic bytes.
    header = file.read(16)
    file.seek(0)

    ext = _detect_image_type(header)
    if ext is None:
        return err("not_an_image", 400)

    user = request.user

    # Build the deterministic S3 key for this user.
    # Using a fixed key (profiles/<id>.<ext>) means re-uploading always
    # overwrites the same object — no orphaned files accumulate.
    path = f"profiles/{user.id}.{ext}"

    # Delete the old object first so default_storage.save() doesn't
    # silently rename the new one (e.g. profiles/1_abc123.jpg).
    # We delete *both* the stored path on the model and the target path,
    # since a previous upload with a different extension would leave a
    # stale key behind.
    for old_path in {user.profile_picture.name if user.profile_picture else None, path}:
        if old_path:
            try:
                default_storage.delete(old_path)
            except Exception:
                pass  # don't block the upload if delete fails

    # Read the full file and save to S3 via default_storage (same pattern
    # as core/s3/views.py :: test_upload which is confirmed working).
    default_storage.save(path, ContentFile(file.read()))

    # Persist the path to the DB.
    user.profile_picture = path
    user.save(update_fields=["profile_picture"])

    # Return the Django proxy URL, not the direct S3 URL.
    # The browser must never talk to S3 directly — the bucket is private.
    return JsonResponse({"profile_picture_url": f"/api/media/{path}"})

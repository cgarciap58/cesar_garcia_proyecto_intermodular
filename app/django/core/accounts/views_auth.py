"""
accounts/views_auth.py
──────────────────────
Authentication endpoints: register, login, get_user, logout.
"""

import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import PatientProfile, PsychologistProfile
from .utils import NAME_RE, err, field_errors, is_old_enough, user_payload


@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return err("invalid_json")

    first_name       = (payload.get("first_name")      or "").strip()
    last_name        = (payload.get("last_name")        or "").strip()
    email            = (payload.get("email")            or "").strip().lower()
    role             =  payload.get("role")
    dob_raw          = (payload.get("dob")              or "").strip()
    password         =  payload.get("password")         or ""
    confirm_password =  payload.get("confirmPassword")  or ""

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

    if not dob_raw:
        errors["dob"] = "required"
    else:
        dob_date = parse_date(dob_raw)
        if dob_date is None:
            errors["dob"] = "dob_invalid"
        elif not is_old_enough(dob_date):
            errors["dob"] = "dob_too_young"

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
        return field_errors(errors)

    if role == "psychologist":
        license_number = (payload.get("license_number") or "").strip()
        country_code   = (payload.get("country_code")   or "").strip()
        psych_errors   = {}
        if not license_number:
            psych_errors["license_number"] = "required"
        if not country_code:
            psych_errors["country_code"] = "required"
        if psych_errors:
            return field_errors(psych_errors)

    User = get_user_model()
    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return field_errors({"email": "email_already_exists"}, status=409)

    user = User.objects.create_user(
        username=email,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=role,
        password=password,
        dob=parse_date(dob_raw),
    )

    if role == "psychologist":
        PsychologistProfile.objects.create(
            user=user,
            license_number=(payload.get("license_number") or "").strip(),
            country_code=(payload.get("country_code") or "").strip(),
        )
    elif role == "patient":
        PatientProfile.objects.create(user=user)

    login(request, user)
    return JsonResponse(user_payload(user), status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return err("invalid_json")

    email    = (payload.get("email")    or "").strip().lower()
    password =  payload.get("password") or ""

    errors = {}
    if not email:    errors["email"]    = "required"
    if not password: errors["password"] = "required"
    if errors:
        return field_errors(errors)

    user = authenticate(request, username=email, password=password)
    if user is None:
        return field_errors({"form": "invalid_credentials"}, status=401)

    login(request, user)
    return JsonResponse({"message": "Log in was successful"}, status=200)


@require_http_methods(["GET"])
def get_user(request):
    if not request.user.is_authenticated:
        return err("not_authenticated", 401)
    return JsonResponse(user_payload(request.user))


@csrf_exempt
@require_http_methods(["POST"])
def logout_user(request):
    logout(request)
    return JsonResponse({"message": "Logged out"}, status=200)

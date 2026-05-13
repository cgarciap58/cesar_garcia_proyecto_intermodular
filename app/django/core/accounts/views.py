import json

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import PatientProfile, PsychologistProfile


@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    first_name = (payload.get("first_name")).strip()
    last_name = (payload.get("last_name")).strip()
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role")
    password = payload.get("password") or ""
    confirm_password = payload.get("confirmPassword") or ""

    if not first_name or not last_name or not email:
        return JsonResponse({"error": "first_name, last_name and email are required"}, status=400)

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
        country_code = (payload.get("country_code") or "").strip()

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
            license_number=license_number,
            country_code=country_code,
        )
    elif role == "patient":
        PatientProfile.objects.create(
            user=user,
            concerns=(payload.get("concerns") or "").strip(),
        )

    return JsonResponse(
        {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
        },
        status=201,
    )


def login_user(request):
    return JsonResponse({"error": "Not implemented"}, status=501)


def get_user(request):
    return JsonResponse({"error": "Not implemented"}, status=501)
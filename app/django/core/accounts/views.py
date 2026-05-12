import json

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.crypto import get_random_string
from .models import PatientProfile, PsychologistProfile


@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    name = (payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role")

    if not name or not email or role not in {"patient", "psychologist"}:
        return JsonResponse({"error": "fullName, email and valid role are required"}, status=400)

    User = get_user_model()
    if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        return JsonResponse({"error": "A user with that email already exists"}, status=409)

    user = User.objects.create_user(
        username=email,
        email=email,
        name=name,
        role=role,
        password=get_random_string(16),
    )

    if role == "psychologist":
        license_number = (payload.get("licenseNumber") or "").strip()
        specialty = (payload.get("specialty") or "").strip()

        if not license_number or not specialty:
            user.delete()
            return JsonResponse(
                {"error": "licenseNumber and specialty are required for psychologists"},
                status=400,
            )

        PsychologistProfile.objects.create(
            user=user,
            license_number=license_number,
            specialty=specialty,
        )
    else:
        PatientProfile.objects.create(
            user=user,
            concerns=(payload.get("concerns") or "").strip(),
        )

    return JsonResponse(
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
        status=201,
    )


def login_user(request):
    return JsonResponse({"error": "Not implemented"}, status=501)


def get_user(request):
    return JsonResponse({"error": "Not implemented"}, status=501)
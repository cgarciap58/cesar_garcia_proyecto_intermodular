import json

from django.core.validators import RegexValidator

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from django.http import JsonResponse

from .models import PatientProfile, PsychologistProfile


name_validator = RegexValidator(
    regex=r'^[a-zA-ZñÑáéíóúÁÉÍÓÚ-]+$',
    message='This field can only contain letters and hyphens.',
)

@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role")
    password = payload.get("password") or ""
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
            license_number=(payload.get("license_number") or "").strip(),
            country_code=(payload.get("country_code") or "").strip(),
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

@csrf_exempt
@require_http_methods(["POST"])
def login_user(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

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
    user = request.user
    return JsonResponse({
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
    })
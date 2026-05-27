from django.contrib import admin
from django.urls import path

from .views import session_test, test_api

from .accounts.views import (
    register_user, login_user, get_user, update_profile, logout_user, add_credits,
)
from .appointments.views import (
    slots_list, slot_detail, available_slots,
    appointments_list,
    appointment_confirm, appointment_reject, appointment_withdraw, appointment_cancel,
    appointment_history, appointment_detail,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('django-debug/session-test/', session_test),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('api/auth/me/',          get_user),
    path('api/auth/register/',    register_user),
    path('api/auth/login/',       login_user),
    path('api/auth/logout/',      logout_user),
    path('api/auth/profile/',     update_profile),
    path('api/auth/credits/add/', add_credits),

    # ── Slots ─────────────────────────────────────────────────────────────────
    # available/ must be registered BEFORE the generic slots/ path
    path('api/appointments/slots/available/', available_slots),
    path('api/appointments/slots/',           slots_list),
    path('api/appointments/slots/<int:slot_id>/', slot_detail),

    # ── Appointments ──────────────────────────────────────────────────────────
    # Specific action paths must be registered BEFORE the generic <id>/ path
    path('api/appointments/history/',                       appointment_history),
    path('api/appointments/<int:appointment_id>/confirm/',  appointment_confirm),
    path('api/appointments/<int:appointment_id>/reject/',   appointment_reject),
    path('api/appointments/<int:appointment_id>/withdraw/', appointment_withdraw),
    path('api/appointments/<int:appointment_id>/cancel/',   appointment_cancel),
    path('api/appointments/<int:appointment_id>/',          appointment_detail),
    path('api/appointments/',                               appointments_list),
]

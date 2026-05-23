from django.contrib import admin
from django.urls import path

from .views import (
    session_test,
    test_api,
)

from .accounts.views import (
    register_user,
    login_user,
    get_user,
    update_profile,
    logout_user,
    add_credits,
)
from .appointments.views import (
    slots_list,
    slot_detail,
    available_slots,
    appointments_list,
    appointment_confirm,
    appointment_cancel,
    appointment_history,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('django-debug/session-test/', session_test),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('api/auth/me/', get_user),
    path('api/auth/register/', register_user),
    path('api/auth/login/', login_user),
    path('api/auth/logout/', logout_user),
    path('api/auth/profile/', update_profile),
    path('api/auth/credits/add/', add_credits),

    # ── Appointments ──────────────────────────────────────────────────────────
    path('api/appointments/', appointments_list),
    path('api/appointments/<int:appointment_id>/confirm/', appointment_confirm),
    path('api/appointments/<int:appointment_id>/cancel/', appointment_cancel),

    # ── Slots ─────────────────────────────────────────────────────────────────
    # NOTE: available_slots must come BEFORE the generic slots_list path.
    # Django matches URLs top-to-bottom, and /slots/available/ would otherwise
    # be caught by /slots/<int:slot_id>/ — but since "available" is not an int
    # that particular collision can't happen.  Still, explicit ordering is
    # cleaner and makes the intent obvious.
    path('api/appointments/slots/available/', available_slots),
    path('api/appointments/slots/', slots_list),
    path('api/appointments/slots/<int:slot_id>/', slot_detail),

    # ── History ───────────────────────────────────────────────────────────────
    path('api/appointments/history/', appointment_history),
]

from django.contrib import admin
from django.urls import path

from .views import (
    session_test, 
    test_api
)

from .accounts.views import (
    register_user, 
    login_user, 
    get_user, 
    logout_user
)
from .appointments.views import (
    slots_list, 
    slot_detail, 
    appointments_list, 
    appointment_confirm, 
    appointment_cancel,
    appointment_history
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('django-debug/session-test/', session_test),
    path('api/auth/me/', get_user),
    path('api/auth/register/', register_user),
    path('api/auth/login/', login_user),
    path('api/auth/logout/', logout_user),
    path('api/appointments/', appointments_list),
    path('api/appointments/<int:appointment_id>/confirm/', appointment_confirm),
    path('api/appointments/<int:appointment_id>/cancel/', appointment_cancel),
    path('api/appointments/slots/', slots_list),
    path('api/appointments/slots/<int:slot_id>/', slot_detail),
    path('api/appointments/history/', appointment_history),
]
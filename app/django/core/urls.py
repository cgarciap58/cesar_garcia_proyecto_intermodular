from django.contrib import admin
from django.urls import path
from .views import test_api, session_test

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    # path('api/auth/register/', register_user),
    # path('api/auth/login/', login_user),
    # path('api/users/me/', get_user),
    # path('api/psychologists/'),
    # path('api/appointments/',),
    path('django-debug/session-test/', session_test),
]
from django.contrib import admin
from django.urls import path

from .accounts.views import register_user
from .views import session_test, test_api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('api/auth/register/', register_user),
    path('django-debug/session-test/', session_test),
]
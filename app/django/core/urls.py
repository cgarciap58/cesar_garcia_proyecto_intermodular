from django.contrib import admin
from django.urls import path

from .views import session_test, test_api
from .accounts.views import register_user, login_user

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('api/auth/register/', register_user),
    path('api/auth/login/', login_user),
    path('django-debug/session-test/', session_test),
]
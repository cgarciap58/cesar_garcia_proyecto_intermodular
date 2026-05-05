from django.contrib import admin
from django.urls import path
from .views import test_api, session_test

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
    path('django-debug/session-test/', session_test),
]
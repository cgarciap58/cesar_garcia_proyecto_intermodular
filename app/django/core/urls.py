from django.contrib import admin
from django.urls import path
from .views import test_api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/test/', test_api),
]
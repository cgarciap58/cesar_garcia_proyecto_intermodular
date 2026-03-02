"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path
from django.http import HttpResponse
from django.contrib.admin.views.decorators import staff_member_required

from records.views import (
    lead_ticket_management_view,
    my_assigned_tickets_view,
    submit_ticket_view,
)

@staff_member_required
def incidents_view(request):
    return HttpResponse("Incidents page")

urlpatterns = [
    path('admin/', admin.site.urls),
    path("", lambda r: HttpResponse("Welcome to the main page!")),  # Home page
    path("health/", lambda r: HttpResponse("ok")),
    path("dog/", lambda r: HttpResponse("ok")),
    path("sickness/", lambda r: HttpResponse("ok")),
    path("incidents/", incidents_view, name="incidents"),
    path("tickets/submit/", submit_ticket_view, name="submit_ticket"),
    path("tickets/my/", my_assigned_tickets_view, name="my-assigned-tickets"),
    path("tickets/my_assigned/", my_assigned_tickets_view, name="my_assigned_tickets"),
    path("tickets/manage/", lead_ticket_management_view, name="lead-ticket-manage"),
]

"""
URL configuration for config project.
"""

from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse
from django.urls import path

from records.views import (
    index_view,
    lead_ticket_management_view,
    login_view,
    logout_view,
    my_assigned_tickets_view,
    report_issue_form_view,
    submit_ticket_view,
    tickets_dashboard_view,
)

@staff_member_required
def incidents_view(request):
    return HttpResponse("Incidents page")

urlpatterns = [
    path("", index_view, name="home"),
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path('admin/', admin.site.urls),
    path("status/", lambda r: HttpResponse("ok")),
    path("incidents/", incidents_view, name="incidents"),
    path("tickets/report/", report_issue_form_view, name="report_issue_form"),
    path("tickets/report", report_issue_form_view),
    path("tickets/submit/", submit_ticket_view, name="submit_ticket"),
    path("tickets/my/", my_assigned_tickets_view, name="my-assigned-tickets"),
    path("tickets/my_assigned/", my_assigned_tickets_view, name="my_assigned_tickets"),
    path("tickets/dashboard/", tickets_dashboard_view, name="tickets_dashboard"),
    path("tickets/manage/", lead_ticket_management_view, name="lead-ticket-manage"),
]

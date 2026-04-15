import json

from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from records.models import Tickets

def _is_developer_or_lead(user):
    return user.groups.filter(name__in=["developer", "lead_developer"]).exists()

def _is_lead_developer(user):
    return user.groups.filter(name="lead_developer").exists()

def _ticket_payload(ticket):
    assignee = ticket.assigned_developer
    status = getattr(ticket, "status", "assigned" if assignee else "unassigned")
    return {
        "id": ticket.id,
        "created_at": ticket.created_at.isoformat(),
        "issue": ticket.issue,
        "status": status,
        "assigned_developer": (
            {
                "id": assignee.id,
                "username": assignee.username,
            }
            if assignee
            else None
        ),
    }

@require_http_methods(["GET"])
def index_view(request):
    return render(request, "records/index.html")


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect("tickets_dashboard")

    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        login(request, form.get_user())
        return redirect("tickets_dashboard")

    return render(request, "records/login.html", {"form": form})


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return redirect("home")


@require_http_methods(["GET"])
def report_issue_form_view(request):
    return render(request, "records/report_issue_form.html")


@require_http_methods(["GET", "POST"])
def submit_ticket_view(request):
    if request.method == "GET":
        return JsonResponse(
            {
                "fields": {
                    "issue": {
                        "type": "string",
                        "required": True,
                    }
                }
            }
        )

    issue = request.POST.get("issue")
    if issue is None and request.body:
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            payload = {}
        issue = payload.get("issue")

    if not issue:
        return JsonResponse({"error": "`issue` is required."}, status=400)

    ticket = Tickets.objects.create(
        issue=issue,
        created_by=request.user if request.user.is_authenticated else None,
        assigned_developer=None,
    )

    if request.POST.get("issue") is not None:
        return render(
            request,
            "records/report_issue_form.html",
            {
                "success_message": "Issue submitted successfully.",
                "ticket_id": ticket.id,
            },
            status=201,
        )

    return JsonResponse(
        {
            "id": ticket.id,
            "created_at": ticket.created_at.isoformat(),
        },
        status=201,
    )

@require_http_methods(["GET"])
@login_required
def my_assigned_tickets_view(request):    
    if not _is_developer_or_lead(request.user):
        return JsonResponse({"error": "Forbidden."}, status=403)

    tickets = Tickets.objects.filter(assigned_developer=request.user)

    return JsonResponse(
        {
            "tickets": [
                {
                    "id": ticket.id,
                    "created_at": ticket.created_at.isoformat(),
                    "issue": ticket.issue,
                    "assigned_developer": ticket.assigned_developer.username,
                }
                for ticket in tickets
            ]
        }
    )


@require_http_methods(["GET", "POST", "PATCH"])
@login_required
def lead_ticket_management_view(request):
    if not _is_lead_developer(request.user):
        return JsonResponse({"error": "Forbidden."}, status=403)


    if request.method == "GET":
        tickets = Tickets.objects.select_related("assigned_developer").all()
        developers = get_user_model().objects.filter(
            groups__name__in=["developer", "lead_developer"]
        ).distinct()
        return JsonResponse(
            {
                "tickets": [_ticket_payload(ticket) for ticket in tickets],
                "developers": [
                    {"id": user.id, "username": user.username} for user in developers
                ],
            }
        )


    payload = {}
    if request.body:
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            payload = {}

    ticket_id = payload.get("ticket_id") or request.POST.get("ticket_id")
    developer_user_id = payload.get("developer_user_id") or request.POST.get(
        "developer_user_id"
    )

    if not ticket_id or not developer_user_id:
        return JsonResponse(
            {"error": "`ticket_id` and `developer_user_id` are required."},
            status=400,
        )

    ticket = Tickets.objects.filter(id=ticket_id).select_related("assigned_developer").first()
    if ticket is None:
        return JsonResponse({"error": "Ticket not found."}, status=404)

    User = get_user_model()
    assignee = User.objects.filter(id=developer_user_id).first()
    if assignee is None:
        return JsonResponse({"error": "Developer user not found."}, status=404)

    if not _is_developer_or_lead(assignee):
        return JsonResponse(
            {
                "error": (
                    "Assignee must belong to the `developer` or `lead_developer` group."
                )
            },
            status=400,
        )

    ticket.assigned_developer = assignee
    ticket.save(update_fields=["assigned_developer"])

    ticket.refresh_from_db()
    return JsonResponse({"ticket": _ticket_payload(ticket)})

@require_http_methods(["GET", "POST"])
@login_required
def tickets_dashboard_view(request):
    if not _is_developer_or_lead(request.user):
        return HttpResponseForbidden("You are not allowed to view tickets.")

    if request.method == "POST":
        if not _is_lead_developer(request.user):
            return HttpResponseForbidden("Only lead developers can assign tickets.")

        ticket_id = request.POST.get("ticket_id")
        developer_user_id = request.POST.get("developer_user_id")
        if not ticket_id or not developer_user_id:
            messages.error(request, "Both ticket and developer are required.")
            return redirect("tickets_dashboard")

        ticket = Tickets.objects.filter(id=ticket_id).first()
        if ticket is None:
            messages.error(request, "Ticket not found.")
            return redirect("tickets_dashboard")

        assignee = get_user_model().objects.filter(id=developer_user_id).first()
        if assignee is None or not _is_developer_or_lead(assignee):
            messages.error(request, "Please select a valid developer account.")
            return redirect("tickets_dashboard")

        ticket.assigned_developer = assignee
        ticket.save(update_fields=["assigned_developer"])
        messages.success(request, f"Ticket #{ticket.id} assigned to {assignee.username}.")
        return redirect("tickets_dashboard")

    if _is_lead_developer(request.user):
        tickets = Tickets.objects.select_related("assigned_developer", "created_by").all()
    else:
        tickets = Tickets.objects.select_related("assigned_developer", "created_by").filter(
            assigned_developer=request.user
        )

    developers = get_user_model().objects.filter(
        groups__name__in=["developer", "lead_developer"]
    ).distinct()

    return render(
        request,
        "records/tickets_dashboard.html",
        {
            "tickets": tickets,
            "developers": developers,
            "is_lead_developer": _is_lead_developer(request.user),
        },
    )
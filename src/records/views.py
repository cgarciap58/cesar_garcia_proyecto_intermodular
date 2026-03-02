import json

from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import get_user_model
from django.http import JsonResponse
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

    return JsonResponse(
        {
            "id": ticket.id,
            "created_at": ticket.created_at.isoformat(),
        },
        status=201,
    )

@require_http_methods(["GET"])
def my_assigned_tickets_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)

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


# @login_required
# @user_passes_test(_is_lead_developer)
@require_http_methods(["GET", "POST", "PATCH"])
def lead_ticket_management_view(request):
    if request.method == "GET":
        tickets = Tickets.objects.select_related("assigned_developer").all()
        return JsonResponse({"tickets": [_ticket_payload(ticket) for ticket in tickets]})

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
import json

from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from records.models import Tickets

def _is_developer_or_lead(user):
    return user.groups.filter(name__in=["developer", "lead_developer"]).exists()

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
import json

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from records.models import Tickets


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

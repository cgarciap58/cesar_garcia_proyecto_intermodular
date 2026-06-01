"""
bugs/views.py
─────────────
Bug-report endpoints:
 
  POST /api/bugs/          → submit_bug        (any visitor, auth optional)
  GET  /api/bugs/          → list_bugs         (admin sees all; developer sees own)
  PATCH /api/bugs/<id>/assign/ → assign_bug    (admin only)
"""
 
import json
 
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
 
from .models import BugReport
from core.accounts.utils import err
 
 
User = get_user_model()
 
 
# ── Helpers ───────────────────────────────────────────────────────────────────
 
def _bug_to_dict(bug) -> dict:
    return {
        'id':          bug.pk,
        'description': bug.description,
        'reporter':    (
            {
                'id':         bug.reporter.pk,
                'email':      bug.reporter.email,
                'first_name': bug.reporter.first_name,
                'last_name':  bug.reporter.last_name,
            }
            if bug.reporter_id else None
        ),
        'assigned_to': (
            {
                'id':         bug.assigned_to.pk,
                'email':      bug.assigned_to.email,
                'first_name': bug.assigned_to.first_name,
                'last_name':  bug.assigned_to.last_name,
            }
            if bug.assigned_to_id else None
        ),
        'created_at': bug.created_at.isoformat(),
    }
 
 
# ── submit_bug ────────────────────────────────────────────────────────────────
 
@csrf_exempt
@require_http_methods(['POST'])
def submit_bug(request):
    """
    POST /api/bugs/
    Body: { "description": "..." }
    Auth is optional — if the user is logged in the report is associated with them,
    otherwise reporter is left null (anonymous).
    """
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return err('invalid_json')
 
    description = (payload.get('description') or '').strip()
    if not description:
        return err('description_required', 422)
 
    reporter = request.user if request.user.is_authenticated else None
 
    bug = BugReport.objects.create(
        description=description,
        reporter=reporter,
    )
 
    return JsonResponse(_bug_to_dict(bug), status=201)
 
 
# ── list_bugs ─────────────────────────────────────────────────────────────────
 
@require_http_methods(['GET'])
def list_bugs(request):
    """
    GET /api/bugs/
    Admin (is_staff=True) → all bug reports + list of developers for the assign dropdown.
    Developer (role='developer') → only bugs assigned to them.
    Others → 403.
    """
    if not request.user.is_authenticated:
        return err('not_authenticated', 401)
 
    user = request.user
 
    if user.is_staff:
        bugs = BugReport.objects.select_related('reporter', 'assigned_to').all()
        developers = list(
            User.objects
            .filter(role=User.ROLE_DEV)
            .values('id', 'email', 'first_name', 'last_name')
        )
        return JsonResponse({
            'bugs':       [_bug_to_dict(b) for b in bugs],
            'developers': developers,
        })
 
    if user.role == User.ROLE_DEV:
        bugs = (
            BugReport.objects
            .select_related('reporter', 'assigned_to')
            .filter(assigned_to=user)
        )
        return JsonResponse({'bugs': [_bug_to_dict(b) for b in bugs]})
 
    return err('forbidden', 403)
 
 
# ── assign_bug ────────────────────────────────────────────────────────────────
 
@csrf_exempt
@require_http_methods(['PATCH'])
def assign_bug(request, bug_id):
    """
    PATCH /api/bugs/<id>/assign/
    Body: { "developer_id": <int> | null }
    Admin only.  Pass null to unassign.
    """
    if not request.user.is_authenticated:
        return err('not_authenticated', 401)
 
    if not request.user.is_staff:
        return err('forbidden', 403)
 
    try:
        bug = BugReport.objects.get(pk=bug_id)
    except BugReport.DoesNotExist:
        return err('not_found', 404)
 
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return err('invalid_json')
 
    developer_id = payload.get('developer_id')
 
    if developer_id is None:
        bug.assigned_to = None
    else:
        try:
            developer = User.objects.get(pk=developer_id, role=User.ROLE_DEV)
        except User.DoesNotExist:
            return err('developer_not_found', 404)
        bug.assigned_to = developer
 
    bug.save(update_fields=['assigned_to'])
 
    return JsonResponse(_bug_to_dict(bug))
 

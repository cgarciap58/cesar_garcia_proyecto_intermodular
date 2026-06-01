from django.conf import settings
from django.db import models
 
 
class BugReport(models.Model):
    # Non-nullable: what the bug is.
    description = models.TextField()
 
    # Nullable: the user who filed it (None → anonymous).
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='filed_bug_reports',
    )
 
    # Nullable: a developer the admin has assigned this to (None → unassigned).
    # Enforced at the view layer: only users with role='developer' may be set here.
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_bug_reports',
    )
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        ordering = ['-created_at']
 
    def __str__(self):
        reporter_label = self.reporter.email if self.reporter_id else 'anonymous'
        return f'BugReport #{self.pk} by {reporter_label}'
 

from django.conf import settings
from django.db import models


class PatientProfile(models.Model):
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'patient_profiles'

    def __str__(self) -> str:
        return self.full_name

class Tickets(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    issue = models.TextField()
    assigned_developer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_tickets',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_tickets',
    )

    class Meta:
        db_table = 'tickets'
        ordering = ['-created_at']
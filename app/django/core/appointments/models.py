from django.db import models
from core.accounts.models import PatientProfile, PsychologistProfile


class AvailableSlot(models.Model):
    psychologist = models.ForeignKey(
        PsychologistProfile,
        on_delete=models.CASCADE,
        related_name='available_slots',
    )
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    is_booked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f'Slot({self.psychologist.user.username} @ {self.start_time})'


class Appointment(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_CANCELLED, 'Cancelled'),
    )

    slot = models.OneToOneField(
        AvailableSlot,
        on_delete=models.PROTECT,  # never delete a slot that has an appointment
        related_name='appointment',
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    private_notes = models.TextField(blank=True)   # psychologist only
    patient_notes = models.TextField(blank=True)   # homework / visible to patient
    meet_link = models.URLField(blank=True)        # future-proofing
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['slot__start_time']

    def __str__(self):
        return f'Appointment({self.patient.user.username} with {self.slot.psychologist.user.username} @ {self.slot.start_time} [{self.status}])'
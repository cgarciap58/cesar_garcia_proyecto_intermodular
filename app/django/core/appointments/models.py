from django.db import models
from core.accounts.models import PatientProfile, PsychologistProfile


class AvailableSlot(models.Model):
    """
    A time slot that a psychologist has opened for booking.

    Lifecycle:
      open      – visible on /book, requestable, deletable only when
                  no active (pending_request) appointments exist
      confirmed – exactly one appointment on this slot is confirmed;
                  cannot be deleted until that appointment is cancelled
      deleted   – soft-deleted by the psychologist; hidden from UI but
                  kept in DB for audit / appointment history
    """
    SLOT_OPEN      = 'open'
    SLOT_CONFIRMED = 'confirmed'
    SLOT_DELETED   = 'deleted'
    SLOT_CHOICES   = [
        (SLOT_OPEN,      'Open'),
        (SLOT_CONFIRMED, 'Confirmed'),
        (SLOT_DELETED,   'Deleted'),
    ]

    psychologist     = models.ForeignKey(
        PsychologistProfile,
        on_delete=models.CASCADE,
        related_name='available_slots',
    )
    start_time       = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    status           = models.CharField(
        max_length=20, choices=SLOT_CHOICES, default=SLOT_OPEN,
    )
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f'Slot({self.psychologist.user.username} @ {self.start_time} [{self.status}])'


class Appointment(models.Model):
    """
    A request / booking between a patient and a psychologist slot.

    Stored statuses (persisted to DB):
      pending_request – patient requested the slot; awaiting psych action
      confirmed       – psychologist confirmed this patient
      rejected        – psychologist rejected this specific request
                        (slot stays/returns to open)
      withdrawn       – patient withdrew their own pending request
                        (credits refunded; slot unaffected)
      cancelled       – a confirmed appointment was cancelled by either party
                        (credits refunded unless in_progress at cancel time)

    Computed statuses (derived at read time, never stored):
      in_progress     – stored=confirmed AND now is within [start, start+duration)
      done            – stored=confirmed AND now >= start+duration
    """
    STATUS_PENDING_REQUEST = 'pending_request'
    STATUS_CONFIRMED       = 'confirmed'
    STATUS_REJECTED        = 'rejected'
    STATUS_WITHDRAWN       = 'withdrawn'
    STATUS_CANCELLED       = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING_REQUEST, 'Pending request'),
        (STATUS_CONFIRMED,       'Confirmed'),
        (STATUS_REJECTED,        'Rejected'),
        (STATUS_WITHDRAWN,       'Withdrawn'),
        (STATUS_CANCELLED,       'Cancelled'),
    ]

    # ForeignKey (not OneToOne) — multiple patients can request the same slot.
    slot    = models.ForeignKey(
        AvailableSlot,
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    status  = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING_REQUEST,
    )

    private_notes = models.TextField(blank=True)   # psychologist-only
    patient_notes = models.TextField(blank=True)   # visible to patient after session
    meet_link     = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['slot__start_time']
        constraints = [
            # A patient can only have one active (non-terminal) request per slot.
            models.UniqueConstraint(
                fields=['slot', 'patient'],
                condition=models.Q(
                    status__in=['pending_request', 'confirmed']
                ),
                name='unique_active_appointment_per_slot_per_patient',
            )
        ]

    def __str__(self):
        return (
            f'Appointment('
            f'{self.patient.user.username} → '
            f'{self.slot.psychologist.user.username} '
            f'@ {self.slot.start_time} [{self.status}])'
        )

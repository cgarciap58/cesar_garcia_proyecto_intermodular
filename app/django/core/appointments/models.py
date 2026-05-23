from django.db import models
from core.accounts.models import PatientProfile, PsychologistProfile


class AvailableSlot(models.Model):
    # ── Slot lifecycle ──────────────────────────────────────────────────────
    # open      – visible in /book, requestable, deletable
    # confirmed – a confirmed appointment is attached; not deletable
    # deleted   – soft-deleted by the psychologist; hidden from UI
    SLOT_OPEN      = 'open'
    SLOT_CONFIRMED = 'confirmed'
    SLOT_DELETED   = 'deleted'
    SLOT_CHOICES = (
        (SLOT_OPEN,      'Open'),
        (SLOT_CONFIRMED, 'Confirmed'),
        (SLOT_DELETED,   'Deleted'),
    )

    psychologist = models.ForeignKey(
        PsychologistProfile,
        on_delete=models.CASCADE,
        related_name='available_slots',
    )
    start_time       = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField()
    status           = models.CharField(
        max_length=20,
        choices=SLOT_CHOICES,
        default=SLOT_OPEN,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f'Slot({self.psychologist.user.username} @ {self.start_time} [{self.status}])'


class Appointment(models.Model):
    # ── Stored statuses ─────────────────────────────────────────────────────
    # pending_request – patient requested, psychologist hasn't acted
    # confirmed       – psychologist confirmed this specific patient
    # rejected        – psychologist confirmed a different patient, or psych
    #                   cancelled before confirming; credits are refunded
    # cancelled       – a previously confirmed appointment was cancelled;
    #                   credits refunded only if not yet in_progress
    #
    # ── Computed statuses (derived at read time, never stored) ───────────────
    # in_progress – stored=confirmed AND now >= start_time
    # done        – stored=confirmed AND now >= start_time + duration_minutes
    STATUS_PENDING_REQUEST = 'pending_request'
    STATUS_CONFIRMED       = 'confirmed'
    STATUS_REJECTED        = 'rejected'
    STATUS_CANCELLED       = 'cancelled'
    STATUS_CHOICES = (
        (STATUS_PENDING_REQUEST, 'Pending request'),
        (STATUS_CONFIRMED,       'Confirmed'),
        (STATUS_REJECTED,        'Rejected'),
        (STATUS_CANCELLED,       'Cancelled'),
    )

    # ForeignKey (not OneToOne) because multiple patients can request the
    # same slot simultaneously — the psychologist picks one to confirm.
    slot = models.ForeignKey(
        AvailableSlot,
        on_delete=models.PROTECT,   # never hard-delete a slot that has appointments
        related_name='appointments',
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.PROTECT,
        related_name='appointments',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_REQUEST,
    )
    private_notes = models.TextField(blank=True)   # psychologist-only
    patient_notes = models.TextField(blank=True)   # visible to patient
    meet_link     = models.URLField(blank=True)    # future-proofing

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['slot__start_time']
        # One patient can only have one non-terminal request per slot.
        # This prevents double-requesting the same slot.
        constraints = [
            models.UniqueConstraint(
                fields=['slot', 'patient'],
                condition=models.Q(status__in=['pending_request', 'confirmed']),
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

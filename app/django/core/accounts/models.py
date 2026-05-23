from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, validate_email
from django.db import models
 
name_validator = RegexValidator(
    regex=r'^[a-zA-ZñÑáéíóúÁÉÍÓÚ-]+$',
    message='This field can only contain letters and hyphens.',
)
 
 
class User(AbstractUser):
    ROLE_PATIENT = 'patient'
    ROLE_PSYCHOLOGIST = 'psychologist'
    ROLE_DEV = 'developer'
    ROLE_CHOICES = (
        (ROLE_PATIENT, 'Patient'),
        (ROLE_PSYCHOLOGIST, 'Psychologist'),
        (ROLE_DEV, 'Developer')
    )
 
    email = models.EmailField(max_length=255, unique=True)
    first_name = models.CharField(max_length=255, validators=[name_validator])
    last_name = models.CharField(max_length=255, validators=[name_validator])
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    dob = models.DateField(blank=True, null=True)
    city = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
 
    # Every user has a timezone preference — patients need it to read appointment
    # times correctly, psychologists need it to set and display their slots.
    timezone = models.CharField(
        max_length=64,
        default='UTC',
        help_text='IANA timezone string, e.g. "Europe/Madrid"',
    )
 
    REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'role', 'dob']
 
 
class PatientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    concerns = models.TextField(blank=True)
    credits = models.PositiveIntegerField(default=0)
    def __str__(self):
        return f'PatientProfile<{self.user.username}>'
 
 
class PsychologistProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='psychologist_profile')
    country_code = models.CharField(max_length=2, blank=True)
    license_number = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(default=False)
    # session_duration_minutes is psych-specific: it determines how long
    # each slot they open will be, and thus the length of appointments.
    session_duration_minutes = models.PositiveIntegerField(default=55)
    session_price = models.DecimalField(
        max_digits=4, decimal_places=1, default=1.0
    )

    VERIFICATION_PENDING = 'pending'
    VERIFICATION_APPROVED = 'approved'
    VERIFICATION_REJECTED = 'rejected'
    VERIFICATION_CHOICES = (
        (VERIFICATION_PENDING, 'Pending'),
        (VERIFICATION_APPROVED, 'Approved'),
        (VERIFICATION_REJECTED, 'Rejected'),
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_CHOICES,
        default=VERIFICATION_PENDING,
    )
 
    def __str__(self):
        return f'PsychologistProfile<{self.user.username}>'

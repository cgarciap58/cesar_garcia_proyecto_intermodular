from django.contrib.auth.models import AbstractUser
from django.db import models


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
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    dob = models.DateField(blank=True, null=True)
    city = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)

    REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'role', 'dob']


class PatientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    concerns = models.TextField(blank=True)

    def __str__(self):
        return f'PatientProfile<{self.user.username}>'


class PsychologistProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='psychologist_profile')
    country_code = models.CharField(max_length=2)
    license_number = models.CharField(max_length=100)
    is_verified = models.BooleanField(default=False)

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
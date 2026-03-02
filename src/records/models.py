from django.db import models


class PatientProfile(models.Model):
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'patient_profiles'

    def __str__(self) -> str:
        return self.full_name

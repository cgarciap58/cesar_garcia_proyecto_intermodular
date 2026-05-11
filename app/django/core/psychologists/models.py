# Aquí se definen los campos necesarios para los usuarios psicólogos, a partir de una extensión del usuario base
class PsychologistProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    specialty = models.CharField(max_length=255)

    is_verified = models.BooleanField(default=False)

    verification_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ],
        default='pending'
    )
class User(AbstractUser):
    ROLE_CHOICES = (
        ('patient', 'Patient'),
        ('psychologist', 'Psychologist'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES) # Rol

    dob = models.DateField() # Fecha de nacimiento
    city = models.CharField(max_length=255) # Ciudad
    phone_number = models.CharField(max_length=30) # Número de teléfono

    profile_picture = models.ImageField(
        upload_to='profiles/',
        blank=True,
        null=True
    ) # Foto de perfil
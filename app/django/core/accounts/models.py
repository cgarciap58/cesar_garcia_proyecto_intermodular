
class User(AbstractUser):
    ROLE_CHOICES = (
        ('patient', 'Patient'),
        ('psychologist', 'Psychologist'),
    )

    name = models.CharField(max_length=255) # Nombre
    role = models.CharField(max_length=20, choices=ROLE_CHOICES) # Rol

    dob = models.DateField() # Fecha de nacimiento
    city = models.CharField(max_length=255) # Ciudad
    phone_number = models.CharField(max_length=30) # Número de teléfono

    email = models.EmailField(max_length=255) # Email

    profile_picture = models.ImageField(
        upload_to='profiles/',
        blank=True,
        null=True
    ) # Foto de perfil
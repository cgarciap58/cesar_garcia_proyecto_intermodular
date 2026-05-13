from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from core.accounts.models import PatientProfile, PsychologistProfile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_staff',
        'is_active',
    )

    fieldsets = UserAdmin.fieldsets + (
        ('Additional info', {
            'fields': (
                'role',
                'dob',
                'city',
                'phone_number',
                'profile_picture',
            )
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional info', {
            'fields': (
                'email',
                'first_name',
                'last_name',
                'role',
                'dob',
                'city',
                'phone_number',
                'profile_picture',
            )
        }),
    )


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'concerns')
    search_fields = (
        'user__username',
        'user__email',
        'user__first_name',
        'user__last_name',
    )


@admin.register(PsychologistProfile)
class PsychologistProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'license_number',
        'specialty',
        'is_verified',
        'verification_status',
    )
    list_filter = ('is_verified', 'verification_status')
    search_fields = (
        'user__username',
        'user__email',
        'user__first_name',
        'user__last_name',
        'license_number',
        'specialty',
    )
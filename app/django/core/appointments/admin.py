from django.contrib import admin
from .models import AvailableSlot, Appointment


@admin.register(AvailableSlot)
class AvailableSlotAdmin(admin.ModelAdmin):
    list_display = (
        'psychologist',
        'start_time',
        'duration_minutes',
        'is_booked',
        'created_at',
    )
    list_filter = ('is_booked', 'psychologist')
    search_fields = (
        'psychologist__user__username',
        'psychologist__user__email',
    )
    ordering = ('start_time',)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'patient',
        'get_psychologist',
        'get_start_time',
        'status',
        'created_at',
        'updated_at',
    )
    list_filter = ('status',)
    search_fields = (
        'patient__user__username',
        'patient__user__email',
        'slot__psychologist__user__username',
    )
    readonly_fields = ('created_at', 'updated_at')

    # Se saca todo menos las notas privadas del psicólogo por privacidad
    
    @admin.display(description='Psychologist')
    def get_psychologist(self, obj):
        return obj.slot.psychologist

    @admin.display(description='Start time', ordering='slot__start_time')
    def get_start_time(self, obj):
        return obj.slot.start_time
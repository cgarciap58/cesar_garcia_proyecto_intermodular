# Lógica para sesiones entre psicólogos y pacientes

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_datetime

from .models import AvailableSlot, Appointment
from core.accounts.models import PatientProfile, PsychologistProfile


# ─── Helpers ────────────────────────────────────────────────────────────────

def require_auth(request):
    """Returns the user if authenticated, else None."""
    if not request.user.is_authenticated:
        return None
    return request.user


def slot_to_dict(slot):
    return {
        'id': slot.id,
        'start_time': slot.start_time.isoformat(),
        'duration_minutes': slot.duration_minutes,
        'is_booked': slot.is_booked,
        'created_at': slot.created_at.isoformat(),
    }


def appointment_to_dict(appointment, for_role):
    data = {
        'id': appointment.id,
        'status': appointment.status,
        'slot': slot_to_dict(appointment.slot),
        'patient': {
            'id': appointment.patient.user.id,
            'first_name': appointment.patient.user.first_name,
            'last_name': appointment.patient.user.last_name,
            'email': appointment.patient.user.email,
        },
        'psychologist': {
            'id': appointment.slot.psychologist.user.id,
            'first_name': appointment.slot.psychologist.user.first_name,
            'last_name': appointment.slot.psychologist.user.last_name,
            'email': appointment.slot.psychologist.user.email,
        },
        'patient_notes': appointment.patient_notes,
        'meet_link': appointment.meet_link,
        'created_at': appointment.created_at.isoformat(),
        'updated_at': appointment.updated_at.isoformat(),
    }

    # Las notas privadas solo las ven los psicólogos
    if for_role == 'psychologist':
        data['private_notes'] = appointment.private_notes

    return data


# ─── Funciones para los huecos disponibles ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def slots_list(request):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # GET — return all slots belonging to this psychologist
    if request.method == 'GET':
        if user.role != 'psychologist':
            return JsonResponse({'error': 'Only psychologists can view their slots'}, status=403)

        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        slots = AvailableSlot.objects.filter(psychologist=profile)
        return JsonResponse({'slots': [slot_to_dict(s) for s in slots]})

    # POST — create one or more slots
    if request.method == 'POST':
        if user.role != 'psychologist':
            return JsonResponse({'error': 'Only psychologists can create slots'}, status=403)

        try:
            profile = user.psychologist_profile
        except PsychologistProfile.DoesNotExist:
            return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        start_times = payload.get('start_times')
        if not isinstance(start_times, list) or len(start_times) == 0:
            return JsonResponse({'error': 'start_times must be a non-empty list'}, status=400)

        created = []
        errors = []

        for raw in start_times:
            dt = parse_datetime(raw)
            if dt is None:
                errors.append(f'Invalid datetime: {raw}')
                continue

            slot = AvailableSlot.objects.create(
                psychologist=profile,
                start_time=dt,
                duration_minutes=profile.session_duration_minutes,
            )
            created.append(slot_to_dict(slot))

        return JsonResponse({'created': created, 'errors': errors}, status=201)


@csrf_exempt
@require_http_methods(['DELETE'])
def slot_detail(request, slot_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can delete slots'}, status=403)

    try:
        slot = AvailableSlot.objects.get(id=slot_id, psychologist=user.psychologist_profile)
    except AvailableSlot.DoesNotExist:
        return JsonResponse({'error': 'Slot not found'}, status=404)

    if slot.is_booked:
        return JsonResponse({'error': 'Cannot delete a booked slot'}, status=409)

    slot.delete()
    return JsonResponse({'message': 'Slot deleted'}, status=200)


# ─── Appointment views ───────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def appointments_list(request):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # GET — each role sees their own appointments
    if request.method == 'GET':
        if user.role == 'patient':
            try:
                profile = user.patient_profile
            except PatientProfile.DoesNotExist:
                return JsonResponse({'error': 'Patient profile not found'}, status=404)

            # EXPLICAR EN LA PRESENTACIÓN
            appointments = Appointment.objects.filter(patient=profile).select_related(
                'slot__psychologist__user', 'patient__user'
            )
            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'patient') for a in appointments]
            })

        if user.role == 'psychologist':
            try:
                profile = user.psychologist_profile
            except PsychologistProfile.DoesNotExist:
                return JsonResponse({'error': 'Psychologist profile not found'}, status=404)

            appointments = Appointment.objects.filter(slot__psychologist=profile).select_related(
                'slot__psychologist__user', 'patient__user'
            )
            return JsonResponse({
                'appointments': [appointment_to_dict(a, 'psychologist') for a in appointments]
            })

        return JsonResponse({'error': 'Invalid role'}, status=403)

    # POST — patient books a slot
    if request.method == 'POST':
        if user.role != 'patient':
            return JsonResponse({'error': 'Only patients can book appointments'}, status=403)

        try:
            patient_profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            return JsonResponse({'error': 'Patient profile not found'}, status=404)

        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        slot_id = payload.get('slot_id')
        if not slot_id:
            return JsonResponse({'error': 'slot_id is required'}, status=400)

        try:
            slot = AvailableSlot.objects.get(id=slot_id)
        except AvailableSlot.DoesNotExist:
            return JsonResponse({'error': 'Slot not found'}, status=404)

        if slot.is_booked:
            return JsonResponse({'error': 'Slot is already booked'}, status=409)

        # Mark slot as booked and create the appointment atomically
        slot.is_booked = True
        slot.save()

        appointment = Appointment.objects.create(
            slot=slot,
            patient=patient_profile,
            status=Appointment.STATUS_PENDING,
        )

        return JsonResponse(appointment_to_dict(appointment, 'patient'), status=201)


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_confirm(request, appointment_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    if user.role != 'psychologist':
        return JsonResponse({'error': 'Only psychologists can confirm appointments'}, status=403)

    try:
        appointment = Appointment.objects.get(
            id=appointment_id,
            slot__psychologist=user.psychologist_profile,
        )
    except Appointment.DoesNotExist:
        return JsonResponse({'error': 'Appointment not found'}, status=404)

    if appointment.status != Appointment.STATUS_PENDING:
        return JsonResponse(
            {'error': f'Cannot confirm an appointment with status: {appointment.status}'},
            status=409,
        )

    appointment.status = Appointment.STATUS_CONFIRMED
    appointment.save()

    return JsonResponse(appointment_to_dict(appointment, 'psychologist'))


@csrf_exempt
@require_http_methods(['PATCH'])
def appointment_cancel(request, appointment_id):
    user = require_auth(request)
    if not user:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    # Find the appointment based on role — each can only cancel their own
    if user.role == 'patient':
        try:
            appointment = Appointment.objects.get(
                id=appointment_id,
                patient=user.patient_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)

    elif user.role == 'psychologist':
        try:
            appointment = Appointment.objects.get(
                id=appointment_id,
                slot__psychologist=user.psychologist_profile,
            )
        except Appointment.DoesNotExist:
            return JsonResponse({'error': 'Appointment not found'}, status=404)

    else:
        return JsonResponse({'error': 'Invalid role'}, status=403)

    if appointment.status == Appointment.STATUS_CANCELLED:
        return JsonResponse({'error': 'Appointment is already cancelled'}, status=409)

    appointment.status = Appointment.STATUS_CANCELLED
    # Free the slot back up so another patient can book it
    appointment.slot.is_booked = False
    appointment.slot.save()
    appointment.save()

    role = user.role
    return JsonResponse(appointment_to_dict(appointment, role))
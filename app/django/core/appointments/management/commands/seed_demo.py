from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from core.accounts.models import User, PatientProfile, PsychologistProfile
from core.appointments.models import AvailableSlot, Appointment


PSYCHOLOGISTS = [
    {
        'username': 'dr.ana.garcia@demo.com',
        'email': 'dr.ana.garcia@demo.com',
        'first_name': 'Ana',
        'last_name': 'Garcia',
        'password': 'demopass123',
        'license_number': 'ES-PSY-001',
        'country_code': 'ES',
        'session_duration_minutes': 50,
    },
    {
        'username': 'dr.james.ford@demo.com',
        'email': 'dr.james.ford@demo.com',
        'first_name': 'James',
        'last_name': 'Ford',
        'password': 'demopass123',
        'license_number': 'US-PSY-042',
        'country_code': 'US',
        'session_duration_minutes': 60,
    },
    {
        'username': 'dr.claire.dubois@demo.com',
        'email': 'dr.claire.dubois@demo.com',
        'first_name': 'Claire',
        'last_name': 'Dubois',
        'password': 'demopass123',
        'license_number': 'FR-PSY-117',
        'country_code': 'FR',
        'session_duration_minutes': 45,
    },
]

PATIENTS = [
    {
        'username': 'mario.rossi@demo.com',
        'email': 'mario.rossi@demo.com',
        'first_name': 'Mario',
        'last_name': 'Rossi',
        'password': 'demopass123',
        'concerns': 'Anxiety and work stress.',
    },
    {
        'username': 'laura.smith@demo.com',
        'email': 'laura.smith@demo.com',
        'first_name': 'Laura',
        'last_name': 'Smith',
        'password': 'demopass123',
        'concerns': 'Sleep difficulties and low mood.',
    },
    {
        'username': 'carlos.vega@demo.com',
        'email': 'carlos.vega@demo.com',
        'first_name': 'Carlos',
        'last_name': 'Vega',
        'password': 'demopass123',
        'concerns': 'Grief and life transitions.',
    },
]


class Command(BaseCommand):
    help = 'Seeds the database with demo psychologists, patients, slots and appointments.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Clearing existing demo data...')
        self._clear_demo_data()

        self.stdout.write('Creating psychologists...')
        psych_profiles = [self._create_psychologist(p) for p in PSYCHOLOGISTS]

        self.stdout.write('Creating patients...')
        patient_profiles = [self._create_patient(p) for p in PATIENTS]

        self.stdout.write('Creating slots...')
        # Each psychologist gets 3 slots spread over the next 2 weeks
        all_slots = []
        now = timezone.now().replace(minute=0, second=0, microsecond=0)

        for i, profile in enumerate(psych_profiles):
            slots = [
                AvailableSlot.objects.create(
                    psychologist=profile,
                    start_time=now + timedelta(days=2 + i, hours=10),
                    duration_minutes=profile.session_duration_minutes,
                ),
                AvailableSlot.objects.create(
                    psychologist=profile,
                    start_time=now + timedelta(days=5 + i, hours=14),
                    duration_minutes=profile.session_duration_minutes,
                ),
                AvailableSlot.objects.create(
                    psychologist=profile,
                    start_time=now + timedelta(days=9 + i, hours=11),
                    duration_minutes=profile.session_duration_minutes,
                ),
            ]
            all_slots.append(slots)
            self.stdout.write(f'  3 slots created for {profile.user.email}')

        self.stdout.write('Creating appointments...')

        # Appointment 1: Mario books Ana's first slot \u2192 confirmed
        slot_1 = all_slots[0][0]
        slot_1.is_booked = True
        slot_1.save()
        Appointment.objects.create(
            slot=slot_1,
            patient=patient_profiles[0],
            status=Appointment.STATUS_CONFIRMED,
            patient_notes='Please keep a mood journal this week.',
            private_notes='Patient showing progress. Increase session frequency?',
        )
        self.stdout.write(f'  Appointment 1: {patient_profiles[0].user.first_name} \u2192 {slot_1.psychologist.user.last_name} [confirmed]')

        # Appointment 2: Laura books James's first slot \u2192 pending
        slot_2 = all_slots[1][0]
        slot_2.is_booked = True
        slot_2.save()
        Appointment.objects.create(
            slot=slot_2,
            patient=patient_profiles[1],
            status=Appointment.STATUS_PENDING,
            patient_notes='',
            private_notes='First session. Intake assessment needed.',
        )
        self.stdout.write(f'  Appointment 2: {patient_profiles[1].user.first_name} \u2192 {slot_2.psychologist.user.last_name} [pending]')

        # Appointment 3: Carlos books Ana's second slot \u2192 cancelled
        slot_3 = all_slots[0][1]
        slot_3.is_booked = True
        slot_3.save()
        appt_3 = Appointment.objects.create(
            slot=slot_3,
            patient=patient_profiles[2],
            status=Appointment.STATUS_CANCELLED,
            patient_notes='',
            private_notes='',
        )
        # On cancellation the slot should be free again
        slot_3.is_booked = False
        slot_3.save()
        self.stdout.write(f'  Appointment 3: {patient_profiles[2].user.first_name} \u2192 {slot_3.psychologist.user.last_name} [cancelled]')

        self.stdout.write(self.style.SUCCESS('\nDemo data seeded successfully!'))
        self.stdout.write('\nDemo credentials (all passwords: demopass123):')
        self.stdout.write('  Psychologists:')
        for p in PSYCHOLOGISTS:
            self.stdout.write(f'    {p["email"]}')
        self.stdout.write('  Patients:')
        for p in PATIENTS:
            self.stdout.write(f'    {p["email"]}')

    def _clear_demo_data(self):
        demo_emails = (
            [p['email'] for p in PSYCHOLOGISTS] +
            [p['email'] for p in PATIENTS]
        )
        # Deleting users cascades to profiles, slots, and appointments
        User.objects.filter(email__in=demo_emails).delete()

    def _create_psychologist(self, data):
        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            password=data['password'],
            role='psychologist',
        )
        profile = PsychologistProfile.objects.create(
            user=user,
            license_number=data['license_number'],
            country_code=data['country_code'],
            session_duration_minutes=data['session_duration_minutes'],
        )
        self.stdout.write(f'  Created psychologist: {user.email}')
        return profile

    def _create_patient(self, data):
        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            password=data['password'],
            role='patient',
        )
        profile = PatientProfile.objects.create(
            user=user,
            concerns=data['concerns'],
        )
        self.stdout.write(f'  Created patient: {user.email}')
        return profile
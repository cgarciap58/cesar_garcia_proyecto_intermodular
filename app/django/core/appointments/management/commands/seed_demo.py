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

        # Helper for creating historical slots
        def create_past_slot(psychologist, days_ago, hour):
            return AvailableSlot.objects.create(
                psychologist=psychologist,
                start_time=now - timedelta(days=days_ago) + timedelta(hours=hour),
                duration_minutes=psychologist.session_duration_minutes,
                is_booked=True,
            )

        # ---------------------------------------------------------
        # HISTORICAL SERIES: Mario + Dr. Ana (3 completed sessions)
        # ---------------------------------------------------------

        mario = patient_profiles[0]
        laura = patient_profiles[1]
        carlos = patient_profiles[2]

        ana = psych_profiles[0]
        james = psych_profiles[1]
        claire = psych_profiles[2]

        historical_slots = [
            create_past_slot(ana, 28, 10),
            create_past_slot(ana, 14, 10),
            create_past_slot(ana, 7, 10),
        ]

        historical_notes = [
            'Initial anxiety assessment completed. Introduced grounding exercises.',
            'Reported reduced work-related rumination. Breathing exercises helping.',
            'Strong progress. Discussed resilience strategies for upcoming workload.',
        ]

        for i, slot in enumerate(historical_slots):
            Appointment.objects.create(
                slot=slot,
                patient=mario,
                status=Appointment.STATUS_CONFIRMED,
                patient_notes='',
                private_notes=historical_notes[i],
            )
            self.stdout.write(
                f'  Historical session {i+1}: {mario.user.first_name} → {ana.user.last_name} [confirmed]'
            )

        # ---------------------------------------------------------
        # Past completed session: Laura + James
        # ---------------------------------------------------------

        past_slot_laura = create_past_slot(james, 10, 14)

        Appointment.objects.create(
            slot=past_slot_laura,
            patient=laura,
            status=Appointment.STATUS_CONFIRMED,
            patient_notes='',
            private_notes='Initial intake completed. Sleep hygiene intervention assigned.',
        )

        self.stdout.write(
            f'  Historical session: {laura.user.first_name} → {james.user.last_name} [confirmed]'
        )

        # ---------------------------------------------------------
        # Past cancelled session: Carlos + Claire
        # ---------------------------------------------------------

        cancelled_slot = create_past_slot(claire, 5, 11)

        Appointment.objects.create(
            slot=cancelled_slot,
            patient=carlos,
            status=Appointment.STATUS_CANCELLED,
            patient_notes='',
            private_notes='',
        )

        cancelled_slot.is_booked = False
        cancelled_slot.save()

        self.stdout.write(
            f'  Historical session: {carlos.user.first_name} → {claire.user.last_name} [cancelled]'
        )

        # ---------------------------------------------------------
        # FUTURE APPOINTMENTS (must have no notes)
        # ---------------------------------------------------------

        future_appointments = [
            (all_slots[0][0], mario, Appointment.STATUS_CONFIRMED),
            (all_slots[1][0], laura, Appointment.STATUS_PENDING),
            (all_slots[2][0], carlos, Appointment.STATUS_CONFIRMED),
            (all_slots[0][2], mario, Appointment.STATUS_PENDING),
            (all_slots[1][1], laura, Appointment.STATUS_CONFIRMED),
        ]

        for idx, (slot, patient, status) in enumerate(future_appointments, start=1):
            slot.is_booked = True
            slot.save()

            Appointment.objects.create(
                slot=slot,
                patient=patient,
                status=status,
                patient_notes='',
                private_notes='',
            )

            self.stdout.write(
                f'  Future appointment {idx}: {patient.user.first_name} → '
                f'{slot.psychologist.user.last_name} [{status}]'
            )

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

        psychologists = PsychologistProfile.objects.filter(
            user__email__in=demo_emails
        )
        patients = PatientProfile.objects.filter(
            user__email__in=demo_emails
        )

        # Delete appointments first
        Appointment.objects.filter(
            slot__psychologist__in=psychologists
        ).delete()

        Appointment.objects.filter(
            patient__in=patients
        ).delete()

        # Then slots
        AvailableSlot.objects.filter(
            psychologist__in=psychologists
        ).delete()

        # Then profiles
        psychologists.delete()
        patients.delete()

        # Finally users
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
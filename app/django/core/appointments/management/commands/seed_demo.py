"""
seed_demo.py — Populates the database with realistic Spanish demo data.

Run:  python manage.py seed_demo

All users:
  timezone   → Europe/Madrid
  city       → varies (all Spanish cities)
  country    → ES
  password   → demopass123

Scenario overview
─────────────────
Psychologists
  • Dra. Elena Martínez   (verified, 55 min sessions, Madrid)
  • Dr. Alejandro Ruiz    (verified, 50 min sessions, Barcelona)

Patients
  • Sofía Navarro   — ansiedad y estrés laboral
  • Marcos Delgado  — problemas de sueño y estado de ánimo bajo
  • Lucía Ferrer    — duelo y cambios vitales
  • Pablo Sánchez   — dificultades de concentración y procrastinación

Historical sessions (done, with notes)
  Sofía  + Elena  × 3  (serie completa, notas de progreso)
  Marcos + Elena  × 2  (pareja de sesiones, notas de seguimiento)
  Lucía  + Alejandro × 2 (dos sesiones con notas)

Future state
  Sofía  → confirmed appointment with Elena (upcoming)
  Marcos → pending_request to Elena (waiting for confirmation)
  Pablo  → two competing pending_requests to Elena for the same slot
  Lucía  → confirmed appointment with Alejandro (upcoming)
  One slot with a past cancelled appointment (Sofía + Alejandro, was confirmed)
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from core.accounts.models import User, PatientProfile, PsychologistProfile
from core.appointments.models import AvailableSlot, Appointment


# ─── Demo user definitions ────────────────────────────────────────────────────

PSYCHOLOGISTS = [
    {
        'email':                    'dra.elena.martinez@demo.com',
        'first_name':               'Elena',
        'last_name':                'Martínez',
        'city':                     'Madrid',
        'license_number':           'ES-PSY-2201',
        'country_code':             'ES',
        'session_duration_minutes': 55,
        'session_price':            '1.0',
        'is_verified':              True,
        'verification_status':      'approved',
    },
    {
        'email':                    'dr.alejandro.ruiz@demo.com',
        'first_name':               'Alejandro',
        'last_name':                'Ruiz',
        'city':                     'Barcelona',
        'license_number':           'ES-PSY-3314',
        'country_code':             'ES',
        'session_duration_minutes': 50,
        'session_price':            '1.5',
        'is_verified':              True,
        'verification_status':      'approved',
    },
]

PATIENTS = [
    {
        'email':      'sofia.navarro@demo.com',
        'first_name': 'Sofía',
        'last_name':  'Navarro',
        'city':       'Madrid',
        'concerns':   'Ansiedad generalizada y estrés relacionado con el trabajo. '
                      'Dificultad para desconectar fuera del horario laboral.',
        'credits':    5,
    },
    {
        'email':      'marcos.delgado@demo.com',
        'first_name': 'Marcos',
        'last_name':  'Delgado',
        'city':       'Sevilla',
        'concerns':   'Problemas de sueño y estado de ánimo bajo. '
                      'Le cuesta levantarse y mantener la motivación durante el día.',
        'credits':    3,
    },
    {
        'email':      'lucia.ferrer@demo.com',
        'first_name': 'Lucía',
        'last_name':  'Ferrer',
        'city':       'Valencia',
        'concerns':   'Duelo tras la pérdida de un familiar cercano. '
                      'Cambios vitales importantes en el último año.',
        'credits':    4,
    },
    {
        'email':      'pablo.sanchez@demo.com',
        'first_name': 'Pablo',
        'last_name':  'Sánchez',
        'city':       'Zaragoza',
        'concerns':   'Dificultades de concentración y tendencia a procrastinar. '
                      'Le gustaría mejorar su organización personal.',
        'credits':    6,
    },
]

PASSWORD    = 'demopass123'
TIMEZONE    = 'Europe/Madrid'

ALL_EMAILS  = [p['email'] for p in PSYCHOLOGISTS] + [p['email'] for p in PATIENTS]


# ─── Command ──────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = 'Seeds the database with Spanish demo data using the new appointment model.'

    def handle(self, *args, **kwargs):
        with transaction.atomic():
            self._clear()
            psych_profiles   = [self._make_psychologist(d) for d in PSYCHOLOGISTS]
            patient_profiles = [self._make_patient(d) for d in PATIENTS]
            self._seed_scenario(psych_profiles, patient_profiles)

        self._print_credentials()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _clear(self):
        self.stdout.write('  Clearing previous demo data…')
        psychs   = PsychologistProfile.objects.filter(user__email__in=ALL_EMAILS)
        patients = PatientProfile.objects.filter(user__email__in=ALL_EMAILS)
        Appointment.objects.filter(slot__psychologist__in=psychs).delete()
        Appointment.objects.filter(patient__in=patients).delete()
        AvailableSlot.objects.filter(psychologist__in=psychs).delete()
        psychs.delete()
        patients.delete()
        User.objects.filter(email__in=ALL_EMAILS).delete()

    def _make_psychologist(self, d):
        from decimal import Decimal
        user = User.objects.create_user(
            username   = d['email'],
            email      = d['email'],
            first_name = d['first_name'],
            last_name  = d['last_name'],
            password   = PASSWORD,
            role       = 'psychologist',
            city       = d['city'],
            timezone   = TIMEZONE,
        )
        profile = PsychologistProfile.objects.create(
            user                     = user,
            license_number           = d['license_number'],
            country_code             = d['country_code'],
            session_duration_minutes = d['session_duration_minutes'],
            session_price            = Decimal(d['session_price']),
            is_verified              = d['is_verified'],
            verification_status      = d['verification_status'],
        )
        self.stdout.write(f'    Psych: {user.get_full_name()} ({user.email})')
        return profile

    def _make_patient(self, d):
        user = User.objects.create_user(
            username   = d['email'],
            email      = d['email'],
            first_name = d['first_name'],
            last_name  = d['last_name'],
            password   = PASSWORD,
            role       = 'patient',
            city       = d['city'],
            timezone   = TIMEZONE,
        )
        profile = PatientProfile.objects.create(
            user     = user,
            concerns = d['concerns'],
            credits  = d['credits'],
        )
        self.stdout.write(f'    Patient: {user.get_full_name()} ({user.email})')
        return profile

    def _make_past_slot(self, psych, days_ago, hour, minute=0):
        """Create a slot in the past (already done). status=confirmed."""
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        start = now - timedelta(days=days_ago) + timedelta(hours=hour, minutes=minute)
        slot = AvailableSlot.objects.create(
            psychologist     = psych,
            start_time       = start,
            duration_minutes = psych.session_duration_minutes,
            status           = AvailableSlot.SLOT_CONFIRMED,
        )
        return slot

    def _make_future_slot(self, psych, days_ahead, hour, minute=0, status=None):
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        start = now + timedelta(days=days_ahead) + timedelta(hours=hour, minutes=minute)
        slot = AvailableSlot.objects.create(
            psychologist     = psych,
            start_time       = start,
            duration_minutes = psych.session_duration_minutes,
            status           = status or AvailableSlot.SLOT_OPEN,
        )
        return slot

    # ── Main scenario ─────────────────────────────────────────────────────────

    def _seed_scenario(self, psychs, patients):
        elena, alejandro = psychs
        sofia, marcos, lucia, pablo = patients

        now = timezone.now()

        self.stdout.write('\n  Building scenario…')

        # ── HISTORICAL: Sofía × Elena (3 sessions, oldest → newest) ──────────
        # Session 1 — initial assessment, 5 weeks ago
        s1 = self._make_past_slot(elena, 35, 10)
        Appointment.objects.create(
            slot          = s1,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Trabajar en el diario de pensamientos automáticos. '
                'Registrar situaciones de estrés durante la semana con su intensidad (0–10).'
            ),
            private_notes = (
                'Primera sesión. Sofía presenta ansiedad de rendimiento acentuada. '
                'Introvertida, tiende a rumiar. Buen nivel de introspección. '
                'Comenzamos con psicoeducación sobre el ciclo estrés-activación.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 1 (hace 5 sem.)')

        # Session 2 — follow-up, 3 weeks ago
        s2 = self._make_past_slot(elena, 21, 10)
        Appointment.objects.create(
            slot          = s2,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Continuar con el diario. Practicar la respiración diafragmática 5 min/día. '
                'Identificar al menos un "logro pequeño" cada tarde.'
            ),
            private_notes = (
                'Trajo el diario, cumplimentado. Registró 4 episodios de rumiación. '
                'Mejora leve en la percepción de control. Introducimos reestructuración cognitiva básica. '
                'Pendiente: reforzar autocompasión, tendencia a la autocrítica elevada.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 2 (hace 3 sem.)')

        # Session 3 — recent, 1 week ago
        s3 = self._make_past_slot(elena, 7, 10)
        Appointment.objects.create(
            slot          = s3,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Practicar la técnica de "pausa de 3 pasos" ante situaciones de estrés. '
                'Leer el capítulo 3 del material adjunto sobre valores personales.'
            ),
            private_notes = (
                'Refiere menos episodios de rumiación nocturna. '
                'Empezamos a trabajar el área de valores y ACT muy superficialmente. '
                'Para la próxima sesión: explorar la relación con su manager, parece un disparador central.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 3 (hace 1 sem.)')

        # ── HISTORICAL: Marcos × Elena (2 sessions) ──────────────────────────
        m1 = self._make_past_slot(elena, 28, 16)
        Appointment.objects.create(
            slot          = m1,
            patient       = marcos,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Mantener un registro de horas de sueño y calidad percibida (1–5). '
                'Evitar pantallas al menos 45 min antes de acostarse esta semana.'
            ),
            private_notes = (
                'Primera sesión con Marcos. Presenta insomnio de conciliación (>1h) y '
                'despertares frecuentes. Estado de ánimo bajo pero sin ideación depresiva. '
                'Comenzamos psicoeducación sobre higiene del sueño.'
            ),
        )
        self.stdout.write('    [done] Marcos × Elena — sesión 1 (hace 4 sem.)')

        m2 = self._make_past_slot(elena, 14, 16)
        Appointment.objects.create(
            slot          = m2,
            patient       = marcos,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Seguir con el registro de sueño. Añadir una actividad activante al día '
                '(paseo, deporte suave) — mínimo 20 min.'
            ),
            private_notes = (
                'El registro muestra mejora marginal: de 75 min a 50 min de latencia. '
                'Identifica que el móvil antes de dormir es un factor claro. '
                'Pendiente: valorar si hay componente depresivo mayor en próxima sesión (PHQ-9).'
            ),
        )
        self.stdout.write('    [done] Marcos × Elena — sesión 2 (hace 2 sem.)')

        # ── HISTORICAL: Lucía × Alejandro (2 sessions) ───────────────────────
        l1 = self._make_past_slot(alejandro, 30, 11)
        Appointment.objects.create(
            slot          = l1,
            patient       = lucia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Escribir una carta a la persona que perdiste, sin enviarla. '
                'Habla con alguien de confianza sobre un recuerdo bonito de esa persona.'
            ),
            private_notes = (
                'Lucía está atravesando un duelo complicado (pérdida de su madre, 4 meses). '
                'Llanto frecuente, evitación de recuerdos. Sin señales de alerta clínica. '
                'Psicoeducación sobre fases del duelo. Buen vínculo terapéutico desde el inicio.'
            ),
        )
        self.stdout.write('    [done] Lucía × Alejandro — sesión 1 (hace 4 sem.)')

        l2 = self._make_past_slot(alejandro, 16, 11)
        Appointment.objects.create(
            slot          = l2,
            patient       = lucia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Continuar el diario de recuerdos. '
                'Identificar qué aspectos de tu vida quieres recuperar o transformar.'
            ),
            private_notes = (
                'Leyó su carta en sesión — muy emocionante, buen trabajo. '
                'Empieza a integrar la pérdida. Habló por primera vez de planes a medio plazo. '
                'Próxima sesión: explorar reconstrucción de identidad post-duelo.'
            ),
        )
        self.stdout.write('    [done] Lucía × Alejandro — sesión 2 (hace 2 sem.)')

        # ── FUTURE: Sofía → confirmed with Elena ─────────────────────────────
        sf = self._make_future_slot(elena, 5, 10, status=AvailableSlot.SLOT_CONFIRMED)
        Appointment.objects.create(
            slot    = sf,
            patient = sofia,
            status  = Appointment.STATUS_CONFIRMED,
        )
        self.stdout.write('    [confirmed] Sofía × Elena — próxima (en 5 días)')

        # ── FUTURE: Marcos → pending_request to Elena ─────────────────────────
        mf = self._make_future_slot(elena, 8, 16)
        marcos.credits -= 1
        marcos.save(update_fields=['credits'])
        Appointment.objects.create(
            slot    = mf,
            patient = marcos,
            status  = Appointment.STATUS_PENDING_REQUEST,
        )
        self.stdout.write('    [pending] Marcos → Elena — solicitud enviada (en 8 días)')

        # ── FUTURE: Pablo and Marcos competing on the same slot ───────────────
        # This slot stays OPEN because no one is confirmed yet
        contested = self._make_future_slot(elena, 12, 10)
        for patient, cost in [(pablo, 1), (marcos, 1)]:
            patient.credits -= cost
            patient.save(update_fields=['credits'])
            Appointment.objects.create(
                slot    = contested,
                patient = patient,
                status  = Appointment.STATUS_PENDING_REQUEST,
            )
        self.stdout.write('    [pending×2] Pablo + Marcos → misma franja Elena (en 12 días)')

        # ── FUTURE: Lucía → confirmed with Alejandro ─────────────────────────
        lf = self._make_future_slot(alejandro, 6, 11, status=AvailableSlot.SLOT_CONFIRMED)
        Appointment.objects.create(
            slot    = lf,
            patient = lucia,
            status  = Appointment.STATUS_CONFIRMED,
        )
        self.stdout.write('    [confirmed] Lucía × Alejandro — próxima (en 6 días)')

        # ── PAST CANCELLED: Sofía had a session with Alejandro that was cancelled
        sc = self._make_past_slot(alejandro, 10, 15)
        sc.status = AvailableSlot.SLOT_OPEN   # slot freed again after cancel
        sc.save(update_fields=['status'])
        Appointment.objects.create(
            slot    = sc,
            patient = sofia,
            status  = Appointment.STATUS_CANCELLED,
        )
        self.stdout.write('    [cancelled] Sofía × Alejandro — cancelada (hace 10 días)')

        # ── Extra open slots for browsing in /book ────────────────────────────
        for days_ahead, hour in [(3, 9), (4, 15), (7, 11), (10, 17), (14, 10)]:
            self._make_future_slot(elena, days_ahead, hour)
        for days_ahead, hour in [(2, 10), (5, 14), (9, 9), (11, 16)]:
            self._make_future_slot(alejandro, days_ahead, hour)

        self.stdout.write('    Open slots created for /book browsing')
        self.stdout.write(self.style.SUCCESS('\n  ✓ Demo data seeded successfully.'))

    def _print_credentials(self):
        self.stdout.write('\nDemo credentials (password for all: demopass123)')
        self.stdout.write('  Psychologists:')
        for p in PSYCHOLOGISTS:
            self.stdout.write(f"    {p['email']}")
        self.stdout.write('  Patients:')
        for p in PATIENTS:
            self.stdout.write(f"    {p['email']}")

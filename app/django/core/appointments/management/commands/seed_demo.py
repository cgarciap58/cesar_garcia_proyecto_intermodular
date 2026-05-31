"""
seed_demo.py — Populates the database with realistic Spanish demo data.

Run:  python manage.py seed_demo

Re-runnable: clears ALL non-admin users and ALL appointments/slots on each run,
             then re-creates everything from scratch.

All users:
  timezone   → Europe/Madrid
  country    → ES
  password   → demopass123

════════════════════════════════════════════════════════
Psychologists
  • Dra. Elena Martínez    (verified,   55 min, Madrid)      ← woman
  • Dra. Carmen Vidal      (verified,   50 min, Sevilla)     ← woman
  • Dr.  Tomás Herrera     (UNVERIFIED, 60 min, Valencia)    ← man  ← verify live on demo

Patients
  • Sofía Navarro          (woman, Madrid)
  • Lucía Ferrer           (woman, Valencia)
  • Marcos Delgado         (man,   Sevilla)

════════════════════════════════════════════════════════
Historical sessions (done — have notes)
  Sofía  × Elena    × 3  (progresión completa)
  Lucía  × Elena    × 2  (duelo y ansiedad)
  Marcos × Carmen   × 2  (problemas de sueño / ánimo)
  Sofía  × Carmen   × 1  (sesión de evaluación inicial)
  Lucía  × Tomás    × 1  (Tomás no verificado aún pero sesiones antiguas son válidas)

Future / active state
  Sofía  → confirmed  with Elena    (en 5 días)
  Lucía  → confirmed  with Carmen   (en 7 días)
  Marcos → pending    →  Elena      (en 9 días)
  Sofía  → pending    →  Carmen     (en 11 días)
  Marcos + Lucía competing on same Elena slot (en 13 días)
  Cancelled past appointment: Marcos × Tomás (hace 8 días)

Extra open slots seeded for /book browsing.
════════════════════════════════════════════════════════
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.accounts.models import PatientProfile, PsychologistProfile, User
from core.appointments.models import Appointment, AvailableSlot


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
        'email':                    'dra.carmen.vidal@demo.com',
        'first_name':               'Carmen',
        'last_name':                'Vidal',
        'city':                     'Sevilla',
        'license_number':           'ES-PSY-3314',
        'country_code':             'ES',
        'session_duration_minutes': 50,
        'session_price':            '1.5',
        'is_verified':              True,
        'verification_status':      'approved',
    },
    {
        # ⚠️  NOT verified — will be approved live on the Django admin during demo
        'email':                    'dr.tomas.herrera@demo.com',
        'first_name':               'Tomás',
        'last_name':                'Herrera',
        'city':                     'Valencia',
        'license_number':           'ES-PSY-4487',
        'country_code':             'ES',
        'session_duration_minutes': 60,
        'session_price':            '2.0',
        'is_verified':              False,
        'verification_status':      'pending',
    },
]

PATIENTS = [
    {
        'email':      'sofia.navarro@demo.com',
        'first_name': 'Sofía',
        'last_name':  'Navarro',
        'city':       'Madrid',
        'concerns':   (
            'Ansiedad generalizada y estrés relacionado con el trabajo. '
            'Dificultad para desconectar fuera del horario laboral.'
        ),
        'credits':    8,
    },
    {
        'email':      'lucia.ferrer@demo.com',
        'first_name': 'Lucía',
        'last_name':  'Ferrer',
        'city':       'Valencia',
        'concerns':   (
            'Duelo tras la pérdida de un familiar cercano. '
            'Cambios vitales importantes en el último año. '
            'Ansiedad social emergente.'
        ),
        'credits':    6,
    },
    {
        'email':      'marcos.delgado@demo.com',
        'first_name': 'Marcos',
        'last_name':  'Delgado',
        'city':       'Sevilla',
        'concerns':   (
            'Problemas de sueño y estado de ánimo bajo. '
            'Le cuesta levantarse y mantener la motivación durante el día.'
        ),
        'credits':    5,
    },
]

PASSWORD   = 'demopass123'
TIMEZONE   = 'Europe/Madrid'

ALL_EMAILS = [p['email'] for p in PSYCHOLOGISTS] + [p['email'] for p in PATIENTS]


# ─── Command ──────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = (
        'Seeds the database with Spanish demo data. '
        'Re-runnable: purges all non-admin users and all appointments before re-creating.'
    )

    def handle(self, *args, **kwargs):
        with transaction.atomic():
            self._clear_all()
            psych_profiles   = [self._make_psychologist(d) for d in PSYCHOLOGISTS]
            patient_profiles = [self._make_patient(d)      for d in PATIENTS]
            self._seed_scenario(psych_profiles, patient_profiles)

        self._print_credentials()

    # ── Purge ─────────────────────────────────────────────────────────────────

    def _clear_all(self):
        """
        Remove ALL appointments, slots, and non-admin / non-staff users.
        Keeps the admin/superuser account(s) untouched.
        """
        self.stdout.write('  Purging database (keeping admin)…')

        # Delete all appointments and slots (safe: no FK back to User)
        Appointment.objects.all().delete()
        AvailableSlot.objects.all().delete()

        # Delete all non-superuser, non-staff profiles and users
        non_admin = User.objects.filter(is_superuser=False, is_staff=False)
        PsychologistProfile.objects.filter(user__in=non_admin).delete()
        PatientProfile.objects.filter(user__in=non_admin).delete()
        non_admin.delete()

        self.stdout.write(self.style.WARNING('    ✓ Purge complete.'))

    # ── Factories ─────────────────────────────────────────────────────────────

    def _make_psychologist(self, d):
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
        verified_tag = '✓ verified' if d['is_verified'] else '✗ PENDING (verify live!)'
        self.stdout.write(f'    Psych: {user.get_full_name()} ({user.email}) [{verified_tag}]')
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

    # ── Slot helpers ──────────────────────────────────────────────────────────

    def _past_slot(self, psych, days_ago, hour, minute=0):
        """Slot in the past; marked CONFIRMED (session is 'done')."""
        anchor = timezone.now().replace(minute=0, second=0, microsecond=0)
        start  = anchor - timedelta(days=days_ago) + timedelta(hours=hour, minutes=minute)
        return AvailableSlot.objects.create(
            psychologist     = psych,
            start_time       = start,
            duration_minutes = psych.session_duration_minutes,
            status           = AvailableSlot.SLOT_CONFIRMED,
        )

    def _future_slot(self, psych, days_ahead, hour, minute=0, status=None):
        """Slot in the future; defaults to OPEN."""
        anchor = timezone.now().replace(minute=0, second=0, microsecond=0)
        start  = anchor + timedelta(days=days_ahead) + timedelta(hours=hour, minutes=minute)
        return AvailableSlot.objects.create(
            psychologist     = psych,
            start_time       = start,
            duration_minutes = psych.session_duration_minutes,
            status           = status or AvailableSlot.SLOT_OPEN,
        )

    # ── Main scenario ─────────────────────────────────────────────────────────

    def _seed_scenario(self, psychs, patients):
        elena, carmen, tomas = psychs
        sofia, lucia, marcos = patients

        self.stdout.write('\n  Building appointment scenario…')

        # ══════════════════════════════════════════════════════════════════════
        # HISTORICAL — past sessions with notes
        # ══════════════════════════════════════════════════════════════════════

        # ── Sofía × Elena — 3 sessions ────────────────────────────────────────

        s1 = self._past_slot(elena, 42, 10)
        Appointment.objects.create(
            slot          = s1,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Empezar el diario de pensamientos automáticos. '
                'Anotar situaciones de estrés con su intensidad del 0 al 10 cada día.'
            ),
            private_notes = (
                'Primera sesión. Sofía muestra ansiedad de rendimiento marcada. '
                'Es introvertida, con tendencia clara a la rumiación. '
                'Muy buena capacidad de introspección. '
                'Iniciamos psicoeducación sobre el ciclo estrés-activación-evitación.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 1 (hace 6 sem.)')

        s2 = self._past_slot(elena, 28, 10)
        Appointment.objects.create(
            slot          = s2,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Continuar con el diario. Practicar respiración diafragmática 5 min/día. '
                'Identificar al menos un "logro pequeño" cada tarde.'
            ),
            private_notes = (
                'Trajo el diario cumplimentado — 4 episodios registrados. '
                'Mejora leve en percepción de control. '
                'Introducimos reestructuración cognitiva básica. '
                'Pendiente: trabajar autocompasión, autocrítica muy elevada.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 2 (hace 4 sem.)')

        s3 = self._past_slot(elena, 14, 10)
        Appointment.objects.create(
            slot          = s3,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Practicar la técnica de pausa cognitiva ante pensamientos intrusivos. '
                'Leer el capítulo 3 del material de autoayuda. '
                'Hablar con una persona de confianza sobre un logro reciente.'
            ),
            private_notes = (
                'Mejora notable: refiere dormir mejor y menos rumiación nocturna. '
                'La reestructuración cognitiva empieza a consolidarse. '
                'Autocompasión sigue siendo el punto débil — tarea para próximas semanas. '
                'Valorar introducir técnicas de mindfulness en siguiente sesión.'
            ),
        )
        self.stdout.write('    [done] Sofía × Elena — sesión 3 (hace 2 sem.)')

        # ── Lucía × Elena — 2 sessions ────────────────────────────────────────

        l1e = self._past_slot(elena, 35, 12)
        Appointment.objects.create(
            slot          = l1e,
            patient       = lucia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Escribir una carta (sin enviar) a la persona perdida. '
                'Hablar con alguien de confianza sobre un recuerdo positivo de esa persona.'
            ),
            private_notes = (
                'Lucía presenta duelo complicado (pérdida de madre, 5 meses). '
                'Llanto frecuente, evitación de recuerdos, dificultad para retomar rutinas. '
                'Sin señales de alerta clínica. Psicoeducación sobre fases del duelo. '
                'Buen vínculo terapéutico desde el inicio — abierta y colaboradora.'
            ),
        )
        self.stdout.write('    [done] Lucía × Elena — sesión 1 (hace 5 sem.)')

        l2e = self._past_slot(elena, 21, 12)
        Appointment.objects.create(
            slot          = l2e,
            patient       = lucia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Continuar el diario de recuerdos positivos. '
                'Explorar qué aspectos de la vida quieres recuperar o transformar.'
            ),
            private_notes = (
                'Leyó en sesión fragmentos de la carta — muy emocionante, excelente avance. '
                'Empieza a integrar la pérdida y verbaliza planes a medio plazo por primera vez. '
                'Ansiedad social emergente como efecto colateral del aislamiento post-duelo. '
                'Próxima sesión: explorar reconstrucción de identidad y reactivación social gradual.'
            ),
        )
        self.stdout.write('    [done] Lucía × Elena — sesión 2 (hace 3 sem.)')

        # ── Marcos × Carmen — 2 sessions ─────────────────────────────────────

        m1c = self._past_slot(carmen, 30, 17)
        Appointment.objects.create(
            slot          = m1c,
            patient       = marcos,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Llevar un registro de sueño durante una semana: hora de acostarse, '
                'de levantarse y calidad percibida (1-5). '
                'Eliminar pantallas 45 min antes de dormir.'
            ),
            private_notes = (
                'Primera sesión con Marcos. Refiere insomnio de conciliación (>75 min) '
                'y estado de ánimo deprimido los últimos 3 meses. '
                'Descarta eventos vitales recientes significativos. '
                'Aplicar PHQ-9 en próxima visita para valorar componente depresivo mayor. '
                'Higiene de sueño como intervención inicial; buena predisposición.'
            ),
        )
        self.stdout.write('    [done] Marcos × Carmen — sesión 1 (hace 4 sem.)')

        m2c = self._past_slot(carmen, 16, 17)
        Appointment.objects.create(
            slot          = m2c,
            patient       = marcos,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Mantener el registro de sueño. '
                'Añadir una actividad activante al día (paseo o deporte suave, mínimo 20 min). '
                'Intentar levantarse a la misma hora todos los días, incluso fines de semana.'
            ),
            private_notes = (
                'El registro muestra mejora marginal: latencia bajó de 75 a 50 min. '
                'Identifica claramente el móvil antes de dormir como factor desencadenante. '
                'PHQ-9: puntuación 11 — depresión leve-moderada confirmada. '
                'Valorar derivación a psiquiatría si no hay mejora en 3 semanas. '
                'Motivación para el cambio presente pero frágil — reforzar alianza terapéutica.'
            ),
        )
        self.stdout.write('    [done] Marcos × Carmen — sesión 2 (hace 2 sem.)')

        # ── Sofía × Carmen — 1 session (evaluación cruzada) ──────────────────

        s1c = self._past_slot(carmen, 20, 11)
        Appointment.objects.create(
            slot          = s1c,
            patient       = sofia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Reflexionar sobre los valores personales que guían tu vida. '
                'Hacer una lista de 3 cosas que te dan energía y 3 que te la quitan.'
            ),
            private_notes = (
                'Sofía busca una segunda opinión / enfoque complementario al de Elena. '
                'Presenta perfeccionismo marcado y dificultad para delegar en el trabajo. '
                'Buena conciencia de sus patrones. '
                'Le propongo un enfoque ACT (valores y compromiso) como complemento a la TCC. '
                'Coordinación con Elena recomendable si continúa viendo a ambas.'
            ),
        )
        self.stdout.write('    [done] Sofía × Carmen — sesión 1 (hace 3 sem.)')

        # ── Lucía × Tomás — 1 session (sesión histórica válida) ──────────────

        l1t = self._past_slot(tomas, 25, 9)
        Appointment.objects.create(
            slot          = l1t,
            patient       = lucia,
            status        = Appointment.STATUS_CONFIRMED,
            patient_notes = (
                'Practicar la respiración 4-7-8 antes de situaciones sociales. '
                'Anotar pensamientos de anticipación negativa antes de cada evento social.'
            ),
            private_notes = (
                'Primera sesión con Lucía — derivada para trabajar la ansiedad social emergente. '
                'Contexto: duelo reciente + aislamiento prolongado. '
                'Evitación social como estrategia de afrontamiento predominante. '
                'Plan: exposición gradual y reestructuración de creencias sobre el juicio social. '
                'Sesión fluida; Lucía es receptiva aunque con reservas iniciales.'
            ),
        )
        self.stdout.write('    [done] Lucía × Tomás — sesión 1 (hace 3.5 sem.) [Tomás pendiente verificación]')

        # ══════════════════════════════════════════════════════════════════════
        # FUTURE — upcoming appointments
        # ══════════════════════════════════════════════════════════════════════

        # Sofía → confirmed with Elena (en 5 días)
        sf_e = self._future_slot(elena, 5, 10, status=AvailableSlot.SLOT_CONFIRMED)
        Appointment.objects.create(
            slot    = sf_e,
            patient = sofia,
            status  = Appointment.STATUS_CONFIRMED,
        )
        self.stdout.write('    [confirmed] Sofía × Elena — próxima (en 5 días)')

        # Lucía → confirmed with Carmen (en 7 días)
        lf_c = self._future_slot(carmen, 7, 11, status=AvailableSlot.SLOT_CONFIRMED)
        Appointment.objects.create(
            slot    = lf_c,
            patient = lucia,
            status  = Appointment.STATUS_CONFIRMED,
        )
        self.stdout.write('    [confirmed] Lucía × Carmen — próxima (en 7 días)')

        # Marcos → pending_request to Elena (en 9 días)
        mf_e = self._future_slot(elena, 9, 16)
        marcos.credits -= 1
        marcos.save(update_fields=['credits'])
        Appointment.objects.create(
            slot    = mf_e,
            patient = marcos,
            status  = Appointment.STATUS_PENDING_REQUEST,
        )
        self.stdout.write('    [pending] Marcos → Elena — solicitud enviada (en 9 días)')

        # Sofía → pending_request to Carmen (en 11 días)
        sf_c = self._future_slot(carmen, 11, 17)
        sofia.credits -= 1
        sofia.save(update_fields=['credits'])
        Appointment.objects.create(
            slot    = sf_c,
            patient = sofia,
            status  = Appointment.STATUS_PENDING_REQUEST,
        )
        self.stdout.write('    [pending] Sofía → Carmen — solicitud enviada (en 11 días)')

        # Marcos + Lucía competing on the same Elena slot (en 13 días)
        contested = self._future_slot(elena, 13, 10)
        for patient in [marcos, lucia]:
            patient.credits -= 1
            patient.save(update_fields=['credits'])
            Appointment.objects.create(
                slot    = contested,
                patient = patient,
                status  = Appointment.STATUS_PENDING_REQUEST,
            )
        self.stdout.write('    [pending×2] Marcos + Lucía → misma franja Elena (en 13 días)')

        # ══════════════════════════════════════════════════════════════════════
        # PAST CANCELLED — Marcos × Tomás
        # ══════════════════════════════════════════════════════════════════════

        cancelled_slot = self._past_slot(tomas, 8, 15)
        cancelled_slot.status = AvailableSlot.SLOT_OPEN   # freed after cancellation
        cancelled_slot.save(update_fields=['status'])
        Appointment.objects.create(
            slot    = cancelled_slot,
            patient = marcos,
            status  = Appointment.STATUS_CANCELLED,
        )
        self.stdout.write('    [cancelled] Marcos × Tomás — cancelada (hace 8 días)')

        # ══════════════════════════════════════════════════════════════════════
        # EXTRA OPEN SLOTS for /book browsing
        # ══════════════════════════════════════════════════════════════════════

        for days, hour in [(2, 9), (3, 15), (6, 11), (8, 17), (10, 10), (15, 9)]:
            self._future_slot(elena, days, hour)
        for days, hour in [(1, 10), (4, 14), (8, 9), (12, 16), (16, 11)]:
            self._future_slot(carmen, days, hour)
        for days, hour in [(3, 10), (6, 16), (10, 12), (14, 9)]:
            self._future_slot(tomas, days, hour)

        self.stdout.write('    Open slots created for /book browsing (Elena×6, Carmen×5, Tomás×4)')
        self.stdout.write(self.style.SUCCESS('\n  ✓ Demo data seeded successfully.'))

    # ── Credentials summary ───────────────────────────────────────────────────

    def _print_credentials(self):
        self.stdout.write('\n' + '═' * 60)
        self.stdout.write('  DEMO CREDENTIALS  (password for all: demopass123)')
        self.stdout.write('═' * 60)
        self.stdout.write('  Psychologists:')
        for p in PSYCHOLOGISTS:
            tag = '  ⚠ VERIFY VIA ADMIN' if not p['is_verified'] else ''
            self.stdout.write(f"    {p['email']}{tag}")
        self.stdout.write('  Patients:')
        for p in PATIENTS:
            self.stdout.write(f"    {p['email']}")
        self.stdout.write('═' * 60 + '\n')

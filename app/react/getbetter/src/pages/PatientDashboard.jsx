import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAppointments, cancelAppointment } from '../services'
import ProfileSidebar from '../components/ProfileSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

export default function PatientDashboard() {
  const { user } = useAuth()
  const { t } = useTranslation('dashboard')
  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  // Built here so it reacts to language changes
  const patientActions = [
    { label: t('patient.bookAppointment'), href: '/book', variant: 'primary' },
    { label: t('patient.addCredits'), variant: 'secondary' },
  ]

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) {
        const now = new Date()
        const filtered = result.data.appointments
          .filter((a) => new Date(a.slot.start_time) >= now)
          .sort((a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time))
        setAppointments(filtered)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [])

  const handleCancel = async () => {
    if (!selected) return
    setCancelling(true)
    setCancelError(null)
    const result = await cancelAppointment(selected.id)
    if (result.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === selected.id ? result.data : a)))
      setSelected(result.data)
    } else {
      setCancelError(result.error)
    }
    setCancelling(false)
  }

  const handleSelect = (appt) => setSelected((prev) => (prev?.id === appt.id ? null : appt))

  const selectedAppointment = selected
    ? appointments.find((a) => a.id === selected.id) ?? selected
    : null

  const isPast = selectedAppointment
    ? new Date(selectedAppointment.slot.start_time) < new Date()
    : false

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex gap-4 items-start">
          <ProfileSidebar
            user={user}
            roleLabel={t('patient.roleLabel')}
            actions={patientActions}
          />
          <AppointmentsPanel
            title={t('patient.appointmentsTitle')}
            appointments={appointments}
            loading={loading}
            error={error}
            emptyMessage={t('patient.emptyAppointments')}
            role="patient"
            selectedId={selectedAppointment?.id}
            onSelect={handleSelect}
          />
        </div>

        {selectedAppointment && (
          <AppointmentDetail
            appointment={selectedAppointment}
            counterpart={{
              firstName: selectedAppointment.psychologist.first_name,
              lastName: selectedAppointment.psychologist.last_name,
              namePrefix: 'Dr.',
              profilePicture: selectedAppointment.psychologist.profile_picture,
            }}
            meetLinkLabel={t('patient.joinSession')}
            previousLabel={t('patient.previousSessionsWith', { lastName: selectedAppointment.psychologist.last_name })}
            previousUserId={selectedAppointment.psychologist.id}
            role="patient"
            notes={
              isPast && selectedAppointment.patient_notes ? (
                <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    {t('patient.notesFromPsychologist')}
                  </p>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    {selectedAppointment.patient_notes}
                  </p>
                </div>
              ) : null
            }
            actions={
              selectedAppointment.status !== 'cancelled' ? (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? t('patient.cancellingAppointment') : t('patient.cancelAppointment')}
                  </button>
                  {cancelError && <p className="text-rose-400 text-sm">{cancelError}</p>}
                </div>
              ) : null
            }
          />
        )}

      </div>
    </main>
  )
}

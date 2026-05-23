import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAppointments, cancelAppointment, addCredits } from '../services'
import { computedStatus } from '../utils/appointmentFormatters'
import ProfileSidebar from '../components/ProfileSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

// ─── Filtering logic ──────────────────────────────────────────────────────────
//
// Show an appointment in the panel when ANY of these is true:
//   - Its effective status is pending_request, confirmed, or in_progress
//   - Its effective status is rejected AND its would-be end time is in the future
//     (so the patient sees why they didn't get the slot)
//   - Its effective status is cancelled AND its would-be end time is in the future
//
// Hide: done (past + confirmed), and rejected/cancelled whose time has passed.

function shouldShowAppointment(appointment) {
  const effective = computedStatus(appointment)
  const endMs = new Date(appointment.slot.start_time).getTime()
    + appointment.slot.duration_minutes * 60_000

  if (effective === 'done') return false
  if ((effective === 'rejected' || effective === 'cancelled') && Date.now() >= endMs) return false
  return true
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDashboard() {
  const { user, setUser } = useAuth()
  const { t }             = useTranslation('dashboard')

  const [appointments, setAppointments] = useState([])
  const [selected, setSelected]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [cancelling, setCancelling]     = useState(false)
  const [cancelError, setCancelError]   = useState(null)
  const [creditsMsg, setCreditsMsg]     = useState(null)   // { type, message }

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) {
        const sorted = [...result.data.appointments].sort(
          (a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time),
        )
        setAppointments(sorted)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [])

  async function handleAddCredits() {
    const result = await addCredits()
    if (result.ok) {
      setUser((prev) => prev ? { ...prev, credits: result.data.credits } : prev)
      setCreditsMsg({
        type:    'success',
        message: t('patient.creditsAdded', {
          added: result.data.added,
          total: result.data.credits,
        }),
      })
    } else {
      setCreditsMsg({ type: 'error', message: result.error || t('patient.creditsError') })
    }
    setTimeout(() => setCreditsMsg(null), 4000)
  }

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

  const handleSelect = (appt) =>
    setSelected((prev) => (prev?.id === appt.id ? null : appt))

  const visible = appointments.filter(shouldShowAppointment)

  const selectedAppointment = selected
    ? (appointments.find((a) => a.id === selected.id) ?? selected)
    : null

  // Effective status for action-button logic
  const selStatus = selectedAppointment ? computedStatus(selectedAppointment) : null

  // Actions that live inside ProfileSidebar are defined inside render so they
  // close over the latest handleAddCredits (which closes over setUser etc.)
  const patientActions = [
    { label: t('patient.bookAppointment'), href: '/book',         variant: 'primary' },
    { label: t('patient.addCredits'),      onClick: handleAddCredits, variant: 'secondary' },
  ]

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex gap-4 items-start">
          {/* ── Left column: sidebar + credits badge + toast ── */}
          <div className="flex flex-col items-center gap-3">
            <ProfileSidebar
              user={user}
              roleLabel={t('patient.roleLabel')}
              actions={patientActions}
            />

            {user?.credits !== undefined && (
              <div className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-white">{user.credits}</p>
                <p className="text-xs text-slate-500">
                  {user.credits === 1 ? t('patient.credit') : t('patient.credits')}
                </p>
              </div>
            )}

            {creditsMsg && (
              <div className={`w-full rounded-lg border px-3 py-2 text-xs text-center transition-all ${
                creditsMsg.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}>
                {creditsMsg.message}
              </div>
            )}
          </div>

          {/* ── Right column: appointments panel ── */}
          <AppointmentsPanel
            title={t('patient.appointmentsTitle')}
            appointments={visible}
            loading={loading}
            error={error}
            emptyMessage={t('patient.emptyAppointments')}
            role="patient"
            selectedId={selectedAppointment?.id}
            onSelect={handleSelect}
          />
        </div>

        {/* ── Detail panel ── */}
        {selectedAppointment && (
          <AppointmentDetail
            appointment={selectedAppointment}
            counterpart={{
              firstName:      selectedAppointment.psychologist.first_name,
              lastName:       selectedAppointment.psychologist.last_name,
              namePrefix:     'Dr.',
              profilePicture: selectedAppointment.psychologist.profile_picture,
            }}
            meetLinkLabel={t('patient.joinSession')}
            previousLabel={t('patient.previousSessionsWith', {
              lastName: selectedAppointment.psychologist.last_name,
            })}
            previousUserId={selectedAppointment.psychologist.id}
            role="patient"
            notes={
              selStatus === 'done' && selectedAppointment.patient_notes ? (
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
              // Only actionable statuses get a cancel button.
              // 'done', 'rejected', 'cancelled' — nothing to do.
              (selStatus === 'pending_request' || selStatus === 'confirmed') ? (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling
                      ? t('patient.cancellingAppointment')
                      : t('patient.cancelAppointment')}
                  </button>
                  {cancelError && (
                    <p className="text-rose-400 text-sm">{cancelError}</p>
                  )}
                </div>
              ) : null
            }
          />
        )}

      </div>
    </main>
  )
}

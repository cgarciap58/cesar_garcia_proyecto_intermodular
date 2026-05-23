import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAppointments, confirmAppointment, cancelAppointment } from '../services'
import { computedStatus } from '../utils/appointmentFormatters'
import ProfileSidebar from '../components/ProfileSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

// ─── Filtering logic ──────────────────────────────────────────────────────────
//
// Psychologist sees all non-done, non-rejected appointments.
// Done appointments (finished sessions) are hidden — they live in history.
// Rejected: the psych caused the rejection by confirming someone else, so
//           there's no value showing those to them.
// Cancelled: show until the would-be end time passes.

function shouldShowAppointment(appointment) {
  const effective = computedStatus(appointment)
  const endMs = new Date(appointment.slot.start_time).getTime()
    + appointment.slot.duration_minutes * 60_000

  if (effective === 'done')     return false
  if (effective === 'rejected') return false
  if (effective === 'cancelled' && Date.now() >= endMs) return false
  return true
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PsychologistDashboard() {
  const { user }   = useAuth()
  const { t }      = useTranslation('dashboard')

  const [appointments, setAppointments] = useState([])
  const [selected, setSelected]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState(null)

  const psychologistActions = [
    { label: t('psychologist.manageSlots'), href: '/slots', variant: 'primary' },
  ]

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

  const applyUpdate = (updated) => {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setSelected(updated)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    const result = await confirmAppointment(selected.id)
    if (result.ok) applyUpdate(result.data)
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleCancel = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    const result = await cancelAppointment(selected.id)
    if (result.ok) applyUpdate(result.data)
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleSelect = (appt) =>
    setSelected((prev) => (prev?.id === appt.id ? null : appt))

  const visible = appointments.filter(shouldShowAppointment)

  const selectedAppointment = selected
    ? (appointments.find((a) => a.id === selected.id) ?? selected)
    : null

  const selStatus = selectedAppointment ? computedStatus(selectedAppointment) : null

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex gap-4 items-start">
          <ProfileSidebar
            user={user}
            namePrefix="Dr."
            roleLabel={t('psychologist.roleLabel')}
            actions={psychologistActions}
          />
          <AppointmentsPanel
            title={t('psychologist.appointmentsTitle')}
            appointments={visible}
            loading={loading}
            error={error}
            emptyMessage={t('psychologist.emptyAppointments')}
            role="psychologist"
            selectedId={selectedAppointment?.id}
            onSelect={handleSelect}
          />
        </div>

        {selectedAppointment && (
          <AppointmentDetail
            appointment={selectedAppointment}
            counterpart={{
              firstName:      selectedAppointment.patient.first_name,
              lastName:       selectedAppointment.patient.last_name,
              profilePicture: selectedAppointment.patient.profile_picture,
            }}
            meetLinkLabel={t('psychologist.startSession')}
            previousLabel={t('psychologist.previousSessionsWith', {
              firstName: selectedAppointment.patient.first_name,
              lastName:  selectedAppointment.patient.last_name,
            })}
            previousUserId={selectedAppointment.patient.id}
            role="psychologist"
            notes={
              // Notes only meaningful once session is in progress or done
              (selStatus === 'in_progress' || selStatus === 'done') ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                      {t('psychologist.sessionNotes')}
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {selectedAppointment.patient_notes || (
                        <span className="italic text-slate-600">{t('psychologist.noSessionNotes')}</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 border border-amber-500/20 p-4">
                    <p className="text-xs font-medium text-amber-500/70 uppercase tracking-wider mb-2">
                      {t('psychologist.privateNotes')}
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {selectedAppointment.private_notes || (
                        <span className="italic text-slate-600">{t('psychologist.noPrivateNotes')}</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : null
            }
            actions={
              // pending_request and confirmed are actionable.
              // in_progress: can still cancel (no refund).
              // done / cancelled / rejected: nothing to do.
              (selStatus === 'pending_request' || selStatus === 'confirmed' || selStatus === 'in_progress') ? (
                <div className="mt-5 flex items-center gap-3 flex-wrap">
                  {selStatus === 'pending_request' && (
                    <button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading
                        ? t('psychologist.confirmingAppointment')
                        : t('psychologist.confirmAppointment')}
                    </button>
                  )}
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading
                      ? t('psychologist.cancellingAppointment')
                      : t('psychologist.cancelAppointment')}
                  </button>
                  {actionError && <p className="text-rose-400 text-sm">{actionError}</p>}
                </div>
              ) : null
            }
          />
        )}

      </div>
    </main>
  )
}

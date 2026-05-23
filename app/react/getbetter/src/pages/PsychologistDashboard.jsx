import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  getAppointments, confirmAppointment, rejectAppointment, cancelAppointment,
} from '../services'
import {
  computedStatus, ACTIVE_STATUSES, ARCHIVE_STATUSES,
} from '../utils/appointmentFormatters'
import ProfileSidebar from '../components/ProfileSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

function sortByTime(appts) {
  return [...appts].sort((a, b) =>
    new Date(a.slot.start_time) - new Date(b.slot.start_time)
  )
}

export default function PsychologistDashboard() {
  const { user }   = useAuth()
  const { t }      = useTranslation('dashboard')

  const [appointments, setAppointments]   = useState([])
  const [selected, setSelected]           = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState(null)
  // Two separate archive toggles for the two groups
  const [showRejected, setShowRejected]   = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)

  const psychologistActions = [
    { label: t('psychologist.manageSlots'), href: '/slots', variant: 'primary' },
  ]

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) {
        setAppointments(sortByTime(result.data.appointments))
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [])

  const applyUpdate = useCallback((updated) => {
    setAppointments((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    setSelected(updated)
  }, [])

  const handleConfirm = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null)
    const result = await confirmAppointment(selected.id)
    if (result.ok) applyUpdate(result.data)
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleReject = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null)
    const result = await rejectAppointment(selected.id)
    if (result.ok) applyUpdate(result.data)
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleCancel = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null)
    const result = await cancelAppointment(selected.id)
    if (result.ok) applyUpdate(result.data)
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleSelect = (appt) =>
    setSelected((prev) => (prev?.id === appt.id ? null : appt))

  // ── Derived lists ──────────────────────────────────────────────────────────
  // Active = pending_request, confirmed, in_progress
  const active = appointments.filter((a) => ACTIVE_STATUSES.has(computedStatus(a)))

  // For psychologists, archive splits into two meaningful groups:
  // "rejected requests" (psych rejected them, or auto-rejected on confirm)
  // "cancelled / done" (past confirmed appointments)
  const rejectedGroup  = appointments.filter((a) => computedStatus(a) === 'rejected')
  const resolvedGroup  = appointments.filter((a) =>
    ['cancelled', 'done', 'withdrawn'].includes(computedStatus(a))
  )

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

          <div className="flex-1 min-w-0 space-y-3">
            {/* Active appointments */}
            <AppointmentsPanel
              title={t('psychologist.appointmentsTitle')}
              appointments={active}
              loading={loading}
              error={error}
              emptyMessage={t('psychologist.emptyAppointments')}
              role="psychologist"
              selectedId={selectedAppointment?.id}
              onSelect={handleSelect}
            />

            {/* Rejected requests archive */}
            {!loading && rejectedGroup.length > 0 && (
              <div>
                <button
                  onClick={() => setShowRejected((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${showRejected ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showRejected
                    ? t('psychologist.hideRejected')
                    : t('psychologist.showRejected', { count: rejectedGroup.length })}
                </button>
                {showRejected && (
                  <AppointmentsPanel
                    title={t('psychologist.rejectedTitle')}
                    appointments={rejectedGroup}
                    loading={false}
                    error={null}
                    emptyMessage=""
                    role="psychologist"
                    selectedId={selectedAppointment?.id}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            )}

            {/* Cancelled / done archive */}
            {!loading && resolvedGroup.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCancelled((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${showCancelled ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showCancelled
                    ? t('psychologist.hideCancelled')
                    : t('psychologist.showCancelled', { count: resolvedGroup.length })}
                </button>
                {showCancelled && (
                  <AppointmentsPanel
                    title={t('psychologist.cancelledTitle')}
                    appointments={resolvedGroup}
                    loading={false}
                    error={null}
                    emptyMessage=""
                    role="psychologist"
                    selectedId={selectedAppointment?.id}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ── */}
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
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                {/* Confirm — pending requests only */}
                {selStatus === 'pending_request' && (
                  <button
                    onClick={handleConfirm}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? t('psychologist.confirmingAppointment') : t('psychologist.confirmAppointment')}
                  </button>
                )}
                {/* Reject — pending requests only */}
                {selStatus === 'pending_request' && (
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? t('psychologist.rejectingRequest') : t('psychologist.rejectRequest')}
                  </button>
                )}
                {/* Cancel — confirmed or in_progress */}
                {(selStatus === 'confirmed' || selStatus === 'in_progress') && (
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? t('psychologist.cancellingAppointment') : t('psychologist.cancelAppointment')}
                  </button>
                )}
                {actionError && <p className="text-rose-400 text-sm">{actionError}</p>}
              </div>
            }
          />
        )}

      </div>
    </main>
  )
}

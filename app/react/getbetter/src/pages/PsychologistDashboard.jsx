import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  getAppointments, getAppointment, confirmAppointment, rejectAppointment, cancelAppointment,
} from '../services'
import {
  computedStatus, ACTIVE_STATUSES, ARCHIVE_STATUSES,
} from '../utils/appointmentFormatters'
import DashboardSidebar from '../components/DashboardSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

function sortByTime(appts) {
  return [...appts].sort((a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time))
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
  const [showRejected, setShowRejected]   = useState(false)
  const [showResolved, setshowResolved] = useState(false)
  const [rejectionNotice, setRejectionNotice] = useState(null)

  // A psychologist must have verification_status === 'approved' to manage slots.
  const isValidated = user?.verification_status === 'approved'

  const psychologistActions = [
    {
      label: t('psychologist.manageSlots'),
      href: isValidated ? '/slots' : undefined,
      variant: 'primary',
      disabled: !isValidated,
      disabledTooltip: !isValidated ? t('psychologist.slotsLockedTooltip') : undefined,
    },
  ]

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) setAppointments(sortByTime(result.data.appointments))
      else setError(result.error)
      setLoading(false)
    })
  }, [])

  const applyUpdate = useCallback((updated) => {
    setAppointments((prev) => sortByTime(prev.map((a) => a.id === updated.id ? updated : a)))
    setSelected(updated)
  }, [])

  const applyBatch = useCallback((updatedList) => {
    setAppointments((prev) => {
      const map  = Object.fromEntries(updatedList.map((a) => [a.id, a]))
      return sortByTime(prev.map((a) => map[a.id] ?? a))
    })
  }, [])

  const handleConfirm = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null); setRejectionNotice(null)
    const result = await confirmAppointment(selected.id)
    if (result.ok) {
      applyUpdate(result.data)
      const rejected = result.data.rejected_appointments ?? []
      if (rejected.length > 0) {
        const names = rejected.map((a) => a.patient?.first_name).filter(Boolean)
        setRejectionNotice({ names })
      }
    } else {
      setActionError(result.error)
    }
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

  const handleSelect = useCallback(async (appt) => {
    if (selected?.id === appt.id) {
      setSelected(null)
      return
    }
    setSelected(appt)
    setActionError(null)
    const result = await getAppointment(appt.id)
    if (result.ok) {
      setAppointments((prev) => prev.map((a) => a.id === result.data.id ? result.data : a))
      setSelected(result.data)
    }
  }, [selected])

  const active        = appointments.filter((a) => ACTIVE_STATUSES.has(computedStatus(a)))
  const rejectedGroup = appointments.filter((a) => computedStatus(a) === 'rejected')
  const resolvedGroup = appointments.filter((a) =>
    ['cancelled', 'done', 'withdrawn'].includes(computedStatus(a))
  )

  const selectedAppointment = selected
    ? (appointments.find((a) => a.id === selected.id) ?? selected)
    : null
  const selStatus = selectedAppointment ? computedStatus(selectedAppointment) : null

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {rejectionNotice && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-300">{t('psychologist.autoRejectedTitle')}</p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                {t('psychologist.autoRejectedBody', { names: rejectionNotice.names.join(', '), count: rejectionNotice.names.length })}
              </p>
            </div>
            <button onClick={() => setRejectionNotice(null)} className="flex-shrink-0 text-amber-500/60 hover:text-amber-300 transition-colors" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex gap-4 items-start">

          <DashboardSidebar
            user={user}
            namePrefix="Dr."
            roleLabel={t('psychologist.roleLabel')}
            actions={psychologistActions}
          />

          {/* ── Appointments + detail (stacked vertically) ── */}
          <div className="flex-1 min-w-0 space-y-3">

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

            {!loading && rejectedGroup.length > 0 && (
              <div>
                <button onClick={() => setShowRejected((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className={`w-3.5 h-3.5 transition-transform ${showRejected ?
                    'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('psychologist.showRejected', { count: rejectedGroup.length })}
                </button>
                {showRejected && (
                  <div className="mt-2">
                    <AppointmentsPanel appointments={rejectedGroup} role="psychologist"
                      selectedId={selectedAppointment?.id} onSelect={handleSelect} />
                  </div>
                )}
              </div>
            )}

            {!loading && resolvedGroup.length > 0 && (
              <div>
                <button onClick={() => setshowResolved((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className={`w-3.5 h-3.5 transition-transform ${showResolved ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('psychologist.showResolved', { count: resolvedGroup.length })}
                </button>
                {showResolved && (
                  <div className="mt-2">
                    <AppointmentsPanel appointments={resolvedGroup} role="psychologist"
                      selectedId={selectedAppointment?.id} onSelect={handleSelect} />
                  </div>
                )}
              </div>
            )}

            {/* Detail panel — below the appointment boxes */}
            {selectedAppointment && (
              <AppointmentDetail
                appointment={selectedAppointment}
                counterpart={{
                  firstName:      selectedAppointment.patient.first_name,
                  lastName:       selectedAppointment.patient.last_name,
                  profilePicture: selectedAppointment.patient.profile_picture,
                }}
                previousLabel={t('psychologist.previousSessionsWith', {
                  firstName: selectedAppointment.patient.first_name,
                  lastName:  selectedAppointment.patient.last_name,
                })}
                previousUserId={selectedAppointment.patient.id}
                role="psychologist"
                notes={
                  selStatus === 'done' ?
                  { patient: selectedAppointment.patient_notes, private: selectedAppointment.private_notes }
                  : null
                }
                noteLabels={{
                  patient:  t('psychologist.sessionNotes'),
                  private:  t('psychologist.privateNotes'),
                  noPatient: t('psychologist.noSessionNotes'),
                  noPrivate: t('psychologist.noPrivateNotes'),
                }}
                actions={
                  selStatus === 'pending_request' ? [
                    { label: actionLoading ? t('psychologist.confirmingAppointment') : t('psychologist.confirmAppointment'),
                      onClick: handleConfirm, disabled: actionLoading, variant: 'primary' },
                    { label: actionLoading ? t('psychologist.rejectingRequest') : t('psychologist.rejectRequest'),
                      onClick: handleReject, disabled: actionLoading, variant: 'secondary' },
                  ] : selStatus === 'confirmed' || selStatus === 'in_progress' ? [
                    { label: actionLoading ? t('psychologist.cancellingAppointment') : t('psychologist.cancelAppointment'),
                      onClick: handleCancel, disabled: actionLoading, variant: 'secondary' },
                  ] : []
                }
                actionError={actionError}
              />
            )}

          </div>
        </div>
      </div>
    </main>
  )
}

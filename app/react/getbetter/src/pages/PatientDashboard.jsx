import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  getAppointments, getAppointment, withdrawAppointment, cancelAppointment, addCredits,
} from '../services'
import {
  computedStatus, ACTIVE_STATUSES, ARCHIVE_STATUSES,
} from '../utils/appointmentFormatters'
import DashboardSidebar from '../components/DashboardSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

function sortByTime(appts) {
  return [...appts].sort((a, b) =>
    new Date(a.slot.start_time) - new Date(b.slot.start_time)
  )
}

function syncCredits(setUser, appointmentData) {
  if (appointmentData?.patient_credits != null) {
    setUser((prev) => prev ? { ...prev, credits: appointmentData.patient_credits } : prev)
  }
}

export default function PatientDashboard() {
  const { user, setUser } = useAuth()
  const { t }             = useTranslation('dashboard')

  const [appointments, setAppointments] = useState([])
  const [selected, setSelected]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]     = useState(null)
  const [creditsMsg, setCreditsMsg]       = useState(null)
  const [showArchive, setShowArchive]     = useState(false)

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) setAppointments(sortByTime(result.data.appointments))
      else setError(result.error)
      setLoading(false)
    })
  }, [])

  async function handleAddCredits() {
    const result = await addCredits()
    if (result.ok) {
      setUser((prev) => prev ? { ...prev, credits: result.data.credits } : prev)
      setCreditsMsg({ type: 'success', message: t('patient.creditsAdded', { added: result.data.added, total: result.data.credits }) })
    } else {
      setCreditsMsg({ type: 'error', message: result.error || t('patient.creditsError') })
    }
    setTimeout(() => setCreditsMsg(null), 4000)
  }

  const applyUpdate = useCallback((updated) => {
    setAppointments((prev) => sortByTime(prev.map((a) => a.id === updated.id ? updated : a)))
    setSelected(updated)
  }, [])

  const handleWithdraw = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null)
    const result = await withdrawAppointment(selected.id)
    if (result.ok) { syncCredits(setUser, result.data); applyUpdate(result.data) }
    else setActionError(result.error)
    setActionLoading(false)
  }

  const handleCancel = async () => {
    if (!selected) return
    setActionLoading(true); setActionError(null)
    const result = await cancelAppointment(selected.id)
    if (result.ok) { syncCredits(setUser, result.data); applyUpdate(result.data) }
    else setActionError(result.error)
    setActionLoading(false)
  }

  // Second click on the same card deselects (hides detail panel)
  const handleSelect = useCallback(async (appt) => {
    if (selected?.id === appt.id) {
      setSelected(null)
      return
    }
    setSelected(appt)
    setActionError(null)
    const result = await getAppointment(appt.id)
    if (result.ok) {
      setAppointments((prev) => sortByTime(prev.map((a) => a.id === result.data.id ? result.data : a)))
      setSelected(result.data)
    }
  }, [selected])

  const active  = appointments.filter((a) => ACTIVE_STATUSES.has(computedStatus(a)))
  const archive = appointments.filter((a) => ARCHIVE_STATUSES.has(computedStatus(a)))

  const selectedAppointment = selected
    ? (appointments.find((a) => a.id === selected.id) ?? selected)
    : null
  const selStatus = selectedAppointment ? computedStatus(selectedAppointment) : null

  const patientActions = [
    { label: t('patient.bookAppointment'), href: '/book',             variant: 'primary' },
    { label: t('patient.addCredits'),      onClick: handleAddCredits, variant: 'secondary' },
  ]

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex gap-4 items-start">

          {/* ── Sidebar ── */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <DashboardSidebar user={user} roleLabel={t('patient.roleLabel')} actions={patientActions} />
            {user?.credits !== undefined && (
              <div className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-white">{user.credits}</p>
                <p className="text-xs text-slate-500">
                  {user.credits === 1 ? t('patient.credit') : t('patient.credits')}
                </p>
              </div>
            )}
            {creditsMsg && (
              <div className={`w-full rounded-lg border px-3 py-2 text-xs text-center ${
                creditsMsg.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30    bg-rose-500/10    text-rose-400'
              }`}>
                {creditsMsg.message}
              </div>
            )}
          </div>

          {/* ── Appointments + detail (stacked vertically) ── */}
          <div className="flex-1 min-w-0 space-y-3">

            <AppointmentsPanel
              title={t('patient.appointmentsTitle')}
              appointments={active}
              loading={loading}
              error={error}
              emptyMessage={t('patient.emptyAppointments')}
              role="patient"
              selectedId={selectedAppointment?.id}
              onSelect={handleSelect}
            />

            {!loading && archive.length > 0 && (
              <div>
                <button
                  onClick={() => setShowArchive((v) => !v)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${showArchive ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showArchive ? t('patient.hideArchive') : t('patient.showArchive', { count: archive.length })}
                </button>
                {showArchive && (
                  <AppointmentsPanel
                    title={t('patient.archiveTitle')}
                    appointments={archive}
                    loading={false}
                    error={null}
                    emptyMessage=""
                    role="patient"
                    selectedId={selectedAppointment?.id}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            )}

            {/* Detail panel — below the appointment boxes */}
            {selectedAppointment && (
              <AppointmentDetail
                appointment={selectedAppointment}
                counterpart={{
                  firstName:      selectedAppointment.psychologist.first_name,
                  lastName:       selectedAppointment.psychologist.last_name,
                  namePrefix:     'Dr.',
                  profilePicture: selectedAppointment.psychologist.profile_picture,
                }}
                previousLabel={t('patient.previousSessionsWith', { lastName: selectedAppointment.psychologist.last_name })}
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
                  <div className="mt-5 flex items-center gap-3 flex-wrap">
                    {selStatus === 'pending_request' && (
                      <button onClick={handleWithdraw} disabled={actionLoading}
                        className="rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {actionLoading ? t('patient.withdrawingRequest') : t('patient.withdrawRequest')}
                      </button>
                    )}
                    {selStatus === 'confirmed' && (
                      <button onClick={handleCancel} disabled={actionLoading}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {actionLoading ? t('patient.cancellingAppointment') : t('patient.cancelAppointment')}
                      </button>
                    )}
                    {actionError && <p className="text-rose-400 text-sm">{actionError}</p>}
                  </div>
                }
              />
            )}

          </div>
        </div>
      </div>
    </main>
  )
}

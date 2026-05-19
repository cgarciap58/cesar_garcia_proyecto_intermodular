import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAppointments, cancelAppointment } from '../services'
import AppointmentCard from '../components/AppointmentCard'
import PreviousSessions from '../components/PreviousSessions'

function formatFullDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE = {
  confirmed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  pending:   'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  useEffect(() => {
    getAppointments().then((result) => {
      if (result.ok) {
        const sorted = [...result.data.appointments].sort(
          (a, b) => new Date(a.slot.start_time) - new Date(b.slot.start_time)
        )
        setAppointments(sorted)
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
      setAppointments((prev) =>
        prev.map((a) => (a.id === selected.id ? result.data : a))
      )
      setSelected(result.data)
    } else {
      setCancelError(result.error)
    }
    setCancelling(false)
  }

  const selectedAppointment = selected
    ? appointments.find((a) => a.id === selected.id) ?? selected
    : null

  // Is the selected appointment in the past?
  const isPast = selectedAppointment
    ? new Date(selectedAppointment.slot.start_time) < new Date()
    : false

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* ── Top strip: profile + appointment cards ── */}
        <div className="flex gap-4 items-start">

          {/* Profile sidebar */}
          <div className="flex-shrink-0 w-36 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold text-slate-400">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              )}
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-sm leading-tight">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">Patient</p>
            </div>
            <div className="w-full flex flex-col gap-2 mt-2">
              <a
                href="/book"
                className="w-full text-center rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 text-xs font-semibold text-white transition-colors"
              >
                Book appointment
              </a>
              <button className="w-full rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
                Add credits
              </button>
            </div>
          </div>

          {/* Appointments horizontal scroll */}
          <div className="flex-1 min-w-0 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Your appointments
              </h2>
              <span className="text-xs text-slate-600">{appointments.length} total</span>
            </div>

            {loading && (
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36 h-32 rounded-2xl bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            )}

            {error && <p className="text-rose-400 text-sm">{error}</p>}

            {!loading && !error && appointments.length === 0 && (
              <div className="flex gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36 h-32 rounded-2xl border border-dashed border-slate-700 flex items-center justify-center">
                    <span className="text-slate-600 text-xs">No appointment</span>
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && appointments.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {appointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    role="patient"
                    isSelected={selectedAppointment?.id === appt.id}
                    onClick={() =>
                      setSelected((prev) => (prev?.id === appt.id ? null : appt))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ── */}
        {selectedAppointment && (
          <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
            <div className="flex gap-6">

              {/* Psychologist avatar */}
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
                  {selectedAppointment.psychologist.profile_picture ? (
                    <img
                      src={selectedAppointment.psychologist.profile_picture}
                      alt="Psychologist"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">
                      {selectedAppointment.psychologist.first_name[0]}
                      {selectedAppointment.psychologist.last_name[0]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 text-center leading-tight">
                  Dr. {selectedAppointment.psychologist.first_name}<br />
                  {selectedAppointment.psychologist.last_name}
                </p>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {formatFullDate(selectedAppointment.slot.start_time)}
                    </h3>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {formatTime(selectedAppointment.slot.start_time)}
                      {' · '}
                      {selectedAppointment.slot.duration_minutes} min
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE[selectedAppointment.status]}`}>
                    {selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
                  </span>
                </div>

                {/* Session notes — only shown after the session has taken place */}
                {isPast && selectedAppointment.patient_notes && (
                  <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                      Notes from your psychologist
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {selectedAppointment.patient_notes}
                    </p>
                  </div>
                )}

                {/* Meet link */}
                {selectedAppointment.meet_link && (
                  <div className="mt-3">
                    <a
                      href={selectedAppointment.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-500/15 border border-blue-500/30 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/25 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      Join session
                    </a>
                  </div>
                )}

                {/* Cancel button */}
                {selectedAppointment.status !== 'cancelled' && (
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelling ? 'Cancelling…' : 'Cancel appointment'}
                    </button>
                    {cancelError && <p className="text-rose-400 text-sm">{cancelError}</p>}
                  </div>
                )}

                {/* Previous sessions with this psychologist */}
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Previous sessions with Dr. {selectedAppointment.psychologist.last_name}
                  </p>
                  <PreviousSessions
                    withUserId={selectedAppointment.psychologist.id}
                    role="patient"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

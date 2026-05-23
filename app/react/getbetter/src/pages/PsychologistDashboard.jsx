import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAppointments, confirmAppointment, cancelAppointment } from '../services'
import ProfileSidebar from '../components/ProfileSidebar'
import AppointmentsPanel from '../components/AppointmentsPanel'
import AppointmentDetail from '../components/AppointmentDetail'

const PSYCHOLOGIST_ACTIONS = [
  { label: 'Manage slots', href: '/slots', variant: 'primary' },
]

export default function PsychologistDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

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
            namePrefix="Dr."
            roleLabel="Psychologist"
            actions={PSYCHOLOGIST_ACTIONS}
          />
          <AppointmentsPanel
            title="Upcoming appointments"
            appointments={appointments}
            loading={loading}
            error={error}
            emptyMessage="No patients yet"
            role="psychologist"
            selectedId={selectedAppointment?.id}
            onSelect={handleSelect}
          />
        </div>

        {selectedAppointment && (
          <AppointmentDetail
            appointment={selectedAppointment}
            counterpart={{
              firstName: selectedAppointment.patient.first_name,
              lastName: selectedAppointment.patient.last_name,
              profilePicture: selectedAppointment.patient.profile_picture,
            }}
            meetLinkLabel="Start session"
            previousLabel={`Previous sessions with ${selectedAppointment.patient.first_name} ${selectedAppointment.patient.last_name}`}
            previousUserId={selectedAppointment.patient.id}
            role="psychologist"
            notes={
              isPast ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                      Session notes
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {selectedAppointment.patient_notes || (
                        <span className="italic text-slate-600">No notes written</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 border border-amber-500/20 p-4">
                    <p className="text-xs font-medium text-amber-500/70 uppercase tracking-wider mb-2">
                      Private notes
                    </p>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {selectedAppointment.private_notes || (
                        <span className="italic text-slate-600">No private notes</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : null
            }
            actions={
              selectedAppointment.status !== 'cancelled' ? (
                <div className="mt-5 flex items-center gap-3 flex-wrap">
                  {selectedAppointment.status === 'pending' && (
                    <button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className="rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? 'Confirming…' : 'Confirm appointment'}
                    </button>
                  )}
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Cancelling…' : 'Cancel appointment'}
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

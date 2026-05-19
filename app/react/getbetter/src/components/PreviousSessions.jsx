import { useEffect, useState } from 'react'
import { getAppointmentHistory } from '../services'

function formatFullDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// A single collapsed/expanded session entry
function SessionEntry({ appointment, role }) {
  const [open, setOpen] = useState(false)
  const hasNotes = role === 'psychologist'
    ? appointment.private_notes || appointment.patient_notes
    : appointment.patient_notes

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-sm text-slate-200">
            {formatFullDate(appointment.slot.start_time)}
          </span>
          <span className="text-xs text-slate-500">
            {appointment.slot.duration_minutes} min
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
          {/* Patient-facing notes (both roles can see these) */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Session notes
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {appointment.patient_notes || (
                <span className="italic text-slate-600">No notes for this session</span>
              )}
            </p>
          </div>

          {/* Private notes — psychologist only */}
          {role === 'psychologist' && (
            <div>
              <p className="text-xs font-medium text-amber-500/70 uppercase tracking-wider mb-1">
                Private notes
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {appointment.private_notes || (
                  <span className="italic text-slate-600">No private notes</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// withUserId: the ID of the OTHER party (psych ID for patient, patient ID for psych)
export default function PreviousSessions({ withUserId, role }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!withUserId) return
    setLoading(true)
    setError(null)

    getAppointmentHistory(withUserId).then((result) => {
      if (result.ok) {
        setHistory(result.data.history)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [withUserId])

  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-11 rounded-xl bg-slate-800/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-rose-400 text-sm mt-4">{error}</p>
  }

  if (history.length === 0) {
    return (
      <p className="text-slate-600 text-sm italic mt-4">
        No previous sessions with this {role === 'patient' ? 'psychologist' : 'patient'}.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      {history.map((appt) => (
        <SessionEntry key={appt.id} appointment={appt} role={role} />
      ))}
    </div>
  )
}

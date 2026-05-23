// AppointmentsPanel — the scrollable appointments strip shown on both dashboards.
//
// Props:
//   title        – heading text (e.g. "Your appointments")
//   appointments – array of appointment objects
//   loading      – boolean, shows skeleton while true
//   error        – error string or null
//   emptyMessage – string shown when there are no appointments
//   role         – "patient" | "psychologist", forwarded to AppointmentCard
//   selectedId   – id of the currently selected appointment (or null)
//   onSelect     – (appointment) => void, called when a card is clicked

import AppointmentCard from './AppointmentCard'

const SKELETON_COUNT = 4
const EMPTY_PLACEHOLDER_COUNT = 3

export default function AppointmentsPanel({
  title,
  appointments,
  loading,
  error,
  emptyMessage,
  role,
  selectedId,
  onSelect,
}) {
  return (
    <div className="flex-1 min-w-0 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </h2>
        <span className="text-xs text-slate-600">{appointments.length} total</span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex gap-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div key={i} className="flex-shrink-0 w-36 h-32 rounded-2xl bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-rose-400 text-sm">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && appointments.length === 0 && (
        <div className="flex gap-3">
          {Array.from({ length: EMPTY_PLACEHOLDER_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-36 h-32 rounded-2xl border border-dashed border-slate-700 flex items-center justify-center"
            >
              <span className="text-slate-600 text-xs">{emptyMessage}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {!loading && !error && appointments.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              role={role}
              isSelected={selectedId === appt.id}
              onClick={() => onSelect(appt)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

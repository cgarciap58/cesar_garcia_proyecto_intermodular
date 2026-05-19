const STATUS_STYLES = {
  confirmed: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Confirmed',
  },
  pending: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'Pending',
  },
  cancelled: {
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-500',
    dot: 'bg-slate-500',
    label: 'Cancelled',
  },
}

function formatShortDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// The person shown on the card is always the OTHER party
function getCounterpart(appointment, role) {
  if (role === 'patient') {
    return {
      name: `Dr. ${appointment.psychologist.last_name}`,
      initials: `${appointment.psychologist.first_name[0]}${appointment.psychologist.last_name[0]}`,
      picture: appointment.psychologist.profile_picture ?? null,
    }
  }
  return {
    name: `${appointment.patient.first_name} ${appointment.patient.last_name}`,
    initials: `${appointment.patient.first_name[0]}${appointment.patient.last_name[0]}`,
    picture: appointment.patient.profile_picture ?? null,
  }
}

export default function AppointmentCard({ appointment, role, isSelected, onClick }) {
  const style = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.pending
  const counterpart = getCounterpart(appointment, role)

  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0 w-36 rounded-2xl border p-4 text-left
        transition-all duration-200 cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-400/50
        ${style.bg} ${style.border}
        ${isSelected
          ? 'ring-2 ring-blue-400 scale-105 shadow-lg shadow-blue-500/10'
          : 'hover:brightness-110 opacity-80 hover:opacity-100'
        }
        ${appointment.status === 'cancelled' ? 'opacity-50 hover:opacity-60' : ''}
      `}
    >
      {/* Profile picture */}
      <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden mb-3">
        {counterpart.picture ? (
          <img
            src={counterpart.picture}
            alt={counterpart.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-semibold text-slate-300">
            {counterpart.initials}
          </span>
        )}
      </div>

      {/* Counterpart name */}
      <p className="text-slate-200 text-xs font-medium truncate mb-2">
        {counterpart.name}
      </p>

      {/* Date + time */}
      <p className="text-white font-semibold text-sm leading-tight">
        {formatShortDate(appointment.slot.start_time)}
      </p>
      <p className="text-slate-400 text-xs mt-0.5">
        {formatTime(appointment.slot.start_time)}
      </p>

      {/* Status dot + label */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
        <span className={`text-xs ${style.text}`}>{style.label}</span>
      </div>
    </button>
  )
}

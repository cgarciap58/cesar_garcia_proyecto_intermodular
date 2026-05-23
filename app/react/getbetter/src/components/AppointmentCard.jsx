import { useTranslation } from 'react-i18next'
import { formatShortDate, formatTime, STATUS_STYLES } from '../utils/appointmentFormatters'

function getCounterpart(appointment, role) {
  if (role === 'patient') {
    return {
      name:     `Dr. ${appointment.psychologist.last_name}`,
      initials: `${appointment.psychologist.first_name[0]}${appointment.psychologist.last_name[0]}`,
      picture:  appointment.psychologist.profile_picture ?? null,
    }
  }
  return {
    name:     `${appointment.patient.first_name} ${appointment.patient.last_name}`,
    initials: `${appointment.patient.first_name[0]}${appointment.patient.last_name[0]}`,
    picture:  appointment.patient.profile_picture ?? null,
  }
}

// Terminal-ish statuses that should be visually dimmed
const DIMMED_STATUSES = new Set(['rejected', 'cancelled', 'done'])

export default function AppointmentCard({ appointment, role, isSelected, onClick }) {
  const { i18n, t } = useTranslation('appointments')

  // `appointment.status` is already the effective (computed) status from the API
  const style      = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.pending_request
  const counterpart = getCounterpart(appointment, role)
  const isDimmed    = DIMMED_STATUSES.has(appointment.status)

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
        ${isDimmed ? 'opacity-50 hover:opacity-60' : ''}
      `}
    >
      <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden mb-3">
        {counterpart.picture ? (
          <img src={counterpart.picture} alt={counterpart.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-slate-300">{counterpart.initials}</span>
        )}
      </div>

      <p className="text-slate-200 text-xs font-medium truncate mb-2">{counterpart.name}</p>

      <p className="text-white font-semibold text-sm leading-tight">
        {formatShortDate(appointment.slot.start_time, i18n.language)}
      </p>
      <p className="text-slate-400 text-xs mt-0.5">
        {formatTime(appointment.slot.start_time, i18n.language)}
      </p>

      <div className="flex items-center gap-1.5 mt-3">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
        {/* Use localised label if available, fall back to style.label */}
        <span className={`text-xs ${style.text}`}>
          {t(style.labelKey, style.label)}
        </span>
      </div>
    </button>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PreviousSessions from './PreviousSessions'
import SessionModal from './SessionModal'
import { formatFullDate, formatTime, STATUS_BADGE, STATUS_STYLES, FALLBACK_STYLE } from '../utils/appointmentFormatters'

const SESSION_STATUSES = new Set(['confirmed', 'in_progress'])

const VIDEO_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
)

export default function AppointmentDetail({
  appointment, counterpart, previousLabel, previousUserId, role, notes, actions,
}) {
  const { i18n, t } = useTranslation('appointments')
  const { t: tDash } = useTranslation('dashboard')

  const [sessionOpen, setSessionOpen] = useState(false)

  const { firstName, lastName, namePrefix, profilePicture } = counterpart
  const displayName  = [namePrefix, firstName, lastName].filter(Boolean).join(' ')
  // Guard against empty/missing names — mirrors DashboardSidebar's pattern
  const initials     = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`
  const style        = STATUS_STYLES[appointment.status] ?? FALLBACK_STYLE
  const badgeClass   = STATUS_BADGE[appointment.status]  ?? STATUS_BADGE.pending_request
  const canJoin      = SESSION_STATUSES.has(appointment.status)

  return (
    <>
      <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
        <div className="flex gap-6">

          {/* Avatar */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
              {profilePicture
                ? <img src={profilePicture} alt={displayName} className="w-full h-full object-cover" />
                : <span className="text-lg font-semibold text-slate-400">{initials}</span>
              }
            </div>
            <p className="text-xs text-slate-400 text-center leading-tight">
              {namePrefix
                ? <>{namePrefix} {firstName}<br />{lastName}</>
                : <>{firstName}<br />{lastName}</>
              }
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {formatFullDate(appointment.slot.start_time, i18n.language)}
                </h3>
                <p className="text-slate-400 text-sm mt-0.5">
                  {formatTime(appointment.slot.start_time, i18n.language)}
                  {' – '}
                  {formatTime(appointment.slot.end_time, i18n.language)}
                  {' · '}
                  {appointment.slot.duration_minutes} min
                </p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${badgeClass}`}>
                {t(style.labelKey)}
              </span>
            </div>

            {/* Go to session button — only for confirmed / in_progress */}
            {canJoin && (
              <div className="mt-4">
                <button
                  onClick={() => setSessionOpen(true)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    appointment.status === 'in_progress'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-400'
                  }`}
                >
                  {VIDEO_ICON}
                  {appointment.status === 'in_progress'
                    ? tDash('session.goNowActive')
                    : tDash('session.goToSession')
                  }
                </button>
              </div>
            )}

            {notes}

            {actions}

            <div className="mt-6 border-t border-slate-800 pt-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                {previousLabel}
              </p>
              <PreviousSessions withUserId={previousUserId} role={role} />
            </div>
          </div>
        </div>
      </div>

      {sessionOpen && (
        <SessionModal
          appointment={appointment}
          counterpart={counterpart}
          onClose={() => setSessionOpen(false)}
        />
      )}
    </>
  )
}

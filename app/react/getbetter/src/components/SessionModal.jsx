import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatFullDate, formatTime } from '../utils/appointmentFormatters'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generates a deterministic-looking but random Google Meet style code from the
// appointment id. Stable for the same appointment (won't change on re-render).
function getMockMeetLink(appointmentId) {
  // Seed a simple hash from the id so the same appointment always gives the
  // same link within a session — looks plausible in a demo.
  const hash  = String(appointmentId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const seg   = (seed, len) =>
    Array.from({ length: len }, (_, i) => chars[(seed * (i + 7) + i * 13) % chars.length]).join('')
  return `https://meet.google.com/${seg(hash, 3)}-${seg(hash + 1, 4)}-${seg(hash + 2, 3)}`
}

function useCountdown(startTimeIso) {
  const getMs = useCallback(
    () => new Date(startTimeIso).getTime() - Date.now(),
    [startTimeIso],
  )
  const [ms, setMs] = useState(getMs)

  useEffect(() => {
    const id = setInterval(() => setMs(getMs()), 1000)
    return () => clearInterval(id)
  }, [getMs])

  return ms
}

function CountdownLabel({ startTimeIso, durationMinutes, t }) {
  const msUntilStart = useCountdown(startTimeIso)
  const msUntilEnd   = msUntilStart + durationMinutes * 60_000

  if (msUntilEnd <= 0) {
    // Session is over
    return (
      <span className="text-xs text-slate-500 italic">{t('session.sessionEnded')}</span>
    )
  }

  if (msUntilStart <= 0) {
    // In progress
    const remainMins = Math.ceil(msUntilEnd / 60_000)
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        {t('session.inProgressEndsIn', { count: remainMins })}
      </span>
    )
  }

  // Upcoming
  const totalSecs  = Math.ceil(msUntilStart / 1000)
  const days       = Math.floor(totalSecs / 86400)
  const hours      = Math.floor((totalSecs % 86400) / 3600)
  const mins       = Math.floor((totalSecs % 3600) / 60)
  const secs       = totalSecs % 60

  if (days > 0) {
    return (
      <span className="text-xs text-slate-400">
        {t('session.startsInDays', { count: days })}
      </span>
    )
  }

  if (hours > 0) {
    return (
      <span className="text-xs text-slate-400">
        {t('session.startsInHours', { hours, mins })}
      </span>
    )
  }

  // Under an hour — show live ticking countdown
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <span className="text-xs font-mono tabular-nums text-amber-400">
      {t('session.startsIn')} {pad(mins)}:{pad(secs)}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionModal({ appointment, counterpart, onClose }) {
  const { i18n, t } = useTranslation('dashboard')

  const { firstName, lastName, namePrefix, profilePicture } = counterpart
  const displayName = [namePrefix, firstName, lastName].filter(Boolean).join(' ')
  const initials    = `${firstName[0]}${lastName[0]}`
  const meetLink    = appointment.meet_link || getMockMeetLink(appointment.id)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleGoNow = () => {
    window.open(meetLink, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('session.modalLabel')}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

        <div className="p-6">

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={t('session.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-5">
            {t('session.title')}
          </p>

          {/* Counterpart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profilePicture
                ? <img src={profilePicture} alt={displayName} className="w-full h-full object-cover" />
                : <span className="text-base font-semibold text-slate-300">{initials}</span>
              }
            </div>
            <div>
              <p className="text-white font-semibold text-base leading-tight">{displayName}</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {formatFullDate(appointment.slot.start_time, i18n.language)}
              </p>
              <p className="text-slate-500 text-xs">
                {formatTime(appointment.slot.start_time, i18n.language)}
                {' · '}
                {appointment.slot.duration_minutes} min
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="mb-6">
            <CountdownLabel
              startTimeIso={appointment.slot.start_time}
              durationMinutes={appointment.slot.duration_minutes}
              t={t}
            />
          </div>

          {/* Go Now button. */}
          {/* TODO: Should be blocked if 30+ min left for appointment */}
          <button
            onClick={handleGoNow}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-5 py-3.5 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-900/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            {t('session.goNow')}
          </button>

          {/* Link hint */}
          <p className="mt-3 text-center text-xs text-slate-600 truncate px-2" title={meetLink}>
            {meetLink}
          </p>

        </div>
      </div>
    </div>
  )
}

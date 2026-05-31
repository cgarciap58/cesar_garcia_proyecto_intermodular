import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAvailableSlots, bookAppointment } from '../services'

// ─── Timezone / date helpers (mirrors SlotsPage) ──────────────────────────────

function formatTimeInTz(isoUtc, tz, locale = 'en') {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(isoUtc))
}

function formatDateHeader(isoUtc, tz, locale = 'en') {
  const str = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: tz,
  }).format(new Date(isoUtc))
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function groupByLocalDate(slots, tz) {
  const map = new Map()
  for (const slot of slots) {
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(slot.start_time))
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey).push(slot)
  }
  return map
}

function creditCost(durationMinutes) {
  return Math.ceil(durationMinutes / 55)
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ type, message }) {
  if (!message) return null
  const styles = {
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    error:   'bg-rose-500/15    border-rose-500/30    text-rose-400',
    warning: 'bg-amber-500/15   border-amber-500/30   text-amber-400',
    info:    'bg-blue-500/15    border-blue-500/30    text-blue-400',
  }
  return (
    <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${styles[type] ?? styles.info}`}>
      {message}
    </div>
  )
}

// ─── PsychologistCard ─────────────────────────────────────────────────────────

function PsychologistCard({ psych, credits, timezone, locale, onBooked }) {
  const { t } = useTranslation('book')

  const [expanded, setExpanded]           = useState(false)
  const [bookingSlotId, setBookingSlotId] = useState(null)
  const [status, setStatus]               = useState(null)
  const [slots, setSlots]                 = useState(psych.slots)

  const cost        = creditCost(psych.session_duration_minutes)
  const canAfford   = credits >= cost
  const initials    = `${psych.first_name[0]}${psych.last_name[0]}`
  const slotsByDate = groupByLocalDate(slots, timezone)

  const handleRequest = async (slotId) => {
    setBookingSlotId(slotId)
    setStatus(null)

    const result = await bookAppointment(slotId)

    if (result.ok) {
      setSlots((prev) => prev.filter((s) => s.id !== slotId))
      setStatus({ type: 'success', message: t('requestSuccess') })
      onBooked(cost)
    } else {
      let msg
      if (result.error === 'Insufficient credits') {
        msg = t('errorInsufficient')
      } else if (result.error?.includes('already have an active request')) {
        msg = t('alreadyRequested')
      } else {
        msg = result.error || t('errorGeneric')
      }
      setStatus({ type: 'error', message: msg })
    }

    setBookingSlotId(null)
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">

      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-800/30 transition-colors"
      >
        {/* Avatar — shows profile picture if available, initials otherwise */}
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
          {psych.profile_picture
            ? <img src={psych.profile_picture} alt={`Dr. ${psych.last_name}`} className="w-full h-full object-cover" />
            : <span className="text-sm font-semibold text-slate-300">{initials}</span>
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm">
            Dr. {psych.first_name} {psych.last_name}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {t('slotCount', { count: slots.length })}
            {' · '}
            {t('min', { count: psych.session_duration_minutes })}
            {' · '}
            {t('credit', { count: cost })}
          </p>
        </div>

        <span className="flex-shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          {t('tokens', { count: parseFloat(psych.session_price) })}
        </span>

        <svg
          className={`flex-shrink-0 w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded slot list ── */}
      {expanded && (
        <div className="border-t border-slate-800 px-5 pb-5 pt-4 space-y-4">

          {slots.length === 0 && (
            <p className="text-slate-500 text-sm italic">{t('noSlotsRemaining')}</p>
          )}

          {!canAfford && slots.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
              {t('notEnoughCredits', { cost })}
            </div>
          )}

          {[...slotsByDate.entries()].map(([dateKey, daySlots]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {formatDateHeader(daySlots[0].start_time, timezone, locale)}
              </p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleRequest(slot.id)}
                    disabled={!canAfford || bookingSlotId === slot.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors
                      ${canAfford
                        ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'
                        : 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
                      }`}
                  >
                    {bookingSlotId === slot.id && (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    )}
                    <span>{formatTimeInTz(slot.start_time, timezone, locale)}</span>
                    <span className="text-xs text-slate-500">{slot.duration_minutes}m</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <StatusBadge type={status?.type} message={status?.message} />
        </div>
      )}
    </div>
  )
}

// ─── BookPage ─────────────────────────────────────────────────────────────────

export default function BookPage() {
  const { user, setUser } = useAuth()
  const navigate           = useNavigate()
  const { t, i18n }        = useTranslation('book')

  const timezone = user?.timezone ?? 'UTC'
  const locale   = i18n.language
  const credits  = user?.credits ?? 0

  const [psychologists, setPsychologists] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  useEffect(() => {
    getAvailableSlots().then((result) => {
      if (result.ok) {
        setPsychologists(result.data.psychologists)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
  }, [])

  // Called by PsychologistCard after a successful request.
  // Deducts the cost from the AuthContext user so every consumer updates.
  const handleBooked = (cost) => {
    setUser((prev) => prev ? { ...prev, credits: Math.max(0, (prev.credits ?? 0) - cost) } : prev)
  }

  const activePsychs = psychologists.filter((p) => p.slots.length > 0)

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-white">{t('pageTitle')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('pageSubtitle', { timezone })}
            </p>
          </div>
        </div>

        {/* ── Credit balance notice ── */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-3.5">
          <span className="text-2xl font-semibold text-white">{credits}</span>
          <div>
            <p className="text-sm text-slate-300 font-medium">
              {t('creditsAvailable', { count: credits })}
            </p>
            <p className="text-xs text-slate-500">{t('creditsCost')}</p>
          </div>
        </div>

        {/* ── Psychologist list ── */}
        <SectionCard
          title={t('psychologistsTitle')}
          subtitle={t('psychologistsSubtitle')}
        >
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="text-rose-400 text-sm">{error}</p>
          )}

          {!loading && !error && activePsychs.length === 0 && (
            <p className="text-slate-500 text-sm italic">{t('noSlots')}</p>
          )}

          {!loading && !error && activePsychs.length > 0 && (
            <div className="space-y-3">
              {activePsychs.map((psych) => (
                <PsychologistCard
                  key={psych.id}
                  psych={psych}
                  credits={credits}
                  timezone={timezone}
                  locale={locale}
                  onBooked={handleBooked}
                />
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </main>
  )
}

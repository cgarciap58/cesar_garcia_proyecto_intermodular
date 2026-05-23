// ─── Date formatting ──────────────────────────────────────────────────────────
//
// All functions accept a `locale` parameter (e.g. 'en', 'es').
// Callers get it from i18next: const { i18n } = useTranslation()
// then pass i18n.language.
//
// Dates returned by Intl in some locales (e.g. Spanish) start lowercase
// ("jueves, 5 de junio"). Since these strings always open a sentence in our
// UI we capitalise the first character unconditionally.

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatFullDate(isoString, locale = 'en') {
  const date = new Date(isoString)
  return capitalize(date.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }))
}

export function formatShortDate(isoString, locale = 'en') {
  const date = new Date(isoString)
  return capitalize(date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }))
}

export function formatTime(isoString, locale = 'en') {
  const date = new Date(isoString)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// ─── Computed status ──────────────────────────────────────────────────────────
//
// Mirrors the backend's compute_status() in appointments/views.py.
// The backend already sends the computed status as `appointment.status`,
// but this helper is useful when the frontend needs to make decisions
// based on the effective status (e.g. showing/hiding action buttons).
//
// appointment.status     – effective status from the API (already computed)
// appointment.stored_status – raw DB value (for action guards)

export function computedStatus(appointment) {
  // The API already returns the computed status as `status`.
  // This function is here for cases where we need to re-derive it client-side
  // (e.g. when time passes between fetches without re-fetching from the server).
  if (appointment.status !== 'confirmed') return appointment.status

  const now      = Date.now()
  const start    = new Date(appointment.slot.start_time).getTime()
  const end      = start + appointment.slot.duration_minutes * 60_000

  if (now >= end)   return 'done'
  if (now >= start) return 'in_progress'
  return 'confirmed'
}

// ─── Status styles ────────────────────────────────────────────────────────────
//
// Used by AppointmentCard (background + border + dot + label) and
// AppointmentDetail (badge pill).
//
// Label strings are intentionally hard-coded here as English fallbacks.
// Components that render localised labels should look up the translation key
// from the 'appointments' namespace (appointments.status.<key>) instead of
// using style.label directly — but style.label is kept for legacy uses.

export const STATUS_BADGE = {
  confirmed:       'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  in_progress:     'bg-blue-500/20    text-blue-400    border border-blue-500/30',
  done:            'bg-slate-500/20   text-slate-400   border border-slate-500/30',
  pending_request: 'bg-amber-500/20   text-amber-400   border border-amber-500/30',
  rejected:        'bg-rose-500/20    text-rose-400    border border-rose-500/30',
  cancelled:       'bg-slate-500/20   text-slate-400   border border-slate-500/30',
}

export const STATUS_STYLES = {
  confirmed: {
    bg:     'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text:   'text-emerald-400',
    dot:    'bg-emerald-400',
    label:  'Confirmed',
    labelKey: 'status.confirmed',
  },
  in_progress: {
    bg:     'bg-blue-500/15',
    border: 'border-blue-500/40',
    text:   'text-blue-400',
    dot:    'bg-blue-400',
    label:  'In progress',
    labelKey: 'status.in_progress',
  },
  done: {
    bg:     'bg-slate-500/15',
    border: 'border-slate-500/30',
    text:   'text-slate-400',
    dot:    'bg-slate-400',
    label:  'Done',
    labelKey: 'status.done',
  },
  pending_request: {
    bg:     'bg-amber-500/15',
    border: 'border-amber-500/40',
    text:   'text-amber-400',
    dot:    'bg-amber-400',
    label:  'Pending',
    labelKey: 'status.pending_request',
  },
  rejected: {
    bg:     'bg-rose-500/15',
    border: 'border-rose-500/40',
    text:   'text-rose-400',
    dot:    'bg-rose-400',
    label:  'Rejected',
    labelKey: 'status.rejected',
  },
  cancelled: {
    bg:     'bg-slate-500/15',
    border: 'border-slate-500/30',
    text:   'text-slate-500',
    dot:    'bg-slate-500',
    label:  'Cancelled',
    labelKey: 'status.cancelled',
  },
}

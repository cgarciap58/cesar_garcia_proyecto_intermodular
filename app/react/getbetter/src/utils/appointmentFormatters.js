// ─── Date formatting ──────────────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatFullDate(isoString, locale = 'en') {
  return capitalize(new Date(isoString).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }))
}

export function formatShortDate(isoString, locale = 'en') {
  return capitalize(new Date(isoString).toLocaleDateString(locale, {
    day: 'numeric', month: 'short',
  }))
}

export function formatTime(isoString, locale = 'en') {
  return new Date(isoString).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Computed status ──────────────────────────────────────────────────────────
//
// The API already sends the computed status as `appointment.status`.
// This function is for re-deriving it client-side as time passes between
// fetches (e.g. a confirmed appointment whose start time just passed).

export function computedStatus(appointment) {
  if (appointment.status !== 'confirmed') return appointment.status

  const now   = Date.now()
  const start = new Date(appointment.slot.start_time).getTime()
  const end   = start + appointment.slot.duration_minutes * 60_000

  if (now >= end)   return 'done'
  if (now >= start) return 'in_progress'
  return 'confirmed'
}

// ─── Terminal statuses ────────────────────────────────────────────────────────
// Used by both dashboards to decide which appointments go into the archive
// toggle vs. the active panel.

export const ACTIVE_STATUSES  = new Set(['pending_request', 'confirmed', 'in_progress'])
export const ARCHIVE_STATUSES = new Set(['withdrawn', 'rejected', 'cancelled', 'done'])

// ─── Status styles ────────────────────────────────────────────────────────────
//
// labelKey maps to the 'appointments' i18n namespace: t(labelKey) in components.

export const STATUS_BADGE = {
  confirmed:       'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  in_progress:     'bg-blue-500/20    text-blue-400    border border-blue-500/30',
  done:            'bg-slate-500/20   text-slate-400   border border-slate-500/30',
  pending_request: 'bg-amber-500/20   text-amber-400   border border-amber-500/30',
  rejected:        'bg-rose-500/20    text-rose-400    border border-rose-500/30',
  withdrawn:       'bg-slate-500/20   text-slate-400   border border-slate-500/30',
  cancelled:       'bg-slate-500/20   text-slate-400   border border-slate-500/30',
}

export const STATUS_STYLES = {
  confirmed: {
    bg: 'bg-emerald-500/15', border: 'border-emerald-500/40',
    text: 'text-emerald-400', dot: 'bg-emerald-400',
    labelKey: 'status.confirmed',
  },
  in_progress: {
    bg: 'bg-blue-500/15', border: 'border-blue-500/40',
    text: 'text-blue-400', dot: 'bg-blue-400',
    labelKey: 'status.in_progress',
  },
  done: {
    bg: 'bg-slate-500/15', border: 'border-slate-500/30',
    text: 'text-slate-400', dot: 'bg-slate-400',
    labelKey: 'status.done',
  },
  pending_request: {
    bg: 'bg-amber-500/15', border: 'border-amber-500/40',
    text: 'text-amber-400', dot: 'bg-amber-400',
    labelKey: 'status.pending_request',
  },
  rejected: {
    bg: 'bg-rose-500/15', border: 'border-rose-500/40',
    text: 'text-rose-400', dot: 'bg-rose-400',
    labelKey: 'status.rejected',
  },
  withdrawn: {
    bg: 'bg-slate-500/15', border: 'border-slate-500/30',
    text: 'text-slate-500', dot: 'bg-slate-500',
    labelKey: 'status.withdrawn',
  },
  cancelled: {
    bg: 'bg-slate-500/15', border: 'border-slate-500/30',
    text: 'text-slate-500', dot: 'bg-slate-500',
    labelKey: 'status.cancelled',
  },
}

// Fallback for unknown statuses
export const FALLBACK_STYLE = STATUS_STYLES.pending_request

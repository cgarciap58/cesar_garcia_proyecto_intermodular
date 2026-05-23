// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatFullDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatShortDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ─── Status styles ────────────────────────────────────────────────────────────

export const STATUS_BADGE = {
  confirmed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  pending:   'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

export const STATUS_STYLES = {
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

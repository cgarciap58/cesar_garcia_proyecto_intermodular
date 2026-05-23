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

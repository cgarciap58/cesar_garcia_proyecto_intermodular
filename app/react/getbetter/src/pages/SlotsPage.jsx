// pages/SlotsPage.jsx
//
// Lets a psychologist manage their available appointment slots.
//
// KEY CONCEPTS FOR THE LEARNER:
// ─────────────────────────────
// • All local state lives in React (useState). Nothing is sent to the server
//   until the user clicks Apply.
// • "Controlled inputs" — every <input>/<select> has value={...} and
//   onChange={...} so React is always the source of truth, not the DOM.
// • We derive display values with useMemo so they re-compute only when their
//   dependencies change, not on every render.
// • Timezone is read-only here (from the user profile). The psychologist
//   changes it in /profile. We use it only for display and slot generation.
// • Duration is local-only: it starts from the profile default but is NOT
//   saved here. Changes affect only the slots created this session.

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getSlots, createSlots, deleteSlot } from '../services'

// ─── Constants ────────────────────────────────────────────────────────────────

// JS Date.getDay() returns 0=Sun…6=Sat; remap to Mon=0…Sun=6
const JS_DAY_TO_IDX = [6, 0, 1, 2, 3, 4, 5]

// Generate localised day names (Mon→Sun) for the active locale using Intl.
// We format a known reference week: 2 June 2025 was a Monday.
// This keeps the LOGIC (dayMask index 0=Mon…6=Sun) language-independent
// while the DISPLAY labels follow the active locale automatically.
function getLocaleDays(locale) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`2025-06-0${i + 2}T12:00:00Z`) // Mon 2 Jun … Sun 8 Jun 2025
    const full = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    return full.charAt(0).toUpperCase() + full.slice(1)
  })
}

const DURATION_MIN = 15
const DURATION_MAX = 180

// ─── Timezone helpers ─────────────────────────────────────────────────────────

function formatTimeInTz(isoUtc, tz, locale = 'en') {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(isoUtc))
}

function formatDateHeader(dateStr, locale = 'en') {
  const str = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${dateStr}T12:00:00Z`))
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatPreviewDate(dateStr, locale = 'en') {
  const str = new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${dateStr}T12:00:00Z`))
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function localToUtcIso(dateStr, timeStr, tz) {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(naive)
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const localMs = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`).getTime()
  const offsetMs = naive.getTime() - localMs
  return new Date(naive.getTime() + offsetMs).toISOString()
}

function utcToLocalDate(isoUtc, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(isoUtc))
}

// ─── Time / date option helpers ───────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function maxDateStr() {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

function datesForRecurringRule(fromStr, toStr, dayMask, tz) {
  const results = []
  let cursor = new Date(`${fromStr}T12:00:00Z`)
  const end = new Date(`${toStr}T12:00:00Z`)
  while (cursor <= end) {
    const localDate = utcToLocalDate(cursor.toISOString(), tz)
    const jsDow = new Date(`${localDate}T12:00:00Z`).getDay()
    if (dayMask[JS_DAY_TO_IDX[jsDow]]) results.push(localDate)
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return results
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    error:   'bg-rose-500/15 border-rose-500/30 text-rose-400',
    info:    'bg-blue-500/15 border-blue-500/30 text-blue-400',
  }
  return (
    <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${styles[type] ?? styles.info}`}>
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SlotsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('appointments')
  const days = getLocaleDays(i18n.language)

  // Timezone is read-only — set in /profile
  const timezone = user?.timezone ?? 'UTC'

  // Duration starts from the profile default but is local to this page visit.
  // It is NOT saved to the server here — that happens in /profile.
  const profileDefault = user?.session_duration_minutes ?? 55
  const [duration, setDuration] = useState(profileDefault)

  // True whenever duration is outside the allowed range
  const durationInvalid = duration < DURATION_MIN || duration > DURATION_MAX

  // ── Slots state ───────────────────────────────────────────────────────────
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // ── Recurring rule state ──────────────────────────────────────────────────
  const [ruleMode, setRuleMode] = useState('add')
  const [dayMask, setDayMask] = useState(Array(7).fill(false))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(maxDateStr())
  const [applyingRule, setApplyingRule] = useState(false)
  const [ruleStatus, setRuleStatus] = useState(null)

  useEffect(() => {
    getSlots().then((result) => {
      if (result.ok) setSlots(result.data.slots)
      else setSlotsError(result.error)
      setLoadingSlots(false)
    })
  }, [])

  // ── Slot preview (derived, never sent anywhere on its own) ────────────────
  const previewSlots = useMemo(() => {
    if (durationInvalid) return []
    if (!dayMask.some(Boolean)) return []
    if (!fromDate || !toDate || fromDate > toDate) return []

    const dates = datesForRecurringRule(fromDate, toDate, dayMask, timezone)
    const result = []

    for (const dateStr of dates) {
      let [h, m] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const endMinutes = eh * 60 + em

      while (h * 60 + m + duration <= endMinutes) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        result.push({ dateStr, timeStr, isoUtc: localToUtcIso(dateStr, timeStr, timezone) })
        const total = h * 60 + m + duration
        h = Math.floor(total / 60)
        m = total % 60
      }
    }
    return result
  }, [durationInvalid, dayMask, fromDate, toDate, startTime, endTime, duration, timezone])

  // ── Apply recurring rule ──────────────────────────────────────────────────
  const handleApplyRule = async () => {
    if (previewSlots.length === 0 || durationInvalid) return
    setApplyingRule(true)
    setRuleStatus(null)

    if (ruleMode === 'add') {
      const result = await createSlots(previewSlots.map((s) => s.isoUtc))
      if (result.ok) {
        setSlots((prev) => [...prev, ...result.data.created])
        const n = result.data.created.length
        const skipped = result.data.errors?.length ?? 0
        setRuleStatus({
          type: 'success',
          message: t('slots.created', { count: n }) + (skipped ? t('slots.skipped', { count: skipped }) : ''),
        })
      } else {
        setRuleStatus({ type: 'error', message: result.error })
      }
    } else {
      const previewUtcSet = new Set(previewSlots.map((s) => new Date(s.isoUtc).getTime()))
      const toDelete = slots.filter(
        (s) => !s.is_booked && previewUtcSet.has(new Date(s.start_time).getTime())
      )
      let deleted = 0, failed = 0
      for (const slot of toDelete) {
        const result = await deleteSlot(slot.id)
        if (result.ok) { deleted++; setSlots((prev) => prev.filter((s) => s.id !== slot.id)) }
        else failed++
      }
      setRuleStatus({
        type: deleted > 0 ? 'success' : 'error',
        message: t('slots.removed', { count: deleted }) + (failed ? t('slots.couldNotDelete', { count: failed }) : ''),
      })
    }
    setApplyingRule(false)
  }

  // ── Delete single slot ────────────────────────────────────────────────────
  const handleDeleteSlot = useCallback(async (slotId) => {
    setDeletingId(slotId)
    const result = await deleteSlot(slotId)
    if (result.ok) setSlots((prev) => prev.filter((s) => s.id !== slotId))
    setDeletingId(null)
  }, [])

  // ── Group slots by local date ─────────────────────────────────────────────
  const slotsByDate = useMemo(() => {
    const map = new Map()
    const todayLocal = utcToLocalDate(new Date().toISOString(), timezone)
    for (const slot of slots) {
      const dateLocal = utcToLocalDate(slot.start_time, timezone)
      if (dateLocal < todayLocal) continue
      if (!map.has(dateLocal)) map.set(dateLocal, [])
      map.get(dateLocal).push(slot)
    }
    for (const [, daySlots] of map) daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    return new Map([...map.entries()].sort())
  }, [slots, timezone])

  // ── Apply button label ────────────────────────────────────────────────────
  const applyLabel = applyingRule
    ? t('slots.applying')
    : ruleMode === 'add'
      ? t('slots.applyCreate', { count: previewSlots.length })
      : t('slots.applyRemove', { count: previewSlots.length })

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-white">{t('slots.pageTitle')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('slots.pageSubtitle')}</p>
          </div>
        </div>

        {/* ── Duration card ── */}
        <SectionCard
          title={t('slots.durationTitle')}
          subtitle={t('slots.durationSubtitle')}
        >
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('slots.durationLabel')}
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
              className={`w-full rounded-lg border bg-slate-950/80 px-3 py-2.5 text-sm text-white
                focus:outline-none focus:ring-2 transition-colors
                ${durationInvalid
                  ? 'border-amber-500/60 focus:border-amber-400 focus:ring-amber-400/30'
                  : 'border-slate-700 focus:border-blue-400 focus:ring-blue-400/30'
                }`}
            />
            {/* Hint: shows profile default when duration has been changed */}
            {duration !== profileDefault && (
              <p className="text-xs text-slate-500 mt-1.5">
                {t('slots.durationHint', { default: profileDefault })}
              </p>
            )}
            {/* Warning: shown (in amber) when outside valid range */}
            {durationInvalid && (
              <p className="text-xs text-amber-400 mt-1.5">
                {t('slots.durationWarning')}
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── Recurring schedule card ── */}
        <SectionCard
          title={t('slots.scheduleTitle')}
          subtitle={t('slots.scheduleSubtitle')}
        >
          {/* Add / Remove toggle */}
          <div className="flex gap-2 mb-5">
            {['add', 'remove'].map((mode) => (
              <button
                key={mode}
                onClick={() => setRuleMode(mode)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  ruleMode === mode
                    ? mode === 'add'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                      : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                    : 'border border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'add' ? t('slots.addSlots') : t('slots.removeSlots')}
              </button>
            ))}
          </div>

          {/* Days of week */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              {t('slots.daysOfWeek')}
            </p>
            <div className="flex flex-wrap gap-2">
              {days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setDayMask((prev) => { const next = [...prev]; next[i] = !next[i]; return next })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    dayMask[i]
                      ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                      : 'border border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Time window + date range */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t('slots.fromTime'), value: startTime, set: setStartTime },
              { label: t('slots.untilTime'), value: endTime, set: setEndTime },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  {label}
                </label>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.startingDate')}
              </label>
              <input
                type="date" value={fromDate} min={todayStr()} max={maxDateStr()}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.endDate')}
              </label>
              <input
                type="date" value={toDate} min={fromDate} max={maxDateStr()}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Slot preview */}
          {previewSlots.length > 0 && (
            <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              {(() => {
                // Group preview by date, show max 5 dates
                const byDate = {}
                for (const s of previewSlots) {
                  if (!byDate[s.dateStr]) byDate[s.dateStr] = []
                  byDate[s.dateStr].push(s)
                }
                const dates = Object.keys(byDate)
                const visible = dates.slice(0, 5)
                const hiddenSlots = previewSlots.length - visible.flatMap((d) => byDate[d]).length
                return (
                  <>
                    {visible.map((dateStr) => (
                      <div key={dateStr} className="mb-3">
                        <p className="text-xs font-medium text-slate-400 mb-1.5">
                        {formatPreviewDate(dateStr, i18n.language)}
                      </p>
                        <div className="flex flex-wrap gap-1.5">
                          {byDate[dateStr].map((s) => (
                            <span key={s.timeStr} className={`rounded px-2 py-0.5 text-xs ${
                              ruleMode === 'add' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                            }`}>
                              {s.timeStr}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {hiddenSlots > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {t('slots.moreSlots', { count: hiddenSlots })}
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Empty preview hint — only shown when days are selected but nothing fits */}
          {previewSlots.length === 0 && dayMask.some(Boolean) && !durationInvalid && (
            <p className="mt-4 text-sm text-slate-500 italic">
              {t('slots.noSlotsPreview', { duration })}
            </p>
          )}

          {/* Apply button */}
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleApplyRule}
              disabled={applyingRule || previewSlots.length === 0 || durationInvalid}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors
                disabled:cursor-not-allowed disabled:opacity-50 ${
                ruleMode === 'add'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
              }`}
            >
              {applyLabel}
            </button>
            <StatusBadge type={ruleStatus?.type} message={ruleStatus?.message} />
          </div>
        </SectionCard>

        {/* ── Upcoming slots card ── */}
        <SectionCard
          title={t('slots.upcomingTitle')}
          subtitle={t('slots.upcomingSubtitle')}
        >
          {loadingSlots && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          )}

          {!loadingSlots && slotsError && (
            <p className="text-rose-400 text-sm">{slotsError}</p>
          )}

          {!loadingSlots && !slotsError && slotsByDate.size === 0 && (
            <p className="text-slate-500 text-sm italic">{t('slots.noUpcoming')}</p>
          )}

          {!loadingSlots && !slotsError && slotsByDate.size > 0 && (
            <div className="space-y-4">
              {[...slotsByDate.entries()].map(([dateStr, daySlots]) => (
                <div key={dateStr}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {formatDateHeader(dateStr, i18n.language)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          slot.is_booked
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                            : 'border-slate-700 bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <span>{formatTimeInTz(slot.start_time, timezone, i18n.language)}</span>
                        <span className="text-xs text-slate-500">{slot.duration_minutes}m</span>
                        {slot.is_booked ? (
                          <span className="text-xs text-amber-500/70 ml-1">{t('slots.booked')}</span>
                        ) : (
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            disabled={deletingId === slot.id}
                            className="ml-1 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                            aria-label="Delete slot"
                          >
                            {deletingId === slot.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </main>
  )
}

// pages/SlotsPage.jsx
//
// This page lets a psychologist manage their available appointment slots.
//
// KEY CONCEPTS FOR THE LEARNER:
// ─────────────────────────────
// • We keep ALL local state in React (useState). Nothing is persisted until
//   the user clicks a save/apply button, which fires a fetch() call to the API.
// • "Controlled inputs" — every <input>/<select> has value={...} and
//   onChange={...} so React is always the source of truth, not the DOM.
// • We derive display values (e.g. slots grouped by week) with useMemo so
//   they re-compute automatically whenever the raw slot list changes.
// • Timezone handling: we store slot start_time in UTC on the server (Django
//   always works in UTC when USE_TZ=True). On the client we convert to/from
//   the psychologist's IANA timezone using the browser-native Intl API.

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getSlots, createSlots, deleteSlot } from '../services'
import { updateProfile } from '../services/profile'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// JS Date.getDay() returns 0=Sun … 6=Sat; we remap to Mon=0 … Sun=6
const JS_DAY_TO_IDX = [6, 0, 1, 2, 3, 4, 5]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Madrid', label: 'Europe / Madrid' },
  { value: 'Europe/London', label: 'Europe / London' },
  { value: 'Europe/Paris', label: 'Europe / Paris' },
  { value: 'Europe/Berlin', label: 'Europe / Berlin' },
  { value: 'Europe/Rome', label: 'Europe / Rome' },
  { value: 'Europe/Amsterdam', label: 'Europe / Amsterdam' },
  { value: 'Europe/Lisbon', label: 'Europe / Lisbon' },
  { value: 'Europe/Warsaw', label: 'Europe / Warsaw' },
  { value: 'America/New_York', label: 'America / New York' },
  { value: 'America/Chicago', label: 'America / Chicago' },
  { value: 'America/Denver', label: 'America / Denver' },
  { value: 'America/Los_Angeles', label: 'America / Los Angeles' },
  { value: 'America/Toronto', label: 'America / Toronto' },
  { value: 'America/Sao_Paulo', label: 'America / São Paulo' },
  { value: 'America/Mexico_City', label: 'America / Mexico City' },
  { value: 'Asia/Tokyo', label: 'Asia / Tokyo' },
  { value: 'Asia/Seoul', label: 'Asia / Seoul' },
  { value: 'Asia/Shanghai', label: 'Asia / Shanghai' },
  { value: 'Asia/Kolkata', label: 'Asia / Kolkata' },
  { value: 'Asia/Dubai', label: 'Asia / Dubai' },
  { value: 'Asia/Singapore', label: 'Asia / Singapore' },
  { value: 'Australia/Sydney', label: 'Australia / Sydney' },
  { value: 'Pacific/Auckland', label: 'Pacific / Auckland' },
  { value: 'Africa/Cairo', label: 'Africa / Cairo' },
  { value: 'Africa/Johannesburg', label: 'Africa / Johannesburg' },
]

// ─── Timezone helpers ─────────────────────────────────────────────────────────

function formatTimeInTz(isoUtc, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(isoUtc))
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
  const naiveMs = naive.getTime()
  const offsetMs = naiveMs - localMs
  return new Date(naiveMs + offsetMs).toISOString()
}

function utcToLocalDate(isoUtc, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(isoUtc))
}

// ─── Generate time options (00:00 … 23:30 every 30 min) ──────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

// ─── Date helpers ─────────────────────────────────────────────────────────────

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
    const idx = JS_DAY_TO_IDX[jsDow]
    if (dayMask[idx]) results.push(localDate)
    cursor = new Date(cursor.getTime() + 86400000)
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
    error: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    info: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  }
  return (
    <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${styles[type] || styles.info}`}>
      {message}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SlotsPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('appointments')

  useEffect(() => {
    if (user && user.role !== 'psychologist') navigate('/dashboard')
  }, [user, navigate])

  const [duration, setDuration] = useState(user?.session_duration_minutes ?? 55)
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState(null)

  const [ruleMode, setRuleMode] = useState('add')
  const [dayMask, setDayMask] = useState(Array(7).fill(false))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(maxDateStr())
  const [applyingRule, setApplyingRule] = useState(false)
  const [ruleStatus, setRuleStatus] = useState(null)

  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    getSlots().then((result) => {
      if (result.ok) setSlots(result.data.slots)
      else setSlotsError(result.error)
      setLoadingSlots(false)
    })
  }, [])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileStatus(null)
    const result = await updateProfile({ session_duration_minutes: duration, timezone })
    if (result.ok) {
      setUser((prev) => ({ ...prev, session_duration_minutes: duration, timezone }))
      setProfileStatus({ type: 'success', message: 'Saved.' })
    } else {
      setProfileStatus({ type: 'error', message: result.error })
    }
    setSavingProfile(false)
  }

  const previewSlots = useMemo(() => {
    if (!dayMask.some(Boolean)) return []
    if (!fromDate || !toDate || fromDate > toDate) return []
    const sessionMin = duration
    const dates = datesForRecurringRule(fromDate, toDate, dayMask, timezone)
    const slots = []
    for (const dateStr of dates) {
      let [h, m] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const endMinutes = eh * 60 + em
      while (h * 60 + m + sessionMin <= endMinutes) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        slots.push({ dateStr, timeStr, isoUtc: localToUtcIso(dateStr, timeStr, timezone) })
        const total = h * 60 + m + sessionMin
        h = Math.floor(total / 60)
        m = total % 60
      }
    }
    return slots
  }, [dayMask, fromDate, toDate, startTime, endTime, duration, timezone])

  const handleApplyRule = async () => {
    if (previewSlots.length === 0) return
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

  const handleDeleteSlot = useCallback(async (slotId) => {
    setDeletingId(slotId)
    const result = await deleteSlot(slotId)
    if (result.ok) setSlots((prev) => prev.filter((s) => s.id !== slotId))
    setDeletingId(null)
  }, [])

  const slotsByDate = useMemo(() => {
    const map = new Map()
    const tz = timezone
    const todayLocal = utcToLocalDate(new Date().toISOString(), tz)
    for (const slot of slots) {
      const dateLocal = utcToLocalDate(slot.start_time, tz)
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

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page header */}
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

        {/* Section 2 — Recurring schedule */}
        <SectionCard title={t('slots.scheduleTitle')} subtitle={t('slots.scheduleSubtitle')}>

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

          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              {t('slots.daysOfWeek')}
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
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

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.fromTime')}
              </label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.untilTime')}
              </label>
              <select value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none">
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.startingDate')}
              </label>
              <input type="date" value={fromDate} min={todayStr()} max={maxDateStr()}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {t('slots.endDate')}
              </label>
              <input type="date" value={toDate} min={fromDate} max={maxDateStr()}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none" />
            </div>
          </div>

          {/* Preview */}
          {previewSlots.length > 0 && (
            <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              {Object.entries(
                previewSlots.slice(0, previewSlots.findIndex((s, i) => {
                  const dates = [...new Set(previewSlots.slice(0, i + 1).map(x => x.dateStr))]
                  return dates.length > 5
                }) || previewSlots.length).reduce((acc, s) => {
                  if (!acc[s.dateStr]) acc[s.dateStr] = []
                  acc[s.dateStr].push(s)
                  return acc
                }, {})
              ).map(([dateStr, daySlots]) => (
                <div key={dateStr} className="mb-3">
                  <p className="text-xs font-medium text-slate-400 mb-1.5">{dateStr}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {daySlots.map((s) => (
                      <span key={s.timeStr} className={`rounded px-2 py-0.5 text-xs ${
                        ruleMode === 'add' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {s.timeStr}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {[...new Set(previewSlots.map(s => s.dateStr))].length > 5 && (
                <p className="text-xs text-slate-500 mt-2">
                  {t('slots.moreSlots', { count: previewSlots.length - previewSlots.filter(s =>
                    [...new Set(previewSlots.slice(0, previewSlots.indexOf(s)).map(x => x.dateStr))].length < 5
                  ).length })}
                </p>
              )}
            </div>
          )}

          {previewSlots.length === 0 && dayMask.some(Boolean) && (
            <p className="mt-4 text-sm text-slate-500 italic">
              {t('slots.noSlotsPreview', { duration })}
            </p>
          )}

          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleApplyRule}
              disabled={applyingRule || previewSlots.length === 0}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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

        {/* Section 1 — Session settings */}
        <SectionCard title={t('slots.profileTitle')} subtitle={t('slots.profileSubtitle')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('slots.durationLabel')}
              </label>
              <input
                type="number" min={15} max={180} step={5} value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 55)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
              <p className="text-xs text-slate-500 mt-1.5">{t('slots.durationHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('slots.timezoneLabel')}
              </label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30">
                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={handleSaveProfile} disabled={savingProfile}
              className="rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-blue-400/50 px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
            >
              {savingProfile ? t('slots.savingSettings') : t('slots.saveSettings')}
            </button>
            {profileStatus && (
              <span className={`text-sm ${profileStatus.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {profileStatus.message}
              </span>
            )}
          </div>
        </SectionCard>

        {/* Section 3 — Upcoming slots */}
        <SectionCard title={t('slots.upcomingTitle')} subtitle={t('slots.upcomingSubtitle')}>
          {loadingSlots && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          )}

          {slotsError && <p className="text-rose-400 text-sm">{slotsError}</p>}

          {!loadingSlots && !slotsError && slotsByDate.size === 0 && (
            <p className="text-slate-500 text-sm italic">{t('slots.noUpcoming')}</p>
          )}

          {!loadingSlots && !slotsError && slotsByDate.size > 0 && (
            <div className="space-y-4">
              {[...slotsByDate.entries()].map(([dateStr, daySlots]) => (
                <div key={dateStr}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {new Intl.DateTimeFormat('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    }).format(new Date(`${dateStr}T12:00:00Z`))}
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
                        <span>{formatTimeInTz(slot.start_time, timezone)}</span>
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

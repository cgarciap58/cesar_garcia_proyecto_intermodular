// pages/SlotsPage.jsx

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getSlots, createSlots, deleteSlot } from '../services'
import AppDatePicker from '../components/AppDatePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const JS_DAY_TO_IDX = [6, 0, 1, 2, 3, 4, 5]
const DURATION_MIN  = 15
const DURATION_MAX  = 180

// ─── Locale helpers ───────────────────────────────────────────────────────────

function getLocaleDays(locale) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`2025-06-0${i + 2}T12:00:00Z`)
    const full = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    return full.charAt(0).toUpperCase() + full.slice(1)
  })
}

// ─── Timezone / date helpers ──────────────────────────────────────────────────

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

// Always YYYY-MM-DD, locale-neutral (en-CA gives ISO order).
function todayStr() {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}
function defaultToDateStr() {
  const d = new Date(); d.setMonth(d.getMonth() + 1)
  return new Intl.DateTimeFormat('en-CA').format(d)
}
function maxDateStr() {
  const d = new Date(); d.setMonth(d.getMonth() + 3)
  return new Intl.DateTimeFormat('en-CA').format(d)
}

// ─── Time options ─────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

function datesForRecurringRule(fromStr, toStr, dayMask, tz) {
  const results = []
  let cursor = new Date(`${fromStr}T12:00:00Z`)
  const end  = new Date(`${toStr}T12:00:00Z`)
  while (cursor <= end) {
    const localDate = utcToLocalDate(cursor.toISOString(), tz)
    const jsDow     = new Date(`${localDate}T12:00:00Z`).getDay()
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
    error:   'bg-rose-500/15    border-rose-500/30    text-rose-400',
    info:    'bg-blue-500/15    border-blue-500/30    text-blue-400',
  }
  return (
    <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${styles[type] ?? styles.info}`}>
      {message}
    </div>
  )
}

// ─── Slot chip ────────────────────────────────────────────────────────────────
//
// Colours mirror dashboard STATUS_STYLES:
//   confirmed    → emerald  (same as confirmed appointment cards)
//   open+pending → amber    (same as pending_request appointment cards)
//   open         → slate    (neutral, deletable)

function SlotChip({ slot, timezone, locale, deletingId, onDelete, t }) {
  const isConfirmed = slot.status === 'confirmed'
  const hasPending  = slot.pending_request_count > 0
  const isDeleting  = deletingId === slot.id

  const chipClass = isConfirmed
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
    : hasPending
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
      : 'border-slate-700 bg-slate-800/60 text-slate-300'

  const startLabel = formatTimeInTz(slot.start_time, timezone, locale)
  const endLabel   = formatTimeInTz(slot.end_time,   timezone, locale)

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${chipClass}`}>
      <span>{startLabel}–{endLabel}</span>
      <span className="text-xs opacity-60">{slot.duration_minutes}m</span>

      {isConfirmed && (
        <span className="ml-1 text-xs text-emerald-500/80">{t('slots.confirmed')}</span>
      )}

      {!isConfirmed && hasPending && (
        <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
          {t('slots.pendingCount', { count: slot.pending_request_count })}
        </span>
      )}

      {!isConfirmed && (
        <button
          onClick={() => onDelete(slot.id)}
          disabled={isDeleting}
          className="ml-1 text-current opacity-50 hover:opacity-100 hover:text-rose-400 transition-colors disabled:opacity-30"
          aria-label={t('slots.deleteSlot')}
          title={hasPending ? t('slots.deleteWithPendingWarning') : undefined}
        >
          {isDeleting ? (
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
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SlotsPage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const { t, i18n } = useTranslation('appointments')
  const days         = getLocaleDays(i18n.language)

  const timezone       = user?.timezone ?? 'UTC'
  const profileDefault = user?.session_duration_minutes ?? 55

  const [duration, setDuration]         = useState(profileDefault)
  const durationInvalid                 = duration < DURATION_MIN || duration > DURATION_MAX

  const [slots, setSlots]               = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError]     = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  const [ruleMode, setRuleMode]         = useState('add')
  const [dayMask, setDayMask]           = useState(Array(7).fill(false))
  const [startTime, setStartTime]       = useState('09:00')
  const [endTime, setEndTime]           = useState('17:00')
  const [fromDate, setFromDate]         = useState(todayStr())
  const [toDate, setToDate]             = useState(defaultToDateStr())
  const [applyingRule, setApplyingRule] = useState(false)
  const [ruleStatus, setRuleStatus]     = useState(null)

  useEffect(() => {
    getSlots().then((result) => {
      if (result.ok) setSlots(result.data.slots)
      else setSlotsError(result.error)
      setLoadingSlots(false)
    })
  }, [])

  const previewSlots = useMemo(() => {
    if (durationInvalid || !dayMask.some(Boolean)) return []
    if (!fromDate || !toDate || fromDate > toDate) return []

    const dates  = datesForRecurringRule(fromDate, toDate, dayMask, timezone)
    const result = []

    for (const dateStr of dates) {
      let [h, m]       = startTime.split(':').map(Number)
      const [eh, em]   = endTime.split(':').map(Number)
      const endMinutes = eh * 60 + em

      while (h * 60 + m + duration <= endMinutes) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        // Compute end time string for preview display
        const totalEnd = h * 60 + m + duration
        const endH     = Math.floor(totalEnd / 60)
        const endM     = totalEnd % 60
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        result.push({
          dateStr,
          timeStr,
          endTimeStr,
          isoUtc: localToUtcIso(dateStr, timeStr, timezone),
        })
        h = endH
        m = endM
      }
    }
    return result
  }, [durationInvalid, dayMask, fromDate, toDate, startTime, endTime, duration, timezone])

  const handleApplyRule = async () => {
    if (previewSlots.length === 0 || durationInvalid) return
    setApplyingRule(true); setRuleStatus(null)

    if (ruleMode === 'add') {
      const result = await createSlots(previewSlots.map((s) => s.isoUtc))
      if (result.ok) {
        setSlots((prev) => [...prev, ...result.data.created])
        const n       = result.data.created.length
        const skipped = result.data.errors?.length ?? 0
        setRuleStatus({
          type: 'success',
          message: t('slots.created', { count: n }) + (skipped ? t('slots.skipped', { count: skipped }) : ''),
        })
      } else {
        setRuleStatus({ type: 'error', message: result.error })
      }
    } else {
      // remove mode — match slots by UTC start_time
      const isoSet = new Set(previewSlots.map((s) => s.isoUtc))
      const toDelete = slots.filter((s) => {
        const norm = new Date(s.start_time).toISOString()
        return isoSet.has(norm)
      })
      let removed = 0; let failed = 0
      for (const s of toDelete) {
        const res = await deleteSlot(s.id)
        if (res.ok) { removed++; setSlots((prev) => prev.filter((x) => x.id !== s.id)) }
        else failed++
      }
      setRuleStatus({
        type: removed > 0 ? 'success' : 'error',
        message: (removed > 0 ? t('slots.removed', { count: removed }) : '')
               + (failed  > 0 ? t('slots.couldNotDelete', { count: failed }) : ''),
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

  // Group upcoming slots by local date
  const slotsByDate = useMemo(() => {
    const now  = new Date()
    const map  = new Map()
    const upcoming = slots
      .filter((s) => s.status !== 'deleted' && new Date(s.end_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

    for (const slot of upcoming) {
      const dateStr = utcToLocalDate(slot.start_time, timezone)
      if (!map.has(dateStr)) map.set(dateStr, [])
      map.get(dateStr).push(slot)
    }
    return map
  }, [slots, timezone])

  const applyLabel = applyingRule
    ? t('slots.applying')
    : ruleMode === 'add'
      ? t('slots.applyCreate', { count: previewSlots.length })
      : t('slots.applyRemove', { count: previewSlots.length })

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

        {/* ── Duration ── */}
        <SectionCard title={t('slots.durationTitle')} subtitle={t('slots.durationSubtitle')}>
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
            {duration !== profileDefault && (
              <p className="text-xs text-slate-500 mt-1.5">
                {t('slots.durationHint', { default: profileDefault })}
              </p>
            )}
            {durationInvalid && (
              <p className="text-xs text-amber-400 mt-1.5">{t('slots.durationWarning')}</p>
            )}
          </div>
        </SectionCard>

        {/* ── Recurring schedule ── */}
        <SectionCard title={t('slots.scheduleTitle')} subtitle={t('slots.scheduleSubtitle')}>
          {/* Add / Remove toggle */}
          <div className="flex gap-2 mb-5">
            {['add', 'remove'].map((mode) => (
              <button
                key={mode}
                onClick={() => setRuleMode(mode)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  ruleMode === mode
                    ? mode === 'add'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20    border border-rose-500/40    text-rose-300'
                    : 'bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'add' ? t('slots.addSlots') : t('slots.removeSlots')}
              </button>
            ))}
          </div>

          {/* Days of week */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              {t('slots.daysOfWeek')}
            </p>
            <div className="flex flex-wrap gap-2">
              {days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setDayMask((prev) => prev.map((v, j) => j === i ? !v : v))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    dayMask[i]
                      ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                      : 'bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: t('slots.fromTime'), value: startTime, onChange: setStartTime },
              { label: t('slots.untilTime'), value: endTime,   onChange: setEndTime   },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                >
                  {TIME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Date range — AppDatePicker shows DD/MM/YYYY, stores YYYY-MM-DD */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <AppDatePicker
              label={t('slots.startingDate')}
              value={fromDate}
              onChange={setFromDate}
              min={todayStr()}
              max={maxDateStr()}
            />
            <AppDatePicker
              label={t('slots.endDate')}
              value={toDate}
              onChange={setToDate}
              min={todayStr()}
              max={maxDateStr()}
            />
          </div>

          {/* Preview */}
          {previewSlots.length > 0 && !durationInvalid && (
            <div className="mt-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Preview
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {previewSlots.slice(0, 20).map((s) => (
                  <span key={s.isoUtc} className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-300">
                    {formatPreviewDate(s.dateStr, i18n.language)} {s.timeStr}–{s.endTimeStr}
                  </span>
                ))}
                {previewSlots.length > 20 && (
                  <span className="text-xs text-slate-500 self-center">
                    {t('slots.moreSlots', { count: previewSlots.length - 20 })}
                  </span>
                )}
              </div>
            </div>
          )}

          {previewSlots.length === 0 && dayMask.some(Boolean) && !durationInvalid && (
            <p className="mt-4 text-xs text-slate-500 italic">
              {t('slots.noSlotsPreview', { duration })}
            </p>
          )}

          {/* Apply */}
          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={handleApplyRule}
              disabled={previewSlots.length === 0 || durationInvalid || applyingRule}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${ruleMode === 'add'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20    border border-rose-500/40    text-rose-300    hover:bg-rose-500/30'
                }`}
            >
              {applyLabel}
            </button>
            <StatusBadge type={ruleStatus?.type} message={ruleStatus?.message} />
          </div>
        </SectionCard>

        {/* ── Upcoming slots ── */}
        <SectionCard title={t('slots.upcomingTitle')} subtitle={t('slots.upcomingSubtitle')}>
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
                      <SlotChip
                        key={slot.id}
                        slot={slot}
                        timezone={timezone}
                        locale={i18n.language}
                        deletingId={deletingId}
                        onDelete={handleDeleteSlot}
                        t={t}
                      />
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

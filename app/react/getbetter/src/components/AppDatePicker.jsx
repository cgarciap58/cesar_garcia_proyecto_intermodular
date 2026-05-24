// AppDatePicker.jsx
//
// A styled wrapper around react-datepicker that:
//   • Displays dates as DD/MM/YYYY in the input field
//   • Shows a calendar with a custom header: year <select> + month <select> + prev/next arrows
//   • Enforces an optional min/max date range
//   • Returns the selected value as a "YYYY-MM-DD" string to keep all internal
//     date logic locale-neutral (ISO strings compare and sort correctly)
//   • Imports the datepicker's default CSS then overrides it to match the app's
//     dark slate theme via inline style overrides on the wrapping element
//
// Props:
//   label    – visible label string (optional)
//   value    – controlled "YYYY-MM-DD" string or ""
//   onChange – called with "YYYY-MM-DD" string (or "" when cleared)
//   min      – earliest selectable date as "YYYY-MM-DD" (optional)
//   max      – latest selectable date as "YYYY-MM-DD" (optional)

import DatePicker from 'react-datepicker'
import { getYear, getMonth } from 'date-fns'
import 'react-datepicker/dist/react-datepicker.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// "YYYY-MM-DD" → Date object (noon UTC to avoid timezone-crossing midnight issues)
function isoToDate(isoStr) {
  if (!isoStr) return null
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

// Date object → "YYYY-MM-DD"
function dateToIso(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Build a range of integers [start, end] inclusive — same pattern you used.
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Custom calendar header ───────────────────────────────────────────────────

function CustomHeader({
  date,
  changeYear,
  changeMonth,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
  minDate,
  maxDate,
}) {
  const minYear = minDate ? getYear(minDate) : getYear(new Date())
  const maxYear = maxDate ? getYear(maxDate) : getYear(new Date()) + 5
  const years   = range(minYear, maxYear)

  const SELECT = 'rounded border border-slate-700 bg-slate-800 text-slate-200 text-xs px-1.5 py-1 focus:outline-none cursor-pointer'
  const BTN    = 'text-slate-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium'

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className={BTN}>‹</button>

      <div className="flex items-center gap-1.5">
        <select
          value={getYear(date)}
          onChange={(e) => changeYear(Number(e.target.value))}
          className={SELECT}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={MONTHS[getMonth(date)]}
          onChange={(e) => changeMonth(MONTHS.indexOf(e.target.value))}
          className={SELECT}
        >
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className={BTN}>›</button>
    </div>
  )
}

// ─── Theme overrides ──────────────────────────────────────────────────────────
// react-datepicker ships with a light theme. We patch it via a <style> tag
// injected once, scoped to the .app-datepicker class on the wrapper div.
// This avoids fighting Tailwind specificity and keeps styles co-located.

const THEME_CSS = `
.app-datepicker .react-datepicker {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  font-family: inherit;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.app-datepicker .react-datepicker__header {
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  border-radius: 0.75rem 0.75rem 0 0;
  padding: 0;
}
.app-datepicker .react-datepicker__current-month,
.app-datepicker .react-datepicker-time__header {
  color: #f1f5f9;
}
.app-datepicker .react-datepicker__day-name {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.app-datepicker .react-datepicker__day {
  color: #cbd5e1;
  border-radius: 0.375rem;
  margin: 1px;
}
.app-datepicker .react-datepicker__day:hover {
  background-color: #334155;
  color: #f1f5f9;
}
.app-datepicker .react-datepicker__day--selected,
.app-datepicker .react-datepicker__day--keyboard-selected {
  background-color: #3b82f6;
  color: #fff;
  font-weight: 600;
}
.app-datepicker .react-datepicker__day--selected:hover {
  background-color: #2563eb;
}
.app-datepicker .react-datepicker__day--outside-month {
  color: #475569;
}
.app-datepicker .react-datepicker__day--disabled {
  color: #374151;
  cursor: not-allowed;
}
.app-datepicker .react-datepicker__day--disabled:hover {
  background-color: transparent;
}
.app-datepicker .react-datepicker__triangle {
  display: none;
}
.app-datepicker .react-datepicker__navigation {
  display: none;
}
`

let themeInjected = false
function injectTheme() {
  if (themeInjected) return
  const style = document.createElement('style')
  style.textContent = THEME_CSS
  document.head.appendChild(style)
  themeInjected = true
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppDatePicker({ label, value, onChange, min, max }) {
  injectTheme()

  const selected = isoToDate(value)
  const minDate  = isoToDate(min)
  const maxDate  = isoToDate(max)

  const INPUT_CLASS =
    'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 cursor-pointer'

  return (
    <div className="app-datepicker">
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      )}
      <DatePicker
        selected={selected}
        onChange={(date) => onChange(dateToIso(date))}
        dateFormat="dd/MM/yyyy"
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
        renderCustomHeader={(props) => (
          <CustomHeader {...props} minDate={minDate} maxDate={maxDate} />
        )}
        className={INPUT_CLASS}
        // Ensure the popup doesn't get clipped by overflow:hidden parents
        popperPlacement="bottom-start"
        popperModifiers={[{ name: 'preventOverflow', options: { altAxis: true } }]}
      />
    </div>
  )
}

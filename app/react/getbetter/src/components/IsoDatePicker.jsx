// IsoDatePicker.jsx
//
// A custom date picker rendered as three <select> elements in YYYY / MM / DD
// order — the ISO 8601 format. This replaces <input type="date"> which
// renders in the *browser UI locale* regardless of the page locale or any
// lang/pattern attributes, making it unreliable for non-US users.
//
// Props:
//   label    – visible label string
//   value    – controlled date string in "YYYY-MM-DD" format (or "")
//   onChange – called with a new "YYYY-MM-DD" string when any select changes
//   min      – earliest allowed date as "YYYY-MM-DD" (optional)
//   max      – latest allowed date as "YYYY-MM-DD" (optional)

const SELECT_CLASS =
  'rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 ' +
  'appearance-none cursor-pointer'

// Generate a range of integers [start, end] inclusive.
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

// Days in a given month (1-indexed), accounting for leap years.
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// Parse a "YYYY-MM-DD" string into { year, month, day } integers.
// Returns null parts for any missing segment.
function parseParts(value) {
  if (!value || value.length < 10) return { year: null, month: null, day: null }
  const [y, m, d] = value.split('-').map(Number)
  return { year: y || null, month: m || null, day: d || null }
}

// Format parts back to "YYYY-MM-DD". Returns "" if any part is missing.
function formatParts(year, month, day) {
  if (!year || !month || !day) return ''
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export default function IsoDatePicker({ label, value, onChange, min, max }) {
  const { year, month, day } = parseParts(value)

  const minParts = parseParts(min)
  const maxParts = parseParts(max)

  // Year range: from min year (or current year - 1) to max year (or current + 5).
  const currentYear = new Date().getFullYear()
  const yearMin = minParts.year ?? currentYear
  const yearMax = maxParts.year ?? (currentYear + 5)
  const years = range(yearMin, yearMax)

  // Month range: if year is at the min/max boundary, clamp months.
  const monthMin = (year && minParts.year && year === minParts.year) ? (minParts.month ?? 1) : 1
  const monthMax = (year && maxParts.year && year === maxParts.year) ? (maxParts.month ?? 12) : 12
  const months = range(monthMin, monthMax)

  // Day range: clamp to actual days in the selected month, and to min/max.
  const maxDay = (year && month) ? daysInMonth(year, month) : 31
  const dayMin = (year && month && minParts.year === year && minParts.month === month)
    ? (minParts.day ?? 1) : 1
  const dayMax = (year && month && maxParts.year === year && maxParts.month === month)
    ? Math.min(maxParts.day ?? 31, maxDay) : maxDay
  const days = range(dayMin, dayMax)

  const handleYear  = (e) => {
    const y = Number(e.target.value)
    // If current day is out of range for the new month/year, clamp it.
    const clampedDay = (month && day) ? Math.min(day, daysInMonth(y, month)) : day
    onChange(formatParts(y, month, clampedDay))
  }

  const handleMonth = (e) => {
    const m = Number(e.target.value)
    const clampedDay = (year && day) ? Math.min(day, daysInMonth(year, m)) : day
    onChange(formatParts(year, m, clampedDay))
  }

  const handleDay   = (e) => onChange(formatParts(year, month, Number(e.target.value)))

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      )}
      <div className="flex items-center gap-1.5">
        {/* Year */}
        <select value={year ?? ''} onChange={handleYear} className={`${SELECT_CLASS} w-24`}>
          <option value="" disabled>YYYY</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <span className="text-slate-600 text-sm select-none">–</span>

        {/* Month */}
        <select value={month ?? ''} onChange={handleMonth} className={`${SELECT_CLASS} w-16`}>
          <option value="" disabled>MM</option>
          {months.map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-slate-600 text-sm select-none">–</span>

        {/* Day */}
        <select value={day ?? ''} onChange={handleDay} className={`${SELECT_CLASS} w-16`}>
          <option value="" disabled>DD</option>
          {days.map((d) => (
            <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

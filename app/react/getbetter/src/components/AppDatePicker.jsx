import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import { enGB } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// "YYYY-MM-DD" → Date object (or null)
function isoToDate(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)   // noon avoids DST edge cases
  return isNaN(d.getTime()) ? null : d
}

// Date object → "YYYY-MM-DD" (or "")
function dateToIso(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Custom input — styled to match the project's text inputs ─────────────────

const CustomInput = forwardRef(({ value, onClick, onChange, placeholder }, ref) => (
  <input
    ref={ref}
    value={value}
    onClick={onClick}
    onChange={onChange}
    placeholder={placeholder ?? 'DD/MM/YYYY'}
    className={
      'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white ' +
      'placeholder:text-slate-500 focus:border-blue-400 focus:outline-none ' +
      'focus:ring-2 focus:ring-blue-400/30 transition-colors cursor-pointer'
    }
  />
))
CustomInput.displayName = 'CustomInput'

// ─── Component ────────────────────────────────────────────────────────────────
//
// Props:
//   label    – optional label string
//   value    – controlled ISO date string "YYYY-MM-DD" or ""
//   onChange – called with "YYYY-MM-DD" (or "" when cleared)
//   min      – "YYYY-MM-DD" lower bound (optional)
//   max      – "YYYY-MM-DD" upper bound (optional)
//
// Date format is always DD/MM/YYYY (locale=enGB, dateFormat="P").
// Age enforcement (e.g. min 16 years) is handled entirely by backend
// validation — the picker itself imposes no year restrictions.

export default function AppDatePicker({ label, value, onChange, min, max }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      )}
      <DatePicker
        selected={isoToDate(value)}
        onChange={(date) => onChange(dateToIso(date))}
        locale={enGB}
        dateFormat="P"
        minDate={isoToDate(min) ?? undefined}
        maxDate={isoToDate(max) ?? undefined}
        showYearDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={120}
        customInput={<CustomInput />}
      />
    </div>
  )
}

import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import { enGB } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// ─── Custom input ─────────────────────────────────────────────────────────────
// Styled button that react-datepicker controls. The ref and onClick are
// injected by the library automatically via the customInput prop.

const CustomInput = forwardRef(({ value, onClick }, ref) => (
  <button
    type="button"
    ref={ref}
    onClick={onClick}
    className="w-full text-left rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors"
  >
    {value || <span className="text-slate-500">DD/MM/YYYY</span>}
  </button>
))
CustomInput.displayName = 'CustomInput'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// "YYYY-MM-DD" → Date (local noon, avoids midnight UTC off-by-one)
function isoToDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

// Date → "YYYY-MM-DD"
function dateToIso(date) {
  if (!date) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// ─── Component ────────────────────────────────────────────────────────────────
// Props:
//   label    – optional label string
//   value    – "YYYY-MM-DD" or ""
//   onChange – called with "YYYY-MM-DD"
//   min/max  – "YYYY-MM-DD" bounds (optional)

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
        customInput={<CustomInput />}
      />
    </div>
  )
}

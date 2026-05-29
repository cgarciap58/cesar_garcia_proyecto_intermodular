import DatePicker from 'react-datepicker'
import { enGB } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

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

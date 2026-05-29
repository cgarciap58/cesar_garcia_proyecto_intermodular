import DatePicker from 'react-datepicker'
import { enGB } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// Should use this reactjs-datepicker component for all date inputs, but adapt it to our project's variables
// For DOB, allow any year that means user is above 16 years old. Make sure input is writeable.
// For appointment dates, allow any date from today onwards, up until 3 months in the future
// For other dates, allow any date
// Remember to use    locale={enGB} and dateFormat="P"  so that format is dd-mm-yyyy


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

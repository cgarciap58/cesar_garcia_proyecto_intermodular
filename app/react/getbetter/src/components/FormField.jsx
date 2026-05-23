// A label + input + optional error message — the pattern repeated across all auth forms.
//
// Props:
//   id          – ties the label's htmlFor to the input's id
//   name        – input name attribute (used by handleChange in parent)
//   label       – visible label text
//   type        – input type (text | email | password | …), defaults to "text"
//   value       – controlled value
//   onChange    – change handler from parent
//   error       – error string; renders below the input when present
//   autoComplete – forwarded to the input
//   placeholder – forwarded to the input
//   children    – optional slot rendered between input and error (e.g. password strength bar)

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm ' +
  'text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-blue-400/30'

export default function FormField({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
  children,
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
      {children}
      {error ? <p className="mt-1.5 text-sm text-rose-400">{error}</p> : null}
    </div>
  )
}

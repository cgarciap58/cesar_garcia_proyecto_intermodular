import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from '../services/profile'
import { NAME_RE, PHONE_RE, filterName, filterPhone } from '../utils/validate'
import AppDatePicker from '../components/AppDatePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

// Needs localization
const TIMEZONES = [
  'UTC',
  'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Rome', 'Europe/Amsterdam', 'Europe/Lisbon', 'Europe/Warsaw',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Mexico_City',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Kolkata',
  'Asia/Dubai', 'Asia/Singapore',
  'Australia/Sydney', 'Australia/Melbourne',
  'Pacific/Auckland',
  'Africa/Cairo', 'Africa/Johannesburg',
]

const COUNTRY_OPTIONS = [
  { value: 'ES', label: 'Spain' },
  { value: 'US', label: 'United States' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'PT', label: 'Portugal' },
]

// Maps backend error codes → i18n keys inside the 'profile' namespace.
// The backend now returns machine-readable codes (e.g. "name_invalid")
// instead of English sentences.
const BACKEND_CODE_MAP = {
  required:                     'errors.required',
  name_invalid:                 'errors.nameInvalid',
  phone_invalid:                'errors.phoneInvalid',
  dob_invalid:                  'errors.dobInvalid',
  timezone_invalid:             'errors.timezoneInvalid',
  current_password_incorrect:   'errors.currentPasswordIncorrect',
  email_already_exists:         'errors.emailInUse',
  password_too_short:           'errors.newPasswordTooShort',
  session_duration_range:       'errors.sessionDurationRange',
  session_price_range:          'errors.sessionPriceRange',
  invalid_credentials:          'errors.invalidCredentials',
  not_psychologist:             'errors.generic',
  not_patient:                  'errors.generic',
  profile_not_found:            'errors.generic',
}

function mapBackendErrors(rawErrors = {}, t) {
  const mapped = {}
  for (const [field, code] of Object.entries(rawErrors)) {
    const key = BACKEND_CODE_MAP[code]
    mapped[field] = key ? t(key) : code
  }
  return mapped
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

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

function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  )
}

const INPUT_BASE =
  'w-full rounded-lg border bg-slate-950/80 px-3 py-2.5 text-sm text-white ' +
  'focus:outline-none focus:ring-2 transition-colors'
const INPUT_NORMAL   = `${INPUT_BASE} border-slate-700 focus:border-blue-400 focus:ring-blue-400/30`
const INPUT_ERROR    = `${INPUT_BASE} border-rose-500 focus:border-rose-400 focus:ring-rose-400/30`
const INPUT_DISABLED =
  'w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed'

function TextInput({ value, onChange, placeholder, disabled, error, type = 'text' }) {
  if (disabled) return <input type={type} value={value} disabled className={INPUT_DISABLED} />
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={error ? INPUT_ERROR : INPUT_NORMAL}
    />
  )
}

function SelectInput({ value, onChange, options, error }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={error ? INPUT_ERROR : INPUT_NORMAL}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}

function StatusBadge({ type, message }) {
  if (!message) return null
  const styles = {
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    error:   'bg-rose-500/15    border-rose-500/30    text-rose-400',
    warning: 'bg-amber-500/15   border-amber-500/30   text-amber-400',
  }
  return (
    <div className={`rounded-lg border px-4 py-2.5 text-sm ${styles[type] ?? styles.error}`}>
      {message}
    </div>
  )
}

// ─── Client-side validation ───────────────────────────────────────────────────

function validate(values, t) {
  const errors = {}

  const fn = (values.first_name || '').trim()
  if (!fn)                    errors.first_name = t('errors.required')
  else if (!NAME_RE.test(fn)) errors.first_name = t('errors.nameInvalid')

  const ln = (values.last_name || '').trim()
  if (!ln)                    errors.last_name  = t('errors.required')
  else if (!NAME_RE.test(ln)) errors.last_name  = t('errors.nameInvalid')

  const ph = (values.phone_number || '').trim()
  if (ph && !PHONE_RE.test(ph)) errors.phone_number = t('errors.phoneInvalid')

  if (values.new_password) {
    if (values.new_password.length < 8) errors.new_password     = t('errors.newPasswordTooShort')
    if (!values.current_password)       errors.current_password = t('errors.currentPasswordRequired')
  }

  if (values.role === 'psychologist') {
    const dur = parseInt(values.session_duration_minutes, 10)
    if (isNaN(dur) || dur < 15 || dur > 180)
      errors.session_duration_minutes = t('errors.sessionDurationRange')
  }

  return errors
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('profile')

  const [values, setValues] = useState({
    first_name:               user.first_name   ?? '',
    last_name:                user.last_name    ?? '',
    dob:                      user.dob          ?? '',
    city:                     user.city         ?? '',
    phone_number:             user.phone_number ?? '',
    timezone:                 user.timezone     ?? 'UTC',
    current_password:         '',
    new_password:             '',
    concerns:                 user.concerns     ?? '',
    session_duration_minutes: String(user.session_duration_minutes ?? 55),
    session_price:            String(user.session_price            ?? '1.0'),
    license_number:           user.license_number  ?? '',
    country_code:             user.country_code    ?? '',
  })

  const [errors, setErrors]     = useState({})
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState(null)

  // ── Field change handler with per-field live filters ───────────────────────
  const handleChange = (field) => (e) => {
    const raw = e.target.value
    let next = raw
    if (field === 'first_name' || field === 'last_name') next = filterName(raw)
    if (field === 'phone_number')                        next = filterPhone(raw)
    setValues((prev) => ({ ...prev, [field]: next }))
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    const validationErrors = validate({ ...values, role: user.role }, t)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)

    const payload = {}
    const str = (v) => (v ?? '').trim()

    if (str(values.first_name)   !== str(user.first_name))         payload.first_name    = str(values.first_name)
    if (str(values.last_name)    !== str(user.last_name))          payload.last_name     = str(values.last_name)
    if (str(values.dob)          !== str(user.dob ?? ''))          payload.dob           = str(values.dob) || null
    if (str(values.city)         !== str(user.city ?? ''))         payload.city          = str(values.city)
    if (str(values.phone_number) !== str(user.phone_number ?? '')) payload.phone_number  = str(values.phone_number)
    if (values.timezone          !== user.timezone)                payload.timezone      = values.timezone

    if (values.new_password) {
      payload.current_password = values.current_password
      payload.new_password     = values.new_password
    }

    if (user.role === 'patient') {
      if (str(values.concerns) !== str(user.concerns ?? ''))
        payload.concerns = str(values.concerns)
    }

    if (user.role === 'psychologist') {
      const dur = parseInt(values.session_duration_minutes, 10)
      if (dur !== user.session_duration_minutes)
        payload.session_duration_minutes = dur
      if (str(values.session_price) !== str(user.session_price ?? ''))
        payload.session_price = parseFloat(values.session_price)
      if (str(values.license_number) !== str(user.license_number ?? ''))
        payload.license_number = str(values.license_number)
      if (str(values.country_code) !== str(user.country_code ?? ''))
        payload.country_code = str(values.country_code)
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false)
      setFeedback({ type: 'success', message: t('success') })
      setTimeout(() => setFeedback(null), 3000)
      return
    }

    const result = await updateProfile(payload)
    setSaving(false)

    if (result.ok) {
      setUser(result.data)
      setValues((prev) => ({
        ...prev,
        current_password: '',
        new_password:     '',
        session_duration_minutes: String(result.data.session_duration_minutes ?? prev.session_duration_minutes),
        session_price:            String(result.data.session_price            ?? prev.session_price),
        license_number:           result.data.license_number                  ?? prev.license_number,
        country_code:             result.data.country_code                    ?? prev.country_code,
      }))
      setFeedback({ type: 'success', message: t('success') })
      setTimeout(() => setFeedback(null), 3500)
    } else if (result.fieldErrors) {
      // Structured backend errors: map codes → localised strings, spread into field errors
      const mapped = mapBackendErrors(result.fieldErrors, t)
      setErrors(mapped)
      setFeedback({ type: 'error', message: t('errors.someFieldsInvalid') })
    } else {
      setFeedback({ type: 'error', message: t('errors.generic') })
    }
  }

  const isPsych   = user.role === 'psychologist'
  const isPatient = user.role === 'patient'

  const verificationBadgeStyle = {
    pending:  'bg-amber-500/15 border-amber-500/30 text-amber-400',
    approved: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  }

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-white">{t('pageTitle')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('pageSubtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          {/* ── Personal information ── */}
          <SectionCard title={t('sections.personal')} subtitle={t('sections.personalSubtitle')}>
            <div className="space-y-4">

              <Field label={t('fields.email')} hint={t('emailNote')}>
                <TextInput value={user.email} disabled />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('fields.firstName')} error={errors.first_name}>
                  <TextInput value={values.first_name} onChange={handleChange('first_name')} error={errors.first_name} />
                </Field>
                <Field label={t('fields.lastName')} error={errors.last_name}>
                  <TextInput value={values.last_name} onChange={handleChange('last_name')} error={errors.last_name} />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('fields.dob')}>
                  <AppDatePicker
                    dobMode
                    value={values.dob}
                    onChange={(iso) => setValues((prev) => ({ ...prev, dob: iso }))}
                  />
                </Field>
                <Field label={t('fields.city')}>
                  <TextInput value={values.city} onChange={handleChange('city')} placeholder={t('placeholders.city')} />
                </Field>
              </div>

              <Field label={t('fields.phone')} error={errors.phone_number}>
                <TextInput
                  value={values.phone_number}
                  onChange={handleChange('phone_number')}
                  placeholder={t('placeholders.phone')}
                  error={errors.phone_number}
                />
              </Field>

            </div>
          </SectionCard>

          {/* ── Timezone ── */}
          <SectionCard title={t('sections.timezone')} subtitle={t('sections.timezoneSubtitle')}>
            <Field label={t('fields.timezone')}>
              <SelectInput
                value={values.timezone}
                onChange={handleChange('timezone')}
                options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              />
            </Field>
          </SectionCard>

          {/* ── Role-specific settings ── */}
          {(isPsych || isPatient) && (
            <SectionCard title={t('sections.roleInfo')} subtitle={t('sections.roleInfoSubtitle')}>
              <div className="space-y-4">

                {isPatient && (
                  <Field label={t('fields.concerns')}>
                    <textarea
                      value={values.concerns}
                      onChange={handleChange('concerns')}
                      placeholder={t('fields.concernsPlaceholder')}
                      rows={3}
                      className={`${INPUT_NORMAL} resize-none`}
                    />
                  </Field>
                )}

                {isPsych && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">{t('verification.label')}:</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border
                        ${verificationBadgeStyle[user.verification_status] ?? verificationBadgeStyle.pending}`}>
                        {t(`verification.${user.verification_status ?? 'pending'}`)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label={t('fields.sessionDuration')} error={errors.session_duration_minutes}>
                        <TextInput type="number" value={values.session_duration_minutes}
                          onChange={handleChange('session_duration_minutes')} error={errors.session_duration_minutes} />
                      </Field>
                      <Field label={t('fields.sessionPrice')} error={errors.session_price}>
                        <TextInput type="number" value={values.session_price}
                          onChange={handleChange('session_price')} error={errors.session_price} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label={t('fields.licenseNumber')}>
                        <TextInput value={values.license_number} onChange={handleChange('license_number')} />
                      </Field>
                      <Field label={t('fields.countryCode')}>
                        <SelectInput
                          value={values.country_code}
                          onChange={handleChange('country_code')}
                          options={[{ value: '', label: '—' }, ...COUNTRY_OPTIONS]}
                        />
                      </Field>
                    </div>

                    {(values.license_number !== (user.license_number ?? '') ||
                      values.country_code   !== (user.country_code   ?? '')) && (
                      <StatusBadge type="warning" message={t('verification.warning')} />
                    )}
                  </>
                )}

              </div>
            </SectionCard>
          )}

          {/* ── Change password ── */}
          <SectionCard title={t('sections.password')} subtitle={t('sections.passwordSubtitle')}>
            <div className="space-y-4">
              <Field label={t('fields.currentPassword')} error={errors.current_password}>
                <TextInput type="password" value={values.current_password}
                  onChange={handleChange('current_password')} placeholder={t('placeholders.currentPassword')}
                  error={errors.current_password} />
              </Field>
              <Field label={t('fields.newPassword')} error={errors.new_password}>
                <TextInput type="password" value={values.new_password}
                  onChange={handleChange('new_password')} placeholder={t('placeholders.newPassword')}
                  error={errors.new_password} />
              </Field>
            </div>
          </SectionCard>

          {/* ── Submit + feedback ── */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50
              px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {saving ? t('actions.saving') : t('actions.save')}
          </button>

          {feedback && <StatusBadge type={feedback.type} message={feedback.message} />}

        </form>
      </div>
    </main>
  )
}

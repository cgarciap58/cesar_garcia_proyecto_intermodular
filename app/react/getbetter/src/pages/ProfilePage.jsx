import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { updateProfile, uploadProfilePicture } from '../services/profile'
import { NAME_RE, PHONE_RE, filterName, filterPhone } from '../utils/validate'
import AppDatePicker from '../components/AppDatePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Country option keys for localisation
const COUNTRY_OPTION_KEYS = [
  { value: 'ES', key: 'countries.ES' },
  { value: 'US', key: 'countries.US' },
  { value: 'FR', key: 'countries.FR' },
]

// Backend error code → profile i18n key
const BACKEND_CODE_MAP = {
  required:                   'errors.required',
  name_invalid:               'errors.nameInvalid',
  phone_invalid:              'errors.phoneInvalid',
  dob_invalid:                'errors.dobInvalid',
  dob_too_young:              'errors.dobTooYoung',
  timezone_invalid:           'errors.timezoneInvalid',
  current_password_incorrect: 'errors.currentPasswordIncorrect',
  email_already_exists:       'errors.emailInUse',
  password_too_short:         'errors.newPasswordTooShort',
  session_duration_range:     'errors.sessionDurationRange',
  session_price_range:        'errors.sessionPriceRange',
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
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={error ? INPUT_ERROR : INPUT_NORMAL}
    />
  )
}

function SelectInput({ value, onChange, options, error }) {
  return (
    <select value={value} onChange={onChange} className={error ? INPUT_ERROR : INPUT_NORMAL}>
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

// ─── AvatarUpload ─────────────────────────────────────────────────────────────
//
// Self-contained widget: shows the current avatar (or initials fallback),
// a hidden <input type="file">, and a "Change photo" button.
// On file selection it immediately POSTs to /api/auth/profile/picture/,
// updates AuthContext on success, and shows inline feedback.

function AvatarUpload({ user, setUser, t }) {
  const fileInputRef   = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [avatarFeedback, setAvatarFeedback] = useState(null) // { type, message }

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    // Reset the input so re-selecting the same file triggers onChange again
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setAvatarFeedback(null)

    const result = await uploadProfilePicture(file)
    setUploading(false)

    if (result.ok) {
      // Update the user in AuthContext so the avatar refreshes everywhere
      // (DashboardSidebar, Navbar, etc.) without a page reload.
      setUser((prev) => ({ ...prev, profile_picture: result.data.profile_picture_url }))
      setAvatarFeedback({ type: 'success', message: t('avatar.success') })
    } else {
      const errorKey = `avatar.errors.${result.error}`
      const message  = t(errorKey, { defaultValue: t('avatar.errors.upload_failed') })
      setAvatarFeedback({ type: 'error', message })
    }

    // Auto-dismiss feedback after 3.5 s
    setTimeout(() => setAvatarFeedback(null), 3500)
  }

  return (
    <div>
      <p className="block text-sm font-medium text-slate-300 mb-3">{t('avatar.label')}</p>

      <div className="flex items-center gap-5">
        {/* Avatar preview */}
        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {user?.profile_picture ? (
            <img
              src={user.profile_picture}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-semibold text-slate-400">{initials}</span>
          )}
        </div>

        {/* Upload controls */}
        <div className="flex flex-col gap-2">
          {/* Hidden real file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Visible button that triggers the hidden input */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-600 hover:border-slate-400 bg-slate-800/60 hover:bg-slate-800
                       px-4 py-2 text-sm font-medium text-slate-300 hover:text-white
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? t('avatar.uploading') : t('avatar.changeButton')}
          </button>

          <p className="text-xs text-slate-500">{t('avatar.hint')}</p>
        </div>
      </div>

      {/* Inline feedback directly under the avatar row */}
      {avatarFeedback && (
        <div className="mt-3">
          <StatusBadge type={avatarFeedback.type} message={avatarFeedback.message} />
        </div>
      )}
    </div>
  )
}

// ─── Section nav items ────────────────────────────────────────────────────────

const SECTIONS = ['personal', 'password', 'roleInfo']

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
  const { t, i18n } = useTranslation(['profile', 'common'])

  const [activeSection, setActiveSection] = useState('personal')
  const [values, setValues] = useState({
    first_name:               user.first_name   ?? '',
    last_name:                user.last_name    ?? '',
    dob:                      user.dob          ?? '',
    city:                     user.city         ?? '',
    phone_number:             user.phone_number ?? '',
    timezone:                 user.timezone     ?? 'UTC',
    current_password:         '',
    new_password:             '',
    // psychologist-only
    session_duration_minutes: String(user.session_duration_minutes ?? 55),
    session_price:            String(user.session_price            ?? '1.0'),
    license_number:           user.license_number  ?? '',
    country_code:             user.country_code    ?? '',
  })
  const [errors,   setErrors]   = useState({})
  const [saving,   setSaving]   = useState(false)
  const [feedback, setFeedback] = useState(null)  // { type, message }

  const handleChange = (field) => (e) => {
    const raw = e.target.value
    let val = raw
    if (field === 'first_name' || field === 'last_name') val = filterName(raw)
    if (field === 'phone_number') val = filterPhone(raw)
    setValues((prev) => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n })
  }

  const str = (v) => String(v ?? '')

  async function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate(values, t)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setFeedback({ type: 'error', message: t('errors.someFieldsInvalid') })
      return
    }

    setSaving(true)
    setFeedback(null)

    // Build a delta — only send changed fields
    const payload = {}

    const userFields = ['first_name', 'last_name', 'city', 'phone_number', 'timezone', 'dob']
    for (const f of userFields) {
      if (str(values[f]) !== str(user[f] ?? '')) payload[f] = values[f]
    }

    if (values.new_password) {
      payload.current_password = values.current_password
      payload.new_password     = values.new_password
    }

    if (user.role === 'psychologist') {
      if (str(values.session_duration_minutes) !== str(user.session_duration_minutes ?? ''))
        payload.session_duration_minutes = parseInt(values.session_duration_minutes, 10)
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
      const mapped = mapBackendErrors(result.fieldErrors, t)
      setErrors(mapped)
      setFeedback({ type: 'error', message: t('errors.someFieldsInvalid') })
    } else {
      setFeedback({ type: 'error', message: t('errors.generic') })
    }
  }

  const isPsych = user.role === 'psychologist'

  const verificationBadgeStyle = {
    pending:  'bg-amber-500/15 border-amber-500/30 text-amber-400',
    approved: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  }

  // Sections available for this user's role
  const visibleSections = SECTIONS.filter((s) => s !== 'roleInfo' || isPsych)

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-4 pt-4 mb-8">
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
            <h1 className="text-2xl font-semibold text-white">{t('pageTitle')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('pageSubtitle')}</p>
          </div>
        </div>

        <div className="flex gap-6">

          {/* ── Section sidebar nav ── */}
          <nav className="flex-shrink-0 w-44">
            <ul className="space-y-1">
              {visibleSections.map((section) => (
                <li key={section}>
                  <button
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {t(`sections.${section}`)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Active section form ── */}
          <div className="flex-1 min-w-0">
            <form onSubmit={handleSubmit} noValidate>
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">

                {/* ── Personal information ── */}
                {activeSection === 'personal' && (
                  <>
                    <div>
                      <h2 className="text-base font-semibold text-white">{t('sections.personal')}</h2>
                      <p className="text-xs text-slate-500 mt-1">{t('sections.personalSubtitle')}</p>
                    </div>

                    {/* ── Avatar upload ── */}
                    <AvatarUpload user={user} setUser={setUser} t={t} />

                    <hr className="border-slate-800" />

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
                      <Field label={t('fields.dob')} error={errors.dob}>
                        <AppDatePicker
                          value={values.dob}
                          onChange={(val) => {
                            setValues((prev) => ({ ...prev, dob: val }))
                            if (errors.dob) setErrors((prev) => { const n = { ...prev }; delete n.dob; return n })
                          }}
                          error={errors.dob}
                        />
                      </Field>
                      <Field label={t('fields.city')} error={errors.city}>
                        <TextInput
                          value={values.city}
                          onChange={handleChange('city')}
                          placeholder={t('placeholders.city')}
                          error={errors.city}
                        />
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

                    <Field label={t('fields.timezone')} error={errors.timezone}>
                      <SelectInput
                        value={values.timezone}
                        onChange={handleChange('timezone')}
                        options={TIMEZONES.map((tz) => ({ value: tz, label: t(`timezones.${tz}`, { ns: 'common' }) }))}
                        error={errors.timezone}
                      />
                    </Field>
                  </>
                )}

                {/* ── Password ── */}
                {activeSection === 'password' && (
                  <>
                    <div>
                      <h2 className="text-base font-semibold text-white">{t('sections.password')}</h2>
                      <p className="text-xs text-slate-500 mt-1">{t('sections.passwordSubtitle')}</p>
                    </div>

                    <Field label={t('fields.currentPassword')} error={errors.current_password}>
                      <TextInput type="password" value={values.current_password}
                        onChange={handleChange('current_password')}
                        placeholder={t('placeholders.currentPassword')}
                        error={errors.current_password} />
                    </Field>
                    <Field label={t('fields.newPassword')} error={errors.new_password}>
                      <TextInput type="password" value={values.new_password}
                        onChange={handleChange('new_password')}
                        placeholder={t('placeholders.newPassword')}
                        error={errors.new_password} />
                    </Field>
                  </>
                )}

                {/* ── Role settings (psychologist only) ── */}
                {activeSection === 'roleInfo' && isPsych && (
                  <>
                    <div>
                      <h2 className="text-base font-semibold text-white">{t('sections.roleInfo')}</h2>
                      <p className="text-xs text-slate-500 mt-1">{t('sections.roleInfoSubtitle')}</p>
                    </div>

                    {/* Verification badge */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">{t('verification.label')}:</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border
                        ${verificationBadgeStyle[user.verification_status] ?? verificationBadgeStyle.pending}`}>
                        {t(`verification.${user.verification_status ?? 'pending'}`)}
                      </span>
                    </div>

                    <Field label={t('fields.licenseNumber')} error={errors.license_number}>
                      <TextInput value={values.license_number} onChange={handleChange('license_number')} error={errors.license_number} />
                    </Field>

                    <Field label={t('fields.countryCode')} error={errors.country_code}>
                      <SelectInput
                        value={values.country_code}
                        onChange={handleChange('country_code')}
                        options={COUNTRY_OPTION_KEYS.map(({ value, key }) => ({ value, label: t(key, { ns: 'common' }) }))}
                        error={errors.country_code}
                      />
                    </Field>

                    {(user.verification_status === 'pending' || user.verification_status === 'rejected') && (
                      <StatusBadge type="warning" message={t('verification.warning')} />
                    )}

                    <Field label={t('fields.sessionDuration')} error={errors.session_duration_minutes}>
                      <TextInput
                        type="number"
                        value={values.session_duration_minutes}
                        onChange={handleChange('session_duration_minutes')}
                        error={errors.session_duration_minutes}
                      />
                    </Field>

                    <Field label={t('fields.sessionPrice')} error={errors.session_price}>
                      <SelectInput
                        value={values.session_price}
                        onChange={handleChange('session_price')}
                        options={[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((v) => ({
                          value: String(v),
                          label: String(v),
                        }))}
                        error={errors.session_price}
                      />
                    </Field>
                  </>
                )}

                {/* ── Feedback + submit (shown for all sections) ── */}
                {feedback && <StatusBadge type={feedback.type} message={feedback.message} />}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50
                               px-5 py-2.5 text-sm font-semibold text-white transition-colors
                               disabled:cursor-not-allowed"
                  >
                    {saving ? t('actions.saving') : t('actions.save')}
                  </button>
                </div>

              </div>
            </form>
          </div>

        </div>
      </div>
    </main>
  )
}

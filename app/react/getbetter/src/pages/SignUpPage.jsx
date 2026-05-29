import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signUp } from '../services'
import { filterName, getPasswordStrength, validateSignUpValues } from '../utils/validate'
import { useAuth } from '../context/AuthContext'
import FormField from '../components/FormField'
import AppDatePicker from '../components/AppDatePicker'

const ROLE_OPTIONS = (t) => [
  { value: 'patient',      label: t('signUp.rolePatient') },
  { value: 'psychologist', label: t('signUp.rolePsychologist') },
]

// Country options use i18n keys so labels are localised
const COUNTRY_OPTION_KEYS = [
  { value: 'ES', key: 'countries.ES' },
  { value: 'US', key: 'countries.US' },
  { value: 'FR', key: 'countries.FR' },
  { value: 'DE', key: 'countries.DE' },
  { value: 'GB', key: 'countries.GB' },
  { value: 'PT', key: 'countries.PT' },
]

const initialValues = {
  first_name: '', last_name: '', email: '', role: '', dob: '',
  password: '', confirmPassword: '', license_number: '', country_code: '',
}

const SELECT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm ' +
  'text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30'

const strengthWidthByScore = { 0: 'w-1/4', 1: 'w-1/4', 2: 'w-2/4', 3: 'w-3/4', 4: 'w-full' }

export default function SignUpPage() {
  const { setUser } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const passwordStrength = getPasswordStrength(values.password)

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValue = (name === 'first_name' || name === 'last_name')
      ? filterName(value)
      : value
    setValues((prev) => ({ ...prev, [name]: nextValue }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationErrors = validateSignUpValues(values, t)
    if (Object.keys(validationErrors).length) {
      setErrors({ ...validationErrors, form: t('validation.someFieldsInvalid') })
      return
    }

    setIsSubmitting(true)
    setErrors({})

    const result = await signUp(values, t)
    if (!result.ok) {
      const backendErrors = result.errors ?? {}
      setErrors({
        ...backendErrors,
        form: backendErrors.form ?? t('validation.someFieldsInvalid'),
      })
      setIsSubmitting(false)
      return
    }

    const me = await fetch('/api/auth/me/', { credentials: 'include' }).then((r) => r.json())
    setUser(me)
    navigate('/dashboard')
  }

  return (
    <main className="min-h-screen bg-slate-950 pt-28 pb-12 px-4">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold text-white">{t('signUp.title')}</h1>
        <p className="mt-2 text-sm text-slate-300">{t('signUp.subtitle')}</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField
            id="first_name" name="first_name"
            label={t('signUp.firstNameLabel')} placeholder={t('signUp.firstNamePlaceholder')}
            value={values.first_name} onChange={handleChange}
            error={errors.first_name} autoComplete="given-name"
          />
          <FormField
            id="last_name" name="last_name"
            label={t('signUp.lastNameLabel')} placeholder={t('signUp.lastNamePlaceholder')}
            value={values.last_name} onChange={handleChange}
            error={errors.last_name} autoComplete="family-name"
          />
          <FormField
            id="email" name="email" type="email"
            label={t('signUp.emailLabel')} placeholder={t('signUp.emailPlaceholder')}
            value={values.email} onChange={handleChange}
            error={errors.email} autoComplete="email"
          />

          {/* Date of birth */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              {t('signUp.dobLabel')}
            </label>
            <AppDatePicker
              value={values.dob}
              onChange={(iso) => {
                setValues((prev) => ({ ...prev, dob: iso }))
                setErrors((prev) => ({ ...prev, dob: '', form: '' }))
              }}
            />
            {errors.dob ? <p className="mt-1.5 text-sm text-rose-400">{errors.dob}</p> : null}
          </div>

          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium text-slate-200">
              {t('signUp.roleLabel')}
            </label>
            <select id="role" name="role" value={values.role} onChange={handleChange} className={SELECT_CLASS}>
              <option value="">{t('signUp.rolePlaceholder')}</option>
              {ROLE_OPTIONS(t).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.role ? <p className="mt-1.5 text-sm text-rose-400">{errors.role}</p> : null}
          </div>

          {values.role === 'psychologist' ? (
            <>
              <div>
                <label htmlFor="country_code" className="mb-2 block text-sm font-medium text-slate-200">
                  {t('signUp.licenseCountryLabel')}
                </label>
                <select id="country_code" name="country_code" value={values.country_code} onChange={handleChange} className={SELECT_CLASS}>
                  <option value="">{t('signUp.licenseCountryPlaceholder')}</option>
                  {COUNTRY_OPTION_KEYS.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.key)}</option>
                  ))}
                </select>
                {errors.country_code ? <p className="mt-1.5 text-sm text-rose-400">{errors.country_code}</p> : null}
              </div>
              <FormField
                id="license_number" name="license_number"
                label={t('signUp.licenseNumberLabel')} placeholder={t('signUp.licenseNumberPlaceholder')}
                value={values.license_number} onChange={handleChange}
                error={errors.license_number}
              />
            </>
          ) : null}

          <FormField
            id="password" name="password" type="password"
            label={t('signUp.passwordLabel')} placeholder={t('signUp.passwordPlaceholder')}
            value={values.password} onChange={handleChange}
            error={errors.password} autoComplete="new-password"
          >
            {values.password ? (
              <div className="mt-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div className={`h-full rounded-full transition-all duration-300 ${strengthWidthByScore[passwordStrength.score]} ${passwordStrength.color}`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-300">
                  {t('signUp.passwordStrength')} <span className="font-medium text-slate-200">{passwordStrength.label}</span>
                </p>
              </div>
            ) : null}
          </FormField>

          <FormField
            id="confirmPassword" name="confirmPassword" type="password"
            label={t('signUp.confirmPasswordLabel')} placeholder={t('signUp.confirmPasswordPlaceholder')}
            value={values.confirmPassword} onChange={handleChange}
            error={errors.confirmPassword} autoComplete="new-password"
          />

          <button
            type="submit" disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:bg-blue-400/60"
          >
            {isSubmitting ? t('signUp.submittingButton') : t('signUp.submitButton')}
          </button>

          {errors.form ? <p className="text-sm text-rose-400">{errors.form}</p> : null}
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          {t('signUp.hasAccount')}{' '}
          <Link to="/signin" className="font-medium text-blue-400 hover:text-blue-300">{t('signUp.signInLink')}</Link>
        </p>
      </div>
    </main>
  )
}

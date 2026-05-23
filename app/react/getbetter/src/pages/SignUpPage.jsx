import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { signUp } from '../services'
import { getPasswordStrength, validateSignUpValues } from '../utils/validate'
import { useAuth } from '../context/AuthContext'
import FormField from '../components/FormField'

const ROLE_OPTIONS = [
  { value: 'patient', label: 'Patient' },
  { value: 'psychologist', label: 'Psychologist' },
]

const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
]

const initialValues = {
  first_name: '',
  last_name: '',
  email: '',
  role: '',
  password: '',
  confirmPassword: '',
  license_number: '',
  country_code: '',
}

const SELECT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm ' +
  'text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30'

const strengthWidthByScore = { 0: 'w-1/4', 1: 'w-1/4', 2: 'w-2/4', 3: 'w-3/4', 4: 'w-full' }

function SignUpPage() {
  const { setUser } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const passwordStrength = getPasswordStrength(values.password)

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValue = (name === 'first_name' || name === 'last_name')
      ? value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ-]/g, '')
      : value
    setValues((prev) => ({ ...prev, [name]: nextValue }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validateSignUpValues(values)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }
    setIsSubmitting(true)
    setErrors({})
    const result = await signUp(values)
    if (!result.ok) {
      setErrors({ ...result.errors })
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
        <h1 className="text-3xl font-semibold text-white">Sign up</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create your account with details that match your profile information.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField
            id="first_name" name="first_name" label="First name"
            value={values.first_name} onChange={handleChange}
            error={errors.first_name} autoComplete="given-name"
            placeholder="Enter your first name"
          />
          <FormField
            id="last_name" name="last_name" label="Last name"
            value={values.last_name} onChange={handleChange}
            error={errors.last_name} autoComplete="family-name"
            placeholder="Enter your last name"
          />
          <FormField
            id="email" name="email" label="Email" type="email"
            value={values.email} onChange={handleChange}
            error={errors.email} autoComplete="email"
            placeholder="name@example.com"
          />

          {/* Role — select, not an input, so FormField doesn't apply */}
          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium text-slate-200">Role</label>
            <select id="role" name="role" value={values.role} onChange={handleChange} className={SELECT_CLASS}>
              <option value="" className="text-slate-500">Select your role</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.role ? <p className="mt-1.5 text-sm text-rose-400">{errors.role}</p> : null}
          </div>

          {/* Psychologist-only fields */}
          {values.role === 'psychologist' ? (
            <>
              <div>
                <label htmlFor="country_code" className="mb-2 block text-sm font-medium text-slate-200">
                  License country
                </label>
                <select id="country_code" name="country_code" value={values.country_code} onChange={handleChange} className={SELECT_CLASS}>
                  <option value="" className="text-slate-500">Select country (optional)</option>
                  {COUNTRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errors.country_code ? <p className="mt-1.5 text-sm text-rose-400">{errors.country_code}</p> : null}
              </div>
              <FormField
                id="license_number" name="license_number" label="License number"
                value={values.license_number} onChange={handleChange}
                error={errors.license_number}
                placeholder="Enter your license number (optional)"
              />
            </>
          ) : null}

          {/* Password — uses children slot for the strength bar */}
          <FormField
            id="password" name="password" label="Password" type="password"
            value={values.password} onChange={handleChange}
            error={errors.password} autoComplete="new-password"
            placeholder="Create a password"
          >
            {values.password ? (
              <div className="mt-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div className={`h-full rounded-full transition-all duration-300 ${strengthWidthByScore[passwordStrength.score]} ${passwordStrength.color}`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-300">
                  Strength: <span className="font-medium text-slate-200">{passwordStrength.label}</span>
                </p>
              </div>
            ) : null}
          </FormField>

          <FormField
            id="confirmPassword" name="confirmPassword" label="Confirm password" type="password"
            value={values.confirmPassword} onChange={handleChange}
            error={errors.confirmPassword} autoComplete="new-password"
            placeholder="Re-enter your password"
          />

          {errors.form ? <p className="text-sm text-rose-400">{errors.form}</p> : null}

          <button
            type="submit" disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:bg-blue-400/60"
          >
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default SignUpPage

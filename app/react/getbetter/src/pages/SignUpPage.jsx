import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { signUp } from '../services/api'
import { getPasswordStrength, validateSignUpValues } from '../utils/validate'

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

function SignUpPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const passwordStrength = getPasswordStrength(values.password)
  const strengthWidthClassByScore = {
    0: 'w-1/4',
    1: 'w-1/4',
    2: 'w-2/4',
    3: 'w-3/4',
    4: 'w-full',
  }
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
      const nextErrors = { ...result.errors }
      setErrors(nextErrors)
      setIsSubmitting(false)
      return
    }

    navigate('/dasboard', {
      state: { successMessage: 'Account created successfully. Please sign in.' },
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 pt-28 pb-12 px-4">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold text-white">Sign up</h1>
        <p className="mt-2 text-sm text-slate-300">Create your account with details that match your profile information.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-slate-200">First name</label>
            <input id="first_name" name="first_name" type="text" autoComplete="given-name" value={values.first_name} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="Enter your first name" />
            {errors.first_name ? <p className="mt-1.5 text-sm text-rose-400">{errors.first_name}</p> : null}
          </div>

          <div>
            <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-slate-200">Last name</label>
            <input id="last_name" name="last_name" type="text" autoComplete="family-name" value={values.last_name} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="Enter your last name" />
            {errors.last_name ? <p className="mt-1.5 text-sm text-rose-400">{errors.last_name}</p> : null}
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" value={values.email} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="name@example.com" />
            {errors.email ? <p className="mt-1.5 text-sm text-rose-400">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium text-slate-200">Role</label>
            <select id="role" name="role" value={values.role} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30">
              <option value="" className="text-slate-500">Select your role</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.role ? <p className="mt-1.5 text-sm text-rose-400">{errors.role}</p> : null}
          </div>

          {values.role === 'psychologist' ? (
            <>
              <div>
                <label htmlFor="country_code" className="mb-2 block text-sm font-medium text-slate-200">License country</label>
                <select id="country_code" name="country_code" value={values.country_code} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30">
                  <option value="" className="text-slate-500">Select country (optional)</option>
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {errors.country_code ? <p className="mt-1.5 text-sm text-rose-400">{errors.country_code}</p> : null}
              </div>

              <div>
                <label htmlFor="license_number" className="mb-2 block text-sm font-medium text-slate-200">License number</label>
                <input id="license_number" name="license_number" type="text" value={values.license_number} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="Enter your license number (optional)" />
                {errors.license_number ? <p className="mt-1.5 text-sm text-rose-400">{errors.license_number}</p> : null}
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="Create a password" />
            {values.password ? (
              <div className="mt-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div className={`h-full rounded-full transition-all duration-300 ${strengthWidthClassByScore[passwordStrength.score]} ${passwordStrength.color}`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-300">
                  Strength: <span className="font-medium text-slate-200">{passwordStrength.label}</span>
                </p>
              </div>
            ) : null}            
            {errors.password ? <p className="mt-1.5 text-sm text-rose-400">{errors.password}</p> : null}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={handleChange} className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30" placeholder="Re-enter your password" />
            {errors.confirmPassword ? <p className="mt-1.5 text-sm text-rose-400">{errors.confirmPassword}</p> : null}
          </div>

          {errors.form ? <p className="text-sm text-rose-400">{errors.form}</p> : null}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:bg-blue-400/60">{isSubmitting ? 'Creating account...' : 'Sign up'}</button>
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
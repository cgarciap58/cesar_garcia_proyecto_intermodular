import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../services'
import { useAuth } from '../context/AuthContext'
import FormField from '../components/FormField'

const initialValues = { email: '', password: '' }

function SignIn() {
  const { setUser } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!values.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    if (!values.password.trim()) {
      nextErrors.password = 'Password is required.'
    } else if (values.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }
    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }
    setIsSubmitting(true)
    setErrors({})
    const result = await signIn({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    })
    if (!result.ok) {
      setErrors(result.errors)
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
        <h1 className="text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-slate-300">Welcome back. Enter your credentials to continue.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField
            id="email" name="email" label="Email" type="email"
            value={values.email} onChange={handleChange}
            error={errors.email} autoComplete="email"
            placeholder="name@example.com"
          />
          <FormField
            id="password" name="password" label="Password" type="password"
            value={values.password} onChange={handleChange}
            error={errors.password} autoComplete="current-password"
            placeholder="Enter your password"
          />

          {errors.form ? <p className="text-sm text-rose-400">{errors.form}</p> : null}

          <button
            type="submit" disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:bg-blue-400/60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-blue-400 hover:text-blue-300">Sign up</Link>
        </p>
      </div>
    </main>
  )
}

export default SignIn

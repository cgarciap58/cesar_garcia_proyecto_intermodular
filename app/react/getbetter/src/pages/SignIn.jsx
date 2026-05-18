import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../services/api'
import { useAuth } from '../context/AuthContext'

const initialValues = {
  email: '',
  password: '',
}


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
    const me = await fetch('/api/auth/me/', { credentials: 'include' }).then(r => r.json())
    setUser(me)
    navigate('/dashboard')

  }

  return (
    <main className="min-h-screen bg-slate-950 pt-28 pb-12 px-4">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-slate-300">Welcome back. Enter your credentials to continue.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
            <input
              id="email" name="email" type="email" autoComplete="email"
              value={values.email} onChange={handleChange}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              placeholder="name@example.com"
            />
            {errors.email ? <p className="mt-1.5 text-sm text-rose-400">{errors.email}</p> : null}
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <input
              id="password" name="password" type="password" autoComplete="current-password"
              value={values.password} onChange={handleChange}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              placeholder="Enter your password"
            />
            {errors.password ? <p className="mt-1.5 text-sm text-rose-400">{errors.password}</p> : null}
          </div>

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
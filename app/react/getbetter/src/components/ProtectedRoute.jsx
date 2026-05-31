import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wraps any route that requires authentication.
//
// Three states of user in AuthContext:
//   undefined  → still fetching /api/auth/me/ — show nothing (avoids flash-redirect)
//   null       → fetch done, not logged in    → redirect to /signin
//   object     → logged in                    → render children
//
// Optionally accepts a `role` prop. If provided, a logged-in user whose role
// doesn't match is sent to /dashboard instead (e.g. a patient hitting /slots).
//
// For psychologist-only routes, also enforces that the psychologist is validated
// (verification_status === 'approved'). A non-validated psychologist hitting
// /slots is redirected back to /dashboard.

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth()

  if (user === undefined) return null

  if (user === null) return <Navigate to="/signin" replace />

  if (role && user.role !== role) return <Navigate to="/dashboard" replace />

  // Psychologist-only routes additionally require the account to be validated.
  if (role === 'psychologist' && user.verification_status !== 'approved') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

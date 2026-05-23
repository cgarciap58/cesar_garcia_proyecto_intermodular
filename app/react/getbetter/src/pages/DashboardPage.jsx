import { useAuth } from '../context/AuthContext'
import PatientDashboard from './PatientDashboard'
import PsychologistDashboard from './PsychologistDashboard'

// Auth and loading are already handled by ProtectedRoute in App.jsx.
// By the time this renders, user is guaranteed to be a logged-in object.

export default function DashboardPage() {
  const { user } = useAuth()

  if (user.role === 'patient') return <PatientDashboard />
  if (user.role === 'psychologist') return <PsychologistDashboard />

  return null
}

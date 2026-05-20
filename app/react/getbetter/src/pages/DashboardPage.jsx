import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PatientDashboard from './PatientDashboard'
import PsychologistDashboard from './PsychologistDashboard'

export default function DashboardPage() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  if (user.role === 'patient') return <PatientDashboard />
  if (user.role === 'psychologist') return <PsychologistDashboard />

  return null
}
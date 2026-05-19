import { useAuth } from '../context/AuthContext'
import PatientDashboard from './PatientDashboard'
import PsychologistDashboard from './PsychologistDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (user?.role === 'patient') return <PatientDashboard />
  if (user?.role === 'psychologist') return <PsychologistDashboard />

  return null
}
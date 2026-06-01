import { Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import BugReportButton from './components/BugReportButton'
import HomePage from './pages/HomePage'
import SignIn from './pages/SignIn'
import SignUpPage from './pages/SignUpPage'
import DashboardPage from './pages/DashboardPage'
import SlotsPage from './pages/SlotsPage'
import BookPage from './pages/BookPage'
import ProfilePage from './pages/ProfilePage'
import BugDispatcherPage from './pages/BugDispatcherPage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <Navbar />
      <Outlet />
      {/* Bug report button is always visible, on every page */}
      <BugReportButton />
    </div>
  )
}

function App() {
  const { user } = useAuth()

  // Still fetching — render nothing; the HTML splash in index.html is still visible
  if (user === undefined) return null

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/slots"
          element={
            <ProtectedRoute role="psychologist">
              <SlotsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/book"
          element={
            <ProtectedRoute role="patient">
              <BookPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/*
          /bugs — accessible to admins (is_staff) and developers.
          No ProtectedRoute role guard here; BugDispatcherPage handles its own
          auth check internally so both roles can reach the same URL.
        */}
        <Route path="/bugs" element={<BugDispatcherPage />} />
      </Route>
    </Routes>
  )
}

export default App

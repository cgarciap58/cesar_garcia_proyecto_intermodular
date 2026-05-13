import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import SignIn from './pages/SignIn'
import SignUpPage from './pages/SignUpPage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <Navbar />
      <Outlet />
    </div>
  )
}

function isAuthenticated() {
  return Boolean(localStorage.getItem('authToken'))
}

function RequireAuth() {
  if (!isAuthenticated()) {
    return <Navigate to="/signin" replace />
  }

  return <Outlet />
}

function RequireGuest() {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        <Route element={<RequireGuest />}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated() ? '/' : '/signin'} replace />} />
      </Route>
    </Routes>
  )
}

export default App
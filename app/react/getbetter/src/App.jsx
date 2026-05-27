import { Outlet, Route, Routes } from 'react-router-dom'
import './spinner.css'
import { useEffect, useState } from 'react'

import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import SignIn from './pages/SignIn'
import SignUpPage from './pages/SignUpPage'
import DashboardPage from './pages/DashboardPage'
import SlotsPage from './pages/SlotsPage'
import BookPage from './pages/BookPage'
import ProfilePage from './pages/ProfilePage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <Navbar />
      <Outlet />
    </div>
  )
}

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-spinner">
        <img src="/logo.gif" alt="Loading GetBetter..." />
      </div>
    </div>
  )
}

function App() {
  const { user } = useAuth()

  // user === undefined means AuthContext is still fetching /api/auth/me/
  // Show the splash screen during that window
  if (user === undefined) return <SplashScreen />

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
      </Route>
    </Routes>
  )
}

export default App

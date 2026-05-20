import { Outlet, Route, Routes } from 'react-router-dom'

import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import SignIn from './pages/SignIn'
import SignUpPage from './pages/SignUpPage'
import DashboardPage from './pages/DashboardPage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <Navbar />
      <Outlet />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/slots" element={<SlotsPage />} />
      </Route>
    </Routes>
  )
}

export default App
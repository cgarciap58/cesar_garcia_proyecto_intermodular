import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import hero from '../assets/hero2.png'

export default function Navbar() {
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const close = () => setMobileMenuIsOpen(false)

  const handleLogout = async () => {
    await logout()
    close()
    navigate('/')
  }

  if (user === undefined) return null

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 md:h-20">

          <div className="flex items-center space-x-1 cursor-pointer" onClick={() => navigate(user ? '/dashboard' : '/')}>
            <img src={hero} alt="GetBetter" className="w-4 h-4 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl md:text-2xl font-medium">
              <span className="text-white">Get</span>
              <span className="text-blue-400">Better</span>
            </span>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {user ? (
              <>
                <NavLink to="/dashboard" className="text-gray-300 hover:text-white text-sm lg:text-base">Dashboard</NavLink>
                <NavLink to="/profile" className="text-gray-300 hover:text-white text-sm lg:text-base">Profile</NavLink>
                <button onClick={handleLogout} className="text-gray-300 hover:text-white text-sm lg:text-base">Log out</button>
              </>
            ) : (
              <>
                <a href="#features" className="text-gray-300 hover:text-white text-sm lg:text-base">Features</a>
                <a href="#testimonials" className="text-gray-300 hover:text-white text-sm lg:text-base">Testimonials</a>
                <NavLink to="/signin" className="text-gray-300 hover:text-white text-sm lg:text-base">Sign in</NavLink>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 text-gray-300 hover:text-white" onClick={() => setMobileMenuIsOpen((prev) => !prev)}>
            {mobileMenuIsOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuIsOpen && (
        <div className="px-4 py-4 space-y-3 md:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-800">
          {user ? (
            <>
              <NavLink to="/dashboard" className="block text-center text-gray-300 hover:text-white" onClick={close}>Dashboard</NavLink>
              <NavLink to="/profile" className="block text-center text-gray-300 hover:text-white" onClick={close}>Profile</NavLink>
              <button onClick={handleLogout} className="block w-full text-center text-gray-300 hover:text-white">Log out</button>
            </>
          ) : (
            <>
              <a href="#features" className="block text-center text-gray-300 hover:text-white" onClick={close}>Features</a>
              <a href="#testimonials" className="block text-center text-gray-300 hover:text-white" onClick={close}>Testimonials</a>
              <NavLink to="/signin" className="block text-center text-gray-300 hover:text-white" onClick={close}>Sign in</NavLink>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
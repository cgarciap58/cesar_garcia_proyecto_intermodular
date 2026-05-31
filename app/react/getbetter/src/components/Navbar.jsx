import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import hero from '../assets/logo.png'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const handleChange = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            i18n.language === code
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const NAV_LINK_CLASS    = 'text-gray-300 hover:text-white text-sm lg:text-base transition-colors'
const MOBILE_LINK_CLASS = 'block text-center text-gray-300 hover:text-white transition-colors'

export default function Navbar() {
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()
  const { t }            = useTranslation('common')

  const close = () => setMobileMenuIsOpen(false)

  const handleLogout = async () => {
    await logout()
    close()
    navigate('/')
  }

  // Logo / "Home" — smooth-scroll to top when already on "/", navigate otherwise.
  const handleHome = (e) => {
    e?.preventDefault?.()
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate('/')
    }
    close()
  }

  // Testimonials — smooth-scroll when on "/", navigate with hash otherwise.
  const handleTestimonials = (e) => {
    if (location.pathname === '/') {
      // Already on home: prevent default anchor jump and use smooth scroll instead
      e.preventDefault()
      document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      e.preventDefault()
      navigate('/#testimonials')
    }
    close()
  }

  if (user === undefined) return null

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 md:h-20">

          {/* Logo */}
          <div
            className="flex items-center space-x-1 cursor-pointer"
            onClick={handleHome}
          >
            <img src={hero} alt={t('appName')} className="w-4 h-4 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl md:text-2xl font-medium">
              <span className="text-white">Get</span>
              <span className="text-blue-400">Better</span>
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {user ? (
              <>
                <a href="/" onClick={handleHome} className={NAV_LINK_CLASS}>{t('nav.home')}</a>
                <NavLink to="/dashboard" className={NAV_LINK_CLASS}>{t('nav.dashboard')}</NavLink>
                <NavLink to="/profile"   className={NAV_LINK_CLASS}>{t('nav.profile')}</NavLink>
                <button onClick={handleLogout} className={NAV_LINK_CLASS}>{t('nav.logOut')}</button>
              </>
            ) : (
              <>
                <a href="/" onClick={handleHome} className={NAV_LINK_CLASS}>{t('nav.home')}</a>
                <a
                  href="#testimonials"
                  onClick={handleTestimonials}
                  className={NAV_LINK_CLASS}
                >
                  {t('nav.testimonials')}
                </a>
                <NavLink to="/signin" className={NAV_LINK_CLASS}>{t('nav.signIn')}</NavLink>
              </>
            )}
            <LanguageSwitcher />
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setMobileMenuIsOpen((prev) => !prev)}
          >
            {mobileMenuIsOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuIsOpen && (
        <div className="px-4 py-4 space-y-3 md:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-800">
          {user ? (
            <>
              <a href="/" onClick={handleHome} className={MOBILE_LINK_CLASS}>{t('nav.home')}</a>
              <NavLink to="/dashboard" className={MOBILE_LINK_CLASS} onClick={close}>{t('nav.dashboard')}</NavLink>
              <NavLink to="/profile"   className={MOBILE_LINK_CLASS} onClick={close}>{t('nav.profile')}</NavLink>
              <button
                onClick={handleLogout}
                className="block w-full text-center text-gray-300 hover:text-white transition-colors"
              >
                {t('nav.logOut')}
              </button>
            </>
          ) : (
            <>
              <a href="/" onClick={handleHome} className={MOBILE_LINK_CLASS}>{t('nav.home')}</a>
              <a
                href="#testimonials"
                onClick={handleTestimonials}
                className={MOBILE_LINK_CLASS}
              >
                {t('nav.testimonials')}
              </a>
              <NavLink to="/signin" className={MOBILE_LINK_CLASS} onClick={close}>{t('nav.signIn')}</NavLink>
            </>
          )}
          <div className="flex justify-center pt-1">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </nav>
  )
}

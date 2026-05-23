import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// ── English ───────────────────────────────────────────────────────────────────
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enDashboard from './locales/en/dashboard.json'
import enAppointments from './locales/en/appointments.json'

// ── Spanish ───────────────────────────────────────────────────────────────────
import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esDashboard from './locales/es/dashboard.json'
import esAppointments from './locales/es/appointments.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        appointments: enAppointments,
      },
      es: {
        common: esCommon,
        auth: esAuth,
        dashboard: esDashboard,
        appointments: esAppointments,
      },
    },

    lng: localStorage.getItem('lang') ?? 'en',  // persist choice across sessions
    fallbackLng: 'en',                           // if a key is missing in 'es', fall back to 'en'

    // Tell i18next which namespace to look in when you call t() without a prefix.
    // e.g. t('save') looks in 'common'. t('auth:signIn') looks in 'auth'.
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React already escapes values, no need to double-escape
    },
  })

export default i18n

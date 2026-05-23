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

    lng: localStorage.getItem('lang') ?? 'es',
    fallbackLng: 'en',
    defaultNS: 'common',

    interpolation: {
      escapeValue: false,
    },
  })

// Keep <html lang="..."> in sync with the active language.
// The browser uses this attribute to format <input type="date"> correctly
// (YYYY-MM-DD for 'es', MM/DD/YYYY for 'en-US', etc.).
const syncHtmlLang = (lng) => { document.documentElement.lang = lng }

// Set on startup
syncHtmlLang(i18n.language)

// Update whenever the user switches language
i18n.on('languageChanged', syncHtmlLang)

export default i18n

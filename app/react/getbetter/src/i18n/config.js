import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// ── English ───────────────────────────────────────────────────────────────────
import enCommon       from './locales/en/common.json'
import enAuth         from './locales/en/auth.json'
import enDashboard    from './locales/en/dashboard.json'
import enAppointments from './locales/en/appointments.json'
import enBook         from './locales/en/book.json'
import enProfile      from './locales/en/profile.json'

// ── Spanish ───────────────────────────────────────────────────────────────────
import esCommon       from './locales/es/common.json'
import esAuth         from './locales/es/auth.json'
import esDashboard    from './locales/es/dashboard.json'
import esAppointments from './locales/es/appointments.json'
import esBook         from './locales/es/book.json'
import esProfile      from './locales/es/profile.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common:       enCommon,
        auth:         enAuth,
        dashboard:    enDashboard,
        appointments: enAppointments,
        book:         enBook,
      },
      es: {
        common:       esCommon,
        auth:         esAuth,
        dashboard:    esDashboard,
        appointments: esAppointments,
        book:         esBook,
      },
    },

    lng:         localStorage.getItem('lang') ?? 'es',
    fallbackLng: 'en',
    defaultNS:   'common',

    interpolation: {
      escapeValue: false,
    },
  })

// Keep <html lang="..."> in sync with the active language.
const syncHtmlLang = (lng) => { document.documentElement.lang = lng }
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n

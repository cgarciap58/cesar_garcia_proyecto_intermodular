import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation('common')

  return (
    <footer className="border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-3 text-sm text-gray-400">
        <p>{t('landing.footer.rights')}</p>
        <p>{t('landing.footer.tagline')}</p>
      </div>
    </footer>
  )
}

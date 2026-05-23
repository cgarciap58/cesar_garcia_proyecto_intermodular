import { useTranslation } from 'react-i18next'

export default function Features() {
  const { t } = useTranslation('common')
  const items = t('landing.features.items', { returnObjects: true })

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center">
          {t('landing.features.heading')}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="mt-3 text-gray-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

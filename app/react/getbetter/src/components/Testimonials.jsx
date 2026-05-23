import { useTranslation } from 'react-i18next'

export default function Testimonials() {
  const { t } = useTranslation('common')
  const items = t('landing.testimonials.items', { returnObjects: true })

  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center">
          {t('landing.testimonials.heading')}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <blockquote key={item.author} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-lg text-gray-100">"{item.quote}"</p>
              <footer className="mt-4 text-sm text-gray-400">— {item.author}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

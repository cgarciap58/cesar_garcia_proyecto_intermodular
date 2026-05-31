import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import tomasImg from '../assets/tomas.jpg'
import luciaImg from '../assets/lucia.jpg'

// ─── Scroll-observer hook ─────────────────────────────────────────────────────
// Returns a ref to attach to a container. Once 20% of it enters the viewport
// the `visible` CSS class is added, triggering the CSS transition.

function useScrollReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

// ─── Individual card ──────────────────────────────────────────────────────────

function TestimonialCard({ quote, author, role, image, delay = 0 }) {
  const ref = useScrollReveal()

  return (
    <div
      ref={ref}
      className="testimonial-card"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Portrait */}
      <div className="portrait-wrapper">
        <img src={image} alt={author} className="portrait-img" />
        <div className="portrait-shine" />
      </div>

      {/* Quote */}
      <div className="quote-body">
        <svg className="quote-mark" viewBox="0 0 32 24" fill="none" aria-hidden="true">
          <path
            d="M0 24V14.4C0 6.4 4.26667 1.6 12.8 0L14.4 2.4C10.6667 3.46667 8.26667 5.6 7.2 8.8H12.8V24H0ZM19.2 24V14.4C19.2 6.4 23.4667 1.6 32 0L33.6 2.4C29.8667 3.46667 27.4667 5.6 26.4 8.8H32V24H19.2Z"
            fill="currentColor"
          />
        </svg>
        <p className="quote-text">{quote}</p>
        <footer className="quote-footer">
          <span className="author-name">{author}</span>
          <span className="author-role">{role}</span>
        </footer>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function Testimonials() {
  const { t } = useTranslation('common')
  const headingRef = useScrollReveal()

  const items = [
    {
      key:    'tomas',
      image:  tomasImg,
      delay:  100,
    },
    {
      key:    'lucia',
      image:  luciaImg,
      delay:  250,
    },
  ]

  return (
    <section id="testimonials" className="testimonials-section">
      {/* Subtle ambient glow */}
      <div className="testimonials-glow" aria-hidden="true" />

      <div className="testimonials-inner">
        <div ref={headingRef} className="testimonials-heading-wrap testimonial-card">
          <p className="testimonials-eyebrow">{t('landing.testimonials.eyebrow')}</p>
          <h2 className="testimonials-heading">{t('landing.testimonials.heading')}</h2>
        </div>

        <div className="testimonials-grid">
          {items.map(({ key, image, delay }) => {
            const item = t(`landing.testimonials.${key}`, { returnObjects: true })
            return (
              <TestimonialCard
                key={key}
                quote={item.quote}
                author={item.author}
                role={item.role}
                image={image}
                delay={delay}
              />
            )
          })}
        </div>
      </div>

      <style>{`
        /* ── Scroll-reveal base state ─────────────────────────────────── */
        .testimonial-card {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .testimonial-card.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Section layout ───────────────────────────────────────────── */
        .testimonials-section {
          position: relative;
          padding: 7rem 1.5rem 8rem;
          overflow: hidden;
        }
        .testimonials-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 60%, rgba(59,130,246,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .testimonials-inner {
          max-width: 64rem;
          margin: 0 auto;
        }

        /* ── Heading ──────────────────────────────────────────────────── */
        .testimonials-heading-wrap {
          text-align: center;
          margin-bottom: 3.5rem;
        }
        .testimonials-eyebrow {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #60a5fa;
          margin-bottom: 0.75rem;
        }
        .testimonials-heading {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.2;
        }

        /* ── Cards grid ───────────────────────────────────────────────── */
        .testimonials-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.75rem;
        }
        @media (min-width: 768px) {
          .testimonials-grid { grid-template-columns: 1fr 1fr; }
        }

        /* ── Card ─────────────────────────────────────────────────────── */
        .testimonial-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          border-radius: 1.25rem;
          overflow: hidden;
          background: linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9));
          border: 1px solid rgba(148,163,184,0.1);
          box-shadow: 0 4px 32px rgba(0,0,0,0.3);
          transition: opacity 0.65s ease, transform 0.65s ease,
                      box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .testimonial-card.visible:hover {
          box-shadow: 0 8px 48px rgba(59,130,246,0.15);
          border-color: rgba(96,165,250,0.25);
        }

        /* ── Portrait ─────────────────────────────────────────────────── */
        .portrait-wrapper {
          position: relative;
          width: 100%;
          /* 3:2 aspect ratio — optimum for head-and-shoulders crop */
          aspect-ratio: 3 / 2;
          overflow: hidden;
          background: #0f172a;
        }
        .portrait-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* Pull the frame up to keep the face centred for head+shoulders shots */
          object-position: center 20%;
          display: block;
          transition: transform 0.5s ease;
        }
        .testimonial-card.visible:hover .portrait-img {
          transform: scale(1.03);
        }
        /* Gradient vignette from bottom so quote sits cleanly */
        .portrait-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(15,23,42,0.85) 100%);
          pointer-events: none;
        }

        /* ── Quote body ───────────────────────────────────────────────── */
        .quote-body {
          padding: 1.5rem 1.75rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          flex: 1;
        }
        .quote-mark {
          width: 1.5rem;
          height: auto;
          color: #3b82f6;
          opacity: 0.6;
          flex-shrink: 0;
        }
        .quote-text {
          font-size: 1rem;
          line-height: 1.7;
          color: #cbd5e1;
          font-style: italic;
          flex: 1;
        }
        .quote-footer {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          margin-top: 0.25rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148,163,184,0.1);
        }
        .author-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: #f1f5f9;
        }
        .author-role {
          font-size: 0.75rem;
          color: #60a5fa;
          letter-spacing: 0.03em;
        }
      `}</style>
    </section>
  )
}

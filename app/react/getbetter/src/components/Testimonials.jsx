import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import luciaImg  from '../assets/lucia.jpg'
import tomasImg  from '../assets/tomas.jpg'
import elenaImg  from '../assets/elena.jpg'

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('tb-visible'); io.disconnect() } },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return ref
}

// ─── Single testimonial card ──────────────────────────────────────────────────
//
// layout: 'image-left'  → [photo | quote]
//         'image-right' → [quote | photo]

function TestimonialCard({ quote, author, role, image, layout, delay = 0, align }) {
  const ref        = useScrollReveal()
  const imageFirst = layout === 'image-left'

  return (
    <div
      ref={ref}
      className={`tb-card tb-align-${align}`}
      style={{ '--tb-delay': `${delay}ms` }}
    >
      <div className={`tb-inner ${imageFirst ? 'tb-row' : 'tb-row-reverse'}`}>

        {/* ── Photo half ─────────────────────────────────────────────── */}
        <div className="tb-photo-half">
          <img src={image} alt={author} className="tb-photo" />
          {/* bottom-up gradient so name reads clearly if ever overlaid */}
          <div className="tb-photo-veil" />
        </div>

        {/* ── Quote half ─────────────────────────────────────────────── */}
        <div className="tb-quote-half">
          <svg className="tb-mark" viewBox="0 0 36 28" aria-hidden="true">
            <path
              d="M0 28V17C0 7.667 5 2.333 15 1L17 4C12.333 5.333 9.667 8 9 12H15V28H0ZM21 28V17C21 7.667 26 2.333 36 1L38 4C33.333 5.333 30.667 8 30 12H36V28H21Z"
              fill="currentColor"
            />
          </svg>

          <p className="tb-text">&#8220;{quote}&#8221;</p>

          <footer className="tb-footer">
            <span className="tb-author">{author}</span>
            <span className="tb-role">{role}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function Testimonials() {
  const { t }      = useTranslation('common')
  const headingRef = useScrollReveal(0.4)

  // Card definitions — layout/align alternates, images are fixed per person
  const cards = [
    { key: 'tomas', image: tomasImg,  layout: 'image-left', align: 'left',  delay: 0  },
    { key: 'lucia', image: luciaImg,  layout: 'image-right',  align: 'right',   delay: 80   },
    { key: 'elena', image: elenaImg,  layout: 'image-left',  align: 'left',   delay: 0   },
  ]

  return (
    <section id="testimonials" className="tb-section">

      {/* Ambient background glow */}
      <div className="tb-bg-glow" aria-hidden="true" />

      <div className="tb-wrap">

        {/* Heading */}
        <div ref={headingRef} className="tb-heading-block tb-card">
          <p className="tb-eyebrow">{t('landing.testimonials.eyebrow')}</p>
          <h2 className="tb-heading">{t('landing.testimonials.heading')}</h2>
        </div>

        {/* Cards */}
        <div className="tb-stack">
          {cards.map(({ key, image, layout, align, delay }) => {
            const item = t(`landing.testimonials.${key}`, { returnObjects: true })
            return (
              <TestimonialCard
                key={key}
                quote={item.quote}
                author={item.author}
                role={item.role}
                image={image}
                layout={layout}
                align={align}
                delay={delay}
              />
            )
          })}
        </div>
      </div>

      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`

        /* scroll-reveal base */
        .tb-card {
          opacity: 0;
          transform: translateY(32px);
          transition:
            opacity  0.7s ease var(--tb-delay, 0ms),
            transform 0.7s ease var(--tb-delay, 0ms);
        }
        .tb-card.tb-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* section */
        .tb-section {
          position: relative;
          padding: 7rem 0 9rem;
          overflow: hidden;
        }
        .tb-bg-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 60% at 50% 55%,
            rgba(59,130,246,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .tb-wrap {
          /* ~80 % of the navbar's max-w-7xl = 80rem → ~64rem */
          max-width: 64rem;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* heading */
        .tb-heading-block {
          text-align: center;
          margin-bottom: 4rem;
        }
        .tb-eyebrow {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #60a5fa;
          margin-bottom: 0.6rem;
        }
        .tb-heading {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1.2;
        }

        /* stack of cards */
        .tb-stack {
          display: flex;
          flex-direction: column;
          gap: 2.25rem;
        }

        /* per-card alignment (left / right) */
        .tb-align-left  { margin-right: auto; }
        .tb-align-right { margin-left:  auto; }

        /* card shell — fixed width ~80 % of wrap */
        .tb-inner {
          display: flex;
          width: 100%;
          border-radius: 1.25rem;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.1);
          background: linear-gradient(
            135deg,
            rgba(30,41,59,0.85) 0%,
            rgba(15,23,42,0.92) 100%
          );
          box-shadow: 0 6px 40px rgba(0,0,0,0.35);
          transition: box-shadow 0.35s ease, border-color 0.35s ease;
          min-height: 260px;
        }
        .tb-card.tb-visible .tb-inner:hover {
          box-shadow: 0 10px 55px rgba(59,130,246,0.18);
          border-color: rgba(96,165,250,0.28);
        }

        /* row directions */
        .tb-row         { flex-direction: row; }
        .tb-row-reverse { flex-direction: row-reverse; }

        /* photo half */
        .tb-photo-half {
          position: relative;
          width: 45%;
          flex-shrink: 0;
          overflow: hidden;
        }
        .tb-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 15%;
          display: block;
          transition: transform 0.55s ease;
        }
        .tb-card.tb-visible .tb-inner:hover .tb-photo {
          transform: scale(1.04);
        }
        /* subtle dark vignette on the inner edge so text side reads cleanly */
        .tb-row         .tb-photo-half .tb-photo-veil {
          position: absolute; inset: 0;
          background: linear-gradient(to right, transparent 70%, rgba(15,23,42,0.7) 100%);
        }
        .tb-row-reverse .tb-photo-half .tb-photo-veil {
          position: absolute; inset: 0;
          background: linear-gradient(to left,  transparent 70%, rgba(15,23,42,0.7) 100%);
        }

        /* quote half */
        .tb-quote-half {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2.25rem 2rem 2rem 2.25rem;
          gap: 1rem;
        }
        .tb-mark {
          width: 1.6rem;
          color: #3b82f6;
          opacity: 0.55;
          flex-shrink: 0;
        }
        .tb-text {
          font-size: 1rem;
          line-height: 1.75;
          color: #cbd5e1;
          font-style: italic;
          flex: 1;
        }
        .tb-footer {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148,163,184,0.1);
        }
        .tb-author {
          font-weight: 700;
          font-size: 0.9rem;
          color: #f1f5f9;
        }
        .tb-role {
          font-size: 0.72rem;
          color: #60a5fa;
          letter-spacing: 0.04em;
        }

        /* ── Responsive: stack vertically on mobile ─────────────────── */
        @media (max-width: 640px) {
          .tb-inner,
          .tb-row,
          .tb-row-reverse {
            flex-direction: column !important;
          }
          .tb-photo-half {
            width: 100%;
            aspect-ratio: 4 / 3;
          }
          .tb-row         .tb-photo-half .tb-photo-veil,
          .tb-row-reverse .tb-photo-half .tb-photo-veil {
            background: linear-gradient(to bottom, transparent 60%, rgba(15,23,42,0.7) 100%);
          }
          .tb-align-left,
          .tb-align-right {
            margin-left:  0;
            margin-right: 0;
          }
        }
      `}</style>
    </section>
  )
}

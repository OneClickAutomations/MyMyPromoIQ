/**
 * ShowcaseUGC — a second large showcase that mirrors the hero's premium studio
 * window for a *completely different* campaign: an athletic hydration brand
 * fronted by a male UGC creator. Same <StudioMockup> visual language, new niche
 * + new creator, to prove PromoIQ generates agency-quality UGC for any audience.
 *
 * Frames: public/assets/ugc-*.jpg (real AI-generated cinematic ad frames, one
 * consistent creator across the whole storyboard).
 */
import { motion } from 'framer-motion'
import { ugcShowcase as c } from '../copy'
import { ArrowRight, PlayIcon } from './icons'
import StudioMockup, { type Variant } from './StudioMockup'
import Reveal from './Reveal'

const variants: Variant[] = [
  { label: 'Hook', dur: '0:06', img: '/assets/ugc-hook.jpg', pos: 'center', done: true },
  { label: 'Product Demo', dur: '0:12', img: '/assets/ugc-demo.jpg', pos: 'center', done: true },
  { label: 'Lifestyle', dur: '0:10', img: '/assets/ugc-lifestyle.jpg', pos: 'center', done: true },
  { label: 'Social Proof', dur: '0:09', img: '/assets/ugc-social.jpg', pos: 'top', done: true },
  { label: 'Benefit', dur: '0:07', img: '/assets/ugc-benefit.jpg', pos: 'center', done: false, percent: 68 },
]

export default function ShowcaseUGC() {
  return (
    <section id="ugc" className="relative py-24 md:py-32">
      <div className="container-x section-pad">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-void-900/40 p-6 shadow-card sm:p-10 lg:p-12">
            {/* warm cinematic glow */}
            <div className="pointer-events-none absolute -left-24 top-0 -z-10 h-80 w-80 rounded-full bg-fire-start/15 blur-[120px]" />
            <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-72 w-72 rounded-full bg-gold/10 blur-[120px]" />

            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              {/* Copy */}
              <div>
                <span className="eyebrow">
                  <span className="h-1.5 w-1.5 rounded-full bg-fire-start" />
                  {c.eyebrow}
                </span>

                <h2 className="mt-6 text-balance text-3xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-4xl md:text-5xl">
                  {c.headline[0]}{' '}
                  <span className="text-fire">{c.headline[1]}</span>{' '}
                  <span className="text-fire">{c.headline[2]}</span>
                </h2>

                <p className="mt-6 max-w-xl text-balance text-lg text-ink-muted">{c.subhead}</p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a href="#generate" className="btn-fire w-full sm:w-auto">
                    {c.ctaPrimary}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a href="#ugc" className="btn-ghost w-full sm:w-auto">
                    <PlayIcon className="h-3.5 w-3.5 text-gold" />
                    {c.ctaSecondary}
                  </a>
                </div>
              </div>

              {/* Mockup */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="pointer-events-none absolute inset-x-6 bottom-2 top-6 -z-10 rounded-[32px] bg-fire-start/15 blur-3xl" />
                <div className="shadow-fire-glow rounded-2xl">
                  <StudioMockup
                    statusBadge={c.mockup.statusBadge}
                    renderPill={c.mockup.renderPill}
                    title={c.mockup.title}
                    percent={c.mockup.percent}
                    preview={{
                      img: '/assets/ugc-main.jpg',
                      alt: c.mockup.previewAlt,
                      masterChip: c.mockup.masterChip,
                      pos: 'top',
                    }}
                    director={c.mockup.director}
                    variants={variants}
                    ctaCard={c.mockup.ctaCard}
                    monthlyCount={94}
                  />
                </div>
              </motion.div>
            </div>

            {/* Footnote strip */}
            <div className="mt-10 border-t border-white/5 pt-6 text-center">
              <p className="text-sm text-ink-muted">
                {c.footnote}{' '}
                <span className="font-semibold text-fire">{c.footnoteEmphasis}</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

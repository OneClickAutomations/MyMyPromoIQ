import { pricing } from '../copy'
import { Check, ArrowRight } from './icons'
import Reveal from './Reveal'

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-28 md:py-36">
      <div className="container-x section-pad">
        <Reveal className="text-center">
          <span className="eyebrow">{pricing.eyebrow}</span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-5xl">
            {pricing.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">{pricing.subtitle}</p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-center">
          {pricing.tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <div
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  t.featured
                    ? 'border-gold/50 bg-void-800 shadow-fire-soft lg:scale-[1.04]'
                    : 'border-white/5 bg-void-800/50'
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-fire px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-fire-soft">
                    {t.badge}
                  </span>
                )}

                <div className="text-sm font-semibold uppercase tracking-widest text-ink-faint">
                  {t.name}
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-ink">{t.price}</span>
                  <span className="mb-1 text-sm text-ink-faint">{t.cadence}</span>
                </div>
                <p className="mt-3 text-sm text-ink-muted">{t.tagline}</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          t.featured ? 'text-gold' : 'text-fire-start'
                        }`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href="#top"
                  className={`mt-7 ${
                    t.featured
                      ? 'btn-fire w-full'
                      : 'btn-ghost w-full'
                  }`}
                >
                  {t.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

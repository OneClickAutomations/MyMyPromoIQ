import { testimonials } from '../copy'
import Reveal from './Reveal'

/** Auto-scrolling testimonial cards (pause on hover). */
export default function Testimonials() {
  const row = [...testimonials.items, ...testimonials.items]

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="container-x section-pad">
        <Reveal>
          <span className="eyebrow">{testimonials.eyebrow}</span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {testimonials.title}
          </h2>
        </Reveal>
      </div>

      <div className="group mask-fade-x mt-12 overflow-hidden">
        <div className="flex w-max gap-5 [animation:marquee_48s_linear_infinite] group-hover:[animation-play-state:paused]">
          {row.map((t, i) => (
            <figure
              key={i}
              className="flex w-[340px] shrink-0 flex-col rounded-2xl border border-white/5 bg-void-800 p-6 shadow-card md:w-[400px]"
            >
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-fire-soft px-2.5 py-1 text-[12px] font-semibold text-fire-start ring-1 ring-fire-start/25">
                {t.metric}
              </span>
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/90 text-sm font-bold text-void">
                  {t.initials}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-ink-faint">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

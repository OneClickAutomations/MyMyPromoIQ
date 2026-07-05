import { problem } from '../copy'
import { X, Check, Bolt } from './icons'
import Reveal from './Reveal'

export default function Problem() {
  return (
    <section id="product" className="relative overflow-hidden py-28 md:py-36">
      {/* Ambient fire glow behind the winning column */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[8%] top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-fire-end/10 blur-[130px]" />
      </div>

      <div className="container-x section-pad">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">{problem.eyebrow}</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-5xl">
              {problem.title}{' '}
              <span className="text-fire">{problem.titleEmphasis}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-lg text-balance text-lg text-ink-muted">
              {problem.subtitle}
            </p>
          </Reveal>
        </div>

        {/* Comparison grid */}
        <Reveal delay={0.12}>
          <div className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-2 lg:gap-6">
            {/* ── Pain column ── */}
            <div className="relative rounded-[28px] border border-white/8 bg-void-900/40 p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500 shadow-[0_0_20px_-4px_rgba(244,63,94,0.7)]">
                  <X className="h-4 w-4 text-white" />
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-ink-faint">
                  {problem.oldLabel}
                </span>
              </div>
              <ul className="space-y-5">
                {problem.rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-void-800/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-500 shadow-[0_0_12px_-2px_rgba(244,63,94,0.75)]">
                        <X className="h-2.5 w-2.5 text-white" />
                      </span>
                      <span className="text-sm leading-snug text-ink-muted line-through decoration-ink-faint/40">
                        {r.pain}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold tracking-tight text-ink-muted">
                        {r.painMetric}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-faint">
                        {r.painMetricLabel}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Gain column ── */}
            <div className="relative rounded-[28px] border border-fire-start/30 bg-gradient-to-b from-fire-start/[0.07] to-void-900/40 p-6 shadow-fire-soft sm:p-8">
              {/* Winner badge */}
              <span className="absolute -top-3 right-6 rounded-full bg-gradient-fire px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-fire-soft">
                The fix
              </span>

              <div className="mb-6 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
                  <Bolt className="h-4 w-4 text-white" />
                </span>
                <span className="text-sm font-bold uppercase tracking-widest text-ink">
                  {problem.newLabel}
                </span>
              </div>
              <ul className="space-y-5">
                {problem.rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-void-800/60 p-4 transition-colors hover:border-fire-start/20"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gradient-fire">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                      <span className="text-sm font-medium leading-snug text-ink">
                        {r.gain}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold tracking-tight text-fire">
                        {r.gainMetric}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-faint">
                        {r.gainMetricLabel}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

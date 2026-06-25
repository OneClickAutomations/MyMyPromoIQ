import { problem } from '../copy'
import Reveal from './Reveal'

const toneMap: Record<string, string> = {
  problem: 'text-ink',
  agitate: 'text-ink-muted',
  solve: 'text-ink',
}

export default function Problem() {
  return (
    <section id="product" className="relative py-28 md:py-36">
      <div className="container-x section-pad">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <span className="eyebrow">{problem.eyebrow}</span>
          </Reveal>

          <div className="mt-8 space-y-7">
            {problem.blocks.map((b, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <p
                  className={`text-balance text-xl leading-relaxed sm:text-2xl ${toneMap[b.kind]} ${
                    b.kind === 'solve' ? 'font-semibold' : ''
                  }`}
                >
                  {b.kind === 'solve' && (
                    <span className="mr-2 inline-block h-2 w-2 -translate-y-1 rounded-full bg-fire-start align-middle" />
                  )}
                  {b.kind === 'solve' ? (
                    <>
                      So stop renting the bottleneck.{' '}
                      <span className="text-fire">{b.text.replace('So stop renting the bottleneck. ', '')}</span>
                    </>
                  ) : (
                    b.text
                  )}
                </p>
              </Reveal>
            ))}
          </div>

          {/* Cost-of-inaction stat row */}
          <Reveal delay={0.1}>
            <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/5 bg-white/5 sm:grid-cols-3">
              {problem.costRow.map((c) => (
                <div key={c.label} className="bg-void-800 p-6 text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-fire sm:text-4xl">
                    {c.stat}
                  </div>
                  <div className="mt-1.5 text-sm text-ink-muted">{c.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

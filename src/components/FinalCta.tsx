import { Link } from 'react-router-dom'
import { finalCta } from '../copy'
import { ArrowRight } from './icons'
import Reveal from './Reveal'

export default function FinalCta() {
  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      {/* gradient glow behind the close */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[820px] max-w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fire-end/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-fire-start/20 blur-[100px]" />
      </div>

      <div className="container-x section-pad text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl md:text-5xl">
            {finalCta.headline[0]}{' '}
            <span className="text-fire">{finalCta.headline[1]}</span>
          </h2>
        </Reveal>
        <Reveal delay={0.06}>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-ink-muted">
            {finalCta.sub}
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link to="/sign-up" className="btn-fire px-8 py-4 text-base">
              {finalCta.cta}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <span className="text-xs text-ink-faint">{finalCta.reassurance}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

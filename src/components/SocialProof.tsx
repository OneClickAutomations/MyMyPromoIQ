import { socialProof } from '../copy'

/** Infinite auto-scroll avatar testimonial strip. Pauses on hover.
 *  Sits flush under the hero — a continuation, not a new section. */
export default function SocialProof() {
  const row = [...socialProof.people, ...socialProof.people] // duplicate for seamless loop

  return (
    <section className="relative mt-20 md:mt-28">
      <p className="container-x section-pad text-center text-xs uppercase tracking-widest text-ink-faint">
        {socialProof.intro}
      </p>

      <div className="group mask-fade-x mt-5 overflow-hidden">
        <div className="flex w-max gap-3 animate-marquee group-hover:[animation-play-state:paused]">
          {row.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-full border border-white/5 bg-void-800/70 py-2 pl-2 pr-4"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                  p.tone === 'fire' ? 'bg-gradient-fire' : 'bg-gold/90 text-void'
                }`}
              >
                {p.initials}
              </span>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                <div
                  className={`text-[12px] font-medium ${
                    p.tone === 'fire' ? 'text-fire-start' : 'text-gold'
                  }`}
                >
                  {p.result}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { videoSection } from '../copy'
import Reveal from './Reveal'

/** Demo video block. Swap the inner faux-frame for a real <video src> /
 *  embed when the demo asset is ready. */
export default function VideoSection() {
  const [playing, setPlaying] = useState(false)

  return (
    <section id="demo" className="relative py-12 md:py-16">
      <div className="container-x section-pad">
        <Reveal>
          <p className="mx-auto max-w-2xl text-balance text-center text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {videoSection.caption}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-balance text-center text-ink-muted">
            {videoSection.subcaption}
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative mx-auto mt-10 max-w-4xl">
            <div className="pointer-events-none absolute inset-8 -z-10 rounded-full bg-fire-start/15 blur-3xl" />
            {/* Elevated dark card with thin gold border */}
            <div className="overflow-hidden rounded-2xl border border-gold/30 bg-void-800 shadow-card ring-1 ring-white/5">
              <div className="relative aspect-video w-full bg-gradient-to-br from-void-700 to-void-800">
                {/* ambient color blooms */}
                <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-fire-start/20 blur-3xl" />
                <div className="absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />

                {!playing ? (
                  <button
                    onClick={() => setPlaying(true)}
                    className="absolute inset-0 grid place-items-center"
                    aria-label="Play demo"
                  >
                    <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-fire shadow-fire-glow transition-transform duration-200 hover:scale-105">
                      {/* gold play triangle */}
                      <span className="ml-1 h-0 w-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-[#F2B84B]" />
                    </span>
                    <span className="absolute bottom-5 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                      {videoSection.posterAlt} · 1:00
                    </span>
                  </button>
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-sm text-ink-muted">
                    {/* TODO: replace with <video controls autoPlay src="/assets/demo.mp4" /> */}
                    Demo player mounts here
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

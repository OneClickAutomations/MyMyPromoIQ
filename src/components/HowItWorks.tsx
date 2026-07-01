import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { howItWorks } from '../copy'
import { Upload, Wand, Film, Download } from './icons'
import Reveal from './Reveal'

/**
 * Interactive product tour (the explainer). The REAL, working pipeline lives
 * in components/Generator.tsx (#generate) and the Vercel functions:
 *   Step 3 (AI directs) → POST /api/generate → Claude writes the prompt +
 *                         Google Veo 3 submits the render
 *   Step 4 (download)   → GET /api/status polls until the video URL is ready
 * Keys (ANTHROPIC_API_KEY, GEMINI_API_KEY) load server-side only.
 */

const stepIcons = [Upload, Wand, Film, Download]

function PreviewPanel({ index }: { index: number }) {
  const step = howItWorks.steps[index]

  // A distinct, convincing mock per step.
  const bodies = [
    // Upload
    <div key="0" className="grid h-full place-items-center p-6">
      <div className="w-full max-w-xs rounded-xl border-2 border-dashed border-fire-start/40 bg-void-700/40 p-8 text-center">
        <Upload className="mx-auto h-8 w-8 text-fire-start" />
        <div className="mt-3 text-sm font-semibold text-ink">Drop product.jpg</div>
        <div className="mt-1 text-xs text-ink-faint">or paste a product link</div>
        <div className="mx-auto mt-4 h-1.5 w-3/4 overflow-hidden rounded-full bg-void-500">
          <div className="h-full w-2/3 rounded-full bg-gradient-fire" />
        </div>
      </div>
    </div>,
    // Style
    <div key="1" className="grid h-full grid-cols-2 gap-3 p-6">
      {['Testimonial', 'Unboxing', 'Day-in-life', 'Fast-cut hook'].map((s, i) => (
        <div
          key={s}
          className={`grid place-items-center rounded-xl border p-4 text-center text-sm font-medium ${
            i === 0
              ? 'border-gold/50 bg-gradient-fire-soft text-ink ring-1 ring-gold/30'
              : 'border-white/5 bg-void-700/40 text-ink-muted'
          }`}
        >
          {s}
          {i === 0 && <span className="mt-1 block text-[10px] uppercase tracking-widest text-gold">selected</span>}
        </div>
      ))}
    </div>,
    // Direct
    <div key="2" className="flex h-full flex-col gap-2 p-6 text-xs">
      {[
        ['✦ Director', 'Writing hook: “Wait, this fixed it in a week?”'],
        ['→ Scene', 'Casting creator · soft window light · handheld'],
        ['→ Beats', 'Hook · proof · close-up · CTA card'],
        ['● Render', 'Seedance · 1080×1920 · 73%'],
      ].map(([k, v], i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.12 }}
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-void-700/40 px-3 py-2"
        >
          <span className={i === 0 ? 'font-semibold text-gold' : 'text-fire-start'}>{k}</span>
          <span className="truncate text-ink-muted">{v}</span>
        </motion.div>
      ))}
    </div>,
    // Publish
    <div key="3" className="grid h-full place-items-center p-6">
      <div className="w-full max-w-[200px]">
        <div className="relative mx-auto aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fire-start/30 to-fire-end/10">
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/40 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
            ad_v13.mp4 · 0:18
          </div>
          <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-gradient-fire text-white">
            <Download className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-lg bg-gradient-fire py-2 text-xs font-semibold text-white">
            Download
          </button>
          <button className="flex-1 rounded-lg border border-white/10 bg-void-700 py-2 text-xs font-semibold text-ink">
            Push to Meta
          </button>
        </div>
      </div>
    </div>,
  ]

  return (
    <div className="relative h-full">
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md bg-black/40 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-fire-start" />
        {step.panelTitle}
        <span className="text-white/40">· {step.panelHint}</span>
      </div>
      {bodies[index]}
    </div>
  )
}

export default function HowItWorks() {
  const [active, setActive] = useState(0)

  return (
    <section id="how-it-works" className="relative py-28 md:py-36">
      <div className="container-x section-pad">
        <Reveal>
          <span className="eyebrow">{howItWorks.eyebrow}</span>
          <h2 className="mt-6 max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl md:text-5xl">
            {howItWorks.title}{' '}
            <span className="text-fire">{howItWorks.titleEmphasis}</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Steps */}
          <div className="flex flex-col gap-3">
            {howItWorks.steps.map((s, i) => {
              const Icon = stepIcons[i]
              const isActive = i === active
              return (
                <button
                  key={s.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                    isActive
                      ? 'border-gold/40 bg-void-800 shadow-card'
                      : 'border-white/5 bg-void-800/40 hover:bg-void-800/70'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
                      isActive
                        ? 'bg-gradient-fire text-white shadow-fire-soft'
                        : 'bg-void-600 text-ink-faint'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-widest ${
                          isActive ? 'text-gold' : 'text-ink-faint'
                        }`}
                      >
                        {s.kicker}
                      </span>
                    </div>
                    <div className="mt-0.5 text-lg font-semibold text-ink">{s.title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.blurb}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Preview panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-void-800 shadow-card">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fire-start/15 blur-3xl" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="h-full"
                >
                  <PreviewPanel index={active} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* progress dots */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {howItWorks.steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === active ? 'w-7 bg-gold' : 'w-1.5 bg-void-500 hover:bg-void-500'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

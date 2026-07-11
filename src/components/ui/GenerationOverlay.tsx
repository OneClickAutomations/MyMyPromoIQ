/**
 * GenerationOverlay — the premium in-progress visual for every generation flow
 * (Quick Generate, Build From Scratch, Clone). Fixed-position and centered so
 * it is always in the user's viewport the instant generation starts — no
 * scrolling required, which matters most on mobile.
 *
 * Visual: a large ring with the overall completion percentage in the center,
 * a headline + detail line for the current step, and a labeled step tracker
 * (dots connected by a line, filled as steps complete) with an optional
 * Cancel action — matching the reference design the product asked for.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from '../icons'

function Ring({ pct }: { pct: number }) {
  const px = 148
  const stroke = 7
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)

  return (
    <div className="relative grid place-items-center" style={{ width: px, height: px }}>
      <svg width={px} height={px} className="-rotate-90">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="rgb(var(--c-void-500))" strokeWidth={stroke} opacity={0.4} />
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none" stroke="url(#gen-ring-gradient)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <defs>
          <linearGradient id="gen-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="100%" stopColor="#E8341C" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute grid place-items-center">
        <span className="text-3xl font-extrabold tabular-nums text-fire-start">{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

export interface GenerationStep {
  /** Short, ALL-CAPS-friendly label shown under the tracker dot (e.g. "Script"). */
  label: string
  /** Headline shown above the ring while this step is active (e.g. "Writing your script…"). */
  headline: string
  /** Secondary detail line while this step is active. */
  detail?: string
}

export interface GenerationOverlayProps {
  steps: GenerationStep[]
  /** 0-based index of the currently active step. */
  activeIndex: number
  /** Expected seconds for the CURRENT step — drives the ring's within-step fill. */
  estimateSecondsForStep?: number
  /** Shown as a small "Cancel" action under the tracker. Omit to hide it. */
  onCancel?: () => void
}

export default function GenerationOverlay({ steps, activeIndex, estimateSecondsForStep, onCancel }: GenerationOverlayProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    const start = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 200)
    return () => clearInterval(id)
  }, [activeIndex])

  const total = steps.length
  // Within-step progress caps at 92% of that step's slice so the ring never
  // visually finishes before the real result lands.
  const withinStep = estimateSecondsForStep
    ? Math.min(0.92, elapsed / estimateSecondsForStep)
    : 0.3 // indeterminate steps still creep forward so the ring never looks frozen
  const pct = Math.min(99, ((activeIndex + withinStep) / total) * 100)

  const active = steps[activeIndex] ?? steps[steps.length - 1]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-void-900/85 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-void-800 p-7 shadow-fire-glow"
        >
          <div className="flex flex-col items-center text-center">
            <Ring pct={pct} />
            <p className="mt-5 text-base font-bold text-ink">{active?.headline}</p>
            {active?.detail && <p className="mt-1 text-xs text-ink-faint">{active.detail}</p>}
          </div>

          {/* Step tracker — dots connected by a line, labels underneath */}
          <div className="mt-7 flex items-start justify-between">
            {steps.map((step, i) => {
              const complete = i < activeIndex
              const current = i === activeIndex
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div className={`h-px flex-1 ${i <= activeIndex ? 'bg-fire-start/50' : 'bg-white/10'}`} />
                    )}
                    <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full transition-colors ${
                      complete ? 'bg-gradient-fire text-white'
                      : current ? 'bg-fire-start/20 ring-2 ring-fire-start' : 'bg-white/[0.06]'
                    }`}>
                      {complete
                        ? <Check className="h-3 w-3" />
                        : current
                          ? <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
                          : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
                    </span>
                    {i < steps.length - 1 && (
                      <div className={`h-px flex-1 ${i < activeIndex ? 'bg-fire-start/50' : 'bg-white/10'}`} />
                    )}
                  </div>
                  <span className={`mt-2 text-center text-[9px] font-bold uppercase tracking-wide ${
                    complete || current ? 'text-ink' : 'text-ink-faint'
                  }`}>{step.label}</span>
                </div>
              )
            })}
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-6 w-full text-center text-xs font-semibold text-ink-faint transition-colors hover:text-ink"
            >
              Cancel
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

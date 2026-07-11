/**
 * GenerationOverlay — the premium in-progress visual for every generation flow
 * (Quick Generate, Build From Scratch, Clone). Fixed-position and centered so
 * it is always in the user's viewport the instant generation starts — no
 * scrolling required, which matters most on mobile where the old inline
 * progress panel could render below the fold.
 *
 * The ring is a determinate countdown when `estimateSeconds` is given (fills
 * toward ~92% on its own pace, then holds until the step advances — so it
 * never visually claims "done" before the real result arrives), and an
 * indeterminate sweep otherwise.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Spark } from '../icons'

function Ring({ pct, indeterminate }: { pct: number; indeterminate: boolean }) {
  const px = 96
  const stroke = 5
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)

  return (
    <div className="relative grid place-items-center" style={{ width: px, height: px }}>
      <svg width={px} height={px} className={`-rotate-90 ${indeterminate ? 'animate-[spin_2.2s_linear_infinite]' : ''}`}>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="rgb(var(--c-void-500))" strokeWidth={stroke} opacity={0.4} />
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none" stroke="url(#gen-ring-gradient)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={indeterminate ? `${c * 0.28} ${c}` : c}
          strokeDashoffset={indeterminate ? 0 : offset}
          style={{ transition: indeterminate ? undefined : 'stroke-dashoffset 0.8s ease' }}
        />
        <defs>
          <linearGradient id="gen-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="100%" stopColor="#E8341C" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute grid place-items-center">
        <Spark className="h-7 w-7 animate-pulse text-fire-start" />
      </div>
    </div>
  )
}

export interface GenerationOverlayProps {
  /** Ordered step labels (e.g. "Claude writing direction", "Rendering video…"). */
  steps: string[]
  /** 0-based index of the currently active step. */
  activeIndex: number
  /** Optional total expected seconds — drives a real countdown fill on the ring. */
  estimateSeconds?: number
  /** Small helper line under the heading (e.g. "This usually takes 1-3 minutes."). */
  subtitle?: string
}

export default function GenerationOverlay({ steps, activeIndex, estimateSeconds, subtitle }: GenerationOverlayProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    const start = Date.now()
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 250)
    return () => clearInterval(id)
  }, [activeIndex === 0]) // restart the clock once, at the first step

  const indeterminate = !estimateSeconds
  // Cap the auto-fill at 92% so it never visually finishes before the real
  // result lands — the last jump to 100% happens when the caller unmounts
  // this component (i.e. phase flips to 'done').
  const pct = estimateSeconds ? Math.min(92, (elapsed / estimateSeconds) * 100) : 0

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
            <Ring pct={pct} indeterminate={indeterminate} />
            <p className="mt-4 text-base font-bold text-ink">{steps[activeIndex] ?? 'Generating…'}</p>
            {subtitle && <p className="mt-1 text-xs text-ink-faint">{subtitle}</p>}
          </div>

          <ul className="mt-6 space-y-2.5">
            {steps.map((step, i) => {
              const complete = i < activeIndex
              const current = i === activeIndex
              return (
                <li key={step} className="flex items-center gap-2.5 text-sm">
                  <span className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full transition-colors ${
                    complete ? 'bg-fire-start/20 text-fire-start'
                    : current ? 'bg-white/10' : 'bg-white/[0.04]'
                  }`}>
                    {complete
                      ? <Check className="h-3 w-3" />
                      : <span className={`h-1.5 w-1.5 rounded-full ${current ? 'animate-pulse-dot bg-fire-start' : 'bg-white/25'}`} />}
                  </span>
                  <span className={complete || current ? 'text-ink' : 'text-ink-faint'}>{step}</span>
                </li>
              )
            })}
          </ul>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

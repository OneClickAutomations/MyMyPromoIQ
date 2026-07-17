/**
 * AdTypeSelector — the type-first entry point (spec Step 0). Renders the engine
 * ad types as visual cards. The chosen type is stored as the brief's
 * commercialStyle, and every downstream step (wizard questions, beats, camera,
 * prompts) reads from the matching AdTypeTemplate — nothing here is hardcoded,
 * it all comes from the engine's AD_TYPE_ORDER + getTemplate.
 *
 * Collapsed by default to the six most popular/widely-used formats (two rows on
 * the desktop grid); "More styles" reveals the rest. If the current selection
 * lives in the hidden set, the grid opens expanded so the choice stays visible.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AD_TYPE_ORDER, getTemplate } from '../../lib/studio/promptEngineBridge'
import type { AdTypeId } from '../../lib/studio/promptEngineBridge'
import { ChevronDown } from '../icons'

const ICON: Record<string, string> = {
  'user-voice': '🗣️', package: '📦', wrench: '🔧', sun: '☀️',
  'arrows-swap': '🔄', 'list-checks': '✅', microphone: '🎤', eye: '👁️',
  sparkle: '✨', columns: '⚖️', heart: '❤️', zap: '⚡',
}

// Editorial hero still per format (public/assets/card-<id>.jpg) — generated to
// read like a 35mm fashion-editorial frame of what the format actually
// produces (flash confessional for testimonial, runway reveal, mirror
// transformation for before/after), not a generic stock photo.
const CARD_IMAGE: Partial<Record<AdTypeId, string>> = {
  testimonial: '/assets/card-testimonial.jpg',
  unboxing: '/assets/card-unboxing.jpg',
  problem_solution: '/assets/card-problem_solution.jpg',
  day_in_the_life: '/assets/card-day_in_the_life.jpg',
  before_after: '/assets/card-before_after.jpg',
  tutorial: '/assets/card-tutorial.jpg',
  street_interview: '/assets/card-street_interview.jpg',
  pov: '/assets/card-pov.jpg',
  product_reveal: '/assets/card-product_reveal.jpg',
  comparison: '/assets/card-comparison.jpg',
  founder_story: '/assets/card-founder_story.jpg',
  hook_only: '/assets/card-hook_only.jpg',
}

/** The most popular, widely-used UGC formats — shown before "More styles". */
const POPULAR: AdTypeId[] = [
  'testimonial', 'unboxing', 'problem_solution',
  'before_after', 'day_in_the_life', 'product_reveal',
]

function Card({ id, selected, onSelect }: { id: AdTypeId; selected?: AdTypeId; onSelect: (a: AdTypeId) => void }) {
  const t = getTemplate(id)
  const isSel = selected === id
  const image = CARD_IMAGE[id]
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={isSel}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border text-left transition ${
        isSel
          ? 'border-fire-start shadow-[0_0_0_1px_rgba(255,107,53,0.4)]'
          : 'border-white/[0.08] hover:border-white/[0.18]'
      }`}
    >
      {image && (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-void-900">
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void-900/90 via-void-900/10 to-transparent" />
          <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/40 text-base leading-none backdrop-blur-sm" aria-hidden>
            {ICON[t.icon] ?? '🎬'}
          </span>
          <span className="absolute bottom-2.5 left-3 text-sm font-semibold text-white drop-shadow-sm">{t.displayName}</span>
        </div>
      )}
      <div className={`flex flex-1 flex-col p-4 ${isSel ? 'bg-fire-start/[0.07]' : 'bg-void-800 group-hover:bg-void-700/60'}`}>
        {!image && (
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-2xl leading-none" aria-hidden>{ICON[t.icon] ?? '🎬'}</span>
            <span className="text-sm font-semibold text-ink">{t.displayName}</span>
          </div>
        )}
        <p className="mb-2 text-xs leading-relaxed text-ink-muted">{t.description}</p>
        <p className="mt-auto text-[11px] italic leading-snug text-ink-faint">{t.previewExample}</p>
      </div>
    </button>
  )
}

export default function AdTypeSelector({
  selected,
  onSelect,
}: {
  selected?: AdTypeId
  onSelect: (adType: AdTypeId) => void
}) {
  const rest = (AD_TYPE_ORDER as AdTypeId[]).filter(id => !POPULAR.includes(id))
  // Open expanded when the current selection is one of the hidden styles.
  const [expanded, setExpanded] = useState(() => !!selected && rest.includes(selected))

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {POPULAR.map(id => <Card key={id} id={id} selected={selected} onSelect={onSelect} />)}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(id => <Card key={id} id={id} selected={selected} onSelect={onSelect} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:border-fire-start/30 hover:text-ink"
      >
        {expanded ? 'Fewer styles' : `More styles (${rest.length})`}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

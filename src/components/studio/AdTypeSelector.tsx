/**
 * AdTypeSelector — the type-first entry point (spec Step 0). Renders all 12
 * engine ad types as visual cards. The chosen type is stored as the brief's
 * commercialStyle, and every downstream step (wizard questions, beats, camera,
 * prompts) reads from the matching AdTypeTemplate — nothing here is hardcoded,
 * it all comes from the engine's AD_TYPE_ORDER + getTemplate.
 */
import { AD_TYPE_ORDER, getTemplate } from '../../lib/studio/promptEngineBridge'
import type { AdTypeId } from '../../lib/studio/promptEngineBridge'

const ICON: Record<string, string> = {
  'user-voice': '🗣️', package: '📦', wrench: '🔧', sun: '☀️',
  'arrows-swap': '🔄', 'list-checks': '✅', microphone: '🎤', eye: '👁️',
  sparkle: '✨', columns: '⚖️', heart: '❤️', zap: '⚡',
}

export default function AdTypeSelector({
  selected,
  onSelect,
}: {
  selected?: AdTypeId
  onSelect: (adType: AdTypeId) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {AD_TYPE_ORDER.map((id) => {
        const t = getTemplate(id as AdTypeId)
        const isSel = selected === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id as AdTypeId)}
            aria-pressed={isSel}
            className={`group flex flex-col rounded-2xl border p-4 text-left transition ${
              isSel
                ? 'border-fire-start bg-fire-start/[0.07] shadow-[0_0_0_1px_rgba(255,107,53,0.4)]'
                : 'border-white/[0.08] bg-void-800 hover:border-white/[0.18] hover:bg-void-700/60'
            }`}
          >
            <div className="mb-2 flex items-center gap-2.5">
              <span className="text-2xl leading-none" aria-hidden>{ICON[t.icon] ?? '🎬'}</span>
              <span className="text-sm font-semibold text-ink">{t.displayName}</span>
            </div>
            <p className="mb-2 text-xs leading-relaxed text-ink-muted">{t.description}</p>
            <p className="mt-auto text-[11px] italic leading-snug text-ink-faint">{t.previewExample}</p>
          </button>
        )
      })}
    </div>
  )
}

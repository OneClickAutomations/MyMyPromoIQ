/**
 * DurationSlider — the premium gradient slider for picking a target video
 * length. Replaces the old "how many videos" mental model: the user thinks
 * in seconds, not clip counts, and the storyboard planner (server-side)
 * translates that into however many clips of whatever per-clip length the
 * video model actually supports — the user never has to know DoP's per-clip
 * limits exist.
 *
 * The live estimate shown under the track (≈N scenes · ~W words) is a rough
 * client-side preview using the same constants the server planner enforces
 * (api/director.ts CLIP_DURATIONS/WORDS_PER_SECOND) — the server plan is
 * always the authoritative one; this just sets expectations before generating.
 */
import { estimateClipCount, WORDS_PER_SECOND } from '../../lib/studio/storyboard'

const MIN = 15
const MAX = 60
const STEP = 5

function estimateWords(totalSeconds: number): number {
  return Math.round(totalSeconds * WORDS_PER_SECOND)
}

export default function DurationSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const pct = ((value - MIN) / (MAX - MIN)) * 100
  const clips = estimateClipCount(value)
  const words = estimateWords(value)

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-void-800 p-5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Video length</label>
        <span className="text-2xl font-extrabold tabular-nums text-fire-start">{value}s</span>
      </div>

      <div className="relative mt-4 h-2">
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-void-600" />
        {/* Fire-gradient fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-fire shadow-fire-soft transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* Glowing thumb */}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-gradient-fire shadow-fire-glow transition-all"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
          aria-label="Video length in seconds"
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-medium text-ink-faint">
        <span>{MIN}s</span>
        <span>{MAX}s</span>
      </div>

      <p className="mt-3 text-[11px] text-ink-muted">
        ≈ {clips} scene{clips === 1 ? '' : 's'} · ~{words} words spoken · Claude adapts the script and scene count to fit {value}s exactly.
      </p>
    </div>
  )
}

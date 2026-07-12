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
import { estimateClipCount, WORDS_PER_SECOND, MAX_CLIP_SECONDS } from '../../lib/studio/storyboard'

// Veo renders at most 8s per clip. The slider steps in whole-clip units so the
// on-screen length is always achievable: 8s = one generation (no stitching),
// 16s = two clips stitched, and so on. This is why "one video" can never be
// 30s — a single generation tops out at 8s.
const MIN = MAX_CLIP_SECONDS          // 8s — one clip
const MAX = MAX_CLIP_SECONDS * 8      // 64s — eight clips
const STEP = MAX_CLIP_SECONDS

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
        <span>{MIN}s · 1 clip</span>
        <span>{MAX}s · {MAX / MAX_CLIP_SECONDS} clips</span>
      </div>

      <p className="mt-3 text-[11px] text-ink-muted">
        {clips === 1
          ? `One clip, up to ${MAX_CLIP_SECONDS}s — a single generation, no stitching. ~${words} words spoken.`
          : `${clips} clips of up to ${MAX_CLIP_SECONDS}s each, stitched into one ~${value}s ad · ~${words} words spoken. Claude sizes the script to fit.`}
      </p>
    </div>
  )
}

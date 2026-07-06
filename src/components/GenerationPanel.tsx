/**
 * GenerationPanel — the video panel (Part 4).
 *
 * Ten slots, 2×5 on desktop / horizontal-scroll on mobile, one tile per clip.
 * Each tile owns its own state: waiting → generating (fire shimmer + the line
 * being spoken) → complete (hover-play video + download + remix) or failed
 * (one-tap retry, never a raw error string). A running header shows live totals.
 */
import { motion } from 'framer-motion'
import { Download, RefreshCw, Check } from './icons'
import { beatGlyph } from '../lib/studio/storyboard'
import type { QueuedClip } from '../lib/studio/useGenerationQueue'

function Tile({ tile, index, onRetry, onRemix, onDownload }: {
  tile: QueuedClip
  index: number
  onRetry: () => void
  onRemix: () => void
  onDownload: () => void
}) {
  return (
    <motion.div layout className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-void-900">
      <span className="absolute left-1.5 top-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">#{index + 1}</span>

      {tile.status === 'complete' && tile.videoUrl ? (
        <>
          {/* autoPlay (not just hover-to-play) — a hover-only preview never
              plays on touch devices, which read as "the video isn't there."
              The #t=0.1 first-frame hint is only appended to hosted URLs; a
              muxed clip is a huge data: URL and the fragment is pointless
              (and best kept off it). */}
          <video
            src={/^data:/i.test(tile.videoUrl!) ? tile.videoUrl : `${tile.videoUrl}#t=0.1`}
            muted loop autoPlay playsInline preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-1.5 right-1.5 flex gap-1">
            <button onClick={onRemix} title="Remix — regenerate this clip"
              className="grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white ring-1 ring-white/15 hover:bg-black/90">
              <RefreshCw className="h-3 w-3" />
            </button>
            <button onClick={onDownload} title="Download clip"
              className="grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white ring-1 ring-white/15 hover:bg-black/90">
              <Download className="h-3 w-3" />
            </button>
          </div>
          <span className="absolute left-1.5 bottom-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/90"><Check className="h-3 w-3 text-white" /></span>
        </>
      ) : tile.status === 'generating' ? (
        <div className="relative flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
          {/* fire-tinted shimmer */}
          <div className="pointer-events-none absolute inset-0 animate-pulse"
            style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(255,215,0,0.06) 60%, transparent)' }} />
          <RefreshCw className="relative h-5 w-5 animate-spin text-fire-start" />
          <p className="relative text-[10px] font-bold uppercase tracking-widest text-fire-start">{tile.beat}</p>
          <p className="relative line-clamp-4 px-1 text-[10px] leading-snug text-ink-muted">{tile.dialogue}</p>
          {tile.retryCount > 0 && <p className="relative text-[9px] text-amber-300">retry {tile.retryCount}</p>}
        </div>
      ) : tile.status === 'failed' ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300">{tile.beat}</p>
          <p className="text-[10px] text-ink-faint">Couldn’t render</p>
          <button onClick={onRetry} className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/25">Retry</button>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-void-800 text-base">{beatGlyph(tile.beat)}</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{tile.beat}</p>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-faint/50" />
        </div>
      )}
    </motion.div>
  )
}

export default function GenerationPanel({
  tiles, running, completedCount, onRetry, onRemix, onDownload,
}: {
  tiles: QueuedClip[]
  running: boolean
  completedCount: number
  onRetry: (clipId: string) => void
  onRemix: (clipId: string) => void
  onDownload: (url: string) => void
}) {
  const activeIndex = tiles.findIndex(t => t.status === 'generating')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        {running && <RefreshCw className="h-4 w-4 animate-spin text-fire-start" />}
        <p className="text-sm font-semibold text-ink">
          {running
            ? <>Generating {activeIndex >= 0 ? activeIndex + 1 : completedCount} of {tiles.length} — {completedCount} complete</>
            : <>{completedCount} of {tiles.length} clips complete</>}
        </p>
      </div>

      {/* 10-slot panel: 2 cols on mobile → 5 across on desktop (2 rows = 10) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <Tile
            key={t.clipId}
            tile={t}
            index={i}
            onRetry={() => onRetry(t.clipId)}
            onRemix={() => onRemix(t.clipId)}
            onDownload={() => t.videoUrl && onDownload(t.videoUrl)}
          />
        ))}
      </div>
    </div>
  )
}

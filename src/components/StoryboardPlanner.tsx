/**
 * StoryboardPlanner — the single most important screen in Ad Forge.
 *
 * The whole creative plan on one screen: every clip visible at once, editable
 * inline, no step-by-step wizard. Cross between a film production doc and a
 * CapCut timeline. The user adjusts, hears it, and hits Generate — done.
 *
 * Controlled: the parent owns the plan and handles generation (Part 4 queue).
 */
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check, RefreshCw, Trash, Plus, PlayIcon, X, ChevronRight, Bolt, Spark,
} from './icons'
import {
  type StoryboardPlan, type StoryboardClip,
  MIN_CLIPS, MAX_CLIPS, maxWords, countWords, wordFit, beatGlyph, recomputeTotals,
} from '../lib/studio/storyboard'
import { generateVoiceover, listVoices } from '../lib/api'

const FIT_STYLES: Record<'fits' | 'tight' | 'over', string> = {
  fits:  'text-emerald-300',
  tight: 'text-amber-300',
  over:  'text-rose-400',
}

function reindex(clips: StoryboardClip[]): StoryboardClip[] {
  return clips.map((c, i) => ({ ...c, order: i + 1 }))
}

// ── One clip card ─────────────────────────────────────────────────────────────
function ClipCard({
  clip, index, total, selected, onToggleSelect, onPatch, onLock, onRegen, onDuplicate, onDelete, onMove, regenerating,
}: {
  clip: StoryboardClip
  index: number
  total: number
  selected: boolean
  onToggleSelect: () => void
  onPatch: (u: Partial<StoryboardClip>) => void
  onLock: () => void
  onRegen: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  regenerating: boolean
}) {
  const cap = maxWords(clip.durationSeconds)
  const used = countWords(clip.dialogue)
  const fit = wordFit(clip.dialogue, clip.durationSeconds)

  return (
    <div className={`relative flex w-full flex-shrink-0 flex-col rounded-2xl border bg-[#161618] p-5 transition-colors lg:w-[320px] ${
      clip.locked ? 'border-gold/40' : selected ? 'border-fire-start/50' : 'border-white/10'
    }`}>
      {regenerating && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-ink"><RefreshCw className="h-4 w-4 animate-spin text-fire-start" /> Rewriting…</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-void-900 text-sm">{beatGlyph(clip.beat)}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-fire-start">{clip.beat}</p>
            <p className="text-[11px] text-ink-faint">Clip {index + 1} of {total}</p>
          </div>
        </div>
        <button
          onClick={onToggleSelect}
          className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${selected ? 'border-fire-start bg-fire-start text-white' : 'border-white/20 text-transparent hover:border-white/40'}`}
          title="Select for partial generation"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>

      {/* Duration + word budget */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => {
            const next = clip.durationSeconds >= 8 ? 4 : clip.durationSeconds + 1
            onPatch({ durationSeconds: next })
          }}
          className="rounded-lg bg-void-900 px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-white/10 hover:ring-fire-start/40"
          title="Tap to change duration"
        >
          {clip.durationSeconds}s
        </button>
        <span className={`text-[11px] font-semibold tabular-nums ${FIT_STYLES[fit]}`}>
          {used}/{cap} words {fit === 'over' ? '· over' : fit === 'tight' ? '· full' : '· fits'}
        </span>
      </div>

      {/* Visual description */}
      <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-ink-faint">Visual</label>
      <textarea
        value={clip.visualDescription}
        onChange={e => onPatch({ visualDescription: e.target.value })}
        rows={3}
        placeholder="What's physically in frame…"
        className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-void-900 px-2.5 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none"
      />

      {/* Dialogue */}
      <label className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-faint">
        Dialogue
        <span className={`normal-case ${FIT_STYLES[fit]}`}>{used}/{cap}</span>
      </label>
      <textarea
        value={clip.dialogue}
        onChange={e => onPatch({ dialogue: e.target.value, wordCount: countWords(e.target.value) })}
        rows={2}
        placeholder="The exact words spoken…"
        className={`mt-1 w-full resize-none rounded-lg border bg-void-900 px-2.5 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none ${
          fit === 'over' ? 'border-rose-400/50 focus:border-rose-400' : 'border-white/10 focus:border-fire-start/40'
        }`}
      />

      {/* Controls */}
      <div className="mt-4 flex items-center gap-1 border-t border-white/[0.06] pt-3">
        <button onClick={onLock} title={clip.locked ? 'Unlock' : 'Lock (keeps this clip on regenerate all)'}
          className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${clip.locked ? 'bg-gold/15 text-gold' : 'text-ink-faint hover:bg-white/[0.06] hover:text-ink'}`}>
          {clip.locked ? <span className="text-xs">🔒</span> : <span className="text-xs">🔓</span>}
        </button>
        <button onClick={onRegen} disabled={clip.locked} title="Regenerate this clip"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-30">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDuplicate} title="Duplicate"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} title="Delete" disabled={total <= 1}
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-red-600/20 hover:text-rose-300 disabled:opacity-30">
          <Trash className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1" />
        <button onClick={() => onMove(-1)} disabled={index === 0} title="Move earlier"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-30 rotate-180">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move later"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function StoryboardPlanner({
  plan, onChange, onGenerate, onRegenClip, regeneratingOrder = null,
  clipCountBusy = false, onClipCountChange, creditsPerClip = 1,
}: {
  plan: StoryboardPlan
  onChange: (plan: StoryboardPlan) => void
  onGenerate: (clips: StoryboardClip[]) => void
  onRegenClip?: (clip: StoryboardClip) => void
  regeneratingOrder?: number | null
  clipCountBusy?: boolean
  onClipCountChange?: (n: number) => void
  creditsPerClip?: number
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewing, setPreviewing] = useState(false)
  const [previewErr, setPreviewErr] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const clips = plan.clips
  const total = useMemo(() => recomputeTotals(clips), [clips])
  const isOver = (c: StoryboardClip) => wordFit(c.dialogue, c.durationSeconds) === 'over'
  const anyOver = clips.some(isOver)

  function setClips(next: StoryboardClip[]) {
    const reindexed = reindex(next)
    onChange({ ...plan, clips: reindexed, clipCount: reindexed.length, totalEstimatedDurationSeconds: recomputeTotals(reindexed) })
  }
  function patchClip(id: string, u: Partial<StoryboardClip>) {
    setClips(clips.map(c => (c.id === id ? { ...c, ...u } : c)))
  }
  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function previewScript() {
    if (previewing) { audioRef.current?.pause(); setPreviewing(false); return }
    const script = clips.map(c => c.dialogue).filter(Boolean).join(' … ')
    if (!script.trim()) { setPreviewErr('No dialogue to preview yet.'); return }
    setPreviewErr(''); setPreviewing(true)
    try {
      const { voices } = await listVoices()
      const voiceId = voices[0]?.voiceId
      if (!voiceId) throw new Error('No preview voice available.')
      const { audioDataUrl } = await generateVoiceover({ text: script.slice(0, 900), voiceId })
      const audio = new Audio(audioDataUrl)
      audioRef.current = audio
      audio.onended = () => setPreviewing(false)
      await audio.play()
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : 'Preview failed.')
      setPreviewing(false)
    }
  }

  const selectedClips = clips.filter(c => selected.has(c.id))
  const generateCount = selectedClips.length || clips.length
  // Block generation of a set that contains an over-budget clip — an
  // over-budget line either gets rushed or trimmed, so it's a defect to fix
  // (edit the dialogue or split the clip), not to ship. Scoped to the exact
  // set being generated so it stays recoverable.
  const effectiveSet = selectedClips.length ? selectedClips : clips
  const effectiveOver = effectiveSet.some(isOver)
  const selectedOver = selectedClips.some(isOver)

  return (
    <div className="space-y-5">
      {/* Above the cards */}
      <div className="rounded-2xl border border-white/10 bg-void-800/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">Storyboard</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              ~{total} seconds across {clips.length} clip{clips.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={previewScript} className="btn-ghost gap-1.5 px-3.5 py-2 text-sm">
            {previewing ? <X className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            {previewing ? 'Stop preview' : 'Preview script'}
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-fire-start/[0.06] px-3.5 py-2.5">
          <Spark className="mt-0.5 h-4 w-4 flex-shrink-0 text-fire-start" />
          <p className="text-xs leading-relaxed text-ink-muted">{plan.reasoning}</p>
        </div>

        {/* Clip-count selector */}
        {onClipCountChange && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-semibold text-ink-faint">Clips</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onClipCountChange(Math.max(MIN_CLIPS, clips.length - 1))}
                disabled={clipCountBusy || clips.length <= MIN_CLIPS}
                className="grid h-7 w-7 place-items-center rounded-lg bg-void-900 text-ink ring-1 ring-white/10 hover:ring-fire-start/40 disabled:opacity-30"
              >–</button>
              <span className="w-8 text-center text-sm font-bold tabular-nums text-ink">
                {clipCountBusy ? <RefreshCw className="mx-auto h-3.5 w-3.5 animate-spin text-fire-start" /> : clips.length}
              </span>
              <button
                onClick={() => onClipCountChange(Math.min(MAX_CLIPS, clips.length + 1))}
                disabled={clipCountBusy || clips.length >= MAX_CLIPS}
                className="grid h-7 w-7 place-items-center rounded-lg bg-void-900 text-ink ring-1 ring-white/10 hover:ring-fire-start/40 disabled:opacity-30"
              >+</button>
            </div>
            <span className="text-[11px] text-ink-faint">Claude recommends {plan.recommendedClipCount}</span>
          </div>
        )}
        {previewErr && <p className="mt-2 text-xs text-amber-300">{previewErr}</p>}
      </div>

      {/* Clip cards — horizontal scroll on desktop, stack on mobile */}
      <div className="flex flex-col gap-3 lg:flex-row lg:overflow-x-auto lg:pb-2">
        <AnimatePresence initial={false}>
          {clips.map((clip, i) => (
            <motion.div key={clip.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <ClipCard
                clip={clip} index={i} total={clips.length}
                selected={selected.has(clip.id)}
                onToggleSelect={() => toggleSelect(clip.id)}
                onPatch={u => patchClip(clip.id, u)}
                onLock={() => patchClip(clip.id, { locked: !clip.locked })}
                onRegen={() => onRegenClip?.(clip)}
                onDuplicate={() => {
                  const copy = { ...clip, id: `clip_${Date.now()}`, locked: false }
                  const idx = clips.findIndex(c => c.id === clip.id)
                  setClips([...clips.slice(0, idx + 1), copy, ...clips.slice(idx + 1)])
                }}
                onDelete={() => setClips(clips.filter(c => c.id !== clip.id))}
                onMove={dir => {
                  const idx = clips.findIndex(c => c.id === clip.id)
                  const j = idx + dir
                  if (j < 0 || j >= clips.length) return
                  const next = [...clips]
                  ;[next[idx], next[j]] = [next[j], next[idx]]
                  setClips(next)
                }}
                regenerating={regeneratingOrder === clip.order}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-2xl border border-white/10 bg-void-900/90 p-4 backdrop-blur">
        {anyOver && (
          <p className="mb-2.5 text-xs text-rose-300">
            {effectiveOver
              ? 'A clip in this set is over its word budget — trim the red clip(s) above (or split into more clips) before generating.'
              : 'Some clips are over their word budget. They\'re excluded from your current selection, but trim them before generating those.'}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {selectedClips.length > 0
              ? <>Generating <span className="font-bold text-ink">{selectedClips.length}</span> selected clip{selectedClips.length === 1 ? '' : 's'}</>
              : <>Generating all <span className="font-bold text-ink">{clips.length}</span> clips</>}
            {' · '}~{generateCount * creditsPerClip} credits
          </p>
          <div className="flex items-center gap-2">
            {selectedClips.length > 0 && (
              <button onClick={() => onGenerate(selectedClips)} disabled={selectedOver} title={selectedOver ? 'A selected clip is over its word budget' : undefined} className="btn-ghost gap-1.5 px-4 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                <Bolt className="h-4 w-4" /> Generate selected ({selectedClips.length})
              </button>
            )}
            <button onClick={() => onGenerate(effectiveSet)} disabled={effectiveOver} title={effectiveOver ? 'A clip in this set is over its word budget — trim it first' : undefined} className="btn-fire gap-1.5 px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              <Bolt className="h-4 w-4" /> Generate {selectedClips.length ? 'selected' : 'all clips'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

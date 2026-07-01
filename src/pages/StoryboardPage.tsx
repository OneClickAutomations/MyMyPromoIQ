/**
 * StoryboardPage — hosts the Storyboard Planner and drives generation.
 *
 * Route: /forge/storyboard
 * Reads a storyboard context (product + style + optional clone reference) from
 * sessionStorage, asks Claude for a clip plan, lets the user shape it on one
 * screen, then fires the clips and assembles them into one commercial.
 *
 * The multi-clip render here is the working core of the Generation Queue; the
 * full 10-slot panel polish is tracked as Part 4.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import StoryboardPlanner from '../components/StoryboardPlanner'
import { Film, RefreshCw, Download, Check, X, Layers, ArrowRight } from '../components/icons'
import {
  planStoryboard, startGeneration, pollUntilDone, stitchVideos,
} from '../lib/api'
import type { StoryboardPlan, StoryboardClip } from '../lib/studio/storyboard'

const CTX_KEY = 'promoiq_storyboard_ctx'

export interface StoryboardContext {
  product: { name: string; description: string; primaryImage: string }
  style: string
  referenceBeats?: string[]
  referenceDurationSeconds?: number
  brandVoice?: string
  cta?: string
}

type Phase = 'planning' | 'plan' | 'rendering' | 'error'
type TileStatus = 'waiting' | 'generating' | 'complete' | 'failed'
interface Tile { clip: StoryboardClip; status: TileStatus; videoUrl?: string }

export default function StoryboardPage() {
  const navigate = useNavigate()
  const [ctx, setCtx] = useState<StoryboardContext | null>(null)
  const [phase, setPhase] = useState<Phase>('planning')
  const [plan, setPlan] = useState<StoryboardPlan | null>(null)
  const [error, setError] = useState('')
  const [clipCountBusy, setClipCountBusy] = useState(false)
  const [regenOrder, setRegenOrder] = useState<number | null>(null)

  // Render state
  const [tiles, setTiles] = useState<Tile[]>([])
  const [assembling, setAssembling] = useState(false)
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null)
  const cancelRef = useRef(false)

  // Load context + plan the first storyboard.
  useEffect(() => {
    let raw: string | null = null
    try { raw = sessionStorage.getItem(CTX_KEY) } catch { /* ignore */ }
    if (!raw) { setPhase('error'); setError('No product context found. Start from Ad Forge.'); return }
    let parsed: StoryboardContext
    try { parsed = JSON.parse(raw) } catch { setPhase('error'); setError('Could not read the storyboard context.'); return }
    setCtx(parsed)
    runPlan(parsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runPlan(c: StoryboardContext, clipCount?: number) {
    setPhase('planning'); setError('')
    try {
      const { plan } = await planStoryboard({
        productName: c.product.name,
        description: c.product.description || c.product.name,
        style: c.style,
        clipCount,
        referenceBeats: c.referenceBeats,
        referenceDurationSeconds: c.referenceDurationSeconds,
        brandVoice: c.brandVoice,
        cta: c.cta,
      })
      setPlan(plan)
      setPhase('plan')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the storyboard.')
      setPhase('error')
    }
  }

  async function changeClipCount(n: number) {
    if (!ctx) return
    setClipCountBusy(true)
    try { await runPlan(ctx, n) } finally { setClipCountBusy(false) }
  }

  async function regenClip(clip: StoryboardClip) {
    if (!ctx || !plan) return
    setRegenOrder(clip.order)
    try {
      const { plan: one } = await planStoryboard({
        productName: ctx.product.name,
        description: ctx.product.description || ctx.product.name,
        style: ctx.style,
        clipCount: 1,
        referenceBeats: [clip.beat],
        brandVoice: ctx.brandVoice,
        cta: ctx.cta,
      })
      const fresh = one.clips[0]
      if (fresh) {
        const merged: StoryboardClip = { ...fresh, id: clip.id, order: clip.order, durationSeconds: clip.durationSeconds, beat: clip.beat, locked: false }
        setPlan({ ...plan, clips: plan.clips.map(c => (c.id === clip.id ? merged : c)) })
      }
    } catch { /* leave clip as-is */ }
    finally { setRegenOrder(null) }
  }

  async function generate(clips: StoryboardClip[]) {
    if (!ctx) return
    cancelRef.current = false
    setPhase('rendering')
    setAssembledUrl(null)
    const initial: Tile[] = clips.map(clip => ({ clip, status: 'waiting' }))
    setTiles(initial)

    // Fire clips sequentially (Veo maxConcurrent = 1). Auto-advance on complete.
    for (let i = 0; i < clips.length; i++) {
      if (cancelRef.current) break
      const clip = clips[i]
      setTiles(prev => prev.map((t, idx) => (idx === i ? { ...t, status: 'generating' } : t)))
      try {
        const { requestId } = await startGeneration({
          productImageUrl: ctx.product.primaryImage,
          productDescription: ctx.product.description || ctx.product.name,
          style: ctx.style,
          quality: 'turbo',
          sceneLabel: clip.beat,
          script: clip.dialogue,
          brandVoice: ctx.brandVoice,
          brandCta: ctx.cta,
        })
        const res = await pollUntilDone(requestId, () => {})
        setTiles(prev => prev.map((t, idx) => (idx === i
          ? { ...t, status: res.status === 'completed' && res.videoUrl ? 'complete' : 'failed', videoUrl: res.videoUrl ?? undefined }
          : t)))
      } catch {
        setTiles(prev => prev.map((t, idx) => (idx === i ? { ...t, status: 'failed' } : t)))
      }
    }
  }

  async function retryTile(index: number) {
    if (!ctx) return
    const tile = tiles[index]
    setTiles(prev => prev.map((t, idx) => (idx === index ? { ...t, status: 'generating' } : t)))
    try {
      const { requestId } = await startGeneration({
        productImageUrl: ctx.product.primaryImage,
        productDescription: ctx.product.description || ctx.product.name,
        style: ctx.style, quality: 'turbo', sceneLabel: tile.clip.beat, script: tile.clip.dialogue,
      })
      const res = await pollUntilDone(requestId, () => {})
      setTiles(prev => prev.map((t, idx) => (idx === index
        ? { ...t, status: res.status === 'completed' && res.videoUrl ? 'complete' : 'failed', videoUrl: res.videoUrl ?? undefined }
        : t)))
    } catch {
      setTiles(prev => prev.map((t, idx) => (idx === index ? { ...t, status: 'failed' } : t)))
    }
  }

  async function assemble() {
    const urls = tiles.filter(t => t.status === 'complete' && t.videoUrl).map(t => t.videoUrl!)
    if (urls.length < 1) return
    setAssembling(true)
    try {
      const { videoDataUrl } = await stitchVideos(urls)
      setAssembledUrl(videoDataUrl)
    } catch { /* keep individual clips available */ }
    finally { setAssembling(false) }
  }

  const doneCount = tiles.filter(t => t.status === 'complete').length
  const allSettled = tiles.length > 0 && tiles.every(t => t.status === 'complete' || t.status === 'failed')

  return (
    <AppShell>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
        <Link to="/forge" className="hover:text-ink transition-colors">Ad Forge</Link>
        <span className="text-ink-faint">/</span>
        <span className="text-ink">Storyboard</span>
      </div>

      {phase === 'planning' && (
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-void-800/50 p-10 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-fire-start" />
          <h2 className="mt-4 text-lg font-bold text-ink">Planning your commercial…</h2>
          <p className="mt-1.5 text-sm text-ink-muted">Claude is breaking this into scroll-stopping clips, each timed to speak clean.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-white/12 p-10 text-center">
          <Film className="mx-auto h-8 w-8 text-ink-faint/50" />
          <h2 className="mt-4 text-lg font-bold text-ink">Nothing to storyboard yet</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-muted">{error}</p>
          <Link to="/forge" className="btn-fire mx-auto mt-6 inline-flex gap-2"><ArrowRight className="h-4 w-4" /> Go to Ad Forge</Link>
        </div>
      )}

      {phase === 'plan' && plan && (
        <StoryboardPlanner
          plan={plan}
          onChange={setPlan}
          onGenerate={generate}
          onRegenClip={regenClip}
          regeneratingOrder={regenOrder}
          clipCountBusy={clipCountBusy}
          onClipCountChange={changeClipCount}
        />
      )}

      {phase === 'rendering' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-ink">Rendering your commercial</h1>
              <p className="mt-0.5 text-sm text-ink-muted">{doneCount} of {tiles.length} clips complete</p>
            </div>
            <button onClick={() => { cancelRef.current = true; setPhase('plan') }} className="btn-ghost gap-1.5 px-3.5 py-2 text-sm">
              <X className="h-4 w-4" /> Back to storyboard
            </button>
          </div>

          {/* Tile grid — 2 columns, scales toward the Part 4 10-slot panel */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t, i) => (
              <motion.div key={t.clip.id} layout className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-void-900">
                {t.status === 'complete' && t.videoUrl ? (
                  <video src={`${t.videoUrl}#t=0.1`} muted loop playsInline preload="metadata"
                    className="h-full w-full object-cover"
                    onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center">
                    {t.status === 'generating' && <RefreshCw className="h-5 w-5 animate-spin text-fire-start" />}
                    {t.status === 'waiting' && <span className="h-2 w-2 animate-pulse rounded-full bg-ink-faint/50" />}
                    {t.status === 'failed' && (
                      <button onClick={() => retryTile(i)} className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 ring-1 ring-rose-400/30">Retry</button>
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">{t.clip.beat}</p>
                    <p className="line-clamp-3 px-1 text-[10px] leading-snug text-ink-muted">{t.clip.dialogue}</p>
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">#{i + 1}</span>
                {t.status === 'complete' && t.videoUrl && (
                  <a href={t.videoUrl} download target="_blank" rel="noreferrer"
                    className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white ring-1 ring-white/15 hover:bg-black/90">
                    <Download className="h-3 w-3" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>

          {/* Assemble prompt */}
          {allSettled && doneCount >= 1 && !assembledUrl && (
            <div className="rounded-2xl border border-fire-start/20 bg-fire-start/[0.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-fire-start" />
                  <p className="text-sm font-semibold text-ink">
                    You have {doneCount}/{tiles.length} clips — assemble into one ~{tiles.filter(t => t.status === 'complete').reduce((s, t) => s + t.clip.durationSeconds, 0)}-second commercial?
                  </p>
                </div>
                <button onClick={assemble} disabled={assembling} className="btn-fire gap-1.5 px-5 py-2.5 text-sm disabled:opacity-50">
                  {assembling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  {assembling ? 'Assembling…' : 'Assemble commercial'}
                </button>
              </div>
            </div>
          )}

          {assembledUrl && (
            <div className="rounded-2xl border border-white/10 bg-void-800/50 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Check className="h-4 w-4" /> Commercial assembled
              </div>
              <video src={assembledUrl} controls playsInline className="mx-auto max-h-[70vh] rounded-xl" />
              <div className="mt-3 flex justify-center gap-2">
                <a href={assembledUrl} download="commercial.mp4" className="btn-fire gap-1.5 px-5 py-2.5 text-sm">
                  <Download className="h-4 w-4" /> Download commercial
                </a>
                <button onClick={() => navigate('/history')} className="btn-ghost px-4 py-2.5 text-sm">Go to History</button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}

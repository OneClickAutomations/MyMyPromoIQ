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
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import StoryboardPlanner from '../components/StoryboardPlanner'
import GenerationPanel from '../components/GenerationPanel'
import CreatorInput, { EMPTY_CREATOR, isCreatorReady, type CreatorInputValue } from '../components/CreatorInput'
import { loadBrandProfile } from '../components/BrandVoiceSetup'
import { Film, RefreshCw, Download, Check, X, Layers, ArrowRight } from '../components/icons'
import {
  planStoryboard, startGeneration, pollUntilDone, stitchVideos,
} from '../lib/api'
import { useGenerationQueue } from '../lib/studio/useGenerationQueue'
import type { StoryboardPlan, StoryboardClip } from '../lib/studio/storyboard'

/** Cross-origin-safe download: fetch → blob → click (the `download` attr is
 * ignored for cross-origin URLs like Veo/CDN renders). */
async function downloadVideo(url: string, name = `clip-${Date.now()}.mp4`) {
  try {
    const blob = await (await fetch(url)).blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 8000)
  } catch { window.open(url, '_blank', 'noopener') }
}

const CTX_KEY = 'promoiq_storyboard_ctx'

export interface StoryboardContext {
  product: { name: string; description: string; primaryImage: string }
  style: string
  referenceBeats?: string[]
  referenceDurationSeconds?: number
  brandVoice?: string
  cta?: string
}

type Phase = 'creator' | 'planning' | 'plan' | 'rendering' | 'error'

export default function StoryboardPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [ctx, setCtx] = useState<StoryboardContext | null>(null)
  const [phase, setPhase] = useState<Phase>('creator')
  const [plan, setPlan] = useState<StoryboardPlan | null>(null)
  const [error, setError] = useState('')
  const [clipCountBusy, setClipCountBusy] = useState(false)
  const [regenOrder, setRegenOrder] = useState<number | null>(null)

  // Bring Your Own Creator (Task A) — Clone had no creator step at all before;
  // this gives it the same three-way choice as the other two modes.
  const [creatorValue, setCreatorValue] = useState<CreatorInputValue>(EMPTY_CREATOR)

  // Generation queue (Part 4) — worker pool with auto-retry + auto-advance.
  const queue = useGenerationQueue(1, 1)
  const [assembling, setAssembling] = useState(false)
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null)

  // Load context + plan the first storyboard.
  useEffect(() => {
    let raw: string | null = null
    try { raw = sessionStorage.getItem(CTX_KEY) } catch { /* ignore */ }
    if (!raw) { setPhase('error'); setError('No product context found. Start from Ad Forge.'); return }
    let parsed: StoryboardContext
    try { parsed = JSON.parse(raw) } catch { setPhase('error'); setError('Could not read the storyboard context.'); return }
    // Merge the saved brand voice / CTA so every plan is calibrated to the brand
    // (skipped brands just fall through to neutral defaults).
    ;(async () => {
      if (user?.id && (!parsed.brandVoice || !parsed.cta)) {
        const profile = await loadBrandProfile(user.id).catch(() => null)
        if (profile) {
          parsed = {
            ...parsed,
            brandVoice: parsed.brandVoice || profile.brandVoice || undefined,
            cta: parsed.cta || profile.cta || undefined,
          }
        }
      }
      setCtx(parsed)
      setPhase('creator')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function proceedToStoryboard() {
    if (!ctx || !isCreatorReady(creatorValue)) return
    runPlan(ctx)
  }

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
        // Bring Your Own Creator: an uploaded/saved photo is a fixed real
        // person — tell the planner to stay neutral so it doesn't invent a
        // gender/appearance that contradicts the photo Veo conditions on.
        creator: creatorValue.mode !== 'generated' && creatorValue.resolvedImageUrl
          ? { source: 'uploaded' }
          : undefined,
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

  // Turn one storyboard clip into a hosted video URL (throws on failure so the
  // queue's retry logic can catch it).
  async function generateOne(clip: StoryboardClip): Promise<string> {
    if (!ctx) throw new Error('no context')
    // Bring Your Own Creator: the resolved photo (as-is or transformed) becomes
    // Veo's identity reference, taking priority over the product photo.
    const creatorImageUrl = creatorValue.mode !== 'generated' ? creatorValue.resolvedImageUrl || undefined : undefined
    const { requestId } = await startGeneration({
      productImageUrl: ctx.product.primaryImage,
      productDescription: ctx.product.description || ctx.product.name,
      style: ctx.style,
      quality: 'turbo',
      sceneLabel: clip.beat,
      script: clip.dialogue,
      brandVoice: ctx.brandVoice,
      brandCta: ctx.cta,
      creatorImageUrl,
      creatorConsentAt: creatorImageUrl ? creatorValue.consentAt : undefined,
      // Continuity across the multi-clip commercial.
      sceneIndex: clip.order,
      sceneCount: plan?.clips.length,
    })
    const res = await pollUntilDone(requestId, () => {})
    if (res.status === 'completed' && res.videoUrl) return res.videoUrl
    throw new Error(res.raw || 'render failed')
  }

  function generate(clips: StoryboardClip[]) {
    if (!ctx) return
    setAssembledUrl(null)
    setPhase('rendering')
    void queue.run(clips, generateOne)
  }

  function retryClip(clipId: string) {
    const clip = plan?.clips.find(c => c.id === clipId)
    if (clip) void queue.retryOne(clip, generateOne)
  }

  async function assemble() {
    const urls = queue.tiles.filter(t => t.status === 'complete' && t.videoUrl).map(t => t.videoUrl!)
    if (urls.length < 1) return
    setAssembling(true)
    try {
      const { videoDataUrl } = await stitchVideos(urls)
      setAssembledUrl(videoDataUrl)
    } catch { /* keep individual clips available */ }
    finally { setAssembling(false) }
  }

  const doneSeconds = queue.tiles.filter(t => t.status === 'complete').reduce((s, t) => s + t.durationSeconds, 0)

  return (
    <AppShell>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
        <Link to="/forge" className="hover:text-ink transition-colors">Ad Forge</Link>
        <span className="text-ink-faint">/</span>
        <span className="text-ink">Storyboard</span>
      </div>

      {phase === 'creator' && ctx && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">Cast your creator</h1>
            <p className="mt-1.5 text-sm text-ink-muted">Let AI cast one, reuse a saved creator, or bring your own — then we'll storyboard the clone around them.</p>
          </div>
          <CreatorInput value={creatorValue} onChange={setCreatorValue} />
          <button onClick={proceedToStoryboard} disabled={!isCreatorReady(creatorValue)} className="btn-fire w-full gap-1.5 disabled:opacity-40">
            Continue to storyboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

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
              <p className="mt-0.5 text-sm text-ink-muted">The queue keeps one clip rendering and fires the next automatically.</p>
            </div>
            <button onClick={() => { queue.cancel(); setPhase('plan') }} className="btn-ghost gap-1.5 px-3.5 py-2 text-sm">
              <X className="h-4 w-4" /> Back to storyboard
            </button>
          </div>

          <GenerationPanel
            tiles={queue.tiles}
            running={queue.running}
            completedCount={queue.completedCount}
            onRetry={retryClip}
            onRemix={retryClip}
            onDownload={url => downloadVideo(url)}
          />

          {/* Assemble prompt — explicit, one-tap (not automatic) */}
          {queue.allSettled && queue.completedCount >= 1 && !assembledUrl && (
            <div className="rounded-2xl border border-fire-start/20 bg-fire-start/[0.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-fire-start" />
                  <p className="text-sm font-semibold text-ink">
                    You have {queue.completedCount}/{queue.total} clips — assemble into one ~{doneSeconds}-second commercial?
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

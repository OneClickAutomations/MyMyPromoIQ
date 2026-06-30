import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import AppShell from '../components/AppShell'
import { ArrowRight, Check, Download, RefreshCw, Wand, Spark } from '../components/icons'
import { startGeneration, pollUntilDone, saveCampaign, saveScene, type StatusResponse } from '../lib/api'
import type { ClonePrefill } from '../lib/discovery/types'
import { adForge } from '../copy'

const CLONE_PREFILL_KEY = 'promoiq_clone_prefill'

const STYLE_OPTIONS = [
  { id: 'testimonial',  label: 'Testimonial',      hint: 'Creator to camera' },
  { id: 'unboxing',     label: 'Unboxing',          hint: 'Tactile product reveal' },
  { id: 'day-in-life',  label: 'Day-in-the-life',   hint: 'Lifestyle b-roll' },
  { id: 'fast-cut',     label: 'Fast-cut hook',     hint: 'Scroll-stopping opener' },
]

// Map the wizard's rich style IDs back to the 4 canonical render styles
const STYLE_ID_MAP: Record<string, string> = {
  ugc_testimonial:   'testimonial',
  founder_story:     'testimonial',
  luxury_commercial: 'day-in-life',
  cinematic_brand:   'day-in-life',
  fast_cut_hook:     'fast-cut',
  unboxing:          'unboxing',
  explainer:         'unboxing',
}

function resolveStyleId(raw: string): string {
  if (STYLE_OPTIONS.find(s => s.id === raw)) return raw
  return STYLE_ID_MAP[raw] ?? 'testimonial'
}

function buildCreatorDescription(attrs: Record<string, string>): string {
  const parts: string[] = []
  if (attrs.gender) parts.push(attrs.gender)
  if (attrs.ageRange) parts.push(attrs.ageRange)
  if (attrs.ethnicity) parts.push(attrs.ethnicity)
  if (attrs.hair) parts.push(`${attrs.hair} hair`)
  if (attrs.wardrobe) parts.push(attrs.wardrobe)
  if (attrs.energyLevel) parts.push(`${attrs.energyLevel} energy`)
  if (attrs.cameraConfidence) parts.push(`${attrs.cameraConfidence} camera confidence`)
  return parts.join(', ')
}

type Phase = 'idle' | 'working' | 'done' | 'error'

const STEPS = [
  'Claude writing direction',
  'Submitting to Veo 3',
  'Rendering video (1-3 min)…',
]

export default function ReviewAndAdjust() {
  const { user } = useUser()
  const [prefill, setPrefill] = useState<ClonePrefill | null>(null)

  const [productImageUrl, setProductImageUrl] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [style, setStyle] = useState('testimonial')
  const [script, setScript] = useState('')
  const [creatorDescription, setCreatorDescription] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Read prefill on mount, then clear it
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CLONE_PREFILL_KEY)
      if (raw) {
        const data = JSON.parse(raw) as ClonePrefill
        setPrefill(data)
        // Pre-fill fields from analysis
        const analysis = data.analysis
        setStyle(resolveStyleId(analysis.suggestedCommercialStyle))
        setScript(analysis.improvedScript ?? '')
        setCreatorDescription(buildCreatorDescription(analysis.suggestedCreatorAttributes as Record<string, string>))
        // If a sourced product has an image, pre-fill image URL
        if (data.sourcedProduct?.imageUrl) {
          setProductImageUrl(data.sourcedProduct.imageUrl)
        }
        if (data.sourcedProduct?.name) {
          setProductDescription(data.sourcedProduct.name)
        }
        // Clear so navigating back doesn't re-use stale analysis
        sessionStorage.removeItem(CLONE_PREFILL_KEY)
      }
    } catch {
      // sessionStorage unavailable or malformed JSON — start blank
    }
  }, [])

  async function handleGenerate() {
    if (!productImageUrl.trim()) {
      setErrorMsg('Provide a product image URL.')
      return
    }
    if (!productDescription.trim()) {
      setErrorMsg('Describe the product you are selling.')
      return
    }
    setErrorMsg('')
    setPhase('working')
    setStepIndex(0)
    setVideoUrl(null)

    try {
      setStepIndex(0) // "Claude writing direction"
      const { requestId, directorPrompt: dp } = await startGeneration({
        productImageUrl: productImageUrl.trim(),
        productDescription: productDescription.trim(),
        style,
        quality: 'turbo',
        script: script.trim() || undefined,
      })
      setDirectorPrompt(dp)
      setStepIndex(1) // "Submitting to Veo 3"

      setStepIndex(2) // "Rendering video"
      const result = await pollUntilDone(
        requestId,
        (s: StatusResponse) => {
          if (s.status === 'pending') setStepIndex(2)
        },
        { intervalMs: 7_000, timeoutMs: 10 * 60 * 1_000 },
      )

      if (result.status === 'completed' && result.videoUrl) {
        setVideoUrl(result.videoUrl)
        setPhase('done')
        // Save to history so it appears in Dashboard/History
        if (user?.id) {
          try {
            const { id: campaignId } = await saveCampaign(user.id, {
              name: productDescription.trim().slice(0, 80),
              product_image_url: productImageUrl.trim(),
              product_description: productDescription.trim(),
              style,
              quality: 'turbo',
              status: 'ready',
            })
            await saveScene(user.id, {
              campaign_id: campaignId,
              label: 'Main',
              style,
              order_index: 0,
              phase: 'done',
              request_id: requestId,
              director_prompt: dp,
              video_url: result.videoUrl,
            })
          } catch {
            // Non-blocking — video is still shown even if history save fails
          }
        }
      } else {
        setErrorMsg(result.raw || 'Video generation failed.')
        setPhase('error')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed.')
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('idle')
    setVideoUrl(null)
    setDirectorPrompt('')
    setErrorMsg('')
    setStepIndex(0)
  }

  const isFromClone = prefill !== null
  const isBusy = phase === 'working'

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/forge" className="text-xs font-semibold text-ink-faint hover:text-ink">
              ← Ad Forge
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-ink">{adForge.review.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isFromClone ? adForge.review.fromClone : adForge.review.fromBuild}
          </p>
        </div>

        {/* Differentiation notes (clone path only) */}
        {isFromClone && prefill.analysis.differentiationNotes && (
          <div className="rounded-xl border border-white/[0.07] bg-void-800/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold mb-2">What Claude changed</p>
            <p className="text-sm text-ink-muted">{prefill.analysis.differentiationNotes}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">
          {/* Product image URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Product image URL (public https://…)
              {isFromClone && productImageUrl && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <input
              value={productImageUrl}
              onChange={e => setProductImageUrl(e.target.value)}
              disabled={isBusy}
              placeholder="https://example.com/product.jpg"
              className="w-full rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Product description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              What are you selling?
              {isFromClone && productDescription && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <textarea
              value={productDescription}
              onChange={e => setProductDescription(e.target.value)}
              disabled={isBusy}
              rows={3}
              placeholder="A matte ceramic pour-over coffee dripper for slow mornings."
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Style picker */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Ad style
              {isFromClone && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setStyle(opt.id)}
                  className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                    style === opt.id
                      ? 'border-fire-start/50 bg-fire-start/[0.08] text-ink'
                      : 'border-white/[0.08] bg-void-800/60 text-ink-muted hover:border-white/20'
                  }`}
                >
                  <span className="text-sm font-semibold leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-ink-faint leading-snug">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Script / hook */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Script / hook
              {isFromClone && script && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              disabled={isBusy}
              rows={4}
              placeholder="The spoken line Claude will write verbatim into the Veo 3 prompt. Leave blank to let Claude improvise."
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Creator */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Creator
              {isFromClone && creatorDescription && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <textarea
              value={creatorDescription}
              onChange={e => setCreatorDescription(e.target.value)}
              disabled={isBusy}
              rows={2}
              placeholder="e.g. female, 25-35, high energy, casual wardrobe"
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-400">
            {errorMsg}
          </p>
        )}

        {/* Progress panel */}
        {phase === 'working' && (
          <div className="rounded-2xl border border-white/[0.07] bg-void-800/60 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Spark className="h-4 w-4 text-fire-start animate-pulse" />
              <p className="text-sm font-semibold text-ink">Generating your video…</p>
            </div>
            <div className="space-y-2">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border transition-all ${
                    i < stepIndex
                      ? 'border-fire-start bg-fire-start/20'
                      : i === stepIndex
                      ? 'border-fire-start/60 bg-fire-start/10 animate-pulse'
                      : 'border-white/10 bg-void-700'
                  }`}>
                    {i < stepIndex && <Check className="h-3 w-3 text-fire-start" />}
                    {i === stepIndex && <div className="h-1.5 w-1.5 rounded-full bg-fire-start" />}
                  </div>
                  <p className={`text-sm transition-all ${
                    i <= stepIndex ? 'text-ink' : 'text-ink-faint'
                  }`}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video result */}
        {phase === 'done' && videoUrl && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full"
              />
            </div>
            {directorPrompt && (
              <details className="rounded-xl border border-white/[0.06] bg-void-800/40 px-4 py-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  Director prompt
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{directorPrompt}</p>
              </details>
            )}
            <div className="flex gap-3">
              <a
                href={videoUrl}
                download
                className="btn-fire flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-800 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:border-white/20 hover:text-ink"
              >
                <RefreshCw className="h-4 w-4" />
                Generate again
              </button>
            </div>
          </div>
        )}

        {/* Error retry */}
        {phase === 'error' && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-800 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:border-white/20 hover:text-ink"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}

        {/* Generate CTA */}
        {(phase === 'idle') && (
          <button
            type="button"
            onClick={handleGenerate}
            className="btn-fire w-full justify-center gap-2"
          >
            <Wand className="h-4 w-4" />
            {adForge.review.generateCta}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </AppShell>
  )
}

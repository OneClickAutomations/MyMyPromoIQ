import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import { ArrowRight, Check, Download, RefreshCw, Spark, Wand } from '../components/icons'
import ProductInput, { type ProductInputValue } from '../components/ProductInput'
import CreatorInput, { EMPTY_CREATOR, isCreatorReady, type CreatorInputValue } from '../components/CreatorInput'
import type { CreatorAttributes } from '../lib/studio/types'
import { startGeneration, pollUntilDone, saveCampaign, saveScene, writeAdScript, type StatusResponse } from '../lib/api'
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

type Phase = 'idle' | 'working' | 'done' | 'error'

const STEPS = [
  'Claude writing direction',
  'Submitting to Higgsfield',
  'Rendering video (1-3 min)…',
]

/** Force-download a cross-origin video URL via a blob fetch. */
async function downloadVideo(url: string) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `promo-video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 8000)
  } catch {
    // Fallback: open in new tab if fetch fails (e.g. CORS restriction)
    window.open(url, '_blank', 'noopener')
  }
}

export default function ReviewAndAdjust() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [prefill, setPrefill] = useState<ClonePrefill | null>(null)

  const [productImageUrl, setProductImageUrl] = useState('')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productSourceUrl, setProductSourceUrl] = useState<string | undefined>(undefined)
  const [style, setStyle] = useState('testimonial')
  const [script, setScript] = useState('')
  const [creatorValue, setCreatorValue] = useState<CreatorInputValue>(EMPTY_CREATOR)

  // AI Magic script writer
  const [showScriptAI, setShowScriptAI] = useState(false)
  const [scriptNiche, setScriptNiche] = useState('')
  const [scriptGoal, setScriptGoal] = useState('')
  const [scriptTone, setScriptTone] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptAIError, setScriptAIError] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [historySaved, setHistorySaved] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Read prefill on mount, then clear it
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CLONE_PREFILL_KEY)
      if (raw) {
        const data = JSON.parse(raw) as ClonePrefill
        setPrefill(data)
        const analysis = data.analysis
        setStyle(resolveStyleId(analysis.suggestedCommercialStyle))
        setScript(analysis.improvedScript ?? '')
        const suggested = (analysis.suggestedCreatorAttributes ?? {}) as Record<string, string>
        setCreatorValue(prev => ({
          ...prev,
          mode: 'generated',
          attributes: {
            gender: suggested.gender ?? '', ageRange: suggested.ageRange ?? '', ethnicity: suggested.ethnicity ?? '',
            bodyType: '', hair: suggested.hair ?? '', wardrobe: suggested.wardrobe ?? '',
            expression: suggested.expression ?? '',
            energyLevel: (suggested.energyLevel as CreatorAttributes['energyLevel']) ?? 'medium',
            cameraConfidence: suggested.cameraConfidence ?? '',
          },
        }))
        // Pre-fill image: sourcedProduct.imageUrl is always set by Discovery now
        const imageUrl = data.sourcedProduct?.imageUrl || data.adImageUrl
        if (imageUrl) setProductImageUrl(imageUrl)
        // Pre-fill product description from the ad's product name.
        // For Quick Clone this IS what the user is selling; for Studio Clone
        // the user should replace it with their own product.
        if (data.sourcedProduct?.name) setProductDescription(data.sourcedProduct.name)
        sessionStorage.removeItem(CLONE_PREFILL_KEY)
      }
    } catch {
      // sessionStorage unavailable or malformed JSON — start blank
    }
  }, [])

  // Bridge the shared ProductInput to this page's flat generation fields.
  const productValue: ProductInputValue = {
    images: productImageUrl ? [productImageUrl] : [],
    primaryImage: productImageUrl,
    name: productName,
    description: productDescription,
    sourceUrl: productSourceUrl,
  }
  function onProductChange(v: ProductInputValue) {
    setProductImageUrl(v.primaryImage)
    setProductName(v.name)
    setProductDescription(v.description)
    setProductSourceUrl(v.sourceUrl)
  }

  async function handleWriteScript() {
    const effectiveDescription = productDescription.trim() || productName.trim()
    if (!effectiveDescription) {
      setScriptAIError('Add a product description first so Claude has something to work with.')
      return
    }
    setScriptAIError('')
    setScriptLoading(true)
    try {
      const creatorArg = creatorValue.mode === 'uploaded_seed'
        ? { source: 'uploaded' as const }
        : creatorValue.mode === 'generated' && creatorValue.attributes.gender
          ? {
              source: 'generated' as const,
              gender: creatorValue.attributes.gender,
              ageRange: creatorValue.attributes.ageRange,
              ethnicity: creatorValue.attributes.ethnicity,
            }
          : undefined
      const { script: generated } = await writeAdScript({
        productName: productName || undefined,
        description: effectiveDescription,
        style,
        niche: scriptNiche.trim() || undefined,
        goal: scriptGoal || undefined,
        tone: scriptTone || undefined,
        creator: creatorArg,
      })
      setScript(generated)
      setShowScriptAI(false)
    } catch (err) {
      setScriptAIError(err instanceof Error ? err.message : 'Script generation failed.')
    } finally {
      setScriptLoading(false)
    }
  }

  async function handleGenerate() {
    const effectiveDescription = (productDescription.trim() || productName.trim())
    if (!effectiveDescription) {
      setErrorMsg('Describe the product you are selling.')
      return
    }
    if (!isCreatorReady(creatorValue)) {
      setErrorMsg('Confirm you have the right to use this person\'s likeness before generating.')
      return
    }
    setErrorMsg('')
    setHistorySaved(false)
    setHistoryError('')
    setPhase('working')
    setStepIndex(0)
    setVideoUrl(null)

    // Bring Your Own Creator: the resolved photo (as-is or transformed) becomes
    // Veo's identity reference, taking priority over the product photo.
    const creatorImageUrl = creatorValue.mode !== 'generated' ? creatorValue.resolvedImageUrl || undefined : undefined

    try {
      setStepIndex(0) // "Claude writing direction"
      const { requestId, directorPrompt: dp } = await startGeneration({
        productImageUrl: productImageUrl.trim(),
        productDescription: effectiveDescription,
        style,
        quality: 'turbo',
        script: script.trim() || undefined,
        creatorImageUrl,
        creatorConsentAt: creatorImageUrl ? creatorValue.consentAt : undefined,
      })
      setDirectorPrompt(dp)
      setStepIndex(1) // "Submitting to Higgsfield"

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

        // Save to history
        if (user?.id) {
          try {
            const { id: campaignId } = await saveCampaign(user.id, {
              name: productDescription.trim().slice(0, 80),
              product_image_url: productImageUrl.trim() || null,
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
            setHistorySaved(true)
          } catch (e) {
            console.error('[ReviewAndAdjust] history save failed:', e)
            setHistoryError(e instanceof Error ? e.message : 'History save failed.')
          }
        } else {
          console.warn('[ReviewAndAdjust] user not loaded — skipping history save')
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
    setHistorySaved(false)
    setHistoryError('')
    setStepIndex(0)
  }

  /** Continue to the 11-step Studio wizard to generate all 6 scenes. */
  function handleContinueToStudio() {
    if (!prefill) return
    // Re-save updated prefill so CommercialStudio's clone bridge picks it up.
    const updated: ClonePrefill = {
      ...prefill,
      cloneMode: 'studio',
      analysis: { ...prefill.analysis, improvedScript: script },
      sourcedProduct: {
        name: productDescription || prefill.sourcedProduct?.name || '',
        imageUrl: productImageUrl || prefill.adImageUrl,
        sourceUrl: prefill.sourcedProduct?.sourceUrl,
      },
    }
    try { sessionStorage.setItem(CLONE_PREFILL_KEY, JSON.stringify(updated)) } catch {}
    navigate('/studio/new')
  }

  async function handleDownload() {
    if (!videoUrl) return
    setDownloading(true)
    try {
      await downloadVideo(videoUrl)
    } finally {
      setDownloading(false)
    }
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

        {/* Clone-mode contextual banner */}
        {isFromClone && prefill.cloneMode === 'quick' && (
          <div className="rounded-xl border border-fire-start/20 bg-fire-start/[0.06] p-4">
            <p className="text-xs font-bold text-fire-start mb-1">Quick clone — pre-filled from the original ad</p>
            <p className="text-sm text-ink-muted">The product name, image, and script below came from the ad you selected. Edit them to match <span className="font-semibold text-ink">your</span> product before generating.</p>
          </div>
        )}
        {isFromClone && prefill.cloneMode !== 'quick' && prefill.analysis.differentiationNotes && (
          <div className="rounded-xl border border-white/[0.07] bg-void-800/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold mb-2">What Claude adapted</p>
            <p className="text-sm text-ink-muted">{prefill.analysis.differentiationNotes}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">
          {/* Product — the shared capture component (upload / camera / URL / AI clean-up) */}
          <ProductInput value={productValue} onChange={onProductChange} />

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
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
                Script / hook
                {isFromClone && script && (
                  <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
                )}
              </label>
              <button
                type="button"
                disabled={isBusy || scriptLoading}
                onClick={() => { setShowScriptAI(v => !v); setScriptAIError('') }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-40 ${
                  showScriptAI
                    ? 'border-fire-start/50 bg-fire-start/[0.12] text-fire-start'
                    : 'border-white/[0.10] bg-void-700/60 text-ink-muted hover:border-fire-start/30 hover:text-fire-start'
                }`}
              >
                <Spark className="h-3 w-3" />
                Write with AI
              </button>
            </div>

            {/* AI Magic context panel */}
            {showScriptAI && (
              <div className="rounded-xl border border-fire-start/20 bg-fire-start/[0.04] p-4 space-y-3">
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Claude uses your product, image, creator, and ad style automatically.
                  Add more context below for the sharpest script.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Niche / audience</label>
                    <input
                      type="text"
                      value={scriptNiche}
                      onChange={e => setScriptNiche(e.target.value)}
                      placeholder="e.g. busy moms, gym bros 25–35"
                      className="w-full rounded-lg border border-white/[0.08] bg-void-800 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Goal</label>
                    <select
                      value={scriptGoal}
                      onChange={e => setScriptGoal(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-void-800 px-3 py-2 text-sm text-ink focus:border-fire-start/40 focus:outline-none"
                    >
                      <option value="">Pick a goal…</option>
                      <option value="Drive link clicks">Drive link clicks</option>
                      <option value="Boost brand awareness">Boost brand awareness</option>
                      <option value="Increase conversions">Increase conversions</option>
                      <option value="Get saves and shares">Get saves and shares</option>
                      <option value="Go viral">Go viral</option>
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {['Conversational', 'Energetic', 'Luxury', 'Educational', 'Funny', 'Emotional'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setScriptTone(prev => prev === t ? '' : t)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            scriptTone === t
                              ? 'border-fire-start/50 bg-fire-start/[0.10] text-ink'
                              : 'border-white/[0.08] bg-void-800/60 text-ink-muted hover:border-white/20'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {scriptAIError && (
                  <p className="text-xs text-rose-400">{scriptAIError}</p>
                )}
                <button
                  type="button"
                  disabled={scriptLoading}
                  onClick={handleWriteScript}
                  className="btn-fire w-full justify-center gap-2 py-2 text-sm disabled:opacity-50"
                >
                  {scriptLoading
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Claude is writing…</>
                    : <><Spark className="h-3.5 w-3.5" /> Generate script</>
                  }
                </button>
              </div>
            )}

            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              disabled={isBusy}
              rows={3}
              placeholder={showScriptAI ? 'Generated script will appear here — you can edit it.' : 'Type your own script, or use "Write with AI" above to let Claude write it.'}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
            {script && (
              <p className="text-[10px] text-ink-faint">This line will be spoken verbatim in your video. Edit freely.</p>
            )}
          </div>

          {/* Creator */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Creator
              {isFromClone && creatorValue.mode === 'generated' && creatorValue.attributes.gender && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <CreatorInput value={creatorValue} onChange={setCreatorValue} />
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

            {/* History save status */}
            {historySaved && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Saved to history
              </p>
            )}
            {historyError && (
              <p className="text-xs text-amber-300">History save failed: {historyError}</p>
            )}

            {directorPrompt && (
              <details className="rounded-xl border border-white/[0.06] bg-void-800/40 px-4 py-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  Director prompt
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{directorPrompt}</p>
              </details>
            )}

            <div className="flex flex-col gap-3">
              {/* Primary actions row */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn-fire flex items-center gap-2 disabled:opacity-60"
                >
                  {downloading
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Downloading…</>
                    : <><Download className="h-4 w-4" /> Download</>
                  }
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-800 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:border-white/20 hover:text-ink"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate again
                </button>
              </div>

              {/* Continue to Studio — only shown when arriving from a clone */}
              {isFromClone && (
                <div className="rounded-2xl border border-fire-start/20 bg-fire-start/[0.04] p-4">
                  <p className="text-sm font-semibold text-ink mb-1">Want to generate all 6 scenes?</p>
                  <p className="text-xs text-ink-muted mb-3">
                    Open the full Studio wizard with your product and script pre-loaded. Generate the Hook, Problem, Solution, Social Proof, CTA, and Outro scenes back-to-back.
                  </p>
                  <button
                    type="button"
                    onClick={handleContinueToStudio}
                    className="btn-fire flex w-full items-center justify-center gap-2"
                  >
                    <Wand className="h-4 w-4" />
                    Continue in Studio — generate next scene
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
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
            disabled={!isCreatorReady(creatorValue)}
            className="btn-fire w-full justify-center gap-2 disabled:opacity-40"
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

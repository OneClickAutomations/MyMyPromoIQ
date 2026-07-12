import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import { ArrowRight, Check, Download, RefreshCw, Spark, Wand, PlayIcon } from '../components/icons'
import ProductInput, { type ProductInputValue } from '../components/ProductInput'
import AdTypeSelector from '../components/studio/AdTypeSelector'
import { resolveAdType } from '../lib/studio/promptEngineBridge'
import GenerationOverlay, { type GenerationStep } from '../components/ui/GenerationOverlay'
import DurationSlider from '../components/ui/DurationSlider'
import CreatorInput, { EMPTY_CREATOR, isCreatorReady, type CreatorInputValue } from '../components/CreatorInput'
import type { CreatorAttributes } from '../lib/studio/types'
import { estimateClipCount } from '../lib/studio/storyboard'
import {
  startGeneration, pollUntilDone, saveCampaign, saveScene, writeAdScript, enhancePrompt,
  planStoryboard, generateVoiceover, muxVideoAudio, stitchVideos, listVoices, extractLastFrame,
  type ElevenVoice,
} from '../lib/api'
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

const STEP_LABELS: GenerationStep[] = [
  { label: 'Script', headline: 'Claude is planning your storyboard…', detail: 'Breaking your ad into scenes that fit the length you chose.' },
  { label: 'Scenes', headline: 'Rendering your scenes…', detail: 'Higgsfield is animating each clip — this is the slow part.' },
  { label: 'Voiceover', headline: 'Recording the voiceover…', detail: 'ElevenLabs is voicing your script.' },
  { label: 'Rendering', headline: 'Stitching it all together…', detail: 'Assembling one seamless video.' },
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
  const [productIntent, setProductIntent] = useState<string | undefined>(undefined)
  const [style, setStyle] = useState('testimonial')
  const [script, setScript] = useState('')
  const [creatorValue, setCreatorValue] = useState<CreatorInputValue>(EMPTY_CREATOR)
  // Flips true when the user hits Cancel mid-generation — checked after every
  // await in handleGenerate so a late-arriving result can't reopen the
  // overlay or show a video the user already dismissed.
  const cancelledRef = useRef(false)

  // Video length — replaces the old "how many videos" mental model. The
  // storyboard planner (server-side) translates seconds into however many
  // clips of whatever per-clip length the video model supports.
  // Default to one 8s clip — the honest "quick" default (a single generation,
  // no stitching). Users drag right to add whole clips.
  const [durationSeconds, setDurationSeconds] = useState(8)

  // Voiceover (ElevenLabs) — loaded lazily, empty selection = silent/native audio.
  const [voices, setVoices] = useState<ElevenVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesError, setVoicesError] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [previewingVoiceId, setPreviewingVoiceId] = useState('')
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Scene rendering is sequential (not parallel) by necessity: each scene's
  // conditioning image is the PREVIOUS scene's last frame (true image-to-video
  // chaining), so scene N+1 literally cannot start until scene N's video
  // exists and its last frame has been extracted. Slower than parallel, but
  // it's what makes the stitched result read as one continuous take instead
  // of the same opening shot repeating every time a new scene begins.
  const [sceneProgress, setSceneProgress] = useState({ done: 0, total: 0 })

  // AI Magic script writer
  const [showScriptAI, setShowScriptAI] = useState(false)
  const [scriptNiche, setScriptNiche] = useState('')
  const [scriptGoal, setScriptGoal] = useState('')
  const [scriptTone, setScriptTone] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptAIError, setScriptAIError] = useState('')

  // Regenerate panel — keyword suggestions + AI Magic enhancement
  const [showRegenPanel, setShowRegenPanel] = useState(false)
  const [regenKeywords, setRegenKeywords] = useState('')
  const [regenEnhancing, setRegenEnhancing] = useState(false)
  const [regenError, setRegenError] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  // Updated once the storyboard plan resolves — drives the overlay's per-step
  // time estimate so the ring's pace roughly matches however many scenes
  // this particular ad actually needs.
  const [planClipCount, setPlanClipCount] = useState(() => estimateClipCount(8))
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [historySaved, setHistorySaved] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Load ElevenLabs voices once, lazily — silent if no key is configured
  // server-side (the voiceover step is opt-in, never blocks generation).
  useEffect(() => {
    setVoicesLoading(true)
    listVoices()
      .then(({ voices: v }) => setVoices(v))
      .catch(e => setVoicesError(e instanceof Error ? e.message : 'Could not load voices.'))
      .finally(() => setVoicesLoading(false))
  }, [])

  function previewVoice(v: ElevenVoice) {
    if (!v.previewUrl) return
    previewAudioRef.current?.pause()
    const audio = new Audio(v.previewUrl)
    previewAudioRef.current = audio
    setPreviewingVoiceId(v.voiceId)
    audio.play().catch(() => {})
    audio.onended = () => setPreviewingVoiceId('')
  }

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
    intent: productIntent,
    sourceUrl: productSourceUrl,
  }
  function onProductChange(v: ProductInputValue) {
    setProductImageUrl(v.primaryImage)
    setProductName(v.name)
    setProductDescription(v.description)
    setProductIntent(v.intent)
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

  /**
   * Full Quick Generate pipeline: plan a storyboard sized to the chosen
   * duration, render every scene (parallel queue), layer an ElevenLabs
   * voiceover onto each rendered clip when a voice is selected, then stitch
   * everything into one video. Mirrors the proven pipeline CommercialStudio's
   * wizard already uses (planStoryboard → per-clip render+voice+mux → stitch),
   * just driven by a single duration slider instead of an 11-step wizard.
   */
  async function handleGenerate(regenerationNotes?: string) {
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
    cancelledRef.current = false

    // Bring Your Own Creator: the resolved photo (as-is or transformed) becomes
    // the video model's identity reference, taking priority over the product photo.
    const creatorImageUrl = creatorValue.mode !== 'generated' ? creatorValue.resolvedImageUrl || undefined : undefined
    const creatorConsentAt = creatorImageUrl ? creatorValue.consentAt : undefined
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

    try {
      // ── STEP 0: SCRIPT — plan a storyboard sized to the chosen duration.
      setStepIndex(0)
      const { plan } = await planStoryboard({
        productName: productName.trim() || effectiveDescription.slice(0, 60),
        description: effectiveDescription,
        style,
        // Pass the exact clip count the slider shows so the server plan matches
        // the UI (a single 8s clip stays a single clip, not silently 2).
        clipCount: estimateClipCount(durationSeconds),
        referenceDurationSeconds: durationSeconds,
        intent: productIntent || undefined,
        creator: creatorArg,
        hookLine: script.trim() || undefined,
        regenerationNotes: regenerationNotes?.trim() || undefined,
      })
      if (cancelledRef.current) return
      setDirectorPrompt(plan.reasoning)
      setPlanClipCount(plan.clips.length)

      // ── STEP 1: SCENES — render sequentially, chaining each scene's video
      // conditioning image from the PREVIOUS scene's last frame. This is what
      // makes the assembled ad read as one continuous take: scene 2 starts
      // from wherever scene 1's camera ended, instead of every scene
      // restarting from the same static product photo (which is what made
      // the old parallel-render version look like the same opening shot
      // repeating on every cut).
      setStepIndex(1)
      setSceneProgress({ done: 0, total: plan.clips.length })
      const rendered: Array<{ videoUrl: string; dialogue: string }> = []
      let chainImageUrl: string | undefined
      let firstRequestId = ''
      let lastError = ''
      for (const clip of plan.clips) {
        if (cancelledRef.current) return
        try {
          const { requestId } = await startGeneration({
            productImageUrl: productImageUrl.trim(),
            productDescription: effectiveDescription,
            style,
            quality: 'turbo',
            script: clip.dialogue,
            sceneLabel: clip.beat,
            sceneIndex: clip.order,
            sceneCount: plan.clips.length,
            creatorImageUrl,
            creatorConsentAt,
            conditioningImageUrl: chainImageUrl,
          })
          if (!firstRequestId) firstRequestId = requestId
          const result = await pollUntilDone(requestId, () => {}, { intervalMs: 7_000, timeoutMs: 10 * 60 * 1_000 })
          if (result.status !== 'completed' || !result.videoUrl) {
            // Surface the actual Veo failure detail from the poll (result.raw)
            // instead of a generic "Render failed" — that's what tells us WHY.
            throw new Error(
              result.raw === 'timeout'
                ? 'Render timed out.'
                : `Render failed: ${(result.raw && result.raw !== 'null' ? result.raw : 'no detail').slice(0, 240)}`,
            )
          }
          rendered.push({ videoUrl: result.videoUrl, dialogue: clip.dialogue })
          setSceneProgress(p => ({ ...p, done: p.done + 1 }))

          // Chain: the NEXT scene continues from THIS scene's last frame,
          // not from the original product photo. A failed extraction just
          // means the next scene falls back to the original conditioning —
          // never fails the whole ad over a continuity nice-to-have.
          if (clip.order < plan.clips.length) {
            try {
              const { imageDataUrl } = await extractLastFrame(result.videoUrl)
              chainImageUrl = imageDataUrl
            } catch {
              chainImageUrl = undefined
            }
          }
        } catch (err) {
          // One scene failing doesn't sink the ad — continue the chain from
          // whatever the last successful frame was (or the original photo).
          // Keep the reason so a total failure can show WHY, not just "try again".
          lastError = err instanceof Error ? err.message : String(err)
          setSceneProgress(p => ({ ...p, done: p.done + 1 }))
        }
      }
      if (cancelledRef.current) return
      if (rendered.length === 0) {
        setErrorMsg(lastError ? `All scenes failed to render. ${lastError}` : 'All scenes failed to render. Try again.')
        setPhase('error')
        return
      }

      // ── STEP 2: VOICEOVER — layer ElevenLabs onto each clip (skipped entirely if no voice picked).
      setStepIndex(2)
      let finalUrls: string[]
      if (selectedVoiceId) {
        const withVoice: string[] = []
        for (const tile of rendered) {
          if (cancelledRef.current) return
          try {
            const { audioDataUrl } = await generateVoiceover({ text: tile.dialogue, voiceId: selectedVoiceId })
            const { videoDataUrl } = await muxVideoAudio({ videoUrl: tile.videoUrl, audioBase64: audioDataUrl })
            withVoice.push(videoDataUrl)
          } catch {
            // Voiceover/mux is a nice-to-have — never fail the whole ad over it.
            withVoice.push(tile.videoUrl)
          }
        }
        finalUrls = withVoice
      } else {
        finalUrls = rendered.map(t => t.videoUrl)
      }
      if (cancelledRef.current) return

      // ── STEP 3: RENDERING — assemble into one seamless video.
      setStepIndex(3)
      const finalUrl = finalUrls.length === 1 ? finalUrls[0] : (await stitchVideos(finalUrls)).videoDataUrl
      if (cancelledRef.current) return

      setVideoUrl(finalUrl)
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
            request_id: firstRequestId,
            director_prompt: plan.reasoning,
            video_url: finalUrl,
          })
          setHistorySaved(true)
        } catch (e) {
          console.error('[ReviewAndAdjust] history save failed:', e)
          setHistoryError(e instanceof Error ? e.message : 'History save failed.')
        }
      } else {
        console.warn('[ReviewAndAdjust] user not loaded — skipping history save')
      }
    } catch (err) {
      if (cancelledRef.current) return
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed.')
      setPhase('error')
    }
  }

  function handleCancel() {
    cancelledRef.current = true
    setPhase('idle')
    setStepIndex(0)
    setSceneProgress({ done: 0, total: 0 })
  }

  function handleReset() {
    setPhase('idle')
    setVideoUrl(null)
    setDirectorPrompt('')
    setErrorMsg('')
    setHistorySaved(false)
    setHistoryError('')
    setStepIndex(0)
    setShowRegenPanel(false)
    setRegenKeywords('')
    setRegenError('')
    setSceneProgress({ done: 0, total: 0 })
  }

  async function handleEnhanceKeywords() {
    if (!regenKeywords.trim()) {
      setRegenError('Type a few keywords first.')
      return
    }
    setRegenError('')
    setRegenEnhancing(true)
    try {
      const { enhanced } = await enhancePrompt({
        text: regenKeywords.trim(),
        productDescription: productDescription.trim() || productName.trim() || undefined,
        style,
      })
      setRegenKeywords(enhanced)
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : 'Enhancement failed.')
    } finally {
      setRegenEnhancing(false)
    }
  }

  function handleRegenerate() {
    setShowRegenPanel(false)
    handleGenerate(regenKeywords)
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

          {/* Video length — replaces "how many videos": the user thinks in
              seconds, Claude figures out how many scenes of what length fit. */}
          <DurationSlider value={durationSeconds} onChange={setDurationSeconds} disabled={isBusy} />

          {/* Ad type — the full 12-format selector (same engine templates as the
              Build-From-Scratch studio) instead of the old 4 canned styles. */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Ad type
              {isFromClone && (
                <span className="text-gold text-[10px] font-semibold uppercase tracking-widest">{adForge.review.filledLabel}</span>
              )}
            </label>
            <AdTypeSelector selected={resolveAdType(style)} onSelect={(ad) => setStyle(ad)} />
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
              placeholder={showScriptAI ? 'Generated script will appear here — you can edit it.' : 'Type an opening line, or use "Write with AI" above to let Claude write it. Optional — leave blank to let Claude write the whole thing.'}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
            />
            {script && (
              <p className="text-[10px] text-ink-faint">The opening scene will speak this line, then Claude continues the story to fill your chosen video length.</p>
            )}
          </div>

          {/* Voiceover — ElevenLabs, opt-in. Empty selection = silent/native audio only. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Voiceover</label>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">ElevenLabs</span>
            </div>
            {voicesLoading && <p className="text-sm text-ink-muted">Loading voices…</p>}
            {voicesError && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-ink-muted">{voicesError}</div>
            )}
            {!voicesLoading && !voicesError && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setSelectedVoiceId('')}
                  className={`flex-shrink-0 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all disabled:opacity-50 ${
                    !selectedVoiceId
                      ? 'border-fire-start/50 bg-fire-start/[0.08] text-ink'
                      : 'border-white/[0.08] bg-void-800 text-ink-muted hover:border-white/20'
                  }`}
                >
                  No voiceover<br /><span className="font-normal text-ink-faint">Silent / native audio</span>
                </button>
                {voices.slice(0, 20).map(v => {
                  const selected = selectedVoiceId === v.voiceId
                  return (
                    <div
                      key={v.voiceId}
                      className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition-all ${
                        selected ? 'border-fire-start/50 bg-fire-start/[0.08]' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => previewVoice(v)}
                        disabled={!v.previewUrl || isBusy}
                        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-void-700 text-fire-start hover:bg-void-600 disabled:opacity-30"
                        aria-label={`Preview ${v.name}`}
                      >
                        {previewingVoiceId === v.voiceId ? <span className="h-2 w-2 rounded-sm bg-fire-start" /> : <PlayIcon className="h-3 w-3" />}
                      </button>
                      <button type="button" disabled={isBusy} onClick={() => setSelectedVoiceId(v.voiceId)} className="min-w-0 text-left disabled:opacity-50">
                        <p className="max-w-[110px] truncate text-xs font-semibold text-ink">{v.name}</p>
                      </button>
                      {selected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-fire-start" />}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-ink-faint">Adds a spoken voiceover of your script over the video. Leave on "No voiceover" to keep the render's native audio.</p>
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

        {/* Generation overlay — fixed/centered so it's always in view, no scrolling required.
            Per-step time estimates scale with the planned scene count — scenes
            render SEQUENTIALLY (each chains off the previous one's last frame
            for continuity), so the estimate is per-scene time × scene count,
            not divided down for parallelism. */}
        {phase === 'working' && (
          <GenerationOverlay
            steps={[
              STEP_LABELS[0],
              {
                ...STEP_LABELS[1],
                detail: sceneProgress.total
                  ? `Scene ${Math.min(sceneProgress.done + 1, sceneProgress.total)} of ${sceneProgress.total} — each one continues from the last for a seamless cut.`
                  : STEP_LABELS[1].detail,
              },
              STEP_LABELS[2],
              STEP_LABELS[3],
            ]}
            activeIndex={stepIndex}
            estimateSecondsForStep={[
              12,
              planClipCount * 70,
              selectedVoiceId ? planClipCount * 8 : 3,
              15 + planClipCount * 3,
            ][stepIndex]}
            onCancel={handleCancel}
          />
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
                  Storyboard plan
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  {planClipCount} scene{planClipCount === 1 ? '' : 's'} · {durationSeconds}s target. {directorPrompt}
                </p>
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
                  onClick={() => setShowRegenPanel(v => !v)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    showRegenPanel
                      ? 'border-fire-start/50 bg-fire-start/[0.10] text-fire-start'
                      : 'border-white/[0.08] bg-void-800 text-ink-muted hover:border-white/20 hover:text-ink'
                  }`}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
              </div>

              {/* Regenerate panel — keyword suggestions + AI Magic enhancement */}
              {showRegenPanel && (
                <div className="rounded-2xl border border-fire-start/20 bg-fire-start/[0.04] p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Regenerate with new direction</p>
                    <p className="mt-0.5 text-xs text-ink-muted">Tell Claude what to change — a keyword, a fix, a new angle. Re-plans and re-renders the whole {durationSeconds}s ad; product, creator, and length stay the same.</p>
                  </div>
                  <textarea
                    value={regenKeywords}
                    onChange={e => setRegenKeywords(e.target.value)}
                    disabled={regenEnhancing}
                    rows={2}
                    placeholder="e.g. show the earbuds much smaller than the case, hold at arm's length, more natural lighting"
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
                  />
                  {regenError && <p className="text-xs text-rose-400">{regenError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleEnhanceKeywords}
                      disabled={regenEnhancing || !regenKeywords.trim()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.10] bg-void-700/60 px-3 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:border-fire-start/30 hover:text-fire-start disabled:opacity-40"
                    >
                      {regenEnhancing
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Enhancing…</>
                        : <><Spark className="h-3.5 w-3.5" /> AI Magic — enhance</>
                      }
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={regenEnhancing}
                      className="btn-fire flex-1 justify-center gap-1.5 text-sm disabled:opacity-50"
                    >
                      <Wand className="h-3.5 w-3.5" /> Regenerate video
                    </button>
                  </div>
                </div>
              )}

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
            onClick={() => handleGenerate()}
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

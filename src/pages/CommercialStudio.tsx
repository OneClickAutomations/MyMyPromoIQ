/**
 * CommercialStudio — Phase 1 wizard shell using the CreativeBrief canonical object.
 *
 * Route: /studio/new
 * 11 steps: Count → Style → Product → Creator → Scene → Camera → Environment →
 *           Lighting → Voice → Script → Storyboard (plan, review, generate all)
 * Count/Style/Product front-load the three questions a user answers before
 * generating even one video: how many, what look, and what's the asset. The
 * final Storyboard step shows every clip up front — editable, regeneratable —
 * before a single render starts; "Generate All" fires the whole queue and every
 * clip is presented together, not one scene at a time.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import CameraStudio from '../components/CameraStudio'
import ProductInput, { type ProductInputValue } from '../components/ProductInput'
import CreatorInput, { EMPTY_CREATOR, isCreatorReady, type CreatorInputValue } from '../components/CreatorInput'
import StoryboardPlanner from '../components/StoryboardPlanner'
import GenerationPanel from '../components/GenerationPanel'
import { useGenerationQueue } from '../lib/studio/useGenerationQueue'
import type { StoryboardPlan, StoryboardClip } from '../lib/studio/storyboard'
import {
  ArrowRight, Bolt, Camera, Check, ChevronRight, Download, Film, ImageIcon, Info, Layers,
  PlayIcon, RefreshCw, Spark, Upload, Users, Wand, X,
} from '../components/icons'
import {
  startGeneration,
  pollUntilDone,
  presignUpload,
  uploadDirectToStorage,
  dataUrlToBlob,
  saveBrief,
  getBrief,
  listCreators,
  listProducts,
  getBrand,
  listVoices,
  generateVoiceover,
  muxVideoAudio,
  stitchVideos,
  extractLastFrame,
  planStoryboard,
  type StatusResponse,
  type StoredCreator,
  type StoredProduct,
  type StoredBrand,
  type ElevenVoice,
} from '../lib/api'
import {
  createEmptyBrief,
  type CreativeBrief,
  type CreatorAttributes,
} from '../lib/studio/types'
import type { ClonePrefill } from '../lib/discovery/types'
import {
  STYLE_PRESETS,
  CAMERA_OPTIONS,
  LIGHTING_OPTIONS,
  ENVIRONMENT_OPTIONS,
  PRODUCT_ACTION_OPTIONS,
  applyStylePreset,
} from '../lib/studio/presets'
import { composeRenderPrompt } from '../lib/studio/compositionEngine'
import { buildClipPromptPackage, resolveAdType, type AdTypeId } from '../lib/studio/promptEngineBridge'
import PromptPreview from '../components/studio/PromptPreview'
import AdTypeSelector from '../components/studio/AdTypeSelector'
import TypeQuestions from '../components/studio/TypeQuestions'
import DurationSlider from '../components/ui/DurationSlider'
import { estimateClipCount, MAX_CLIP_SECONDS } from '../lib/studio/storyboard'

/** Nearest legacy preset per engine ad type — seeds camera/lighting defaults. */
const ADTYPE_TO_PRESET: Record<AdTypeId, string> = {
  testimonial: 'ugc_testimonial',
  problem_solution: 'ugc_testimonial',
  before_after: 'ugc_testimonial',
  street_interview: 'ugc_testimonial',
  founder_story: 'founder_story',
  day_in_the_life: 'cinematic_brand',
  pov: 'cinematic_brand',
  unboxing: 'unboxing',
  tutorial: 'explainer',
  comparison: 'explainer',
  product_reveal: 'luxury_commercial',
  hook_only: 'fast_cut_hook',
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { num: 1,  key: 'style',       label: 'Ad Type',      required: true,  icon: Wand },
  { num: 2,  key: 'count',       label: 'Length',       required: true,  icon: Layers },
  { num: 3,  key: 'product',     label: 'Assets',        required: true,  icon: Upload },
  { num: 4,  key: 'creator',     label: 'Creator',      required: false, icon: Users },
  { num: 5,  key: 'scene',       label: 'Scene',        required: false, icon: Camera },
  { num: 6,  key: 'camera',      label: 'Camera',       required: false, icon: Camera },
  { num: 7,  key: 'environment', label: 'Environment',  required: false, icon: ImageIcon },
  { num: 8,  key: 'lighting',    label: 'Lighting',     required: false, icon: Spark },
  { num: 9,  key: 'voice',       label: 'Voice',        required: false, icon: Bolt },
  { num: 10, key: 'script',      label: 'Script',       required: false, icon: Wand },
  { num: 11, key: 'storyboard',  label: 'Storyboard',   required: true,  icon: PlayIcon },
] as const

// Creator attribute chip options now live in CreatorInput.tsx (shared across
// all three modes) — the wizard's Cast step delegates rendering to it.

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGrid<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { id: T; label: string; phrase?: string; hint?: string }[]
  value: T | T[]
  onChange: (v: T | T[]) => void
  multi?: boolean
}) {
  const selected = multi ? (value as T[]) : [value as T]

  function toggle(id: T) {
    if (multi) {
      const prev = value as T[]
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      onChange(next)
    } else {
      onChange(id)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all duration-150 text-left ${
              active
                ? 'border-fire-start/60 bg-fire-start/10 text-fire-start ring-1 ring-fire-start/30'
                : 'border-white/[0.09] bg-void-800 text-ink-muted hover:border-white/20 hover:text-ink'
            }`}
          >
            {opt.label}
            {opt.hint && <span className="ml-1.5 text-[11px] font-normal opacity-60">{opt.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Skip button ───────────────────────────────────────────────────────────────

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-white/[0.07] py-3 text-sm font-semibold text-ink-faint hover:bg-white/[0.04] hover:text-ink transition-colors"
    >
      Skip — use AI defaults
    </button>
  )
}

// ── "For Best Results" guidance callout — collapsible, dismissible per step ─────
function BestResults({ title = 'For best results', tips }: { title?: string; tips: string[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-4">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2.5 text-left">
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-gold/15">
          <Info className="h-3.5 w-3.5 text-gold" />
        </span>
        <span className="text-sm font-bold text-ink">{title}</span>
        <ChevronRight className={`ml-auto h-4 w-4 text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <ul className="mt-3 space-y-1.5 pl-1">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gold/60" />
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Step header ───────────────────────────────────────────────────────────────

function StepHeader({
  title,
  desc,
  onBack,
  badge,
}: {
  title: string
  desc: string
  onBack?: () => void
  badge?: React.ReactNode
}) {
  return (
    <div>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors"
        >
          ← Back
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{desc}</p>
        </div>
        {badge}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type InputMethod = 'upload' | 'camera' | 'url' | 'product-url'

export default function CommercialStudio() {
  const { user } = useUser()

  // ── Wizard step state
  const [stepNum, setStepNum] = useState(1)

  // ── CreativeBrief — single source of truth
  const [brief, setBrief] = useState<CreativeBrief>(() =>
    createEmptyBrief(crypto.randomUUID(), user?.id ?? ''),
  )
  const briefIdRef = useRef<string | null>(null)

  // ── Product upload state (capture UI is now the shared ProductInput component)
  const [inputMethod, setInputMethod]     = useState<InputMethod>('upload')
  const [productFile, setProductFile]     = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState('')
  const [urlInput, setUrlInput]           = useState('')
  const [urlPreviewOk, setUrlPreviewOk]   = useState(false)
  const [descInput, setDescInput]         = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [step1Error, setStep1Error]       = useState('')
  const [cameraOpen, setCameraOpen]       = useState(false)

  // ── Voiceover (ElevenLabs) state
  const [voices, setVoices]               = useState<ElevenVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesError, setVoicesError]     = useState('')
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // ── Creative Studio library (loaded once on mount)
  const [savedCreators, setSavedCreators] = useState<StoredCreator[]>([])
  const [savedProducts, setSavedProducts] = useState<StoredProduct[]>([])
  const [savedBrand, setSavedBrand] = useState<StoredBrand | null>(null)

  // ── Clone bridge — set when this brief was pre-filled from a discovered ad
  const [clonedFrom, setClonedFrom] = useState<{ name: string; notes: string } | null>(null)

  // ── Multi-scene state ──────────────────────────────────────────────────────
  const SCENE_LABELS = ['Hook', 'Problem / Agitation', 'Solution', 'Social Proof', 'Call to Action', 'Outro'] as const
  // "How many videos?" (Step 1) — 1 renders a single video; 2-6 builds that many
  // beats into a full commercial. Seeded from the dashboard entry point (?mode=).
  const [desiredVideoCount, setDesiredVideoCount] = useState(1)
  const activeSceneLabels = SCENE_LABELS.slice(0, desiredVideoCount)

  // ── Storyboard plan → Generate All (replaces the old one-scene-at-a-time flow)
  const [wizardPhase, setWizardPhase] = useState<'idle' | 'planning' | 'plan' | 'rendering' | 'error'>('idle')
  const [wizardPlan, setWizardPlan] = useState<StoryboardPlan | null>(null)
  const [wizardPlanError, setWizardPlanError] = useState('')
  const [wizardClipCountBusy, setWizardClipCountBusy] = useState(false)
  const [wizardRegenOrder, setWizardRegenOrder] = useState<number | null>(null)
  // Concurrency 1 = clips render sequentially, in order — required for
  // last-frame chaining (each clip conditions on the previous clip's final
  // frame so the stitched ad reads as one continuous take, not the same
  // opening shot repeating on every cut).
  const wizardQueue = useGenerationQueue(1, 1)
  // The previous clip's extracted last frame, threaded into the next clip's
  // video conditioning. Reset at the start of every full run.
  const wizardChainRef = useRef<string | undefined>(undefined)
  const [wizardAssembling, setWizardAssembling] = useState(false)
  const [wizardAssembledUrl, setWizardAssembledUrl] = useState<string | null>(null)
  const [wizardAssemblyError, setWizardAssemblyError] = useState('')
  // Guards auto-assembly to fire exactly ONCE per generation run. Without it, a
  // failed stitch left assembledUrl null + assembling false, so the auto-assemble
  // effect's condition went true again and re-fired in a loop (the "blinking" the
  // user saw). Reset at the start of each new Generate-All.
  const wizardAutoAssembledRef = useRef(false)

  // ── Draft save toast
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const draftToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Autosave (500 ms debounce after brief changes)
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useCallback((b: CreativeBrief) => {
    if (!user?.id) return
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(async () => {
      try {
        const { id } = await saveBrief(user.id, {
          ...(briefIdRef.current ? { id: briefIdRef.current } : {}),
          status: 'draft',
          product: b.product,
          creator: b.creator,
          scene: b.scene,
          style: b.style,
          voice: b.voice,
          script: b.script,
          storyboard: b.storyboard,
          render: b.render,
          ...(b.sourceAd ? { sourceAd: b.sourceAd } : {}),
        })
        briefIdRef.current = id
        setDraftSavedAt(Date.now())
        if (draftToastTimer.current) clearTimeout(draftToastTimer.current)
        draftToastTimer.current = setTimeout(() => setDraftSavedAt(null), 3000)
      } catch {
        // Autosave failure is silent — user data isn't lost, just not persisted yet
      }
    }, 500)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    Promise.all([
      listCreators(user.id).catch(() => ({ creators: [] as StoredCreator[] })),
      listProducts(user.id).catch(() => ({ products: [] as StoredProduct[] })),
      getBrand(user.id).catch(() => ({ brand: null as StoredBrand | null })),
    ]).then(([c, p, b]) => {
      if (!cancelled) {
        setSavedCreators(c.creators)
        setSavedProducts(p.products)
        setSavedBrand(b.brand)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  // ── Entry params from the dashboard: ?style=<preset>&mode=quick|full ────────
  // Quick Create cards pass the chosen format so the studio opens pre-set on it;
  // 'full' opens the multi-scene commercial builder.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'quick') setDesiredVideoCount(1)
    if (mode === 'full') setDesiredVideoCount(6)
    const style = searchParams.get('style')
    if (style && STYLE_PRESETS[style]) {
      setBrief(prev => {
        const next = { ...prev, ...applyStylePreset(prev, style) }
        scheduleSave(next)
        return next
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume a saved draft: ?brief=<id> ───────────────────────────────────────
  useEffect(() => {
    const briefId = searchParams.get('brief')
    if (!briefId || !user?.id) return
    getBrief(user.id, briefId).then(({ brief }) => {
      if (!brief) return
      briefIdRef.current = briefId
      const b = brief as Record<string, unknown>
      setBrief(prev => ({
        ...prev,
        status: (b.status as CreativeBrief['status']) ?? 'draft',
        product:     (b.product as CreativeBrief['product'])     ?? prev.product,
        creator:     (b.creator as CreativeBrief['creator'])     ?? prev.creator,
        scene:       (b.scene as CreativeBrief['scene'])         ?? prev.scene,
        style:       (b.style as CreativeBrief['style'])         ?? prev.style,
        voice:       (b.voice as CreativeBrief['voice'])         ?? prev.voice,
        script:      (b.script as CreativeBrief['script'])       ?? prev.script,
        storyboard:  (b.storyboard as CreativeBrief['storyboard']) ?? prev.storyboard,
        render:      (b.render as CreativeBrief['render'])       ?? prev.render,
        sourceAd:    (b.source_ad as CreativeBrief['sourceAd'])  ?? prev.sourceAd,
      }))
      // Restore product image preview if one was saved
      const prod = b.product as Record<string, unknown> | undefined
      const imgUrl = prod?.productImageUrl as string | undefined
      if (imgUrl) {
        setInputMethod('url')
        setUrlInput(imgUrl)
        setProductPreview(imgUrl)
        setUrlPreviewOk(true)
      }
      const descText = prod?.productName as string | undefined
      if (descText) setDescInput(descText)
    }).catch(() => {})
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clone bridge: hydrate the brief from a discovered-ad analysis (once) ────
  useEffect(() => {
    let raw: string | null = null
    try { raw = sessionStorage.getItem('promoiq_clone_prefill') } catch { return }
    if (!raw) return
    try { sessionStorage.removeItem('promoiq_clone_prefill') } catch {}

    let prefill: ClonePrefill
    try { prefill = JSON.parse(raw) } catch { return }
    const a = prefill.analysis
    if (!a) return

    const s = a.suggestedCreatorAttributes ?? {}
    const attributes: CreatorAttributes = {
      gender: s.gender ?? '',
      ageRange: s.ageRange ?? '',
      ethnicity: s.ethnicity ?? '',
      bodyType: s.bodyType ?? '',
      hair: s.hair ?? '',
      wardrobe: s.wardrobe ?? '',
      expression: s.expression ?? '',
      energyLevel: (s.energyLevel as CreatorAttributes['energyLevel']) ?? 'medium',
      cameraConfidence: s.cameraConfidence ?? '',
    }

    setBrief(prev => {
      let next: CreativeBrief = {
        ...prev,
        creator: { ...prev.creator, mode: 'generated', attributes },
        script: { ...prev.script, generationMode: 'manual', editedText: a.improvedScript },
        sourceAd: {
          sourceAdId: prefill.sourceAdId,
          analysisSummary: a.differentiationNotes,
          appliedAt: prefill.appliedAt,
        },
      }
      if (a.suggestedCommercialStyle) next = applyStylePreset(next, a.suggestedCommercialStyle)
      // Workflow B: seed the product from the sourced listing so Step 1 is pre-filled.
      if (prefill.sourcedProduct) {
        next = { ...next, product: { ...next.product, productName: prefill.sourcedProduct.name } }
      }
      return next
    })

    if (prefill.sourcedProduct) {
      if (prefill.sourcedProduct.imageUrl) {
        setInputMethod('url')
        setUrlInput(prefill.sourcedProduct.imageUrl)
        setProductPreview(prefill.sourcedProduct.imageUrl)
        setUrlPreviewOk(true)
      }
    }
    setClonedFrom({ name: prefill.sourceAdName, notes: a.differentiationNotes })
  }, [])

  function patch(update: Partial<CreativeBrief>) {
    setBrief(prev => {
      const next = { ...prev, ...update }
      scheduleSave(next)
      return next
    })
  }

  // ── Voiceover helpers (ElevenLabs) ─────────────────────────────────────────
  const loadVoices = useCallback(async () => {
    if (voices.length || voicesLoading) return
    setVoicesLoading(true)
    setVoicesError('')
    try {
      const { voices: v } = await listVoices()
      setVoices(v)
    } catch (err) {
      setVoicesError(err instanceof Error ? err.message : 'Could not load voices.')
    } finally {
      setVoicesLoading(false)
    }
  }, [voices.length, voicesLoading])

  // Lazy-load voices the first time the user reaches the Voice step.
  useEffect(() => {
    if (stepNum === 9) loadVoices()
  }, [stepNum, loadVoices])

  function previewVoice(v: ElevenVoice) {
    if (!v.previewUrl) return
    // Toggle off if the same preview is playing.
    if (previewingVoiceId === v.voiceId && previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPreviewingVoiceId(null)
      return
    }
    previewAudioRef.current?.pause()
    const audio = new Audio(v.previewUrl)
    previewAudioRef.current = audio
    audio.onended = () => setPreviewingVoiceId(null)
    audio.play().then(() => setPreviewingVoiceId(v.voiceId)).catch(() => setPreviewingVoiceId(null))
  }

  // ── Navigation helpers ────────────────────────────────────────────────────

  function goBack() {
    setStepNum(n => Math.max(1, n - 1))
  }

  function goForward() {
    setStepNum(n => Math.min(11, n + 1))
  }

  // Skip optional step: apply preset defaults then advance
  function skipWithDefaults() {
    const updated = brief.style.commercialStyle
      ? applyStylePreset(brief, brief.style.commercialStyle)
      : brief
    patch(updated)
    goForward()
  }

  // ── Saved library helpers ─────────────────────────────────────────────────

  function handleSelectSavedProduct(product: StoredProduct) {
    const imageUrl = product.primary_image_url ?? ''
    setInputMethod('url')
    setUrlInput(imageUrl)
    setProductPreview(imageUrl)
    setUrlPreviewOk(!!imageUrl)
    setDescInput(product.description ?? '')
    patch({
      product: {
        ...brief.product,
        productName: product.name,
        description: product.description ?? '',
        rawImages: [],
        processedImages: [],
      },
    })
  }

  // ── Product helpers ───────────────────────────────────────────────────────

  function handleCapture(dataUrl: string) {
    setProductPreview(dataUrl); setProductFile(null); setStep1Error('')
  }

  async function handleProductNext() {
    setStep1Error('')
    if (inputMethod === 'url' || inputMethod === 'product-url') {
      patch({ product: { ...brief.product, productName: brief.product.productName, rawImages: [], processedImages: [] } })
      goForward()
      return
    }
    setUploadingImage(true)
    try {
      const mimeType = productFile?.type || (productPreview.startsWith('data:image/png') ? 'image/png' : 'image/jpeg')
      const { path, token, publicUrl } = await presignUpload(mimeType)
      const fileData: Blob = productFile ?? dataUrlToBlob(productPreview)
      await uploadDirectToStorage(path, token, fileData, mimeType)
      patch({
        product: {
          ...brief.product,
          rawImages: [{ id: path, url: publicUrl, kind: 'raw', createdAt: new Date().toISOString() }],
        },
      })
      goForward()
    } catch (err) {
      setStep1Error((err instanceof Error ? err.message : 'Upload failed.') + ' Try the Image URL tab instead.')
    } finally {
      setUploadingImage(false)
    }
  }

  const productImageUrl =
    inputMethod === 'url'
      ? urlInput.trim()
      : brief.product.rawImages[0]?.url ?? productPreview

  const canAdvanceStep1 = inputMethod === 'product-url'
    ? (urlPreviewOk || !!brief.product.productName) && !!descInput.trim()
    : !!productPreview && !!descInput.trim()

  // ── Bridge the shared ProductInput into the wizard's step-1 state ───────────
  // Maps ProductInput's value onto the fields the existing generation plumbing
  // (handleProductNext, productImageUrl, canAdvanceStep1) already reads, so the
  // upload/turnaround/advance logic keeps working unchanged.
  const wizardProductValue: ProductInputValue = {
    images: productPreview ? [productPreview] : [],
    primaryImage: productPreview,
    name: brief.product.productName,
    description: descInput,
    sourceUrl: undefined,
    turnaroundImage: brief.product.turnaroundImageUrl,
  }
  function onWizardProduct(v: ProductInputValue) {
    const img = v.primaryImage
    if (img && /^https?:\/\//.test(img)) {
      // Remote URL: route through the existing 'url' path (no re-upload needed).
      setInputMethod('url'); setUrlInput(img); setUrlPreviewOk(true)
    } else {
      // Data URL from upload/camera: the 'upload' path re-hosts it on Next.
      setInputMethod('upload')
    }
    setProductFile(null)
    setProductPreview(img)
    // Only ever sync from the actual description field. Falling back to
    // v.name here was the bug: while description is still empty, typing the
    // FIRST character into "Product name" fell through to v.name and got
    // written into descInput — after that, descInput itself became a truthy
    // "description" on the next keystroke, so it silently stuck at just that
    // one leaked character instead of continuing to mirror the name.
    if (v.description) setDescInput(v.description)
    // Persist the turnaround sheet (generated inside ProductInput) so it's used
    // as Claude's vision reference at generation time.
    patch({ product: { ...brief.product, productName: v.name || brief.product.productName, description: v.description || brief.product.description, turnaroundImageUrl: v.turnaroundImage ?? brief.product.turnaroundImageUrl } })
  }

  // ── Storyboard plan → Generate All ────────────────────────────────────────
  // Replaces the old one-scene-at-a-time director feed: the full storyboard is
  // planned and shown up front, every clip is editable/regeneratable, and
  // "Generate All" fires the whole queue at once instead of a click-per-scene.

  // Creator context for the storyboard planner, so it never invents a person
  // (the "a woman" bug). An uploaded/transformed photo = a fixed real person:
  // stay neutral, don't assign a gender/look. A generated creator = pass the
  // chosen attributes so the description matches.
  function planCreatorContext() {
    const hasUploadedPhoto = !!(brief.creator.transformedImageUrl || brief.creator.seedImages?.[0]?.url)
    if (hasUploadedPhoto) return { source: 'uploaded' as const }
    const a = brief.creator.attributes
    if (a && (a.gender || a.ageRange || a.ethnicity)) {
      return { source: 'generated' as const, gender: a.gender || undefined, ageRange: a.ageRange || undefined, ethnicity: a.ethnicity || undefined }
    }
    return undefined
  }

  async function runWizardPlan(clipCount?: number) {
    setWizardPhase('planning')
    setWizardPlanError('')
    try {
      const { plan } = await planStoryboard({
        productName: brief.product.productName,
        description: brief.product.description ?? descInput,
        style: brief.style.commercialStyle || 'testimonial',
        clipCount: clipCount ?? desiredVideoCount,
        referenceBeats: [...activeSceneLabels],
        brandVoice: savedBrand?.brand_voice ?? undefined,
        cta: savedBrand?.cta_preferences ?? undefined,
        creator: planCreatorContext(),
        answers: brief.wizardAnswers,
      })
      setWizardPlan(plan)
      setWizardPhase('plan')
    } catch (e) {
      setWizardPlanError(e instanceof Error ? e.message : 'Could not plan the storyboard.')
      setWizardPhase('error')
    }
  }

  async function changeWizardClipCount(n: number) {
    setWizardClipCountBusy(true)
    try { await runWizardPlan(n) } finally { setWizardClipCountBusy(false) }
  }

  async function regenWizardClip(clip: StoryboardClip) {
    if (!wizardPlan) return
    setWizardRegenOrder(clip.order)
    try {
      const { plan: one } = await planStoryboard({
        productName: brief.product.productName,
        description: brief.product.description ?? descInput,
        style: brief.style.commercialStyle || 'testimonial',
        clipCount: 1,
        referenceBeats: [clip.beat],
        brandVoice: savedBrand?.brand_voice ?? undefined,
        cta: savedBrand?.cta_preferences ?? undefined,
        creator: planCreatorContext(),
        answers: brief.wizardAnswers,
      })
      const fresh = one.clips[0]
      if (fresh) {
        const merged: StoryboardClip = { ...fresh, id: clip.id, order: clip.order, durationSeconds: clip.durationSeconds, beat: clip.beat, locked: false }
        setWizardPlan({ ...wizardPlan, clips: wizardPlan.clips.map(c => (c.id === clip.id ? merged : c)) })
      }
    } catch { /* leave clip as-is */ }
    finally { setWizardRegenOrder(null) }
  }

  // Turn one storyboard clip into a hosted video URL (throws on failure so the
  // queue's retry logic can catch it). Layers a per-clip ElevenLabs voiceover
  // on top when a voice was picked, falling back to the silent/native-audio
  // clip if voiceover or mux fails.
  async function wizardGenerateOne(clip: StoryboardClip): Promise<string> {
    if (!productImageUrl) throw new Error('no product image')
    const composed = composeRenderPrompt(brief)
    const composedPrompt = composed.scenes.map(s => s.prompt).join(' ')
    const creatorImageUrl = brief.creator.transformedImageUrl || brief.creator.seedImages?.[0]?.url || undefined

    // Prompt engine: build the timed-beat Veo prompt + Nano Banana start-frame
    // prompt for this clip. The server runs the engine path (start frame → Veo)
    // when a Gemini key is present, and falls back to the legacy path otherwise.
    // Never let a prompt-build hiccup block generation — degrade to legacy.
    let enginePkg: ReturnType<typeof buildClipPromptPackage> | null = null
    try { enginePkg = buildClipPromptPackage(brief, clip) } catch { enginePkg = null }

    const { requestId } = await startGeneration({
      productImageUrl,
      productDescription: brief.product.description ?? descInput,
      style: brief.style.commercialStyle || 'testimonial',
      quality: 'turbo',
      composedPrompt,
      negativePrompt: enginePkg?.negativePrompt ?? composed.negativePrompt,
      // Engine path (used server-side only with a Gemini key):
      veoPrompt: enginePkg?.veoPrompt,
      nanaBananaPrompt: enginePkg?.nanaBananaPrompt,
      clipDurationSeconds: clip.durationSeconds,
      creatorReferenceImageUrl: creatorImageUrl,
      brandVoice: savedBrand?.brand_voice ?? undefined,
      brandTaglines: (savedBrand?.taglines as string[] | undefined) ?? undefined,
      brandCta: savedBrand?.cta_preferences ?? undefined,
      sceneLabel: clip.beat,
      script: clip.dialogue,
      creatorImageUrl,
      creatorConsentAt: creatorImageUrl ? brief.creator.likenessConsentAt : undefined,
      // Product consistency: prefer the 6-angle turnaround as Claude's vision
      // reference when one exists; the server falls back to productImageUrl otherwise.
      productReferenceImageUrl: brief.product.turnaroundImageUrl || undefined,
      // Continuity: this clip's place in the sequence so clips 2..N continue the
      // take instead of each re-opening on the product still.
      sceneIndex: clip.order,
      sceneCount: wizardPlan?.clips.length,
      // Last-frame chaining: clips 2..N condition on the PREVIOUS clip's final
      // frame (set below after each render) instead of the static product
      // photo, so the stitched ad reads as one continuous take. Clip 1 has no
      // chain (undefined) and uses its Nano Banana start frame / references.
      conditioningImageUrl: wizardChainRef.current,
    })
    const final: StatusResponse = await pollUntilDone(requestId, () => {}, {
      intervalMs: 5_000,
      timeoutMs: 10 * 60 * 1_000,
    })
    if (final.status !== 'completed' || !final.videoUrl) {
      throw new Error(final.raw === 'timeout' ? 'Render timed out — try again.' : 'Render failed.')
    }

    // Chain the NEXT clip off this clip's last frame. Extract from the raw Veo
    // output (before voiceover/mux). A failed extraction just means the next
    // clip falls back to its start frame — never fails the ad over continuity.
    // Skipped on the final clip. Because the queue runs sequentially
    // (concurrency 1), this ref is always set before the next clip reads it.
    if (typeof wizardPlan?.clips.length === 'number' && clip.order < wizardPlan.clips.length) {
      try {
        const { imageDataUrl } = await extractLastFrame(final.videoUrl)
        wizardChainRef.current = imageDataUrl
      } catch {
        wizardChainRef.current = undefined
      }
    }

    if (!brief.voice.voiceId || !clip.dialogue.trim()) return final.videoUrl
    try {
      const { audioDataUrl } = await generateVoiceover({ text: clip.dialogue, voiceId: brief.voice.voiceId, speed: brief.voice.speed })
      const { videoDataUrl } = await muxVideoAudio({ videoUrl: final.videoUrl, audioBase64: audioDataUrl })
      return videoDataUrl
    } catch {
      // Voiceover/mux is a nice-to-have — never fail the clip over it.
      return final.videoUrl
    }
  }

  function generateAllClips(clips: StoryboardClip[]) {
    setWizardAssembledUrl(null)
    setWizardAssemblyError('')
    wizardAutoAssembledRef.current = false
    // Fresh chain — clip 1 starts from its own start frame, not a stale frame
    // left over from a previous run.
    wizardChainRef.current = undefined
    setWizardPhase('rendering')
    void wizardQueue.run(clips, wizardGenerateOne)
  }

  function retryWizardClip(clipId: string) {
    const clip = wizardPlan?.clips.find(c => c.id === clipId)
    if (clip) void wizardQueue.retryOne(clip, wizardGenerateOne)
  }

  async function assembleWizardAd() {
    const urls = wizardQueue.tiles.filter(t => t.status === 'complete' && t.videoUrl).map(t => t.videoUrl!)
    if (urls.length < 1) return
    setWizardAssemblyError('')
    setWizardAssembling(true)
    try {
      // A single clip IS the finished ad — skip the network round-trip to
      // ffmpeg (and its failure surface) entirely rather than stitching one
      // video against itself.
      const videoDataUrl = urls.length === 1 ? urls[0] : (await stitchVideos(urls)).videoDataUrl
      setWizardAssembledUrl(videoDataUrl)
      patch({ status: 'complete', render: { ...brief.render, outputUrl: videoDataUrl, statusLog: [] } })
    } catch (e) {
      // Previously swallowed silently — the user just saw nothing happen,
      // which read as "the video was generated but isn't visible anywhere."
      setWizardAssemblyError(e instanceof Error ? e.message : 'Could not assemble the final commercial.')
    } finally {
      setWizardAssembling(false)
    }
  }

  // Kick off planning the moment the user reaches the Storyboard step.
  useEffect(() => {
    if (stepNum === 11 && wizardPhase === 'idle' && productImageUrl) {
      runWizardPlan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNum])

  // Once "Generate All" is clicked, the rest happens without further input —
  // the moment every clip has settled, assemble automatically. Fires ONCE per
  // run (the ref guard): a failed stitch must NOT auto-retry in a loop; the
  // user gets a manual "Retry assembly" button instead.
  useEffect(() => {
    if (
      wizardPhase === 'rendering' &&
      wizardQueue.allSettled &&
      wizardQueue.completedCount >= 1 &&
      !wizardAutoAssembledRef.current
    ) {
      wizardAutoAssembledRef.current = true
      assembleWizardAd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardPhase, wizardQueue.allSettled, wizardQueue.completedCount])

  // ── Left-rail stepper ─────────────────────────────────────────────────────

  function Stepper() {
    return (
      <nav aria-label="Wizard steps" className="space-y-0.5">
        {STEPS.map((s, i) => {
          const state = s.num < stepNum ? 'done' : s.num === stepNum ? 'active' : 'future'
          const Icon = s.icon
          return (
            <div key={s.key} className={`relative flex gap-3 ${i < STEPS.length - 1 ? 'pb-4' : ''}`}>
              {i < STEPS.length - 1 && (
                <div className="absolute left-[14px] top-8 bottom-0 w-px bg-void-600" />
              )}
              <div className={`relative z-10 mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg transition-all duration-300 ${
                state === 'done'   ? 'bg-gradient-fire shadow-fire-soft' :
                state === 'active' ? 'bg-fire-start/15 ring-2 ring-fire-start/50' :
                'bg-void-700/60 ring-1 ring-white/[0.06]'
              }`}>
                {state === 'done'
                  ? <Check className="h-3.5 w-3.5 text-white" />
                  : <Icon className={`h-3.5 w-3.5 ${state === 'active' ? 'text-fire-start' : 'text-ink-faint/40'}`} />
                }
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${state === 'active' ? 'text-ink' : state === 'done' ? 'text-ink-muted' : 'text-ink-faint/40'}`}>
                    {s.label}
                  </span>
                  {!s.required && state === 'future' && (
                    <span className="rounded-full bg-void-700/50 px-1.5 py-px text-[8px] font-semibold text-ink-faint/40 uppercase tracking-widest">opt</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </nav>
    )
  }

  // ── Step renders ──────────────────────────────────────────────────────────

  // Step 1: How many videos? — asked before style or assets, so the rest of
  // the wizard (and the final render) already knows the scope of the job.
  function renderCount() {
    return (
      <div className="space-y-6">
        <StepHeader title="How long should your ad be?" desc="Pick a length — we build it from clips of up to 8s each. A single 8s clip is one generation; longer ads stitch several together." onBack={goBack} />

        <DurationSlider
          value={desiredVideoCount * MAX_CLIP_SECONDS}
          onChange={(sec) => setDesiredVideoCount(estimateClipCount(sec))}
        />

        <div className="rounded-2xl border border-white/[0.07] bg-void-900/40 p-4">
          <p className="text-sm text-ink-muted">
            {desiredVideoCount === 1
              ? 'A single ~8s video in your chosen style — the fastest path, no stitching.'
              : `A full commercial built from ${desiredVideoCount} beats: ${SCENE_LABELS.slice(0, desiredVideoCount).join(' → ')}.`}
          </p>
        </div>

        <button onClick={goForward} className="btn-fire w-full">
          Next — Assets <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Step 3: Product (assets)
  function renderProduct() {
    return (
      <div className="space-y-5">
        <StepHeader title="Drop in your product" desc="Upload a photo, take a photo, paste an image URL, or scan a product page URL to auto-fill everything." />

        <BestResults tips={[
          'Use a clear, sharp photo on a plain, uncluttered background with even lighting.',
          'Shoot the product straight-on at a natural angle — avoid extreme perspective.',
          'State real dimensions in the description (e.g. “6-inch tall, fits in one hand”) so the AI keeps the product at correct scale and doesn’t render it oversized.',
          'Mention the material/finish (matte, glossy, metal) and the exact label text to keep packaging faithful.',
          'Higher-resolution images hold detail better through video generation.',
        ]} />

        {/* Saved products quick-pick */}
        {savedProducts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">Saved Products</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {savedProducts.map(product => {
                const isSelected = brief.product.productName === product.name
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectSavedProduct(product)}
                    className={`flex flex-shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                        : 'border-white/[0.08] bg-void-800 hover:border-fire-start/40'
                    }`}
                  >
                    {product.primary_image_url && (
                      <img src={product.primary_image_url} className="h-8 w-8 flex-shrink-0 rounded-lg object-cover" alt={product.name} />
                    )}
                    <div className="min-w-0">
                      <p className="max-w-[100px] truncate text-sm font-semibold text-ink">{product.name}</p>
                      {product.brand && <p className="text-xs text-ink-faint">{product.brand}</p>}
                    </div>
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 h-px bg-white/[0.06]" />
          </div>
        )}

        {/* Product capture — the shared component (upload / camera / URL / bg-removal / enhance) */}
        <ProductInput value={wizardProductValue} onChange={onWizardProduct} />

        {step1Error && (
          <p className="rounded-xl border border-fire-start/20 bg-fire-start/5 px-4 py-3 text-sm text-fire-start">{step1Error}</p>
        )}

        {/* The turnaround generator now lives inside ProductInput (above), next
            to Remove background / Enhance, so it's available in every mode. */}

        <button onClick={handleProductNext} disabled={!canAdvanceStep1 || uploadingImage} className="btn-fire w-full disabled:opacity-50">
          {uploadingImage ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Uploading…</> : <>Next — Creator <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    )
  }

  // Step 4: Creator
  function renderCreator() {
    const creatorValue: CreatorInputValue = {
      mode: brief.creator.mode,
      attributes: brief.creator.attributes ?? EMPTY_CREATOR.attributes,
      savedCreatorId: brief.creator.savedCreatorId ?? '',
      seedImages: (brief.creator.seedImages ?? []).map(a => a.url),
      primarySeedImage: brief.creator.seedImages?.[0]?.url ?? '',
      usagePath: brief.creator.usagePath ?? 'as_is',
      transformInstruction: brief.creator.transformInstruction ?? '',
      resolvedImageUrl: brief.creator.transformedImageUrl || (brief.creator.usagePath === 'as_is' ? brief.creator.seedImages?.[0]?.url ?? '' : ''),
      consentAcknowledged: !!brief.creator.likenessConsentAt,
      consentAt: brief.creator.likenessConsentAt,
    }
    const nowIso = new Date().toISOString()
    function onCreatorChange(v: CreatorInputValue) {
      patch({
        creator: {
          mode: v.mode,
          attributes: v.attributes,
          savedCreatorId: v.savedCreatorId || undefined,
          seedImages: v.seedImages.map((url, i) => ({ id: `creator-seed-${i}`, url, kind: 'raw' as const, createdAt: nowIso })),
          usagePath: v.usagePath,
          transformInstruction: v.transformInstruction,
          transformedImageUrl: v.usagePath === 'transform' ? v.resolvedImageUrl : undefined,
          likenessConsentAt: v.consentAt,
        },
      })
    }
    const readyToAdvance = creatorValue.mode !== 'uploaded_seed' || isCreatorReady(creatorValue)

    return (
      <div className="space-y-6">
        <StepHeader title="Cast your creator" desc="Tell us who should star in your ad — or let AI choose." onBack={goBack} />

        <BestResults title="For best results — casting fidelity" tips={[
          'Be specific and explicit about ethnicity and skin tone — e.g. “African American woman, deep brown skin.” Vague casting is the #1 cause of the AI rendering the wrong person.',
          'Set age range, hair, and wardrobe — the more concrete the description, the more consistent the result.',
          'Energy level and expression shape delivery: pick high energy for hooks, calm/warm for testimonials.',
          'Bringing your own creator? Upload 1–5 clear photos of the same person for the strongest identity match.',
        ]} />

        <CreatorInput value={creatorValue} onChange={onCreatorChange} savedCreators={savedCreators} />

        <div className="flex flex-col gap-3">
          <button onClick={goForward} disabled={!readyToAdvance} className="btn-fire w-full disabled:opacity-40">
            Next — Scene <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 5: Scene — type-specific questions (the content specifics for this ad
  // format) + how the creator interacts with the product. The questions change
  // completely based on the chosen ad type; their answers ground the storyboard
  // planner's dialogue in what the user actually told us.
  function renderScene() {
    const adType = resolveAdType(brief.style.commercialStyle)
    return (
      <div className="space-y-6">
        <StepHeader title="Tell us about your ad" desc="A few specifics for this format — then how the creator interacts with your product." onBack={goBack} />

        <div className="rounded-2xl border border-white/[0.08] bg-void-800/60 p-5">
          <TypeQuestions
            adType={adType}
            answers={brief.wizardAnswers ?? {}}
            onChange={(next) => patch({ wizardAnswers: next })}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">How should the creator interact with your product?</p>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCT_ACTION_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              onClick={() => patch({ scene: { ...brief.scene, productAction: opt.id } })}
              className={`rounded-2xl border p-4 text-left transition-all ${
                brief.scene.productAction === opt.id
                  ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                  : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{opt.label}</p>
                {brief.scene.productAction === opt.id && <Check className="h-4 w-4 text-fire-start" />}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{opt.phrase}</p>
            </button>
          ))}
        </div>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={goForward} disabled={!brief.scene.productAction} className="btn-fire w-full disabled:opacity-50">
            Next — Camera <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 2: Ad type (required) — the type-first choice. Each of the 12 engine
  // ad types drives its own beat structure, camera progression, and prompts.
  // Choosing one also seeds camera/lighting defaults from the nearest legacy
  // preset, then stores the engine ad-type id as commercialStyle.
  function renderStyle() {
    return (
      <div className="space-y-6">
        <StepHeader title="What kind of ad are you making?" desc="Pick a format — it shapes the beats, camera, and the exact prompts we generate." />

        <AdTypeSelector
          selected={resolveAdType(brief.style.commercialStyle)}
          onSelect={(adType) => {
            const seedPreset = ADTYPE_TO_PRESET[adType]
            const seeded = seedPreset ? applyStylePreset(brief, seedPreset) : brief
            setBrief(prev => {
              // Apply preset defaults for camera/lighting, but store the engine
              // ad-type id as commercialStyle so the engine drives generation.
              const next = { ...prev, ...seeded, style: { ...seeded.style, commercialStyle: adType } }
              scheduleSave(next)
              return next
            })
          }}
        />

        <button onClick={goForward} disabled={!brief.style.commercialStyle} className="btn-fire w-full disabled:opacity-50">
          Next — How Many <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Step 6: Camera direction (multi-select, up to 3)
  function renderCamera() {
    const selectedCams = brief.style.cameraDirection
    const preset = brief.style.commercialStyle ? STYLE_PRESETS[brief.style.commercialStyle] : null
    return (
      <div className="space-y-6">
        <StepHeader
          title="Camera direction"
          desc="Select up to 3 camera moves for your scenes."
          onBack={goBack}
          badge={preset && <span className="rounded-full border border-fire-start/30 bg-fire-start/[0.08] px-3 py-1 text-[11px] font-semibold text-fire-start">{preset.label} defaults applied</span>}
        />

        {selectedCams.length > 2 && (
          <p className="text-xs text-gold">✦ More than 3 camera moves per shot can look chaotic — consider trimming.</p>
        )}

        <ChipGrid
          options={CAMERA_OPTIONS}
          value={selectedCams}
          onChange={v => patch({ style: { ...brief.style, cameraDirection: v as string[] } })}
          multi
        />

        <div className="flex flex-col gap-3">
          <button onClick={goForward} className="btn-fire w-full">
            Next — Environment <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 7: Environment
  function renderEnvironment() {
    // A real uploaded photo (creator or product) already has a real, usable
    // background — forcing a generic preset onto it fights the actual
    // conditioning image the video model sees. Surface that clearly instead
    // of only offering artificial settings that don't apply.
    const hasRealPhoto = !!(brief.creator.transformedImageUrl || brief.creator.seedImages?.length || productPreview)
    return (
      <div className="space-y-6">
        <StepHeader title="Choose an environment" desc="Where does the scene take place?" onBack={goBack} />

        {hasRealPhoto && (
          <div className="rounded-xl border border-fire-start/20 bg-fire-start/[0.05] p-3">
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">You've uploaded a real photo</span> — pick <span className="font-semibold text-fire-start">Keep My Setting</span> to use its actual background as-is, instead of forcing a different preset scene onto it.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {ENVIRONMENT_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              onClick={() => patch({ scene: { ...brief.scene, environment: opt.id } })}
              className={`rounded-2xl border p-4 text-left transition-all ${
                brief.scene.environment === opt.id
                  ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                  : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{opt.label}</p>
                {brief.scene.environment === opt.id && <Check className="h-4 w-4 text-fire-start" />}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{opt.phrase}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={goForward} disabled={!brief.scene.environment} className="btn-fire w-full disabled:opacity-50">
            Next — Lighting <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 8: Lighting
  function renderLighting() {
    return (
      <div className="space-y-6">
        <StepHeader title="Lighting setup" desc="Choose the lighting mood for your scene." onBack={goBack} />

        <div className="grid grid-cols-2 gap-3">
          {LIGHTING_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              onClick={() => patch({ scene: { ...brief.scene, lighting: opt.id } })}
              className={`rounded-2xl border p-4 text-left transition-all ${
                brief.scene.lighting === opt.id
                  ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                  : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{opt.label}</p>
                {brief.scene.lighting === opt.id && <Check className="h-4 w-4 text-fire-start" />}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{opt.phrase}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={goForward} disabled={!brief.scene.lighting} className="btn-fire w-full disabled:opacity-50">
            Next — Voice <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 9: Voice
  function renderVoice() {
    const voiceModes = [
      { id: 'ai_generated', label: 'AI Generated', hint: 'We pick the best voice for your style' },
      { id: 'cloned',       label: 'Clone My Voice', hint: 'Upload a sample to match your voice' },
      { id: 'uploaded',     label: 'Upload Audio', hint: 'Record your own voiceover' },
    ] as const

    return (
      <div className="space-y-6">
        <StepHeader title="Voiceover" desc="Choose how the ad will sound." onBack={goBack} />

        <div className="grid gap-3">
          {voiceModes.map(({ id, label, hint }) => (
            <button key={id} type="button"
              onClick={() => patch({ voice: { ...brief.voice, mode: id } })}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                brief.voice.mode === id
                  ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                  : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <div className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-2 ${
                brief.voice.mode === id ? 'border-fire-start bg-fire-start' : 'border-void-400'
              }`}>
                {brief.voice.mode === id && <span className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="font-semibold text-ink">{label}</p>
                <p className="text-xs text-ink-muted">{hint}</p>
              </div>
              {(id === 'cloned' || id === 'uploaded') && (
                <span className="ml-auto rounded-full bg-void-700/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ink-faint">Soon</span>
              )}
            </button>
          ))}
        </div>

        {brief.voice.mode === 'ai_generated' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Voice gender</p>
                <ChipGrid options={[{ id: 'female', label: 'Female' }, { id: 'male', label: 'Male' }, { id: 'neutral', label: 'Neutral' }]} value={brief.voice.gender ?? ''} onChange={v => patch({ voice: { ...brief.voice, gender: v as string } })} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Tone</p>
                <ChipGrid options={[{ id: 'warm', label: 'Warm' }, { id: 'confident', label: 'Confident' }, { id: 'energetic', label: 'Energetic' }, { id: 'calm', label: 'Calm' }]} value={brief.voice.tone ?? ''} onChange={v => patch({ voice: { ...brief.voice, tone: v as string } })} />
              </div>
            </div>

            {/* ElevenLabs voice library */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Premium voice</p>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">ElevenLabs</span>
              </div>

              {voicesLoading && <p className="text-sm text-ink-muted">Loading voices…</p>}
              {voicesError && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-ink-muted">
                  {voicesError}
                </div>
              )}

              {!voicesLoading && !voicesError && voices.length > 0 && (() => {
                const g = (brief.voice.gender ?? '').toLowerCase()
                const filtered = g && g !== 'neutral'
                  ? voices.filter(v => !v.gender || v.gender.toLowerCase() === g)
                  : voices
                const list = (filtered.length ? filtered : voices).slice(0, 24)
                return (
                  <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {list.map(v => {
                      const selected = brief.voice.voiceId === v.voiceId
                      return (
                        <div key={v.voiceId}
                          className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
                            selected ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                          }`}>
                          <button
                            type="button"
                            onClick={() => previewVoice(v)}
                            disabled={!v.previewUrl}
                            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-void-700 text-fire-start hover:bg-void-600 disabled:opacity-30"
                            aria-label={`Preview ${v.name}`}
                          >
                            {previewingVoiceId === v.voiceId ? <span className="h-2.5 w-2.5 rounded-sm bg-fire-start" /> : <PlayIcon className="h-3.5 w-3.5" />}
                          </button>
                          <button type="button" onClick={() => patch({ voice: { ...brief.voice, voiceId: v.voiceId } })} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-semibold text-ink">{v.name}</p>
                            <p className="truncate text-[11px] text-ink-faint capitalize">
                              {[v.gender, v.accent, v.useCase].filter(Boolean).join(' · ') || v.category}
                            </p>
                          </button>
                          {selected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {!voicesLoading && !voicesError && voices.length === 0 && (
                <p className="text-xs text-ink-faint">No voices available. Set ELEVENLABS_API_KEY to enable premium voiceovers.</p>
              )}
              <p className="mt-2 text-[11px] text-ink-faint">The voiceover is generated from your script in the next steps and plays with your finished ad.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button onClick={goForward} className="btn-fire w-full">
            Next — Script <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 10: Script
  function renderScript() {
    const modes = [
      { id: 'product',    label: 'From product',       hint: 'AI writes from your product brief' },
      { id: 'benefits',   label: 'Feature-led',        hint: 'Lead with product benefits' },
      { id: 'pain_points', label: 'Problem → Solution', hint: 'Start with the customer pain' },
      { id: 'cta',        label: 'CTA-first',          hint: 'Lead with the action you want' },
      { id: 'manual',     label: 'Write my own',       hint: 'Full control over the script' },
    ] as const

    return (
      <div className="space-y-6">
        <StepHeader title="Script generation" desc="How should AI write your ad script?" onBack={goBack} />

        <div className="grid grid-cols-2 gap-3">
          {modes.map(({ id, label, hint }) => (
            <button key={id} type="button"
              onClick={() => patch({ script: { ...brief.script, generationMode: id } })}
              className={`rounded-2xl border p-4 text-left transition-all ${
                brief.script.generationMode === id
                  ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                  : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <p className="font-semibold text-ink">{label}</p>
              <p className="mt-1 text-xs text-ink-faint">{hint}</p>
            </button>
          ))}
        </div>

        {brief.script.generationMode === 'manual' && (
          <textarea
            rows={5}
            value={brief.script.editedText ?? ''}
            onChange={e => patch({ script: { ...brief.script, editedText: e.target.value } })}
            placeholder="Write your own script here. Keep it 15-30 seconds for best results."
            className="w-full resize-none rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
          />
        )}

        <div className="flex flex-col gap-3">
          <button onClick={goForward} className="btn-fire w-full">
            Next — Storyboard <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 11: Storyboard — plan every clip up front, let the user edit/regenerate,
  // then "Generate All" fires the whole queue and every clip lands together.
  function renderStoryboardGenerate() {
    const doneSeconds = wizardQueue.tiles.filter(t => t.status === 'complete').reduce((s, t) => s + t.durationSeconds, 0)

    return (
      <div className="space-y-6">
        <StepHeader
          title="Storyboard"
          desc={
            wizardPhase === 'plan' ? 'Review, edit, or regenerate any clip — then generate the whole ad at once.'
            : wizardPhase === 'rendering' ? 'Clips render in order, each continuing from the last one’s final frame, then stitch into one seamless ad.'
            : 'Every clip up front — editable, regeneratable — before a single render starts.'
          }
          onBack={wizardPhase === 'idle' || wizardPhase === 'planning' ? goBack : undefined}
        />

        {wizardPhase === 'idle' && !productImageUrl && (
          <div className="rounded-2xl border border-dashed border-white/12 p-10 text-center">
            <Film className="mx-auto h-8 w-8 text-ink-faint/50" />
            <p className="mt-3 text-sm text-ink-muted">Add a product image in Assets before planning the storyboard.</p>
          </div>
        )}

        {wizardPhase === 'planning' && (
          <div className="rounded-2xl border border-white/10 bg-void-800/50 p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-fire-start" />
            <h2 className="mt-4 text-lg font-bold text-ink">Planning your commercial…</h2>
            <p className="mt-1.5 text-sm text-ink-muted">Claude is breaking this into scroll-stopping clips, each timed to speak clean.</p>
          </div>
        )}

        {wizardPhase === 'error' && (
          <div className="rounded-2xl border border-fire-start/20 bg-fire-start/5 p-5">
            <p className="text-sm font-semibold text-fire-start">Could not plan the storyboard</p>
            <p className="mt-1 text-sm text-ink-muted">{wizardPlanError}</p>
            <button onClick={() => runWizardPlan()} className="btn-fire mt-4 py-2.5 px-5 text-sm">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}

        {wizardPhase === 'plan' && wizardPlan && (
          <StoryboardPlanner
            plan={wizardPlan}
            onChange={setWizardPlan}
            onGenerate={generateAllClips}
            onRegenClip={regenWizardClip}
            regeneratingOrder={wizardRegenOrder}
            clipCountBusy={wizardClipCountBusy}
            onClipCountChange={changeWizardClipCount}
            renderClipExtra={(clip) => <PromptPreview brief={brief} clip={clip} />}
          />
        )}

        {wizardPhase === 'rendering' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">Each clip continues from the previous one’s final frame, then fires the next automatically.</p>
              <button onClick={() => { wizardQueue.cancel(); setWizardPhase('plan') }} className="btn-ghost gap-1.5 px-3.5 py-2 text-sm">
                <X className="h-4 w-4" /> Back to storyboard
              </button>
            </div>

            <GenerationPanel
              tiles={wizardQueue.tiles}
              running={wizardQueue.running}
              completedCount={wizardQueue.completedCount}
              onRetry={retryWizardClip}
              onRemix={retryWizardClip}
              onDownload={url => window.open(url, '_blank', 'noopener')}
            />

            {/* Assembly is automatic once every clip settles — no extra tap needed. */}
            {wizardAssembling && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-fire-start/20 bg-fire-start/[0.06] p-5">
                <RefreshCw className="h-4 w-4 animate-spin text-fire-start" />
                <p className="text-sm font-semibold text-ink">
                  Assembling your ~{doneSeconds}-second commercial…
                </p>
              </div>
            )}

            {wizardAssemblyError && (
              <div className="rounded-2xl border border-fire-start/20 bg-fire-start/5 p-5">
                <p className="text-sm font-semibold text-fire-start">Could not assemble the final commercial</p>
                <p className="mt-1 text-sm text-ink-muted">{wizardAssemblyError}</p>
                <p className="mt-1 text-xs text-ink-faint">Your individual clips above are still complete and downloadable.</p>
                <button onClick={assembleWizardAd} className="btn-fire mt-4 py-2.5 px-5 text-sm">
                  <RefreshCw className="h-4 w-4" /> Retry assembly
                </button>
              </div>
            )}

            {wizardAssembledUrl && (
              <div className="rounded-2xl border border-white/10 bg-void-800/50 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Check className="h-4 w-4" /> Your commercial is ready
                </div>
                <video src={wizardAssembledUrl} controls autoPlay playsInline className="mx-auto max-h-[70vh] rounded-xl" />
                <div className="mt-3 flex justify-center gap-2">
                  <a href={wizardAssembledUrl} download="commercial.mp4" className="btn-fire gap-1.5 px-5 py-2.5 text-sm">
                    <Download className="h-4 w-4" /> Download commercial
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Step content router ───────────────────────────────────────────────────

  function renderStep() {
    switch (stepNum) {
      case 1:  return renderStyle()
      case 2:  return renderCount()
      case 3:  return renderProduct()
      case 4:  return renderCreator()
      case 5:  return renderScene()
      case 6:  return renderCamera()
      case 7:  return renderEnvironment()
      case 8:  return renderLighting()
      case 9:  return renderVoice()
      case 10: return renderScript()
      case 11: return renderStoryboardGenerate()
      default: return null
    }
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      {cameraOpen && <CameraStudio onCapture={handleCapture} onClose={() => setCameraOpen(false)} />}

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Link to="/dashboard" className="hover:text-ink transition-colors">Campaigns</Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink">New campaign</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Commercial Studio</h1>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {draftSavedAt && (
              <motion.span
                key="draft-toast"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25"
              >
                <Check className="h-3 w-3" /> Draft saved
              </motion.span>
            )}
          </AnimatePresence>
          <span className="eyebrow hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
            Step {stepNum} of 11
          </span>
        </div>
      </div>

      {/* Cloned-from-ad banner */}
      {clonedFrom && (
        <div className="mb-5 rounded-2xl border border-fire-start/20 bg-fire-start/[0.06] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-fire-start/15">
              <Spark className="h-4 w-4 text-fire-start" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                Filled from ad analysis · <span className="text-fire-start">{clonedFrom.name}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{clonedFrom.notes}</p>
              <p className="mt-1.5 text-[11px] text-ink-faint">Creator, style, and script are pre-filled — edit anything before generating.</p>
            </div>
            <button onClick={() => setClonedFrom(null)} className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile progress bar */}
      <div className="mb-5 lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
            {STEPS[stepNum - 1].label}
          </span>
          <span className="text-xs text-ink-faint">{Math.round((stepNum / 11) * 100)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-void-600">
          <motion.div
            className="h-1 rounded-full bg-gradient-fire"
            animate={{ width: `${(stepNum / 11) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">

        {/* Left: stepper (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <Stepper />
          </div>
        </div>

        {/* Right: step content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={stepNum}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  )
}

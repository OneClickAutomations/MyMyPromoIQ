/**
 * CommercialStudio — Phase 1 wizard shell using the CreativeBrief canonical object.
 *
 * Route: /studio/new
 * 11 steps: Product → Creator → Scene → Style → Camera → Environment →
 *           Lighting → Voice → Script → Storyboard → Director (generation)
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import CameraStudio from '../components/CameraStudio'
import ProductInput, { type ProductInputValue } from '../components/ProductInput'
import {
  ArrowRight, Bolt, Camera, Check, ChevronDown, ChevronRight, Download, Film, ImageIcon, Info, Layers,
  Palette, PlayIcon, RefreshCw, Spark, Upload, Users, Wand, X,
} from '../components/icons'
import {
  startGeneration,
  pollUntilDone,
  presignUpload,
  uploadDirectToStorage,
  dataUrlToBlob,
  saveBrief,
  getBrief,
  runDirector,
  listCreators,
  listProducts,
  getBrand,
  listVoices,
  generateVoiceover,
  muxVideoAudio,
  stitchVideos,
  generateModelSheet,
  type DirectorLogEntry,
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
import { composeHiggsfieldPrompt, detectConflicts } from '../lib/studio/compositionEngine'

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { num: 1,  key: 'product',     label: 'Product',      required: true,  icon: Upload },
  { num: 2,  key: 'creator',     label: 'Creator',      required: false, icon: Users },
  { num: 3,  key: 'scene',       label: 'Scene',        required: false, icon: Camera },
  { num: 4,  key: 'style',       label: 'Style',        required: true,  icon: Wand },
  { num: 5,  key: 'camera',      label: 'Camera',       required: false, icon: Camera },
  { num: 6,  key: 'environment', label: 'Environment',  required: false, icon: ImageIcon },
  { num: 7,  key: 'lighting',    label: 'Lighting',     required: false, icon: Spark },
  { num: 8,  key: 'voice',       label: 'Voice',        required: false, icon: Bolt },
  { num: 9,  key: 'script',      label: 'Script',       required: false, icon: Wand },
  { num: 10, key: 'storyboard',  label: 'Storyboard',   required: true,  icon: PlayIcon },
  { num: 11, key: 'director',    label: 'Director',     required: true,  icon: Spark },
] as const

// ── Creator attribute options ─────────────────────────────────────────────────

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary']
const AGE_OPTIONS    = ['18–24', '25–34', '35–44', '45–54', '55+']
const ETHNICITY_OPTIONS = ['Asian', 'Black / African American', 'Hispanic / Latino', 'Middle Eastern', 'South Asian', 'White / Caucasian', 'Mixed / Other']
const WARDROBE_OPTIONS = ['casual streetwear', 'athletic / sportswear', 'business casual', 'cozy loungewear', 'trendy fashion', 'classic / timeless']
const ENERGY_OPTIONS: Array<{ id: CreatorAttributes['energyLevel']; label: string; hint: string }> = [
  { id: 'low',    label: 'Calm',     hint: 'Trustworthy, measured delivery' },
  { id: 'medium', label: 'Engaging', hint: 'Relatable, natural enthusiasm' },
  { id: 'high',   label: 'Hype',     hint: 'High-energy, scroll-stopper' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function videoThumbSrc(url: string): string {
  return /#t=/.test(url) ? url : `${url}#t=0.1`
}

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

// ── Turnaround model-sheet generator (Gemini) ──────────────────────────────────
// Turns one reference photo into a 2x3 multi-angle sheet for consistency review.
function ModelSheetGenerator({ imageUrl, subjectType, subjectHint }: {
  imageUrl: string
  subjectType: 'product' | 'character'
  subjectHint?: string
}) {
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function go() {
    if (!imageUrl || busy) return
    setBusy(true); setErr(''); setSheet(null)
    try {
      const { sheetDataUrl } = await generateModelSheet({ imageUrl, subjectType, subjectHint })
      setSheet(sheetDataUrl)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate the turnaround.')
    } finally {
      setBusy(false)
    }
  }

  const label = subjectType === 'character' ? 'character' : 'product'
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-void-800 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-fire-start/15">
          <Layers className="h-4 w-4 text-fire-start" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Generate a 360° turnaround reference</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            AI reimagines your {label} from 6 angles on one sheet — a consistency reference to review before you generate.
          </p>
        </div>
      </div>

      <button onClick={go} disabled={!imageUrl || busy}
        className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-40">
        {busy
          ? <><RefreshCw className="h-4 w-4 animate-spin" /> Rendering turnaround…</>
          : <><Spark className="h-4 w-4" /> {sheet ? 'Regenerate turnaround' : 'Generate turnaround'}</>}
      </button>

      {err && <p className="mt-2 text-xs text-amber-300">{err}</p>}

      {sheet && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
          <img src={sheet} alt={`${label} turnaround model sheet`} className="w-full" />
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-void-900 px-3 py-2">
            <span className="text-[11px] text-ink-faint">6-angle reference sheet</span>
            <a href={sheet} download={`${label}-turnaround.png`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fire-start hover:text-fire-end">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Circular generation progress indicator ─────────────────────────────────────
function CircularProgress({ pct, label }: { pct: number; label: string }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  const isDone = pct >= 100
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        {/* Outer glow ring — pulses while in progress */}
        {!isDone && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full animate-pulse"
            style={{ boxShadow: `0 0 32px 6px rgba(255,107,53,${0.15 + pct / 500})` }}
          />
        )}
        <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
          <defs>
            <linearGradient id="cg-fire" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF6B35" />
              <stop offset="100%" stopColor="#FFD700" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={isDone ? '#4ade80' : 'url(#cg-fire)'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.9s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-ink">{Math.round(pct)}%</span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-ink-faint">
            {isDone ? 'Done' : pct < 75 ? 'Planning' : 'Rendering'}
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold text-fire-start/90">{label}</p>
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

// ── Card option (preset cards) ────────────────────────────────────────────────

function PresetCard({
  label,
  blurb,
  img,
  selected,
  onSelect,
}: {
  label: string
  blurb: string
  img?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
        selected
          ? 'border-fire-start/60 ring-2 ring-fire-start/20 shadow-[0_0_28px_rgba(255,107,53,0.18)]'
          : 'border-white/[0.08] hover:border-white/[0.26] hover:shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
      }`}
    >
      {img && (
        <div className="relative aspect-video overflow-hidden">
          <img src={img} alt={label} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {selected && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-fire shadow-fire-soft"
            >
              <Check className="h-3.5 w-3.5 text-white" />
            </motion.div>
          )}
        </div>
      )}
      <div className={`p-4 ${img ? 'border-t' : ''} ${selected ? 'border-fire-start/20 bg-fire-start/[0.06]' : 'border-white/[0.06] bg-void-900/80'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-ink">{label}</p>
          {!img && selected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{blurb}</p>
      </div>
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type InputMethod = 'upload' | 'camera' | 'url' | 'product-url'
type DirectorPhase = 'idle' | 'directing' | 'generating' | 'done' | 'error'

const STYLE_IMAGES: Record<string, string> = {
  ugc_testimonial:   '/assets/fmt-testimonial.png',
  founder_story:     '/assets/fmt-testimonial.png',
  luxury_commercial: '/assets/fmt-life.png',
  cinematic_brand:   '/assets/fmt-life.png',
  fast_cut_hook:     '/assets/fmt-hook.png',
  unboxing:          '/assets/fmt-unbox.png',
  explainer:         '/assets/fmt-unbox.png',
}

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

  // ── Director feed state
  const [directorPhase, setDirectorPhase]       = useState<DirectorPhase>('idle')
  const [directorLog, setDirectorLog]           = useState<DirectorLogEntry[]>([])
  const [visibleLogCount, setVisibleLogCount]   = useState(0)
  const [directorNote, setDirectorNote]         = useState('')
  const [expandedStages, setExpandedStages]     = useState<Set<string>>(new Set())
  const [videoUrl, setVideoUrl]                 = useState<string | null>(null)
  const [genError, setGenError]                 = useState('')
  const [voiceoverUrl, setVoiceoverUrl]         = useState<string | null>(null)
  const [voiceoverError, setVoiceoverError]     = useState('')
  const [muxedUrl, setMuxedUrl]                 = useState<string | null>(null)
  const [muxing, setMuxing]                     = useState(false)
  const [muxError, setMuxError]                 = useState('')

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
  type SceneResult = { label: string; videoUrl: string; voiceoverUrl: string | null }
  const SCENE_LABELS = ['Hook', 'Problem / Agitation', 'Solution', 'Social Proof', 'Call to Action', 'Outro'] as const
  const [completedScenes, setCompletedScenes] = useState<SceneResult[]>([])
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0)
  // 'quick' = one video in a chosen format; 'full' = build up to 6 scenes into a
  // complete commercial. Seeded from the dashboard entry point (?mode=).
  const [adMode, setAdMode] = useState<'quick' | 'full'>('full')
  const [genProgress, setGenProgress] = useState(0)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stitch state
  const [stitching, setStitching] = useState(false)
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null)
  const [stitchError, setStitchError] = useState('')

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
    if (mode === 'quick' || mode === 'full') setAdMode(mode)
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
    if (stepNum === 8) loadVoices()
  }, [stepNum, loadVoices])

  // Auto-combine the rendered scene with its voiceover the moment both are ready,
  // so the finished clip actually plays with sound — no manual "combine" click
  // (that extra step was why generated videos seemed silent). The guards make this
  // fire exactly once per scene.
  useEffect(() => {
    if (directorPhase === 'done' && videoUrl && voiceoverUrl && !muxedUrl && !muxing) {
      handleMux()
    }
  }, [directorPhase, videoUrl, voiceoverUrl, muxedUrl, muxing]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleMux() {
    if (!videoUrl || !voiceoverUrl || muxing) return
    setMuxing(true)
    setMuxError('')
    try {
      const { videoDataUrl } = await muxVideoAudio({ videoUrl, audioBase64: voiceoverUrl })
      setMuxedUrl(videoDataUrl)
    } catch (err) {
      setMuxError(err instanceof Error ? err.message : 'Could not combine audio and video.')
    } finally {
      setMuxing(false)
    }
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
    if (v.description || v.name) setDescInput(v.description || v.name)
    patch({ product: { ...brief.product, productName: v.name || brief.product.productName, description: v.description || brief.product.description } })
  }

  // ── Director feed / generation ────────────────────────────────────────────

  // Stage → percentage milestones (directing phase)
  const STAGE_PROGRESS: Record<string, number> = {
    analyzing: 12, casting: 28, scripting: 48, storyboarding: 68,
  }

  async function handleGenerate(sceneLabel?: string) {
    if (!productImageUrl) return
    setDirectorPhase('directing')
    setDirectorLog([])
    setVisibleLogCount(0)
    setExpandedStages(new Set())
    setVideoUrl(null)
    setGenError('')
    setVoiceoverUrl(null)
    setVoiceoverError('')
    setMuxedUrl(null)
    setMuxError('')
    setGenProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)

    // Kick off the voiceover in parallel — it's independent of the video render,
    // so we don't make the user wait on it sequentially.
    const scriptText = brief.script.editedText || brief.script.generatedText || ''
    let currentVoiceoverUrl: string | null = null
    if (scriptText.trim() && brief.voice.voiceId) {
      generateVoiceover({ text: scriptText, voiceId: brief.voice.voiceId, speed: brief.voice.speed })
        .then(r => { currentVoiceoverUrl = r.audioDataUrl; setVoiceoverUrl(r.audioDataUrl) })
        .catch(e => setVoiceoverError(e instanceof Error ? e.message : 'Voiceover failed.'))
    }

    try {
      // 1. Run director commentary
      const { log } = await runDirector({
        productName: brief.product.productName,
        description: brief.product.description ?? descInput,
        style: brief.style.commercialStyle,
        creatorMode: brief.creator.mode,
        energyLevel: brief.creator.attributes?.energyLevel,
      })

      // Animate log entries in, one per second, updating progress circle
      setDirectorLog(log)
      for (let i = 0; i < log.length; i++) {
        await new Promise(r => setTimeout(r, 900))
        setVisibleLogCount(i + 1)
        const stage = log[i]?.stage as string | undefined
        if (stage && STAGE_PROGRESS[stage] !== undefined) {
          setGenProgress(STAGE_PROGRESS[stage])
        }
      }

      // 2. Transition to rendering stage — start time-based creep 75% → 95%
      setDirectorPhase('generating')
      setGenProgress(75)
      let crept = 75
      progressTimerRef.current = setInterval(() => {
        crept = Math.min(95, crept + (95 - crept) * 0.04)
        setGenProgress(crept)
      }, 2_000)

      // 3. Submit to Higgsfield with scene-specific focus when provided.
      const composed = composeHiggsfieldPrompt(brief)
      const composedPrompt = composed.scenes.map(s => s.prompt).join(' ')
      const label = sceneLabel ?? SCENE_LABELS[currentSceneIdx]
      const { requestId, directorPrompt } = await startGeneration({
        productImageUrl,
        productDescription: brief.product.description ?? descInput,
        style: brief.style.commercialStyle || 'testimonial',
        quality: 'turbo',
        composedPrompt,
        negativePrompt: composed.negativePrompt,
        brandVoice: savedBrand?.brand_voice ?? undefined,
        brandTaglines: (savedBrand?.taglines as string[] | undefined) ?? undefined,
        brandCta: savedBrand?.cta_preferences ?? undefined,
        sceneLabel: label,
      })
      setDirectorNote(directorPrompt)

      setDirectorLog(prev => [...prev, {
        timestamp: new Date().toISOString(),
        stage: 'rendering',
        message: directorPrompt || 'Submitting to the render engine — stand by.',
      }])
      setVisibleLogCount(prev => prev + 1)

      // 4. Poll for completion
      const final: StatusResponse = await pollUntilDone(requestId, () => {}, {
        intervalMs: 5_000,
        timeoutMs: 10 * 60 * 1_000,
      })

      if (progressTimerRef.current) clearInterval(progressTimerRef.current)

      if (final.status === 'completed' && final.videoUrl) {
        setGenProgress(100)
        setVideoUrl(final.videoUrl)
        setDirectorPhase('done')
        patch({ status: 'complete', render: { ...brief.render, outputUrl: final.videoUrl, statusLog: [] } })
        // Save this scene to the completed list
        setCompletedScenes(prev => [...prev, {
          label: label,
          videoUrl: final.videoUrl!,
          voiceoverUrl: currentVoiceoverUrl,
        }])
      } else {
        setGenProgress(0)
        const msg = final.raw === 'timeout' ? 'Render timed out — try again.' : 'Render failed. Try a different style or image.'
        setGenError(msg)
        setDirectorPhase('error')
      }
    } catch (err) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      setGenProgress(0)
      setGenError(err instanceof Error ? err.message : 'Something went wrong.')
      setDirectorPhase('error')
    }
  }

  function handleNextScene() {
    const next = currentSceneIdx + 1
    setCurrentSceneIdx(next)
    setVideoUrl(null)
    setVoiceoverUrl(null)
    setMuxedUrl(null)
    setMuxError('')
    setDirectorPhase('idle')
    setGenProgress(0)
    handleGenerate(SCENE_LABELS[next])
  }

  async function handleStitch() {
    const urls = completedScenes.map(s => s.videoUrl)
    if (urls.length < 2) return
    setStitching(true)
    setStitchError('')
    try {
      const { videoDataUrl } = await stitchVideos(urls)
      setStitchedUrl(videoDataUrl)
    } catch (e) {
      setStitchError(e instanceof Error ? e.message : 'Stitch failed.')
    } finally {
      setStitching(false)
    }
  }

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

  // Step 1: Product
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

        {/* Optional: turnaround model sheet for consistency (needs an image). */}
        {productImageUrl && (
          <ModelSheetGenerator imageUrl={productImageUrl} subjectType="product" subjectHint={brief.product.productName || undefined} />
        )}

        <button onClick={handleProductNext} disabled={!canAdvanceStep1 || uploadingImage} className="btn-fire w-full disabled:opacity-50">
          {uploadingImage ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Uploading…</> : <>Next — Creator <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    )
  }

  // Step 2: Creator
  function renderCreator() {
    const attrs = brief.creator.attributes
    return (
      <div className="space-y-6">
        <StepHeader title="Cast your creator" desc="Tell us who should star in your ad — or let AI choose." onBack={goBack} />

        <BestResults title="For best results — casting fidelity" tips={[
          'Be specific and explicit about ethnicity and skin tone — e.g. “African American woman, deep brown skin.” Vague casting is the #1 cause of the AI rendering the wrong person.',
          'Set age range, hair, and wardrobe — the more concrete the description, the more consistent the result.',
          'Energy level and expression shape delivery: pick high energy for hooks, calm/warm for testimonials.',
          'Save a creator you like in the Creator Studio so you can reuse the exact same person across campaigns.',
        ]} />

        <div className={`grid gap-3 ${savedCreators.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {([
            { mode: 'generated' as const,    label: 'Generate AI Creator', desc: 'AI builds from attributes' },
            { mode: 'uploaded_seed' as const, label: 'Upload Seed Image',  desc: 'Use a reference photo' },
            ...(savedCreators.length > 0 ? [{ mode: 'saved' as const, label: 'My Creators', desc: `${savedCreators.length} saved` }] : []),
          ]).map(({ mode, label, desc }) => (
            <button key={mode} type="button"
              onClick={() => patch({ creator: { ...brief.creator, mode } })}
              className={`rounded-2xl border p-4 text-left transition-all ${
                brief.creator.mode === mode ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
              }`}>
              <p className="font-bold text-ink text-sm">{label}</p>
              <p className="mt-1 text-xs text-ink-muted">{desc}</p>
            </button>
          ))}
        </div>

        {brief.creator.mode === 'generated' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Gender</p>
              <ChipGrid options={GENDER_OPTIONS.map(v => ({ id: v, label: v }))} value={attrs?.gender ?? ''} onChange={v => patch({ creator: { ...brief.creator, attributes: { ...attrs!, gender: v as string } } })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Age range</p>
              <ChipGrid options={AGE_OPTIONS.map(v => ({ id: v, label: v }))} value={attrs?.ageRange ?? ''} onChange={v => patch({ creator: { ...brief.creator, attributes: { ...attrs!, ageRange: v as string } } })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Ethnicity</p>
              <ChipGrid options={ETHNICITY_OPTIONS.map(v => ({ id: v, label: v }))} value={attrs?.ethnicity ?? ''} onChange={v => patch({ creator: { ...brief.creator, attributes: { ...attrs!, ethnicity: v as string } } })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Wardrobe vibe</p>
              <ChipGrid options={WARDROBE_OPTIONS.map(v => ({ id: v, label: v }))} value={attrs?.wardrobe ?? ''} onChange={v => patch({ creator: { ...brief.creator, attributes: { ...attrs!, wardrobe: v as string } } })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">On-camera energy</p>
              <div className="grid grid-cols-3 gap-3">
                {ENERGY_OPTIONS.map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => patch({ creator: { ...brief.creator, attributes: { ...attrs!, energyLevel: opt.id } } })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      attrs?.energyLevel === opt.id ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                    }`}>
                    <p className="text-sm font-bold text-ink">{opt.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{opt.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {brief.creator.mode === 'uploaded_seed' && (
          <div className="rounded-2xl border border-white/[0.08] bg-void-800 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-void-700">
              <Upload className="h-6 w-6 text-ink-faint" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">Seed image upload</p>
            <p className="mt-1 text-xs text-ink-muted">Coming soon — use AI creator for now.</p>
          </div>
        )}

        {brief.creator.mode === 'saved' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {savedCreators.map(c => {
              const attrs = (c.attributes ?? {}) as Record<string, string>
              const initials = c.name.split(' ').slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase() || '?'
              const selected = brief.creator.savedCreatorId === c.id
              return (
                <button key={c.id} type="button"
                  onClick={() => patch({ creator: {
                    ...brief.creator,
                    mode: 'saved',
                    savedCreatorId: c.id,
                    attributes: {
                      gender: attrs.gender ?? '',
                      ageRange: attrs.ageRange ?? '',
                      ethnicity: attrs.ethnicity ?? '',
                      bodyType: '',
                      hair: attrs.hairStyle ?? '',
                      wardrobe: attrs.wardrobe ?? '',
                      expression: attrs.personality ?? '',
                      energyLevel: (attrs.energyLevel as 'low' | 'medium' | 'high') ?? 'medium',
                      cameraConfidence: attrs.cameraConfidence ?? '',
                    },
                  }})}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selected ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                  }`}>
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-bold text-white" style={{ background: '#FF6B35' }}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-muted">{attrs.creatorType ?? 'AI Creator'}</p>
                  </div>
                  {selected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button onClick={goForward} className="btn-fire w-full">
            Next — Scene <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 3: Scene (product action)
  function renderScene() {
    return (
      <div className="space-y-6">
        <StepHeader title="Set the scene" desc="How should the creator interact with your product?" onBack={goBack} />

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

        <div className="flex flex-col gap-3">
          <button onClick={goForward} disabled={!brief.scene.productAction} className="btn-fire w-full disabled:opacity-50">
            Next — Style <ArrowRight className="h-4 w-4" />
          </button>
          <SkipButton onClick={skipWithDefaults} />
        </div>
      </div>
    )
  }

  // Step 4: Style (required)
  function renderStyle() {
    const presets = Object.values(STYLE_PRESETS)
    return (
      <div className="space-y-6">
        <StepHeader title="Pick a commercial style" desc="This determines the look, feel, and energy of your entire campaign." onBack={goBack} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {presets.map(preset => (
            <PresetCard
              key={preset.id}
              label={preset.label}
              blurb={preset.blurb}
              img={STYLE_IMAGES[preset.id]}
              selected={brief.style.commercialStyle === preset.id}
              onSelect={() => {
                const updated = applyStylePreset(brief, preset.id)
                setBrief(prev => {
                  const next = { ...prev, ...updated }
                  scheduleSave(next)
                  return next
                })
              }}
            />
          ))}
        </div>

        <button onClick={goForward} disabled={!brief.style.commercialStyle} className="btn-fire w-full disabled:opacity-50">
          Next — Camera <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Step 5: Camera direction (multi-select, up to 3)
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

  // Step 6: Environment
  function renderEnvironment() {
    return (
      <div className="space-y-6">
        <StepHeader title="Choose an environment" desc="Where does the scene take place?" onBack={goBack} />

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

  // Step 7: Lighting
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

  // Step 8: Voice
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

  // Step 9: Script
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

  // Step 10: Storyboard review (composition engine preview)
  function renderStoryboard() {
    const payload = (() => {
      try { return composeHiggsfieldPrompt(brief) } catch { return null }
    })()
    const conflicts = detectConflicts(brief)
    const preset = brief.style.commercialStyle ? STYLE_PRESETS[brief.style.commercialStyle] : null

    return (
      <div className="space-y-6">
        <StepHeader title="Storyboard preview" desc="Review the AI-composed shot list before generating." onBack={goBack} />

        {/* Brief summary card */}
        <div className="rounded-2xl border border-white/[0.08] bg-void-900/60 p-5 space-y-3">
          {productPreview && (
            <div className="flex items-center gap-3">
              <img src={productPreview} alt="Product" className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{brief.product.productName || 'Product'}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">{brief.product.description ?? descInput}</p>
              </div>
            </div>
          )}
          {preset && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-fire-start/30 bg-fire-start/[0.08] px-3 py-1 text-[11px] font-semibold text-fire-start">{preset.label}</span>
              <span className="text-xs text-ink-faint">· {payload?.estimatedCredits ?? 0} est. credits</span>
            </div>
          )}
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            {conflicts.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-gold/20 bg-gold/[0.05] px-4 py-3">
                <span className="text-gold text-sm">⚠</span>
                <p className="text-sm text-ink-muted">{w.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Scene list */}
        {payload && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Scene breakdown</p>
            {payload.scenes.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-void-800/60 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-fire-start">Scene {i + 1}</span>
                  <span className="text-[10px] text-ink-faint">{s.durationSeconds}s · {s.cameraDirection}</span>
                </div>
                <p className="text-sm text-ink-muted leading-relaxed">{s.prompt}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={goForward} className="btn-fire w-full">
          <Wand className="h-4 w-4" />
          Approve & Generate →
        </button>
      </div>
    )
  }

  // Step 11: Director feed (Phase 0.3)
  const STAGE_LABELS: Record<string, string> = {
    analyzing:    'Brief reviewed',
    casting:      'Creator chosen',
    scripting:    'Script written',
    storyboarding:'Scenes planned',
    rendering:    'Video rendered',
  }

  function renderDirector() {
    const allStages = ['analyzing', 'casting', 'scripting', 'storyboarding', 'rendering']
    const doneStages = directorLog.slice(0, visibleLogCount).map(e => e.stage)
    const isGenerating = directorPhase === 'directing' || directorPhase === 'generating'
    const currentLabel = SCENE_LABELS[currentSceneIdx] ?? `Scene ${currentSceneIdx + 1}`
    const scenesDone = completedScenes.length
    // Quick Create = a single video; Full Ad = build up to all six beats.
    const canAddMore = adMode === 'full' && scenesDone < SCENE_LABELS.length
    const canStitch = scenesDone >= 2

    return (
      <div className="space-y-6">
        <StepHeader
          title={scenesDone === 0 ? (adMode === 'quick' ? 'Quick Create' : 'AI Director') : `Scene ${scenesDone + (directorPhase === 'done' ? 0 : 1)} of ${SCENE_LABELS.length}`}
          desc={isGenerating ? `Generating — ${currentLabel}` : scenesDone > 0 ? (adMode === 'full' ? 'Keep going or stitch your scenes into a full ad.' : 'Your video is ready below.') : 'Sit back — the director is working.'}
          onBack={directorPhase === 'idle' ? goBack : undefined}
        />

        {/* ── Ad structure — the six beats that make a full commercial (full mode) ─ */}
        {adMode === 'full' && (
        <div className="rounded-2xl border border-white/[0.07] bg-void-900/40 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Ad structure</p>
            <span className="text-[10px] text-ink-faint">{scenesDone}/{SCENE_LABELS.length} beats · all six = a full commercial</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCENE_LABELS.map((label, i) => {
              const done = i < scenesDone
              const current = i === scenesDone
              return (
                <span key={label}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                    done ? 'bg-emerald-500/15 text-emerald-300'
                    : current ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30'
                    : 'bg-void-700/40 text-ink-faint'
                  }`}>
                  {done ? <Check className="h-3 w-3" /> : <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-black/20 text-[8px]">{i + 1}</span>}
                  {label}
                </span>
              )
            })}
          </div>
        </div>
        )}

        {/* ── Completed scenes gallery ──────────────────────────────────────── */}
        {completedScenes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Completed scenes</p>
            <div className="grid grid-cols-3 gap-2">
              {completedScenes.map((sc, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-void-900">
                  <video
                    src={videoThumbSrc(sc.videoUrl)}
                    muted playsInline preload="metadata"
                    className="aspect-[9/16] w-full object-cover"
                    onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                    onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                    <p className="truncate text-[9px] font-bold text-white/90">{sc.label}</p>
                  </div>
                  <div className="absolute right-1.5 top-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                </div>
              ))}
              {/* Empty slot placeholders — labeled with the upcoming scene beat (full mode) */}
              {adMode === 'full' && SCENE_LABELS.slice(completedScenes.length).map((label, i) => (
                <div key={`empty-${i}`} className="flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/[0.08] bg-void-900/30 p-2 text-center">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-void-700/60 text-[10px] font-bold text-ink-faint">{completedScenes.length + i + 1}</span>
                  <span className="text-[9px] font-semibold leading-tight text-ink-faint">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Idle: start / next-scene button ──────────────────────────────── */}
        {directorPhase === 'idle' && (
          <div className="space-y-4">
            {scenesDone === 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-5">
                <p className="text-sm text-ink-muted">The Composition Engine has assembled your brief. The AI Director will plan and render:</p>
                <ul className="mt-3 space-y-1.5">
                  {allStages.map(s => (
                    <li key={s} className="flex items-center gap-2.5 text-sm text-ink-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-fire-start/40" />
                      {STAGE_LABELS[s]}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-faint">{adMode === 'full' ? "You'll be able to generate up to 6 scenes and stitch them into one complete ad." : 'Quick Create renders a single video in your chosen format.'}</p>
              </div>
            )}
            {savedBrand && scenesDone === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-fire-start/20 bg-fire-start/[0.06] px-4 py-2.5">
                <Palette className="h-3.5 w-3.5 flex-shrink-0 text-fire-start" />
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-fire-start">Brand Kit active</span>
                  {savedBrand.brand_voice ? ` · ${savedBrand.brand_voice}` : ''}
                  {savedBrand.cta_preferences ? ` · CTA: "${savedBrand.cta_preferences}"` : ''}
                </p>
              </div>
            )}
            <button onClick={() => handleGenerate()} className="btn-fire w-full">
              <Spark className="h-4 w-4" />
              {scenesDone === 0 ? 'Start Generation' : `Generate Scene ${scenesDone + 1} — ${currentLabel}`}
            </button>
          </div>
        )}

        {/* ── Active feed: circular progress + stage log ────────────────────── */}
        {isGenerating && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/60 shadow-card">
            <div className="relative border-b border-white/[0.06] px-5 py-4">
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg,rgba(255,107,53,0.25) 0%,transparent 60%)' }} />
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                <p className="text-sm font-semibold text-ink">
                  {directorPhase === 'directing' ? `AI Director — Planning` : `Rendering — ${currentLabel}`}
                </p>
              </div>
            </div>

            {/* Circular progress + stage list */}
            <div className="flex flex-col items-center gap-6 p-6">
              <CircularProgress
                pct={genProgress}
                label={directorPhase === 'generating' ? `Rendering ${currentLabel}…` : `Scene ${currentSceneIdx + 1} of ${SCENE_LABELS.length}`}
              />

              <div className="w-full space-y-2">
                {allStages.map((stage, i) => {
                  const logEntry = directorLog.find(e => e.stage === stage)
                  const isVisible = doneStages.includes(stage as DirectorLogEntry['stage'])
                  const isActive = !isVisible && (
                    (directorPhase === 'directing' && i === doneStages.length) ||
                    (directorPhase === 'generating' && stage === 'rendering')
                  )
                  const isExpanded = expandedStages.has(stage)
                  const toggleExpand = () => setExpandedStages(prev => {
                    const next = new Set(prev)
                    next.has(stage) ? next.delete(stage) : next.add(stage)
                    return next
                  })
                  return (
                    <div key={stage} className={`overflow-hidden rounded-xl transition-colors duration-300 ${
                      isVisible ? 'border border-white/[0.08] bg-void-800/50' :
                      isActive  ? 'border border-fire-start/20 bg-fire-start/[0.04]' :
                      'border border-transparent'
                    }`}>
                      <button
                        type="button"
                        onClick={isVisible && logEntry ? toggleExpand : undefined}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 ${isVisible && logEntry ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {/* Status dot */}
                        <div className={`relative grid h-5 w-5 flex-shrink-0 place-items-center rounded-full transition-all duration-500 ${
                          isVisible ? 'bg-gradient-fire shadow-fire-soft' :
                          isActive  ? 'bg-fire-start/15 ring-1 ring-fire-start/50' :
                          'bg-void-600/50'
                        }`}>
                          {isVisible  ? <Check className="h-3 w-3 text-white" />
                          : isActive  ? <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
                          : <span className="h-1 w-1 rounded-full bg-ink-faint/30" />}
                        </div>
                        {/* Label */}
                        <span className={`flex-1 text-left text-xs font-semibold transition-colors duration-300 ${isVisible || isActive ? 'text-ink' : 'text-ink-faint/30'}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                        {/* Right side: pulse or chevron */}
                        {isActive && <span className="animate-pulse text-[9px] font-semibold text-fire-start/70">In progress…</span>}
                        {isVisible && logEntry && (
                          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-ink-faint transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      {/* Expandable detail */}
                      <AnimatePresence>
                        {isVisible && logEntry && isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <p className="border-t border-white/[0.06] px-3 pb-3 pt-2 text-[11px] leading-relaxed text-ink-muted">
                              {logEntry.message}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {directorPhase === 'error' && (
          <div className="rounded-2xl border border-fire-start/20 bg-fire-start/5 p-5">
            <p className="text-sm font-semibold text-fire-start">Generation failed</p>
            <p className="mt-1 text-sm text-ink-muted">{genError}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => handleGenerate(currentLabel)} className="btn-fire py-2.5 px-5 text-sm">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              <button onClick={goBack} className="btn-ghost py-2.5 px-5 text-sm">
                Adjust brief
              </button>
            </div>
          </div>
        )}

        {/* ── Done — current scene result ───────────────────────────────────── */}
        {directorPhase === 'done' && videoUrl && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">

            {/* Scene header badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                <Check className="h-3 w-3" /> Scene {scenesDone} complete
              </span>
              <span className="text-xs text-ink-faint">{completedScenes[completedScenes.length - 1]?.label}</span>
            </div>

            {/* Video preview */}
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-void-900 shadow-card">
              <video
                src={videoThumbSrc(videoUrl)}
                poster={productPreview || undefined}
                controls autoPlay loop muted playsInline preload="metadata"
                className="aspect-[9/16] max-h-72 w-full object-contain"
              />
              {directorNote && (
                <div className="border-t border-white/[0.06] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-gold">✦ Director's note</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{directorNote}</p>
                </div>
              )}
            </div>

            {/* Per-scene voiceover */}
            {voiceoverUrl && (
              <div className="rounded-2xl border border-white/[0.08] bg-void-900 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Voiceover</p>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">ElevenLabs</span>
                </div>
                <audio src={voiceoverUrl} controls className="mt-3 w-full" />
                {muxing
                  ? <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fire-start"><RefreshCw className="h-3 w-3 animate-spin" /> Adding the voiceover to your video…</p>
                  : !muxedUrl && <p className="mt-1.5 text-[11px] text-ink-faint">Combining with your video automatically — or continue generating scenes and stitch them all at the end.</p>}
              </div>
            )}
            {voiceoverError && <p className="text-xs text-amber-300">Voiceover: {voiceoverError}</p>}

            {/* No voice was picked → the clip is silent. Tell the user why and how to fix it. */}
            {!voiceoverUrl && !voiceoverError && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                <p className="text-sm font-semibold text-amber-200">This clip has no voiceover</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Pick a voice in the Voice step and add a script so your ad speaks. The video renders without sound until a voice is selected.
                </p>
              </div>
            )}

            {muxedUrl && (
              <div className="overflow-hidden rounded-2xl border border-gold/30 bg-void-900">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-semibold text-ink">Scene + voiceover combined</p>
                </div>
                <video src={muxedUrl} controls autoPlay playsInline className="aspect-[9/16] max-h-72 w-full object-contain" />
              </div>
            )}
            {muxError && <p className="text-xs text-amber-300">Combine: {muxError}</p>}

            {/* ── Next scene / stitch CTA area ─────────────────────────────── */}
            <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-void-900/60 p-4">
              <p className="text-sm font-semibold text-ink">What's next?</p>

              {canAddMore && (
                <button onClick={handleNextScene}
                  className="btn-fire flex w-full items-center justify-center gap-2 py-3">
                  <Spark className="h-4 w-4" />
                  Generate Next Scene — {SCENE_LABELS[currentSceneIdx + 1] ?? 'Next'}
                </button>
              )}

              {canStitch && (
                <button onClick={handleStitch} disabled={stitching}
                  className="btn-ghost flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60">
                  {stitching
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Stitching {scenesDone} scenes…</>
                    : <><Film className="h-4 w-4" /> Stitch {scenesDone} scenes into one ad</>}
                </button>
              )}

              {/* Per-scene combine / download */}
              <div className="grid gap-2 sm:grid-cols-2">
                {voiceoverUrl && !muxedUrl && (
                  <button onClick={handleMux} disabled={muxing}
                    className="btn-ghost flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-60">
                    {muxing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Combining…</> : <><Bolt className="h-4 w-4" /> Combine this scene with audio</>}
                  </button>
                )}
                {muxedUrl ? (
                  <a href={muxedUrl} download={`scene-${scenesDone}-with-sound.mp4`}
                    className="btn-ghost flex items-center justify-center gap-2 py-2.5 text-sm">
                    <Download className="h-4 w-4" /> Download scene with sound
                  </a>
                ) : (
                  <a href={videoUrl} download={`scene-${scenesDone}-silent.mp4`} target="_blank" rel="noreferrer"
                    className="btn-ghost flex items-center justify-center gap-2 py-2.5 text-sm">
                    <Download className="h-4 w-4" /> Download scene (silent)
                  </a>
                )}
              </div>
            </div>

            {/* ── Stitched final ad ─────────────────────────────────────────── */}
            {stitchedUrl && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-gold/40 bg-void-900 shadow-card">
                  <div className="flex items-center gap-2.5 border-b border-white/[0.06] bg-gold/5 px-4 py-3">
                    <Film className="h-4 w-4 text-gold" />
                    <p className="text-sm font-bold text-ink">Full ad — {scenesDone} scenes stitched</p>
                  </div>
                  <video src={stitchedUrl} controls playsInline className="w-full" />
                </div>
                <a href={stitchedUrl} download="full-ad-stitched.mp4"
                  className="btn-fire flex w-full items-center justify-center gap-2 py-3">
                  <Download className="h-4 w-4" /> Download complete ad ({scenesDone} scenes)
                </a>
              </motion.div>
            )}
            {stitchError && <p className="text-xs text-amber-300">Stitch: {stitchError}</p>}

          </motion.div>
        )}
      </div>
    )
  }

  // ── Step content router ───────────────────────────────────────────────────

  function renderStep() {
    switch (stepNum) {
      case 1:  return renderProduct()
      case 2:  return renderCreator()
      case 3:  return renderScene()
      case 4:  return renderStyle()
      case 5:  return renderCamera()
      case 6:  return renderEnvironment()
      case 7:  return renderLighting()
      case 8:  return renderVoice()
      case 9:  return renderScript()
      case 10: return renderStoryboard()
      case 11: return renderDirector()
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

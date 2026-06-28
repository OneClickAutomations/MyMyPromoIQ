/**
 * CommercialStudio — Phase 1 wizard shell using the CreativeBrief canonical object.
 *
 * Route: /studio/new
 * 11 steps: Product → Creator → Scene → Style → Camera → Environment →
 *           Lighting → Voice → Script → Storyboard → Director (generation)
 */
import { useState, useRef, useCallback, useTransition, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import CameraStudio from '../components/CameraStudio'
import {
  ArrowRight, Bolt, Camera, Check, Download, ImageIcon, LinkIcon,
  PlayIcon, RefreshCw, Spark, Upload, Users, Wand,
} from '../components/icons'
import {
  startGeneration,
  pollUntilDone,
  presignUpload,
  uploadDirectToStorage,
  dataUrlToBlob,
  saveBrief,
  runDirector,
  listCreators,
  listProducts,
  type DirectorLogEntry,
  type StatusResponse,
  type StoredCreator,
  type StoredProduct,
} from '../lib/api'
import {
  createEmptyBrief,
  type CreativeBrief,
  type CreatorAttributes,
} from '../lib/studio/types'
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

type InputMethod = 'upload' | 'camera' | 'url'
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
  const [, startDescTransition] = useTransition()

  // ── Wizard step state
  const [stepNum, setStepNum] = useState(1)

  // ── CreativeBrief — single source of truth
  const [brief, setBrief] = useState<CreativeBrief>(() =>
    createEmptyBrief(crypto.randomUUID(), user?.id ?? ''),
  )
  const briefIdRef = useRef<string | null>(null)

  // ── Product upload helpers (mirrors Studio.tsx)
  const [inputMethod, setInputMethod]     = useState<InputMethod>('upload')
  const [productFile, setProductFile]     = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState('')
  const [urlInput, setUrlInput]           = useState('')
  const [urlPreviewOk, setUrlPreviewOk]   = useState(false)
  const [descInput, setDescInput]         = useState('')
  const [isDragOver, setIsDragOver]       = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [step1Error, setStep1Error]       = useState('')
  const [cameraOpen, setCameraOpen]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Director feed state
  const [directorPhase, setDirectorPhase]       = useState<DirectorPhase>('idle')
  const [directorLog, setDirectorLog]           = useState<DirectorLogEntry[]>([])
  const [visibleLogCount, setVisibleLogCount]   = useState(0)
  const [directorNote, setDirectorNote]         = useState('')
  const [videoUrl, setVideoUrl]                 = useState<string | null>(null)
  const [genError, setGenError]                 = useState('')

  // ── Creative Studio library (loaded once on mount)
  const [savedCreators, setSavedCreators] = useState<StoredCreator[]>([])
  const [savedProducts, setSavedProducts] = useState<StoredProduct[]>([])

  // ── Autosave (500 ms debounce after brief changes)
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useCallback((b: CreativeBrief) => {
    if (!user?.id) return
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(async () => {
      try {
        const { id } = await saveBrief(user.id, {
          ...(briefIdRef.current ? { id: briefIdRef.current } : {}),
          status: b.status,
          product: b.product,
          creator: b.creator,
          scene: b.scene,
          style: b.style,
          voice: b.voice,
          script: b.script,
          storyboard: b.storyboard,
          render: b.render,
        })
        briefIdRef.current = id
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
    ]).then(([c, p]) => {
      if (!cancelled) { setSavedCreators(c.creators); setSavedProducts(p.products) }
    })
    return () => { cancelled = true }
  }, [user?.id])

  function patch(update: Partial<CreativeBrief>) {
    setBrief(prev => {
      const next = { ...prev, ...update }
      scheduleSave(next)
      return next
    })
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

  function applyFile(file: File) {
    if (!file.type.startsWith('image/')) { setStep1Error('Please select a JPG, PNG, or WebP image.'); return }
    if (file.size > 20 * 1024 * 1024) { setStep1Error('Image must be under 20 MB.'); return }
    setStep1Error('')
    setProductFile(file)
    setProductPreview(URL.createObjectURL(file))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) applyFile(file)
    e.target.value = ''
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) applyFile(file)
  }

  function handleCapture(dataUrl: string) {
    setProductPreview(dataUrl); setProductFile(null); setStep1Error('')
  }

  function clearProduct() {
    setProductFile(null); setProductPreview(''); setUrlPreviewOk(false)
    setUrlInput(''); setStep1Error('')
    patch({ product: { ...brief.product, rawImages: [], processedImages: [] } })
  }

  async function handleProductNext() {
    setStep1Error('')
    if (inputMethod === 'url') {
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

  const canAdvanceStep1 = !!productPreview && !!descInput.trim()

  // ── Director feed / generation ────────────────────────────────────────────

  async function handleGenerate() {
    if (!productImageUrl) return
    setDirectorPhase('directing')
    setDirectorLog([])
    setVisibleLogCount(0)
    setVideoUrl(null)
    setGenError('')

    try {
      // 1. Run director commentary
      const { log } = await runDirector({
        productName: brief.product.productName,
        description: brief.product.description ?? descInput,
        style: brief.style.commercialStyle,
        creatorMode: brief.creator.mode,
        energyLevel: brief.creator.attributes?.energyLevel,
      })

      // Animate log entries in, one per second
      setDirectorLog(log)
      for (let i = 0; i < log.length; i++) {
        await new Promise(r => setTimeout(r, 900))
        setVisibleLogCount(i + 1)
      }

      // 2. Transition to rendering stage
      setDirectorPhase('generating')

      // 3. Submit to Higgsfield
      const { requestId, directorPrompt } = await startGeneration({
        productImageUrl,
        productDescription: brief.product.description ?? descInput,
        style: brief.style.commercialStyle || 'testimonial',
        quality: 'turbo',
      })
      setDirectorNote(directorPrompt)

      // Add rendering stage to log
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

      if (final.status === 'completed' && final.videoUrl) {
        setVideoUrl(final.videoUrl)
        setDirectorPhase('done')
        patch({ status: 'complete', render: { ...brief.render, outputUrl: final.videoUrl, statusLog: [] } })
      } else {
        const msg = final.raw === 'timeout' ? 'Render timed out — try again.' : 'Render failed. Try a different style or image.'
        setGenError(msg)
        setDirectorPhase('error')
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong.')
      setDirectorPhase('error')
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
    const tabs: { id: InputMethod; label: string; Icon: typeof Upload }[] = [
      { id: 'upload', label: 'Upload',       Icon: Upload },
      { id: 'camera', label: 'Take a Photo', Icon: Camera },
      { id: 'url',    label: 'Image URL',    Icon: LinkIcon },
    ]
    return (
      <div className="space-y-5">
        <StepHeader title="Drop in your product" desc="Upload a photo, take a photo, or paste an image URL." />

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

        <div className="flex rounded-xl border border-void-600 bg-void-800 p-1">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => { setInputMethod(id); clearProduct() }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 ${
                inputMethod === id ? 'bg-fire-start text-white shadow-fire-soft' : 'text-ink-muted hover:text-ink'
              }`}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={inputMethod} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            {inputMethod === 'upload' && (
              productPreview && productFile ? (
                <div className="flex items-center gap-4 rounded-2xl border border-fire-start/30 bg-fire-start/5 p-4">
                  <img src={productPreview} alt="Product" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{productFile.name}</p>
                    <p className="text-xs text-ink-faint">{formatBytes(productFile.size)}</p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-fire-start"><Check className="h-3 w-3" /> Ready</span>
                  </div>
                  <button onClick={clearProduct} className="flex-shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-ink hover:bg-white/[0.06] transition-colors">✕</button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 text-center transition-all duration-200 ${
                    isDragOver ? 'border-fire-start bg-fire-start/10 scale-[1.01]' : 'border-void-500 bg-void-800/60 hover:border-fire-start/40 hover:bg-void-800'
                  }`}
                >
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${isDragOver ? 'bg-fire-start/20' : 'bg-void-700/60'}`}>
                    <Upload className={`h-6 w-6 ${isDragOver ? 'text-fire-start' : 'text-ink-faint'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Drop your product image here</p>
                    <p className="mt-0.5 text-xs text-ink-faint">or click to browse</p>
                    <p className="mt-0.5 text-xs text-ink-faint/60">JPG, PNG, WebP up to 20 MB</p>
                  </div>
                </div>
              )
            )}

            {inputMethod === 'camera' && (
              productPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-fire-start/30 bg-void-900">
                  <img src={productPreview} alt="Captured" className="max-h-52 w-full object-contain" />
                  <button onClick={clearProduct} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">Retake</button>
                </div>
              ) : (
                <button onClick={() => setCameraOpen(true)}
                  className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-void-500 bg-void-800/60 py-12 hover:border-fire-start/40 transition-all">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-fire-start/10 ring-1 ring-fire-start/30">
                    <Camera className="h-8 w-8 text-fire-start" />
                  </div>
                  <p className="text-sm font-semibold text-ink">Open camera studio</p>
                  <div className="flex items-center gap-2 rounded-xl bg-fire-start px-5 py-2.5 text-sm font-semibold text-white shadow-fire-soft">
                    <Camera className="h-4 w-4" /> Take a Photo
                  </div>
                </button>
              )
            )}

            {inputMethod === 'url' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="url" value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlPreviewOk(false); setProductPreview('') }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const url = urlInput.trim()
                        if (url && /^https?:\/\//i.test(url)) { setProductPreview(url); setUrlPreviewOk(true) }
                        else setStep1Error('Please enter a valid image URL (https://…).')
                      }
                    }}
                    placeholder="https://example.com/product.jpg"
                    className="flex-1 rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
                  />
                  <button onClick={() => {
                    const url = urlInput.trim()
                    if (!url || !/^https?:\/\//i.test(url)) { setStep1Error('Please enter a valid https URL.'); return }
                    setStep1Error(''); setProductPreview(url); setUrlPreviewOk(true)
                  }} className="rounded-xl bg-void-700 px-4 py-3 text-sm font-semibold text-ink hover:bg-void-600 transition-colors">
                    Preview
                  </button>
                </div>
                {urlPreviewOk && productPreview && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="overflow-hidden rounded-xl border border-fire-start/30 bg-void-900">
                    <img src={productPreview} alt="Product preview" className="max-h-48 w-full object-contain"
                      onError={() => { setUrlPreviewOk(false); setStep1Error('Could not load image from that URL.') }}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />

        <div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Product name</span>
            <input
              type="text"
              value={brief.product.productName}
              onChange={e => patch({ product: { ...brief.product, productName: e.target.value } })}
              placeholder="e.g. NovaCream Daily SPF 50"
              className="mt-2 w-full rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
            />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">What is it?</span>
            <textarea
              rows={2}
              value={descInput}
              onChange={e => {
                const v = e.target.value
                setDescInput(v)
                startDescTransition(() => patch({ product: { ...brief.product, description: v } }))
              }}
              placeholder="A matte ceramic pour-over coffee dripper for slow mornings."
              className="mt-2 w-full resize-none rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
            />
          </label>
        </div>

        {step1Error && (
          <p className="rounded-xl border border-fire-start/20 bg-fire-start/5 px-4 py-3 text-sm text-fire-start">{step1Error}</p>
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
    analyzing:    'Analyzing brief',
    casting:      'Casting creator',
    scripting:    'Writing script',
    storyboarding:'Blocking scenes',
    rendering:    'Rendering video',
  }

  function renderDirector() {
    const allStages = ['analyzing', 'casting', 'scripting', 'storyboarding', 'rendering']
    const doneStages = directorLog.slice(0, visibleLogCount).map(e => e.stage)

    return (
      <div className="space-y-6">
        <StepHeader title="AI Director" desc="Sit back — the director is working." onBack={directorPhase === 'idle' ? goBack : undefined} />

        {/* Idle: start button */}
        {directorPhase === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-5">
              <p className="text-sm text-ink-muted">The Composition Engine has assembled your brief. The AI Director will now:</p>
              <ul className="mt-3 space-y-1.5">
                {allStages.map(s => (
                  <li key={s} className="flex items-center gap-2.5 text-sm text-ink-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-fire-start/40" />
                    {STAGE_LABELS[s]}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={handleGenerate} className="btn-fire w-full">
              <Spark className="h-4 w-4" /> Start Generation
            </button>
          </div>
        )}

        {/* Active feed */}
        {(directorPhase === 'directing' || directorPhase === 'generating') && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/60 shadow-card">
            {/* Pulsing header */}
            <div className="relative border-b border-white/[0.06] px-5 py-4">
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg,rgba(255,107,53,0.2) 0%,transparent 60%)' }} />
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                <p className="text-sm font-semibold text-ink">
                  {directorPhase === 'directing' ? 'AI Director — Live' : 'Rendering video'}
                </p>
              </div>
            </div>

            {/* Stage timeline */}
            <div className="p-5 space-y-4">
              {allStages.map((stage, i) => {
                const logEntry = directorLog.find(e => e.stage === stage)
                const isVisible = doneStages.includes(stage as DirectorLogEntry['stage'])
                const isActive = !isVisible && (
                  (directorPhase === 'directing' && i === doneStages.length) ||
                  (directorPhase === 'generating' && stage === 'rendering')
                )
                const isDone = isVisible

                return (
                  <div key={stage} className="flex gap-3">
                    <div className={`relative mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full transition-all duration-500 ${
                      isDone   ? 'bg-gradient-fire shadow-fire-soft' :
                      isActive ? 'bg-fire-start/15 ring-1 ring-fire-start/50' :
                      'bg-void-600/50'
                    }`}>
                      {isDone   ? <Check className="h-3.5 w-3.5 text-white" />
                      : isActive ? <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                      : <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold transition-colors duration-300 ${isDone || isActive ? 'text-ink' : 'text-ink-faint/40'}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                        {isActive && <span className="animate-pulse text-[10px] font-semibold text-fire-start/80">In progress…</span>}
                      </div>
                      <AnimatePresence>
                        {logEntry && isVisible && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ duration: 0.4 }}
                            className="mt-1 text-xs leading-relaxed text-ink-muted"
                          >
                            {logEntry.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {directorPhase === 'error' && (
          <div className="rounded-2xl border border-fire-start/20 bg-fire-start/5 p-5">
            <p className="text-sm font-semibold text-fire-start">Generation failed</p>
            <p className="mt-1 text-sm text-ink-muted">{genError}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={handleGenerate} className="btn-fire py-2.5 px-5 text-sm">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              <button onClick={goBack} className="btn-ghost py-2.5 px-5 text-sm">
                Adjust brief
              </button>
            </div>
          </div>
        )}

        {/* Done — video result */}
        {directorPhase === 'done' && videoUrl && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-void-900 shadow-card">
              <video
                src={videoThumbSrc(videoUrl)}
                poster={productPreview || undefined}
                controls autoPlay loop muted playsInline preload="metadata"
                className="aspect-[9/16] max-h-80 w-full object-contain"
              />
              {directorNote && (
                <div className="border-t border-white/[0.06] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gold">✦ Director's note</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{directorNote}</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a href={videoUrl} download target="_blank" rel="noreferrer"
                className="btn-fire flex items-center justify-center gap-2 py-3">
                <Download className="h-4 w-4" /> Download video
              </a>
              <Link to="/history" className="btn-ghost flex items-center justify-center gap-2 py-3">
                <ImageIcon className="h-4 w-4" /> View in History
              </Link>
            </div>
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
        <span className="eyebrow hidden sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
          Step {stepNum} of 11
        </span>
      </div>

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

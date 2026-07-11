import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import CameraStudio from '../components/CameraStudio'
import GenerationOverlay from '../components/ui/GenerationOverlay'
import {
  ArrowRight, Bolt, Camera, Check, Download, ImageIcon, LinkIcon,
  PlayIcon, RefreshCw, Share2, Spark, Upload, Users, Wand,
} from '../components/icons'
import {
  startGeneration,
  pollUntilDone,
  presignUpload,
  uploadDirectToStorage,
  dataUrlToBlob,
  saveCampaign,
  saveScene,
  getCampaign,
  type StatusResponse,
} from '../lib/api'
import { generator } from '../copy'

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkflowStep = 1 | 2 | 3 | 4
type InputMethod = 'upload' | 'camera' | 'url'
type Phase = 'idle' | 'working' | 'done' | 'error'

type Scene = {
  id: string
  dbId: string | null
  label: string
  style: string
  phase: Phase
  videoUrl: string | null
  directorPrompt: string
  error: string
}

// ── Scene templates ───────────────────────────────────────────────────────────

const SCENE_TEMPLATES = [
  { label: 'Hook',         style: 'fast-cut',    duration: ':06', objective: 'Stop the scroll',     shotType: 'Wide · kinetic' },
  { label: 'Product Demo', style: 'unboxing',    duration: ':12', objective: 'Show it in action',   shotType: 'Close-up reveal' },
  { label: 'Testimonial',  style: 'testimonial', duration: ':15', objective: 'Build trust',          shotType: 'Face to camera' },
  { label: 'Day-in-Life',  style: 'day-in-life', duration: ':12', objective: 'Create desire',       shotType: 'Lifestyle b-roll' },
  { label: 'Social Proof', style: 'testimonial', duration: ':08', objective: 'Overcome objections', shotType: 'Face to camera' },
  { label: 'CTA',          style: 'fast-cut',    duration: ':05', objective: 'Drive the click',     shotType: 'Product + text' },
]

const STYLE_THEME: Record<string, { grad: string; accent: string }> = {
  'fast-cut':    { grad: 'linear-gradient(160deg,rgba(255,60,20,0.30) 0%,rgba(10,10,12,0.98) 55%)',  accent: '#FF3C14' },
  'unboxing':    { grad: 'linear-gradient(160deg,rgba(255,185,0,0.26) 0%,rgba(10,10,12,0.98) 55%)',  accent: '#FFB900' },
  'testimonial': { grad: 'linear-gradient(160deg,rgba(255,107,53,0.24) 0%,rgba(10,10,12,0.98) 55%)', accent: '#FF6B35' },
  'day-in-life': { grad: 'linear-gradient(160deg,rgba(255,140,40,0.20) 0%,rgba(10,10,12,0.98) 55%)', accent: '#FF8C28' },
}
const STYLE_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'fast-cut': Bolt, 'unboxing': Upload, 'testimonial': Users, 'day-in-life': Spark,
}


// Cinematic preview image + metadata for each style card in Step 2
const STYLE_META: Record<string, {
  img: string
  colorGrade: string
  bestFor: string
  tagline: string
}> = {
  testimonial: {
    img: '/assets/fmt-testimonial.png',
    colorGrade: 'linear-gradient(to bottom right, rgba(255,107,53,0.18) 0%, rgba(0,0,0,0.12) 100%)',
    bestFor: 'Social proof, reviews, UGC',
    tagline: 'Real people. Real results.',
  },
  unboxing: {
    img: '/assets/fmt-unbox.png',
    colorGrade: 'linear-gradient(to bottom right, rgba(255,185,0,0.14) 0%, rgba(0,0,0,0.12) 100%)',
    bestFor: 'Features, benefits, how-to demos',
    tagline: 'Show the product and how it works.',
  },
  'day-in-life': {
    img: '/assets/fmt-life.png',
    colorGrade: 'linear-gradient(to bottom right, rgba(255,140,40,0.14) 0%, rgba(0,0,0,0.12) 100%)',
    bestFor: 'Relatable moments, aspiration',
    tagline: 'Show it in real-life situations.',
  },
  'fast-cut': {
    img: '/assets/fmt-hook.png',
    colorGrade: 'linear-gradient(to bottom right, rgba(255,40,20,0.18) 0%, rgba(0,0,0,0.12) 100%)',
    bestFor: 'Strong openings, bold hooks',
    tagline: 'Grab attention in the first 3 seconds.',
  },
}

function blankScene(label: string, style: string): Scene {
  return { id: crypto.randomUUID(), dbId: null, label, style, phase: 'idle', videoUrl: null, directorPrompt: '', error: '' }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Workflow step definitions ─────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { num: 1 as const, title: 'Drop in your product', desc: 'Upload, take a photo, or paste an image URL.', Icon: Upload },
  { num: 2 as const, title: 'Pick a style',          desc: 'Choose the vibe for your ad.',                Icon: Wand },
  { num: 3 as const, title: 'AI directs & generates', desc: 'AI writes the script, blocks the scenes, and renders footage.', Icon: Spark },
  { num: 4 as const, title: 'Download or publish',   desc: 'Download your ad or publish it to your account.', Icon: Download },
]

// ── Scene card ────────────────────────────────────────────────────────────────

type SceneCardProps = {
  scene: Scene
  idx: number
  isActive: boolean
  isClickable?: boolean
  size?: 'sm' | 'lg'
  posterUrl?: string
  onClick?: () => void
}

// Append a seek fragment so browsers paint the first frame as a thumbnail
// even when autoplay is blocked. Harmless if the host ignores it.
function videoThumbSrc(url: string): string {
  return /#t=/.test(url) ? url : `${url}#t=0.1`
}

function SceneCard({ scene, idx, isActive, isClickable = false, size = 'lg', posterUrl, onClick }: SceneCardProps) {
  const t = SCENE_TEMPLATES[idx]
  const theme = STYLE_THEME[t.style] ?? STYLE_THEME['testimonial']
  const Icon = STYLE_ICON[t.style] ?? Spark

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={isClickable ? { y: -3, transition: { duration: 0.15 } } : {}}
      className={`group relative w-full overflow-hidden text-left rounded-2xl border transition-all duration-200 ${
        isActive
          ? 'border-fire-start/60 ring-2 ring-fire-start/20 shadow-[0_0_28px_rgba(255,107,53,0.14)]'
          : isClickable
            ? 'border-white/[0.08] hover:border-white/[0.22] hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]'
            : 'border-white/[0.08] cursor-default'
      }`}
    >
      {/* ── Visual area ── */}
      <div className="relative aspect-[9/16] w-full overflow-hidden">

        {/* Background gradient */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ background: (scene.phase === 'done' || scene.phase === 'working') ? '#07070a' : theme.grad }}
        />

        {/* Subtle vignette */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
        />

        {/* Film grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Corner brackets — film-frame aesthetic */}
        {scene.phase !== 'done' && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[7px] top-[7px] h-3 w-3 border-l border-t border-white/[0.20]" />
            <div className="absolute right-[7px] top-[7px] h-3 w-3 border-r border-t border-white/[0.20]" />
            <div className="absolute bottom-[7px] left-[7px] h-3 w-3 border-b border-l border-white/[0.20]" />
            <div className="absolute bottom-[7px] right-[7px] h-3 w-3 border-b border-r border-white/[0.20]" />
          </div>
        )}

        {/* Duration badge — top left */}
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="text-[9px] font-bold tabular-nums tracking-wide text-white/85">{t.duration}</span>
        </div>

        {/* Scene number — top right (hidden when done, check takes over) */}
        {scene.phase !== 'done' && (
          <div className="absolute right-2 top-2 z-10 grid h-[18px] w-[18px] place-items-center rounded-full bg-black/60 backdrop-blur-sm">
            <span className="text-[9px] font-bold text-white/70">{idx + 1}</span>
          </div>
        )}

        {/* ── State content ── */}
        {scene.phase === 'done' && scene.videoUrl ? (
          <>
            <video
              src={videoThumbSrc(scene.videoUrl)}
              poster={posterUrl}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
            {/* Done badge */}
            <div className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire shadow-fire-soft ring-2 ring-black/20">
              <Check className="h-3 w-3 text-white" />
            </div>
          </>

        ) : scene.phase === 'working' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="relative">
              <span
                className="absolute -inset-2 animate-ping rounded-full opacity-30"
                style={{ background: `radial-gradient(circle, ${theme.accent}60 0%, transparent 70%)` }}
              />
              <span className="relative block h-5 w-5 animate-spin rounded-full border-2 border-fire-start/25 border-t-fire-start" />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-ink-faint/80">Rendering</span>
          </div>

        ) : scene.phase === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-fire-start/[0.09] ring-1 ring-fire-start/25">
              <span className="text-base leading-none text-fire-start">✕</span>
            </div>
            <span className="text-[9px] font-bold text-fire-start">Failed</span>
            {isClickable && <span className="text-[8px] text-ink-faint">Click to retry</span>}
          </div>

        ) : (
          /* Idle */
          <>
            {/* Center icon */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div
                className="grid h-11 w-11 place-items-center rounded-[14px] transition-transform duration-200 group-hover:scale-110"
                style={{
                  background: `${theme.accent}14`,
                  boxShadow: `0 0 24px ${theme.accent}1a, inset 0 1px 0 ${theme.accent}22`,
                }}
              >
                <Icon className="h-5 w-5" style={{ color: `${theme.accent}cc` }} />
              </div>
              <span
                className="px-2 text-center text-[9px] font-semibold leading-tight tracking-wide"
                style={{ color: `${theme.accent}75` }}
              >
                {t.shotType}
              </span>
            </div>

            {/* Bottom: objective */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-2.5 pb-2.5 pt-8">
              <p className="text-[8px] leading-tight text-white/38">{t.objective}</p>
            </div>

            {/* Hover: generate CTA */}
            {isClickable && (
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: `linear-gradient(to bottom, ${theme.accent}0e 0%, ${theme.accent}06 100%)` }}
              >
                <span className="rounded-xl bg-fire-start px-3 py-1.5 text-[10px] font-bold text-white shadow-fire-soft">
                  Generate ↗
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-white/[0.06] bg-void-900/90 px-2.5 py-2">
        <p className={`font-bold text-ink ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>{scene.label}</p>
        <p className="mt-0.5 text-[8px] capitalize leading-tight text-ink-faint/60">{t.shotType}</p>
      </div>
    </motion.button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Studio() {
  const [searchParams] = useSearchParams()
  const defaultStyle = searchParams.get('style') || generator.styles[0].id
  const { user } = useUser()

  // ── Navigation
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1)

  // ── Step 1: product input
  const [inputMethod, setInputMethod] = useState<InputMethod>('upload')
  const [productFile, setProductFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState('') // shown in UI
  const [productApiUrl, setProductApiUrl]   = useState('') // sent to /api/generate
  const [urlInput, setUrlInput]             = useState('')
  const [urlPreviewOk, setUrlPreviewOk]     = useState(false)
  const [descInput, setDescInput]           = useState('')   // immediate — drives textarea
  const [description, setDescription]       = useState('')   // deferred via startTransition
  const [, startDescTransition]             = useTransition()
  const [cameraOpen, setCameraOpen]         = useState(false)
  const [isDragOver, setIsDragOver]         = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [step1Error, setStep1Error]         = useState('')

  // ── Step 2: style
  const [style, setStyle]     = useState(defaultStyle)
  const [quality, setQuality] = useState('turbo')
  useEffect(() => setStyle(defaultStyle), [defaultStyle])

  // ── Step 3/4: generation
  const [genPhase, setGenPhase]       = useState<Phase>('idle')
  const [genStepIdx, setGenStepIdx]   = useState(0)
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [genError, setGenError]       = useState('')
  const [saveFailed, setSaveFailed]   = useState(false)
  const [scenes, setScenes]           = useState<Scene[]>(SCENE_TEMPLATES.map(t => blankScene(t.label, t.style)))
  const [activeSceneIdx, setActiveSceneIdx] = useState(0)

  const campaignIdRef = useRef<string | null>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const loadedCampaignRef = useRef<string | null>(null)

  // ── Load an existing campaign (History → open/edit/regenerate) ─────────────
  useEffect(() => {
    const campaignParam = searchParams.get('campaign')
    if (!campaignParam || !user?.id || loadedCampaignRef.current === campaignParam) return
    loadedCampaignRef.current = campaignParam
    let cancelled = false

    ;(async () => {
      try {
        const { campaign, scenes: dbScenes } = await getCampaign(user.id, campaignParam)
        if (cancelled || !campaign) return

        campaignIdRef.current = campaign.id
        if (campaign.product_image_url) {
          setProductPreview(campaign.product_image_url)
          setProductApiUrl(campaign.product_image_url)
          setInputMethod('url')
          setUrlInput(campaign.product_image_url)
          setUrlPreviewOk(true)
        }
        if (campaign.product_description) {
          setDescInput(campaign.product_description)
          setDescription(campaign.product_description)
        }
        if (campaign.style) setStyle(campaign.style)
        if (campaign.quality) setQuality(campaign.quality)

        // Merge DB scenes onto the template storyboard by order index.
        const merged = SCENE_TEMPLATES.map((t, i) => {
          const row = (dbScenes ?? []).find(s => s.order_index === i)
          if (!row) return blankScene(t.label, t.style)
          return {
            id: crypto.randomUUID(),
            dbId: row.id,
            label: t.label,
            style: t.style,
            phase: (row.phase as Phase) ?? 'idle',
            videoUrl: row.video_url ?? null,
            directorPrompt: row.director_prompt ?? '',
            error: row.error_message ?? '',
          }
        })
        setScenes(merged)

        const firstDone = merged.findIndex(s => s.phase === 'done')
        if (firstDone >= 0) {
          setActiveSceneIdx(firstDone)
          setGenPhase('done')
          setDirectorPrompt(merged[firstDone].directorPrompt)
          setWorkflowStep(4)
        }
      } catch {
        // Campaign not found / Supabase unavailable — fall back to a fresh studio
      }
    })()

    return () => { cancelled = true }
  }, [searchParams, user?.id])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateScene(idx: number, patch: Partial<Scene>) {
    setScenes(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  async function upsertCampaign() {
    const { id } = await saveCampaign(user!.id, {
      ...(campaignIdRef.current ? { id: campaignIdRef.current } : {}),
      name: description.slice(0, 60) || 'Untitled Campaign',
      product_image_url: productApiUrl || null,
      product_description: description.trim() || null,
      style, quality,
      status: 'rendering',
    })
    campaignIdRef.current = id
    return id
  }

  function applyFile(file: File) {
    if (!file.type.startsWith('image/')) { setStep1Error('Please select a JPG, PNG, or WebP image.'); return }
    if (file.size > 20 * 1024 * 1024) { setStep1Error('Image must be under 20 MB.'); return }
    setStep1Error('')
    setProductFile(file)
    setProductPreview(URL.createObjectURL(file))
    setProductApiUrl('') // will be resolved on "Next"
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) applyFile(file)
    e.target.value = ''
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) applyFile(file)
  }

  function handleCapture(dataUrl: string) {
    setProductPreview(dataUrl)
    setProductApiUrl('') // will be resolved on "Next"
    setProductFile(null)
    setStep1Error('')
  }

  function handleLoadUrl() {
    const url = urlInput.trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      setStep1Error('Please enter a valid image URL (https://…).')
      return
    }
    setStep1Error('')
    setProductPreview(url)
    setProductApiUrl(url)
    setUrlPreviewOk(true)
  }

  function clearProduct() {
    setProductFile(null)
    setProductPreview('')
    setProductApiUrl('')
    setUrlPreviewOk(false)
    setUrlInput('')
    setStep1Error('')
  }

  // Step 1 → 2: upload file/capture if needed, then advance
  const handleNextStep1 = useCallback(async () => {
    if (!productPreview || !description.trim()) return
    setStep1Error('')

    if (inputMethod === 'url') {
      setProductApiUrl(urlInput.trim())
      setWorkflowStep(2)
      return
    }

    // Local file or camera capture — get a signed URL from the server, then
    // upload the file directly to Supabase Storage (bypasses Netlify entirely).
    setUploadingImage(true)
    try {
      const mimeType = productFile?.type ||
        (productPreview.startsWith('data:image/png')  ? 'image/png'  :
         productPreview.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg')

      const { path, token, publicUrl } = await presignUpload(mimeType)

      // productFile is a raw File (no conversion needed).
      // Camera captures are data URLs — convert to Blob.
      const fileData: Blob = productFile ?? dataUrlToBlob(productPreview)

      await uploadDirectToStorage(path, token, fileData, mimeType)
      setProductApiUrl(publicUrl)
      setWorkflowStep(2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      setStep1Error(msg + ' Try the Image URL tab instead.')
    } finally {
      setUploadingImage(false)
    }
  }, [productPreview, productFile, description, inputMethod, urlInput])

  // Step 2 → 3: trigger generation
  async function handleGenerate() {
    if (!productApiUrl) return
    const idx = activeSceneIdx
    updateScene(idx, { phase: 'working', error: '', videoUrl: null, directorPrompt: '' })
    setGenPhase('working')
    setGenStepIdx(0)
    setDirectorPrompt('')
    setGenError('')
    setWorkflowStep(3)

    // Persistence via server API (service key — bypasses RLS).
    let campaignId: string | null = null
    let sceneDbId = scenes[idx].dbId
    let canPersist = true
    try {
      campaignId = await upsertCampaign()
      const { id } = await saveScene(user!.id, {
        ...(sceneDbId ? { id: sceneDbId } : {}),
        campaign_id: campaignId,
        label: scenes[idx].label, style, order_index: idx, phase: 'working',
        error_message: null, video_url: null,
      })
      sceneDbId = id
      updateScene(idx, { dbId: sceneDbId })
      setSaveFailed(false)
    } catch (e) {
      console.warn('[Studio] Persistence unavailable:', e)
      canPersist = false
      setSaveFailed(true)
    }

    // Generation — always runs
    try {
      // Step 0: AI is writing the director prompt (shown while the request is in flight)
      const { requestId, directorPrompt: dp } = await startGeneration({
        productImageUrl: productApiUrl,
        productDescription: description.trim(),
        style, quality,
      })
      setDirectorPrompt(dp)
      updateScene(idx, { directorPrompt: dp })
      if (canPersist && sceneDbId && campaignId) {
        try { await saveScene(user!.id, { id: sceneDbId, campaign_id: campaignId, director_prompt: dp, request_id: requestId }) } catch {}
      }
      // Step 1: submitted to render engine; Step 2: rendering
      setGenStepIdx(1)
      await new Promise(r => setTimeout(r, 800)) // brief pause so users see "Submitting"
      setGenStepIdx(2)

      // Poll /api/status every 5 s until the render finishes or times out.
      // On Vercel's free tier, function invocations are unlimited.
      const final: StatusResponse = await pollUntilDone(requestId, () => setGenStepIdx(2), {
        intervalMs: 5_000,
        timeoutMs: 10 * 60 * 1_000,
      })

      if (final.status === 'completed' && final.videoUrl) {
        updateScene(idx, { phase: 'done', videoUrl: final.videoUrl })
        setGenPhase('done')
        if (canPersist && sceneDbId && campaignId) {
          try {
            await saveScene(user!.id, { id: sceneDbId, campaign_id: campaignId, phase: 'done', video_url: final.videoUrl })
            const allDone = scenes.every((s, i) => i === idx || s.phase === 'done')
            if (allDone) await saveCampaign(user!.id, { id: campaignId, status: 'ready' })
          } catch (e) {
            console.warn('[Studio] Could not save finished video:', e)
            setSaveFailed(true)
          }
        }
        setWorkflowStep(4)
      } else {
        const msg = final.raw === 'timeout' ? 'Render timed out. Try again.' : 'Render failed. Try a different image or style.'
        updateScene(idx, { phase: 'error', error: msg })
        setGenPhase('error')
        setGenError(msg)
        if (canPersist && sceneDbId && campaignId) {
          try { await saveScene(user!.id, { id: sceneDbId, campaign_id: campaignId, phase: 'error', error_message: msg }) } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      updateScene(idx, { phase: 'error', error: msg })
      setGenPhase('error')
      setGenError(msg)
    }
  }

  function startOver() {
    clearProduct()
    setDescInput('')
    setDescription('')
    setStyle(defaultStyle)
    setQuality('turbo')
    setGenPhase('idle')
    setDirectorPrompt('')
    setGenError('')
    setScenes(SCENE_TEMPLATES.map(t => blankScene(t.label, t.style)))
    setActiveSceneIdx(0)
    campaignIdRef.current = null
    setWorkflowStep(1)
  }

  const canAdvanceStep1 = !!productPreview && !!descInput.trim()
  const completedScenes = scenes.filter(s => s.phase === 'done').length

  // ── Step nav ─────────────────────────────────────────────────────────────

  function StepNav() {
    return (
      <nav aria-label="Campaign workflow steps">
        {WORKFLOW_STEPS.map(({ num, title, desc, Icon }, i) => {
          const state = num < workflowStep ? 'done' : num === workflowStep ? 'active' : 'future'
          return (
            <div key={num}>
              <div className={`relative flex gap-4 ${i < WORKFLOW_STEPS.length - 1 ? 'pb-6' : ''}`}>
                {/* Connector line */}
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="absolute left-[18px] top-10 bottom-0 w-px bg-void-600" />
                )}

                {/* Icon circle */}
                <div className={`relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl transition-all duration-300 ${
                  state === 'done'   ? 'bg-gradient-fire shadow-fire-soft' :
                  state === 'active' ? 'bg-fire-start/15 ring-2 ring-fire-start/50' :
                  'bg-void-700/60 ring-1 ring-white/[0.06]'
                }`}>
                  {state === 'done' ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Icon className={`h-4 w-4 ${state === 'active' ? 'text-fire-start' : 'text-ink-faint/50'}`} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                      state === 'active' ? 'text-fire-start' : 'text-ink-faint/50'
                    }`}>
                      Step {num}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold leading-tight mt-0.5 ${
                    state === 'future' ? 'text-ink-faint/50' : 'text-ink'
                  }`}>{title}</p>
                  <p className={`mt-0.5 text-xs leading-snug hidden lg:block ${
                    state === 'active' ? 'text-ink-muted' : 'text-ink-faint/40'
                  }`}>{desc}</p>
                </div>
              </div>
            </div>
          )
        })}
      </nav>
    )
  }

  // ── Step 1 content ────────────────────────────────────────────────────────

  function renderStep1() {
    const tabs: { id: InputMethod; label: string; Icon: typeof Upload }[] = [
      { id: 'upload', label: 'Upload',       Icon: Upload },
      { id: 'camera', label: 'Take a Photo', Icon: Camera },
      { id: 'url',    label: 'Image URL',    Icon: LinkIcon },
    ]

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Drop in your product</h2>
          <p className="mt-1 text-sm text-ink-muted">Upload a photo, take a photo, or paste an image URL.</p>
        </div>

        {/* Input method tabs */}
        <div className="flex rounded-xl border border-void-600 bg-void-800 p-1">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setInputMethod(id); clearProduct(); setStep1Error('') }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 ${
                inputMethod === id
                  ? 'bg-fire-start text-white shadow-fire-soft'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={inputMethod}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {inputMethod === 'upload' && (
              <div>
                {productPreview && productFile ? (
                  /* File selected — preview */
                  <div className="flex items-center gap-4 rounded-2xl border border-fire-start/30 bg-fire-start/5 p-4">
                    <img src={productPreview} alt="Product" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{productFile.name}</p>
                      <p className="text-xs text-ink-faint">{formatBytes(productFile.size)}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-fire-start">
                        <Check className="h-3 w-3" /> Ready to use
                      </span>
                    </div>
                    <button onClick={clearProduct} className="flex-shrink-0 rounded-lg p-1.5 text-ink-faint hover:text-ink hover:bg-white/[0.06] transition-colors">
                      ✕
                    </button>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 text-center transition-all duration-200 ${
                      isDragOver ? 'border-fire-start bg-fire-start/10 scale-[1.01]' : 'border-void-500 bg-void-800/60 hover:border-fire-start/40 hover:bg-void-800'
                    }`}
                  >
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl transition-colors ${
                      isDragOver ? 'bg-fire-start/20' : 'bg-void-700/60'
                    }`}>
                      <Upload className={`h-6 w-6 ${isDragOver ? 'text-fire-start' : 'text-ink-faint'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">Drop your product image here</p>
                      <p className="mt-0.5 text-xs text-ink-faint">or click to browse</p>
                      <p className="mt-0.5 text-xs text-ink-faint/60">JPG, PNG, WebP up to 20 MB</p>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
              </div>
            )}

            {inputMethod === 'camera' && (
              <div>
                {productPreview ? (
                  /* Post-capture preview */
                  <div className="relative overflow-hidden rounded-2xl border border-fire-start/30 bg-void-900">
                    <img src={productPreview} alt="Captured product" className="max-h-52 w-full object-contain" />
                    <button
                      onClick={clearProduct}
                      className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                    >
                      Retake
                    </button>
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-gradient-fire px-3 py-1.5">
                      <Check className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">Photo captured</span>
                    </div>
                  </div>
                ) : (
                  /* Camera prompt */
                  <button
                    onClick={() => setCameraOpen(true)}
                    className="group relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-void-500 bg-void-800/60 py-12 hover:border-fire-start/40 hover:bg-void-800 transition-all"
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(255,107,53,0.08) 0%, transparent 70%)' }}
                    />
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-fire-start/10 ring-1 ring-fire-start/30 group-hover:bg-fire-start/15 transition-colors">
                      <Camera className="h-8 w-8 text-fire-start" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-ink">Open camera studio</p>
                      <p className="mt-1 text-xs text-ink-faint">Capture your product in professional quality</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-fire-start px-5 py-2.5 text-sm font-semibold text-white shadow-fire-soft">
                      <Camera className="h-4 w-4" />
                      Take a Photo
                    </div>
                  </button>
                )}

                {/* Pro tip */}
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-fire-start/20 bg-fire-start/5 px-4 py-3">
                  <Spark className="mt-0.5 h-4 w-4 flex-shrink-0 text-fire-start" />
                  <div>
                    <span className="text-xs font-semibold text-fire-start">Pro tip</span>
                    <p className="mt-0.5 text-xs text-ink-muted">Use a well-lit photo with a clean background for best results.</p>
                  </div>
                </div>
              </div>
            )}

            {inputMethod === 'url' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlPreviewOk(false); setProductPreview('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLoadUrl()}
                    placeholder="https://example.com/your-product.jpg"
                    className="flex-1 rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
                  />
                  <button
                    onClick={handleLoadUrl}
                    className="rounded-xl bg-void-700 px-4 py-3 text-sm font-semibold text-ink hover:bg-void-600 transition-colors"
                  >
                    Preview
                  </button>
                </div>
                {urlPreviewOk && productPreview && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="overflow-hidden rounded-xl border border-fire-start/30 bg-void-900"
                  >
                    <img
                      src={productPreview}
                      alt="Product preview"
                      className="max-h-48 w-full object-contain"
                      onError={() => { setUrlPreviewOk(false); setStep1Error('Could not load image from that URL.') }}
                    />
                  </motion.div>
                )}
                <p className="text-xs text-ink-faint">Paste a direct link to a JPEG, PNG, or WebP image.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Product description */}
        <div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">What is it?</span>
            <textarea
              required
              rows={2}
              value={descInput}
              onChange={e => {
                const v = e.target.value
                setDescInput(v)
                startDescTransition(() => setDescription(v))
              }}
              placeholder="A matte ceramic pour-over coffee dripper for slow mornings."
              className="mt-2 w-full resize-none rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
            />
          </label>
        </div>

        {/* Error */}
        {step1Error && (
          <p className="rounded-xl border border-fire-start/20 bg-fire-start/5 px-4 py-3 text-sm text-fire-start">{step1Error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleNextStep1}
          disabled={!canAdvanceStep1 || uploadingImage}
          className="btn-fire w-full disabled:opacity-50"
        >
          {uploadingImage ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Uploading image…</>
          ) : (
            <>Pick a style <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    )
  }

  // ── Step 2 content ────────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => setWorkflowStep(1)} className="mb-4 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors">
            ← Back
          </button>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Pick a style</h2>
          <p className="mt-1 text-sm text-ink-muted">Choose the vibe for your ad.</p>
        </div>

        {/* Image + description recap */}
        {productPreview && (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-void-800/60 p-3">
            <img src={productPreview} alt="Product" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{description.slice(0, 80)}</p>
              <p className="mt-0.5 text-[10px] text-ink-faint">Product ready</p>
            </div>
            <Check className="ml-auto h-4 w-4 flex-shrink-0 text-fire-start" />
          </div>
        )}

        {/* Style cards — cinematic video preview thumbnails */}
        <div className="grid grid-cols-2 gap-3">
          {generator.styles.map(s => {
            const meta = STYLE_META[s.id]
            const Icon = STYLE_ICON[s.id] ?? Spark
            const isSelected = style === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-fire-start/60 ring-2 ring-fire-start/20 shadow-[0_0_28px_rgba(255,107,53,0.18)]'
                    : 'border-white/[0.08] hover:border-white/[0.26] hover:shadow-[0_8px_32px_rgba(0,0,0,0.55)]'
                }`}
              >
                {/* ── Thumbnail (16:9) ── */}
                <div className="relative aspect-video w-full overflow-hidden">
                  {/* Photo */}
                  <img
                    src={meta.img}
                    alt={s.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  {/* Cinematic color grade */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: meta.colorGrade }} />
                  {/* Bottom darkening for readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  {/* Top darkening */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`grid h-9 w-9 place-items-center rounded-full border backdrop-blur-sm transition-all duration-200 group-hover:scale-110 ${
                      isSelected
                        ? 'border-fire-start/50 bg-fire-start/25 shadow-fire-soft'
                        : 'border-white/25 bg-black/35 group-hover:border-white/45 group-hover:bg-black/55'
                    }`}>
                      <PlayIcon className="h-3.5 w-3.5 translate-x-px text-white" />
                    </div>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-fire shadow-fire-soft"
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </motion.div>
                  )}

                  {/* Bottom tagline over image */}
                  <p className="absolute inset-x-0 bottom-2.5 px-3 text-[10px] font-semibold leading-tight text-white/70">
                    {meta.tagline}
                  </p>
                </div>

                {/* ── Info panel ── */}
                <div className={`border-t p-3.5 transition-colors duration-200 ${
                  isSelected ? 'border-fire-start/20 bg-fire-start/[0.06]' : 'border-white/[0.06] bg-void-900/80'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg transition-colors ${
                      isSelected ? 'bg-fire-start/25' : 'bg-void-700/70'
                    }`}>
                      <Icon className={`h-3.5 w-3.5 transition-colors ${isSelected ? 'text-fire-start' : 'text-ink-faint/70'}`} />
                    </div>
                    <span className="text-sm font-bold text-ink">{s.label}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{s.hint}</p>
                  <p className="mt-1.5 text-[10px] text-ink-faint/55">
                    <span className="font-semibold text-ink-faint/75">Best for:</span> {meta.bestFor}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Quality */}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Quality</p>
          <div className="flex gap-2">
            {generator.qualities.map(q => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={`flex-1 rounded-xl border px-3 py-3 text-center transition-all duration-150 ${
                  quality === q.id
                    ? 'border-fire-start/50 bg-fire-start/10 text-ink'
                    : 'border-white/[0.07] bg-void-800 text-ink-muted hover:bg-void-700'
                }`}
              >
                <span className="block text-sm font-bold">{q.label}</span>
                <span className="block text-[11px] text-ink-faint">{q.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate CTA */}
        <button onClick={handleGenerate} className="btn-fire w-full">
          <Wand className="h-4 w-4" />
          Generate scene · {SCENE_TEMPLATES[activeSceneIdx].label}
        </button>
        <p className="text-center text-[11px] text-ink-faint">{generator.note}</p>
      </div>
    )
  }

  // ── Step 3 content ────────────────────────────────────────────────────────

  function renderStep3() {
    const tpl = SCENE_TEMPLATES[activeSceneIdx]
    const genSteps = [
      'Writing script & blocking the scene',
      'Submitting to the render engine',
      'Rendering your video',
    ]

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">AI directs &amp; generates</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Claude is directing scene {activeSceneIdx + 1}: <span className="font-semibold text-ink">{tpl.label}</span>
          </p>
        </div>

        {/* Progress card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/60 shadow-card">
          {/* Header with fire pulse */}
          <div className="relative border-b border-white/[0.06] px-5 py-4">
            <div className="pointer-events-none absolute inset-0 opacity-20"
              style={{ background: 'linear-gradient(90deg,rgba(255,107,53,0.2) 0%,transparent 60%)' }}
            />
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
              <p className="text-sm font-semibold text-ink">Live generation</p>
              <span className="ml-auto rounded-full bg-void-700/60 px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                {tpl.duration} · {tpl.shotType}
              </span>
            </div>
          </div>

          <div className="space-y-3 p-5">
            {genSteps.map((label, i) => {
              const state = i < genStepIdx ? 'done' : i === genStepIdx ? 'active' : 'todo'
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full transition-all duration-300 ${
                    state === 'done'   ? 'bg-gradient-fire shadow-fire-soft' :
                    state === 'active' ? 'bg-fire-start/15 ring-1 ring-fire-start/50' :
                    'bg-void-600/60'
                  }`}>
                    {state === 'done'   ? <Check className="h-3.5 w-3.5 text-white" />
                    : state === 'active' ? <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                    : <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/40" />}
                  </span>
                  <span className={`text-sm transition-colors duration-300 ${state === 'todo' ? 'text-ink-faint' : 'text-ink'}`}>
                    {label}
                  </span>
                  {state === 'active' && (
                    <span className="ml-auto animate-pulse text-[10px] font-semibold text-fire-start/80">In progress</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Claude's direction (revealed once available) */}
          <AnimatePresence>
            {directorPrompt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="border-t border-white/[0.06] p-5"
              >
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold">✦ Claude's direction</p>
                <p className="text-sm leading-relaxed text-ink-muted">{directorPrompt}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Storyboard preview (all scenes, current one active) */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">Storyboard</p>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                idx={idx}
                isActive={idx === activeSceneIdx}
                isClickable={false}
                size="sm"
                posterUrl={productPreview}
              />
            ))}
          </div>
        </div>

        {/* Error state */}
        {genPhase === 'error' && genError && (
          <div className="rounded-2xl border border-fire-start/20 bg-fire-start/5 p-5">
            <p className="text-sm font-semibold text-fire-start">Generation failed</p>
            <p className="mt-1 text-sm text-ink-muted">{genError}</p>
            <div className="mt-4 flex gap-3">
              <button onClick={handleGenerate} className="btn-fire py-2.5 px-5 text-sm">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              <button onClick={() => setWorkflowStep(2)} className="btn-ghost py-2.5 px-5 text-sm">
                Change style
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Step 4 content ────────────────────────────────────────────────────────

  function renderStep4() {
    const doneScene = scenes[activeSceneIdx]
    const doneCount = completedScenes

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Download or publish</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {doneCount} of {scenes.length} scenes ready
            </p>
          </div>
          <button onClick={startOver} className="flex items-center gap-1.5 rounded-xl border border-void-500 bg-void-800/60 px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-void-700 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Start over
          </button>
        </div>

        {/* Couldn't-save warning — so a generated video is never silently lost */}
        {saveFailed && doneScene?.videoUrl && (
          <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
            <p className="text-sm font-semibold text-gold">Heads up — this video wasn't saved to your History.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Storage isn't fully connected yet, so download it now to keep it. Your video is ready below.
            </p>
          </div>
        )}

        {/* Result video */}
        {doneScene?.videoUrl && (
          <div className="overflow-hidden rounded-2xl border border-gold/20 bg-void-900 shadow-card">
            <video
              src={videoThumbSrc(doneScene.videoUrl)}
              poster={productPreview || undefined}
              controls autoPlay loop muted playsInline preload="metadata"
              className="aspect-[9/16] max-h-80 w-full object-contain"
            />
            {doneScene.directorPrompt && (
              <div className="border-t border-white/[0.06] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gold">✦ Claude's direction</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{doneScene.directorPrompt}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href={doneScene?.videoUrl ?? '#'}
            download
            target="_blank"
            rel="noreferrer"
            className="btn-fire flex items-center justify-center gap-2 py-3"
          >
            <Download className="h-4 w-4" />
            Download video
          </a>
          <button className="btn-ghost flex items-center justify-center gap-2 py-3 opacity-60 cursor-not-allowed" disabled>
            <Share2 className="h-4 w-4" />
            Publish
            <span className="rounded-full bg-void-600/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ink-faint/60 ml-1">Soon</span>
          </button>
          <button
            onClick={() => {
              const nextIdle = scenes.findIndex(s => s.phase === 'idle')
              if (nextIdle >= 0) { setActiveSceneIdx(nextIdle); setWorkflowStep(2) }
              else startOver()
            }}
            className="btn-ghost flex items-center justify-center gap-2 py-3"
          >
            <ImageIcon className="h-4 w-4" />
            {scenes.some(s => s.phase === 'idle') ? 'Generate next scene' : 'New campaign'}
          </button>
        </div>

        {/* Full storyboard */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Storyboard</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-void-600">
                <div className="h-1 rounded-full bg-gradient-fire transition-all duration-700"
                  style={{ width: `${(doneCount / scenes.length) * 100}%` }} />
              </div>
              <span className="text-[10px] font-semibold text-ink-faint">{doneCount}/{scenes.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                idx={idx}
                isActive={idx === activeSceneIdx}
                isClickable={scene.phase === 'idle' || scene.phase === 'error'}
                size="lg"
                posterUrl={productPreview}
                onClick={() => {
                  if (scene.phase === 'idle' || scene.phase === 'error') {
                    setActiveSceneIdx(idx)
                    setWorkflowStep(2)
                  } else {
                    setActiveSceneIdx(idx)
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Camera overlay */}
      {cameraOpen && (
        <CameraStudio
          onCapture={handleCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Link to="/dashboard" className="hover:text-ink transition-colors">Campaigns</Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink">New campaign</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Campaign Studio</h1>
        </div>
        <span className="eyebrow hidden sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
          Live · Real Generation
        </span>
      </div>

      {/* Mobile step indicator */}
      <div className="mb-5 lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
            Step {workflowStep} of 4 — {WORKFLOW_STEPS[workflowStep - 1].title}
          </span>
          <span className="text-xs text-ink-faint">{workflowStep * 25}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-void-600">
          <motion.div
            className="h-1 rounded-full bg-gradient-fire"
            animate={{ width: `${workflowStep * 25}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">

        {/* Left: Step nav (desktop only) */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            <StepNav />
          </div>
        </div>

        {/* Right: Step content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={workflowStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {workflowStep === 1 && renderStep1()}
              {workflowStep === 2 && renderStep2()}
              {workflowStep === 3 && renderStep3()}
              {workflowStep === 4 && renderStep4()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Always-in-view generation overlay — the inline progress card inside
            renderStep3() stays for desktop context, but this guarantees the
            countdown is visible without scrolling on any viewport, mobile
            included. Hidden the instant workflowStep advances to 4 (done). */}
        {workflowStep === 3 && (
          <GenerationOverlay
            steps={[
              { label: 'Script', headline: 'Claude is writing & blocking the scene…', detail: 'Directing this scene from your brief.' },
              { label: 'Submit', headline: 'Submitting to the render engine…', detail: 'Handing the direction to Higgsfield.' },
              { label: 'Render', headline: 'Rendering your video…', detail: 'This usually takes 1-3 minutes.' },
            ]}
            activeIndex={genStepIdx}
            estimateSecondsForStep={[15, 10, 150][genStepIdx]}
          />
        )}
      </div>
    </AppShell>
  )
}

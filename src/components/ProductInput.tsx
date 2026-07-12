/**
 * ProductInput — the reusable product-capture foundation for Ad Forge.
 *
 * Every mode (Clone / Build / Quick) mounts this as its first element: there is
 * no path through the app that doesn't begin with a product. It covers the four
 * capture methods and two AI clean-up steps the product premise depends on:
 *
 *   • Drag-and-drop multi-image upload (up to 5 angles of the same product)
 *   • In-browser camera capture (reuses CameraStudio / getUserMedia)
 *   • Product URL → server-side scrape (title, description, hero image)
 *   • Background removal via Gemini image editing, shown as a before/after slider
 *   • One-tap AI enhancement (upscale / sharpen) before the pipeline
 *
 * No new serverless function: uploads reuse the presign flow, URL scrape reuses
 * /api/sourcing, and both AI steps reuse /api/modelsheet (generateImage edit).
 * The parent owns the value; this component only emits changes.
 */
import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CameraStudio from './CameraStudio'
import { Upload, Camera, LinkIcon, Wand, Spark, Check, RefreshCw, Package, Plus, Trash, Grid, Download } from './icons'
import { extractProductFromUrl, generateImage, generateModelSheet, enhancePrompt, enhanceProductDescription } from '../lib/api'

export interface ProductInputValue {
  /** All captured angles, newest-first. Data URLs or https URLs, up to 5. */
  images: string[]
  /** The hero shot fed to generation (may be background-removed / enhanced). */
  primaryImage: string
  name: string
  description: string
  /** Campaign intent (drive conversions, brand awareness, etc.) — feeds the
   *  script writer / Creative Direction so the copy targets the right goal. */
  intent?: string
  sourceUrl?: string
  /** 2×3 multi-angle turnaround sheet of the hero, once generated. Used as a
   *  vision reference at generation time so the product stays faithful. */
  turnaroundImage?: string
}

export const EMPTY_PRODUCT: ProductInputValue = {
  images: [], primaryImage: '', name: '', description: '', intent: '', sourceUrl: undefined, turnaroundImage: undefined,
}

/** Common campaign intents offered as quick-picks (the user can also type). */
export const INTENT_OPTIONS = [
  'Drive conversions / sales',
  'Brand awareness',
  'Product launch',
  'Retargeting / warm audience',
  'Grow followers / engagement',
  'Educate about the product',
] as const

type Method = 'upload' | 'camera' | 'url'
const MAX_IMAGES = 5

// Resize any incoming image to ≤1280px on the long edge, re-encode JPEG 0.85.
// Keeps the base64 payload well under Vercel's 4.5 MB body limit for the AI steps.
function resizeToDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // canvas.toDataURL() throws a SecurityError if the source image was
      // served without a permissive CORS header (true for most real-world
      // product-page CDNs — Amazon, WooCommerce, many Shopify apps). That
      // throw happens inside this callback, NOT the executor's sync scope, so
      // without this try/catch it never reaches reject() — the promise just
      // hangs forever and the caller's fallback never fires. This was why
      // "paste a product URL" silently never completed.
      try {
        const MAX = 1280
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not process image (CORS-restricted source).'))
      }
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

function dataUrlParts(dataUrl: string): { base64: string; mimeType: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

// ── Before/after reveal slider ────────────────────────────────────────────────
function BeforeAfter({ before, after, onKeep, onDiscard, busyLabel }: {
  before: string
  after: string | null
  onKeep: () => void
  onDiscard: () => void
  busyLabel?: string
}) {
  const [pos, setPos] = useState(50)
  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-void-900 select-none">
        <img src={before} alt="Original" className="absolute inset-0 h-full w-full object-contain" />
        {after && (
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
            {/* Checkerboard so a transparent cutout reads as removed, not white */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(45deg,#2a2a2e 25%,transparent 25%),linear-gradient(-45deg,#2a2a2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2e 75%),linear-gradient(-45deg,transparent 75%,#2a2a2e 75%)',
              backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
            }} />
            <img src={after} alt="Cleaned" className="absolute inset-0 h-full w-full object-contain" style={{ width: `${100 / (pos / 100)}%`, maxWidth: 'none' }} />
          </div>
        )}
        {after && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-fire-start" style={{ left: `${pos}%` }} />
            <input
              type="range" min={0} max={100} value={pos}
              onChange={e => setPos(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              aria-label="Reveal cleaned image"
            />
            <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Before</span>
            <span className="absolute right-2 top-2 rounded-md bg-fire-start/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">After</span>
          </>
        )}
        {!after && busyLabel && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-sm text-ink">
              <RefreshCw className="h-5 w-5 animate-spin text-fire-start" />
              {busyLabel}
            </div>
          </div>
        )}
      </div>
      {after && (
        <div className="flex gap-2">
          <button onClick={onKeep} className="btn-fire flex-1 gap-1.5 py-2 text-sm">
            <Check className="h-4 w-4" /> Keep this
          </button>
          <button onClick={onDiscard} className="btn-ghost flex-1 py-2 text-sm">Revert</button>
        </div>
      )}
    </div>
  )
}

export default function ProductInput({ value, onChange, className = '' }: {
  value: ProductInputValue
  onChange: (v: ProductInputValue) => void
  className?: string
}) {
  const [method, setMethod] = useState<Method>('upload')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // AI clean-up state (operates on the primary image, via Gemini nano-banana)
  const [aiBusy, setAiBusy] = useState<'bg' | 'enhance' | null>(null)
  const [preview, setPreview] = useState<{ before: string; after: string | null } | null>(null)

  // Enhance-with-prompt state (user describes the edit; AI Magic polishes it)
  const [enhanceOpen, setEnhanceOpen] = useState(false)
  const [enhanceText, setEnhanceText] = useState('')
  const [enhanceMagicBusy, setEnhanceMagicBusy] = useState(false)

  // "AI Magic" on the product Description — expands a thin description into a
  // richer one (features, who it's for, benefit) so the script writer /
  // Creative Direction has real material to work with.
  const [descMagicBusy, setDescMagicBusy] = useState(false)
  const [descMagicErr, setDescMagicErr] = useState('')

  // Turnaround / model-sheet state (a faithful multi-angle grid of the hero).
  const [turnaroundBusy, setTurnaroundBusy] = useState(false)
  const [turnaroundErr, setTurnaroundErr] = useState('')
  // Regenerate-with-instruction (+ AI Magic) for the turnaround.
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenText, setRegenText] = useState('')
  const [regenMagicBusy, setRegenMagicBusy] = useState(false)

  const patch = useCallback((u: Partial<ProductInputValue>) => onChange({ ...value, ...u }), [value, onChange])

  async function addImages(sources: string[]) {
    setError('')
    const room = MAX_IMAGES - value.images.length
    if (room <= 0) { setError(`Up to ${MAX_IMAGES} images. Remove one to add another.`); return }
    try {
      const resized = await Promise.all(sources.slice(0, room).map(resizeToDataUrl))
      const images = [...resized, ...value.images].slice(0, MAX_IMAGES)
      patch({ images, primaryImage: value.primaryImage || images[0] })
    } catch {
      setError('One of those files could not be read. Try a JPG, PNG, or WebP.')
    }
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return
    const readers = Array.from(files)
      .filter(f => f.type.startsWith('image/') && f.size <= 20 * 1024 * 1024)
      .map(f => new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = () => rej(new Error('read failed'))
        r.readAsDataURL(f)
      }))
    if (!readers.length) { setError('Choose image files under 20 MB each.'); return }
    Promise.all(readers).then(addImages).catch(() => setError('Could not read those files.'))
  }

  async function loadUrl() {
    const u = urlInput.trim()
    if (!u) return
    setUrlBusy(true); setError('')
    try {
      const r = await extractProductFromUrl(u)
      const next: Partial<ProductInputValue> = { sourceUrl: u }
      if (r.title) next.name = r.title
      // The server already falls back to a Claude-written description from
      // the photo when the page's own meta tags don't have one — so this is
      // rarely empty, and the user is never forced to hand-type it.
      if (r.description) next.description = r.description
      const gallery = r.images?.length ? r.images : r.imageUrl ? [r.imageUrl] : []
      if (gallery.length) {
        const resized = await Promise.all(gallery.map(url => resizeToDataUrl(url).catch(() => url)))
        next.images = [...resized, ...value.images].slice(0, MAX_IMAGES)
        next.primaryImage = value.primaryImage || resized[0]
      }
      patch(next)
      if (!gallery.length && !r.title) setError('Nothing usable found at that URL — try the product page directly.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that URL.')
    } finally {
      setUrlBusy(false)
    }
  }

  function removeImage(src: string) {
    const images = value.images.filter(i => i !== src)
    patch({ images, primaryImage: value.primaryImage === src ? (images[0] ?? '') : value.primaryImage })
  }

  /** The hero photo as the API reference shape (data-URL → base64, else url). */
  function heroRef(): { imageBase64: string; mimeType: string } | { imageUrl: string } | null {
    if (!value.primaryImage) return null
    const parts = dataUrlParts(value.primaryImage)
    return parts ? { imageBase64: parts.base64, mimeType: parts.mimeType } : { imageUrl: value.primaryImage }
  }

  // Background removal & enhance now route through Gemini nano-banana (a true
  // instruction-following image editor) via /api/modelsheet 'edit'. The old
  // client-side flood-fill/levels versions "did nothing" on real product
  // photos (complex backgrounds, imperceptible level shifts) — this edits the
  // actual pixels faithfully.
  const BG_PROMPT = 'Remove the background completely and replace it with a pure solid white (#FFFFFF) background. Keep the product EXACTLY as it is — identical shape, color, materials, label text, proportions, and position. Do not restyle, recolor, relight, crop, or move the product. Clean crisp edges, no drop shadow, no reflection, no added elements.'

  async function runBackgroundRemoval() {
    const ref = heroRef()
    if (!ref) { setError('Background removal works on an uploaded/captured photo.'); return }
    setAiBusy('bg'); setError('')
    setPreview({ before: value.primaryImage, after: null })
    try {
      const { imageDataUrl } = await generateImage({ mode: 'edit', subjectType: 'product', editPrompt: BG_PROMPT, ...ref })
      setPreview({ before: value.primaryImage, after: imageDataUrl })
    } catch (e) {
      setPreview(null)
      setError(e instanceof Error ? e.message : 'Background removal failed — try again.')
    } finally {
      setAiBusy(null)
    }
  }

  /** Enhance/modify the hero photo with the user's own instruction. */
  async function runEnhance() {
    const ref = heroRef()
    if (!ref) { setError('Enhance works on an uploaded/captured photo.'); return }
    if (!enhanceText.trim()) { setError('Describe how you want the photo enhanced.'); return }
    setAiBusy('enhance'); setError('')
    setPreview({ before: value.primaryImage, after: null })
    try {
      const editPrompt = `${enhanceText.trim()}. Keep the product itself faithful — do not change its shape, color, label, or proportions unless the instruction explicitly asks for it.`
      const { imageDataUrl } = await generateImage({ mode: 'edit', subjectType: 'product', editPrompt, ...ref })
      setPreview({ before: value.primaryImage, after: imageDataUrl })
      setEnhanceOpen(false)
    } catch (e) {
      setPreview(null)
      setError(e instanceof Error ? e.message : 'Enhance failed — try again.')
    } finally {
      setAiBusy(null)
    }
  }

  /** "AI Magic" on the Description — enrich a thin product description into a
   *  fuller one the script writer can actually use. */
  async function magicEnhanceDescription() {
    const seed = value.description.trim() || value.name.trim()
    if (!seed) { setDescMagicErr('Add a product name or a few words first.'); return }
    setDescMagicBusy(true)
    setDescMagicErr('')
    try {
      const { enhanced } = await enhanceProductDescription({
        name: value.name || undefined,
        description: value.description || undefined,
        intent: value.intent || undefined,
      })
      if (enhanced) patch({ description: enhanced })
    } catch (e) {
      setDescMagicErr(e instanceof Error ? e.message : 'Could not enhance the description.')
    } finally {
      setDescMagicBusy(false)
    }
  }

  /** "AI Magic" — expand the user's rough enhance keywords into a sharper instruction. */
  async function magicEnhanceText() {
    if (!enhanceText.trim()) return
    setEnhanceMagicBusy(true)
    try {
      const { enhanced } = await enhancePrompt({ text: enhanceText.trim(), productDescription: value.name || value.description || undefined })
      setEnhanceText(enhanced)
    } catch { /* leave the text as-is */ } finally {
      setEnhanceMagicBusy(false)
    }
  }

  function keepAi() {
    if (!preview?.after) return
    const images = value.images.map(i => (i === preview.before ? preview.after! : i))
    if (!images.includes(preview.after)) images.unshift(preview.after)
    patch({ images: images.slice(0, MAX_IMAGES), primaryImage: preview.after })
    setPreview(null)
  }

  // Turnaround: a faithful single-image 2x3 multi-angle grid of the product,
  // generated by Gemini nano-banana from the hero photo (an instruction editor
  // that keeps the real object identical across all six cells — unlike Soul,
  // which re-imagined it). Optional Regenerate instruction (with AI Magic).
  async function generateTurnaround(instruction?: string) {
    const ref = heroRef()
    if (!ref || turnaroundBusy) { if (!ref) setTurnaroundErr('Add a product photo first.'); return }
    setTurnaroundBusy(true); setTurnaroundErr('')
    try {
      const { sheetDataUrl } = await generateModelSheet({
        subjectType: 'product',
        subjectHint: value.name || undefined,
        extraInstruction: instruction?.trim() || undefined,
        ...ref,
      })
      patch({ turnaroundImage: sheetDataUrl })
      setRegenOpen(false)
    } catch (e) {
      setTurnaroundErr(e instanceof Error ? e.message : 'Could not build the turnaround — try a clearer photo.')
    } finally {
      setTurnaroundBusy(false)
    }
  }

  async function magicRegenText() {
    if (!regenText.trim()) return
    setRegenMagicBusy(true)
    try {
      const { enhanced } = await enhancePrompt({ text: regenText.trim(), productDescription: value.name || value.description || undefined })
      setRegenText(enhanced)
    } catch { /* leave as-is */ } finally {
      setRegenMagicBusy(false)
    }
  }

  /** Download the turnaround image. */
  function downloadTurnaround() {
    if (!value.turnaroundImage) return
    const a = document.createElement('a')
    a.href = value.turnaroundImage
    a.download = `${(value.name || 'product').replace(/\s+/g, '-').toLowerCase()}-turnaround.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const hasImages = value.images.length > 0
  const TABS: Array<{ id: Method; label: string; icon: typeof Upload }> = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'camera', label: 'Camera', icon: Camera },
    { id: 'url', label: 'Product URL', icon: LinkIcon },
  ]

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#161618] p-6 ${className}`}>
      {cameraOpen && (
        <CameraStudio
          onCapture={(dataUrl) => addImages([dataUrl])}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-fire-start/15 ring-1 ring-fire-start/20">
          <Package className="h-4.5 w-4.5 text-fire-start" />
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight text-ink">Your product</h3>
          <p className="text-xs text-ink-muted">Every ad starts here. Add up to {MAX_IMAGES} angles.</p>
        </div>
      </div>

      {/* Method tabs */}
      <div className="mt-5 flex gap-1.5 rounded-xl bg-void-900 p-1">
        {TABS.map(t => {
          const active = method === t.id
          return (
            <button
              key={t.id}
              onClick={() => { setMethod(t.id); if (t.id === 'camera') setCameraOpen(true) }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-fire-start/15 text-fire-start' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Method body */}
      <div className="mt-4">
        {method === 'upload' && (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => { e.preventDefault(); setIsDragOver(false); onFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            className={`grid cursor-pointer place-items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragOver ? 'border-fire-start/60 bg-fire-start/[0.05]' : 'border-white/12 hover:border-white/25'
            }`}
          >
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onFiles(e.target.files)} />
            <Upload className="h-7 w-7 text-ink-faint" />
            <p className="mt-2.5 text-sm font-semibold text-ink">Drag images here or click to browse</p>
            <p className="mt-1 text-xs text-ink-faint">JPG, PNG, or WebP · up to 20 MB each</p>
          </div>
        )}

        {method === 'camera' && (
          <button onClick={() => setCameraOpen(true)} className="btn-ghost flex w-full items-center justify-center gap-2 py-3 text-sm">
            <Camera className="h-4 w-4" /> Open camera
          </button>
        )}

        {method === 'url' && (
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadUrl() }}
              placeholder="Paste an Amazon, Shopify, or AliExpress product URL"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
            />
            <button onClick={loadUrl} disabled={urlBusy || !urlInput.trim()} className="btn-fire gap-1.5 px-4 py-2.5 text-sm disabled:opacity-40">
              {urlBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              {urlBusy ? 'Reading…' : 'Fetch'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-amber-300">{error}</p>}

      {/* Captured images */}
      {hasImages && (
        <div className="mt-5">
          <div className="grid grid-cols-5 gap-2">
            {value.images.map((src) => {
              const isPrimary = src === value.primaryImage
              return (
                <div key={src} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-void-900">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => patch({ primaryImage: src })}
                    className={`absolute inset-0 transition-colors ${isPrimary ? 'ring-2 ring-inset ring-fire-start' : 'hover:bg-black/30'}`}
                    aria-label="Set as hero image"
                  />
                  {isPrimary && (
                    <span className="absolute left-1 top-1 rounded bg-fire-start px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Hero</span>
                  )}
                  <button
                    onClick={() => removeImage(src)}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600/80"
                    aria-label="Remove image"
                  >
                    <Trash className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
            {value.images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/15 text-ink-faint transition-colors hover:border-fire-start/40 hover:text-fire-start"
                aria-label="Add another angle"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Click a thumbnail to set the hero shot. The hero drives generation.</p>

          {/* AI clean-up */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={runBackgroundRemoval} disabled={!!aiBusy || turnaroundBusy} className="btn-ghost gap-1.5 px-3 py-2 text-xs disabled:opacity-40">
              {aiBusy === 'bg' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand className="h-3.5 w-3.5" />}
              Remove background
            </button>
            <button onClick={() => { setEnhanceOpen(v => !v); setError('') }} disabled={!!aiBusy || turnaroundBusy}
              className={`gap-1.5 px-3 py-2 text-xs disabled:opacity-40 ${enhanceOpen ? 'btn-fire' : 'btn-ghost'}`}>
              {aiBusy === 'enhance' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Spark className="h-3.5 w-3.5" />}
              Enhance photo
            </button>
            <button onClick={() => generateTurnaround()} disabled={!!aiBusy || turnaroundBusy} className="btn-ghost gap-1.5 px-3 py-2 text-xs disabled:opacity-40">
              {turnaroundBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Grid className="h-3.5 w-3.5" />}
              {value.turnaroundImage ? 'Regenerate turnaround' : 'Generate turnaround'}
            </button>
          </div>

          {/* Enhance-with-prompt panel — you say how to change the photo, AI
              Magic sharpens the wording, nano-banana applies it faithfully. */}
          {enhanceOpen && (
            <div className="mt-3 rounded-xl border border-fire-start/20 bg-fire-start/[0.04] p-3 space-y-2.5">
              <p className="text-[11px] text-ink-muted">Describe how to enhance or modify the photo — lighting, background, angle, cleanup. The product stays faithful unless you ask otherwise.</p>
              <textarea
                value={enhanceText}
                onChange={e => setEnhanceText(e.target.value)}
                disabled={aiBusy === 'enhance'}
                rows={2}
                placeholder="e.g. brighten the lighting and put it on a clean marble countertop"
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-void-800 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button type="button" onClick={magicEnhanceText} disabled={enhanceMagicBusy || !enhanceText.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.10] bg-void-700/60 px-3 py-2 text-xs font-semibold text-ink-muted transition-all hover:border-fire-start/30 hover:text-fire-start disabled:opacity-40">
                  {enhanceMagicBusy ? <><RefreshCw className="h-3 w-3 animate-spin" /> Enhancing…</> : <><Spark className="h-3 w-3" /> AI Magic</>}
                </button>
                <button type="button" onClick={runEnhance} disabled={aiBusy === 'enhance' || !enhanceText.trim()}
                  className="btn-fire flex-1 justify-center gap-1.5 py-2 text-xs disabled:opacity-50">
                  {aiBusy === 'enhance' ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</> : <><Wand className="h-3 w-3" /> Apply</>}
                </button>
              </div>
            </div>
          )}

          {/* Turnaround — your real uploaded angles (ground truth) plus
              AI-estimated fill angles for the sides/back, plus a Claude
              dimensions/material/scale legend. Gives the video generator a
              multi-angle sense of the product's form and true scale. */}
          {(turnaroundBusy || value.turnaroundImage || turnaroundErr) && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-void-900 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Grid className="h-3.5 w-3.5 text-fire-start" />
                <p className="text-xs font-semibold text-ink">Product turnaround</p>
                {value.turnaroundImage && !turnaroundBusy && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><Check className="h-3 w-3" /> Saved as reference</span>
                )}
              </div>
              {turnaroundBusy ? (
                <div className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-lg bg-void-800/60 text-sm text-ink-muted">
                  <RefreshCw className="h-4 w-4 animate-spin text-fire-start" />
                  <span>Rendering the 6-angle turnaround…</span>
                </div>
              ) : value.turnaroundImage ? (
                <img src={value.turnaroundImage} alt="Product turnaround sheet" className="w-full rounded-lg" />
              ) : null}
              {turnaroundErr && <p className="mt-2 text-xs text-amber-300">{turnaroundErr}</p>}

              {value.turnaroundImage && !turnaroundBusy && (
                <>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={downloadTurnaround} className="btn-ghost flex-1 justify-center gap-1.5 py-2 text-xs">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button type="button" onClick={() => { setRegenOpen(v => !v); setTurnaroundErr('') }}
                      className={`flex-1 justify-center gap-1.5 py-2 text-xs ${regenOpen ? 'btn-fire' : 'btn-ghost'}`}>
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                  </div>

                  {regenOpen && (
                    <div className="mt-2.5 rounded-lg border border-fire-start/20 bg-fire-start/[0.04] p-2.5 space-y-2">
                      <p className="text-[11px] text-ink-muted">Optional: tell it what to change (angles, lighting, background). Leave blank to just re-roll.</p>
                      <textarea
                        value={regenText}
                        onChange={e => setRegenText(e.target.value)}
                        rows={2}
                        placeholder="e.g. show more of the back and top, brighter white background"
                        className="w-full resize-none rounded-lg border border-white/[0.08] bg-void-800 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={magicRegenText} disabled={regenMagicBusy || !regenText.trim()}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.10] bg-void-700/60 px-3 py-2 text-xs font-semibold text-ink-muted transition-all hover:border-fire-start/30 hover:text-fire-start disabled:opacity-40">
                          {regenMagicBusy ? <><RefreshCw className="h-3 w-3 animate-spin" /> Enhancing…</> : <><Spark className="h-3 w-3" /> AI Magic</>}
                        </button>
                        <button type="button" onClick={() => generateTurnaround(regenText)}
                          className="btn-fire flex-1 justify-center gap-1.5 py-2 text-xs">
                          <RefreshCw className="h-3 w-3" /> Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <p className="mt-2 text-[11px] text-ink-faint">
                A faithful 6-angle turnaround generated from your photo — it helps the video model keep the product consistent when a creator turns or handles it.
              </p>
            </div>
          )}

          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <BeforeAfter
                  before={preview.before}
                  after={preview.after}
                  busyLabel={aiBusy === 'bg' ? 'Removing background…' : aiBusy === 'enhance' ? 'Enhancing…' : undefined}
                  onKeep={keepAi}
                  onDiscard={() => setPreview(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Name + description */}
      <div className="mt-5 space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">Product name</p>
          <input
            value={value.name}
            onChange={e => patch({ name: e.target.value })}
            placeholder="e.g. Glow Vitamin C Serum"
            className="w-full rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-muted">Description</p>
            <button
              type="button"
              onClick={magicEnhanceDescription}
              disabled={descMagicBusy}
              title="Let AI enrich your description so the script writer has more to work with"
              className="inline-flex items-center gap-1 rounded-lg border border-fire-start/30 bg-fire-start/[0.06] px-2 py-1 text-[11px] font-semibold text-fire-start transition hover:bg-fire-start/[0.12] disabled:opacity-50"
            >
              {descMagicBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Spark className="h-3 w-3" />} AI Magic
            </button>
          </div>
          <textarea
            value={value.description}
            onChange={e => patch({ description: e.target.value })}
            placeholder="One or two lines about what it is and who it's for. The AI uses this to write the script."
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
          />
          {descMagicErr && <p className="mt-1 text-[11px] text-fire-start">{descMagicErr}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">Campaign intent</p>
          <input
            value={value.intent ?? ''}
            onChange={e => patch({ intent: e.target.value })}
            list="intent-options"
            placeholder="What's the goal? e.g. drive conversions, brand awareness…"
            className="w-full rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
          />
          <datalist id="intent-options">
            {INTENT_OPTIONS.map(o => <option key={o} value={o} />)}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INTENT_OPTIONS.slice(0, 4).map(o => (
              <button
                key={o}
                type="button"
                onClick={() => patch({ intent: o })}
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  value.intent === o
                    ? 'border-fire-start/60 bg-fire-start/[0.08] text-ink'
                    : 'border-white/[0.10] bg-void-900 text-ink-muted hover:border-white/20'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">Steers the script — especially “Creative Direction” in the next step.</p>
        </div>
      </div>
    </div>
  )
}

/** True when the value has enough to proceed to a mode. */
export function isProductReady(v: ProductInputValue): boolean {
  return !!v.primaryImage || v.name.trim().length > 1
}

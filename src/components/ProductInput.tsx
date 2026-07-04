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
import { Upload, Camera, LinkIcon, Wand, Spark, Check, RefreshCw, Package, Plus, Trash } from './icons'
import { extractProductFromUrl, generateImage } from '../lib/api'

export interface ProductInputValue {
  /** All captured angles, newest-first. Data URLs or https URLs, up to 5. */
  images: string[]
  /** The hero shot fed to generation (may be background-removed / enhanced). */
  primaryImage: string
  name: string
  description: string
  sourceUrl?: string
}

export const EMPTY_PRODUCT: ProductInputValue = {
  images: [], primaryImage: '', name: '', description: '', sourceUrl: undefined,
}

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

  // AI clean-up state (operates on the primary image)
  const [aiBusy, setAiBusy] = useState<'bg' | 'enhance' | null>(null)
  const [preview, setPreview] = useState<{ before: string; after: string | null } | null>(null)

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
      if (r.description) next.description = r.description
      if (r.imageUrl) {
        const resized = await resizeToDataUrl(r.imageUrl).catch(() => r.imageUrl!)
        next.images = [resized, ...value.images].slice(0, MAX_IMAGES)
        next.primaryImage = value.primaryImage || resized
      }
      patch(next)
      if (!r.imageUrl && !r.title) setError('Nothing usable found at that URL — try the product page directly.')
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

  async function runAi(kind: 'bg' | 'enhance') {
    if (!value.primaryImage) return
    const parts = dataUrlParts(value.primaryImage)
    if (!parts) { setError('Enhance and background removal work on uploaded/captured images.'); return }
    setAiBusy(kind); setError('')
    setPreview({ before: value.primaryImage, after: null })
    const editPrompt = kind === 'bg'
      ? 'Remove the background completely, leaving ONLY the product on a pure white background. Keep the product pixel-accurate with crisp clean edges, no drop shadow, no reflection, no added elements.'
      : 'Upscale and sharpen this product photo: improve lighting, clarity and detail, and remove noise and JPEG compression artifacts. Do NOT alter the product\'s shape, color, label text, or proportions.'
    try {
      const { imageDataUrl } = await generateImage({
        mode: 'edit', subjectType: 'product', editPrompt,
        imageBase64: parts.base64, mimeType: parts.mimeType,
      })
      setPreview({ before: value.primaryImage, after: imageDataUrl })
    } catch (e) {
      setPreview(null)
      setError(e instanceof Error ? e.message : 'That step failed — try again.')
    } finally {
      setAiBusy(null)
    }
  }

  function keepAi() {
    if (!preview?.after) return
    const images = value.images.map(i => (i === preview.before ? preview.after! : i))
    if (!images.includes(preview.after)) images.unshift(preview.after)
    patch({ images: images.slice(0, MAX_IMAGES), primaryImage: preview.after })
    setPreview(null)
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
            <button onClick={() => runAi('bg')} disabled={!!aiBusy} className="btn-ghost gap-1.5 px-3 py-2 text-xs disabled:opacity-40">
              {aiBusy === 'bg' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand className="h-3.5 w-3.5" />}
              Remove background
            </button>
            <button onClick={() => runAi('enhance')} disabled={!!aiBusy} className="btn-ghost gap-1.5 px-3 py-2 text-xs disabled:opacity-40">
              {aiBusy === 'enhance' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Spark className="h-3.5 w-3.5" />}
              Enhance photo
            </button>
          </div>

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
        <input
          value={value.name}
          onChange={e => patch({ name: e.target.value })}
          placeholder="Product name (e.g. Glow Vitamin C Serum)"
          className="w-full rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
        />
        <textarea
          value={value.description}
          onChange={e => patch({ description: e.target.value })}
          placeholder="One or two lines about what it is and who it's for. The AI uses this to write the script."
          rows={2}
          className="w-full resize-none rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
        />
      </div>
    </div>
  )
}

/** True when the value has enough to proceed to a mode. */
export function isProductReady(v: ProductInputValue): boolean {
  return !!v.primaryImage || v.name.trim().length > 1
}

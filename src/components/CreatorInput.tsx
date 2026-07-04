/**
 * CreatorInput — "Bring Your Own Creator" (Task A), shared across all three
 * generation modes (Clone, Build From Scratch, Quick Generate).
 *
 * Presents three creator sources with equal weight:
 *   - Generate a creator     (existing attribute-based casting)
 *   - Use a saved creator    (existing, from the creators library)
 *   - Upload your own        (new — this is the gap Task A closes)
 *
 * Uploading a real person's photo forks into two paths, chosen explicitly
 * (never assumed):
 *   Path 1 "Use this person exactly as they are" — the raw upload becomes the
 *          Veo identity reference directly.
 *   Path 2 "Transform this person" — a natural-language instruction is sent to
 *          Gemini image-edit (api/modelsheet.ts, subjectType 'character') as an
 *          EDIT of the uploaded photo (never a from-scratch regen), producing a
 *          same-identity, changed-attribute still that becomes the reference.
 *
 * A single consent checkbox gates any use of an uploaded human photo, and the
 * result can optionally be saved to the user's creator library (creators
 * table, already scoped by userId — no schema change needed).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Camera, Upload, Check, X, RefreshCw, Trash, Plus, Users, Wand, Star } from './icons'
import { generateImage, listCreators, saveCreator, type StoredCreator } from '../lib/api'
import type { CreatorAttributes } from '../lib/studio/types'

const MAX_IMAGES = 5

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary']
const AGE_OPTIONS = ['18–24', '25–34', '35–44', '45–54', '55+']
const ETHNICITY_OPTIONS = ['Asian', 'Black / African American', 'Hispanic / Latino', 'Middle Eastern', 'South Asian', 'White / Caucasian', 'Mixed / Other']
const WARDROBE_OPTIONS = ['casual streetwear', 'athletic / sportswear', 'business casual', 'cozy loungewear', 'trendy fashion', 'classic / timeless']
const ENERGY_OPTIONS: Array<{ id: CreatorAttributes['energyLevel']; label: string; hint: string }> = [
  { id: 'low', label: 'Calm', hint: 'Trustworthy, measured delivery' },
  { id: 'medium', label: 'Engaging', hint: 'Relatable, natural enthusiasm' },
  { id: 'high', label: 'Hype', hint: 'High-energy, scroll-stopper' },
]

// Quick-tap templates — tapping REPLACES the instruction field; user edits from there.
const TRANSFORM_CHIPS = [
  { label: 'Clothing color / style', text: 'Change their clothing to ' },
  { label: 'Hairstyle or hair color', text: 'Change their hairstyle to ' },
  { label: 'What they’re holding / doing', text: 'Have them ' },
  { label: 'The setting around them', text: 'Change the setting to ' },
  { label: 'Wardrobe context', text: 'Change their wardrobe from casual to business attire' },
]

export type CreatorSourceMode = 'generated' | 'saved' | 'uploaded_seed'
export type CreatorUsagePath = 'as_is' | 'transform'

export interface CreatorInputValue {
  mode: CreatorSourceMode
  attributes: CreatorAttributes
  savedCreatorId: string
  /** All captured angles, newest-first. Data URLs, up to 5. */
  seedImages: string[]
  /** The identity-anchor shot (usually seedImages[0]). */
  primarySeedImage: string
  usagePath: CreatorUsagePath
  transformInstruction: string
  /** The image actually used as the Veo reference: raw upload (as_is) or the
   *  transformed still (transform, once previewed). Empty until resolved. */
  resolvedImageUrl: string
  consentAcknowledged: boolean
  consentAt?: string
}

export const EMPTY_CREATOR: CreatorInputValue = {
  mode: 'generated',
  attributes: { gender: '', ageRange: '', ethnicity: '', bodyType: '', hair: '', wardrobe: '', expression: '', energyLevel: 'medium', cameraConfidence: '' },
  savedCreatorId: '',
  seedImages: [],
  primarySeedImage: '',
  usagePath: 'as_is',
  transformInstruction: '',
  resolvedImageUrl: '',
  consentAcknowledged: false,
  consentAt: undefined,
}

/** True when the value is complete enough to generate with. */
export function isCreatorReady(v: CreatorInputValue): boolean {
  if (v.mode === 'generated') return true
  if (v.mode === 'saved') {
    if (!v.savedCreatorId) return false
    // A saved creator with a photo still needs a consent record — either
    // carried forward from when it was originally saved, or (for creators
    // saved before this feature existed) acknowledged now.
    return !v.resolvedImageUrl || v.consentAcknowledged
  }
  // uploaded_seed: must have a resolved image (as-is upload, or a previewed
  // transform) AND explicit consent — never generate on an unacknowledged photo.
  return !!v.resolvedImageUrl && v.consentAcknowledged
}

function resizeToDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // See ProductInput.tsx's identical helper for why this try/catch matters:
      // a CORS-tainted canvas throws inside this callback, not the executor's
      // sync scope, so without it the promise hangs forever instead of rejecting.
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

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
            value === o ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'
          }`}>
          {o}
        </button>
      ))}
    </div>
  )
}

// Lazily loaded to avoid a hard dependency from every call site — mirrors the
// dynamic-import-free approach used elsewhere; kept inline since it's small.
function CameraCapture({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s })
      .catch(() => setError('Could not access the camera. Check permissions, or upload a file instead.'))
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [])
  function shoot() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.9))
    onClose()
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-void-900">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <p className="text-sm font-bold text-ink">Take a photo</p>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="aspect-square bg-black">
          {error
            ? <div className="grid h-full place-items-center p-6 text-center text-sm text-amber-300">{error}</div>
            : <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />}
        </div>
        <div className="p-4">
          <button onClick={shoot} disabled={!!error} className="btn-fire w-full disabled:opacity-40">
            <Camera className="h-4 w-4" /> Capture
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CreatorInput({
  value, onChange, savedCreators: savedCreatorsProp, className = '',
}: {
  value: CreatorInputValue
  onChange: (v: CreatorInputValue) => void
  /** Optional — if omitted, the component fetches its own list. */
  savedCreators?: StoredCreator[]
  className?: string
}) {
  const { user } = useUser()
  const [savedCreators, setSavedCreators] = useState<StoredCreator[]>(savedCreatorsProp ?? [])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [transformBusy, setTransformBusy] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (savedCreatorsProp || !user?.id) return
    listCreators(user.id).then(r => setSavedCreators(r.creators)).catch(() => {})
  }, [user?.id, savedCreatorsProp])

  const patch = useCallback((u: Partial<CreatorInputValue>) => onChange({ ...value, ...u }), [value, onChange])

  async function addImages(sources: string[]) {
    setError('')
    const room = MAX_IMAGES - value.seedImages.length
    if (room <= 0) { setError(`Up to ${MAX_IMAGES} photos. Remove one to add another.`); return }
    try {
      const resized = await Promise.all(sources.slice(0, room).map(resizeToDataUrl))
      const seedImages = [...resized, ...value.seedImages].slice(0, MAX_IMAGES)
      const primary = value.primarySeedImage || seedImages[0]
      patch({
        seedImages, primarySeedImage: primary,
        // A new upload invalidates any previously resolved/consented image.
        resolvedImageUrl: value.usagePath === 'as_is' ? primary : value.resolvedImageUrl,
        consentAcknowledged: false, consentAt: undefined,
      })
    } catch {
      setError('One of those photos could not be read. Try a JPG, PNG, or WebP.')
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

  function removeImage(src: string) {
    const seedImages = value.seedImages.filter(i => i !== src)
    const primary = value.primarySeedImage === src ? (seedImages[0] ?? '') : value.primarySeedImage
    patch({ seedImages, primarySeedImage: primary, resolvedImageUrl: '', consentAcknowledged: false, consentAt: undefined })
  }

  function choosePath(path: CreatorUsagePath) {
    if (path === 'as_is') {
      patch({ usagePath: 'as_is', resolvedImageUrl: value.primarySeedImage, consentAcknowledged: false, consentAt: undefined })
    } else {
      patch({ usagePath: 'transform', resolvedImageUrl: '', consentAcknowledged: false, consentAt: undefined })
    }
  }

  async function previewTransform() {
    if (!value.transformInstruction.trim()) { setError('Describe the change first.'); return }
    const parts = dataUrlParts(value.primarySeedImage)
    if (!parts) { setError('Upload a photo before transforming it.'); return }
    setTransformBusy(true); setError('')
    try {
      // Scoped as an EDIT of the uploaded photo (never a from-scratch regen) —
      // api/modelsheet.ts's 'edit' mode locks identity server-side; subjectType
      // 'character' adds the face/identity-preservation instruction.
      const { imageDataUrl } = await generateImage({
        mode: 'edit', subjectType: 'character',
        editPrompt: value.transformInstruction.trim(),
        imageBase64: parts.base64, mimeType: parts.mimeType,
      })
      patch({ resolvedImageUrl: imageDataUrl, consentAcknowledged: false, consentAt: undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not preview that change — try again.')
    } finally {
      setTransformBusy(false)
    }
  }

  function toggleConsent(checked: boolean) {
    patch({ consentAcknowledged: checked, consentAt: checked ? new Date().toISOString() : undefined })
  }

  async function doSaveCreator() {
    if (!user?.id || !value.resolvedImageUrl) return
    setSaveBusy(true); setError('')
    try {
      await saveCreator(user.id, {
        name: saveName.trim() || 'My creator',
        mode: 'uploaded_seed',
        attributes: { likenessConsentAt: value.consentAt ?? null },
        seed_images: value.seedImages.map(url => ({ url })),
      })
      setSaved(true); setSaveOpen(false)
      if (!savedCreatorsProp && user?.id) listCreators(user.id).then(r => setSavedCreators(r.creators)).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this creator.')
    } finally {
      setSaveBusy(false)
    }
  }

  const attrs = value.attributes
  const SOURCES: Array<{ id: CreatorSourceMode; icon: typeof Users; label: string; desc: string }> = [
    { id: 'generated', icon: Wand, label: 'Generate AI Creator', desc: 'AI builds from attributes' },
    ...(savedCreators.length > 0 ? [{ id: 'saved' as const, icon: Star, label: 'Use a saved creator', desc: `${savedCreators.length} saved` }] : []),
    { id: 'uploaded_seed', icon: Camera, label: 'Upload your own', desc: 'Bring your own creator' },
  ]

  return (
    <div className={`space-y-5 ${className}`}>
      {cameraOpen && <CameraCapture onCapture={dataUrl => addImages([dataUrl])} onClose={() => setCameraOpen(false)} />}

      {/* Three equal-weight source cards */}
      <div className={`grid gap-3 ${SOURCES.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {SOURCES.map(({ id, icon: Icon, label, desc }) => (
          <button key={id} type="button" onClick={() => patch({ mode: id })}
            className={`rounded-2xl border p-4 text-left transition-all ${
              value.mode === id ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
            }`}>
            <Icon className="h-4 w-4 text-fire-start" />
            <p className="mt-2 text-sm font-bold text-ink">{label}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{desc}</p>
          </button>
        ))}
      </div>

      {/* ── Generate: attribute chips (unchanged behavior) ── */}
      {value.mode === 'generated' && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Gender</p>
            <ChipRow options={GENDER_OPTIONS} value={attrs.gender} onChange={v => patch({ attributes: { ...attrs, gender: v } })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Age range</p>
            <ChipRow options={AGE_OPTIONS} value={attrs.ageRange} onChange={v => patch({ attributes: { ...attrs, ageRange: v } })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Ethnicity</p>
            <ChipRow options={ETHNICITY_OPTIONS} value={attrs.ethnicity} onChange={v => patch({ attributes: { ...attrs, ethnicity: v } })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Wardrobe vibe</p>
            <ChipRow options={WARDROBE_OPTIONS} value={attrs.wardrobe} onChange={v => patch({ attributes: { ...attrs, wardrobe: v } })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">On-camera energy</p>
            <div className="grid grid-cols-3 gap-3">
              {ENERGY_OPTIONS.map(opt => (
                <button key={opt.id} type="button" onClick={() => patch({ attributes: { ...attrs, energyLevel: opt.id } })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    attrs.energyLevel === opt.id ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                  }`}>
                  <p className="text-sm font-bold text-ink">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved: pick from library ── */}
      {value.mode === 'saved' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {savedCreators.map(c => {
            const cAttrs = (c.attributes ?? {}) as Record<string, string>
            const initials = c.name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?'
            const selected = value.savedCreatorId === c.id
            const hasPhoto = c.mode === 'uploaded_seed' && c.seed_images?.length > 0
            // Carry forward the consent captured when this creator was originally
            // saved — reusing a saved creator should never re-prompt. Only a
            // legacy creator saved before this feature existed (no stored
            // timestamp) falls through to needing the checkbox once more.
            const existingConsent = cAttrs.likenessConsentAt || undefined
            return (
              <button key={c.id} type="button" onClick={() => patch({
                savedCreatorId: c.id,
                seedImages: hasPhoto ? c.seed_images.map(s => s.url) : [],
                primarySeedImage: hasPhoto ? c.seed_images[0].url : '',
                resolvedImageUrl: hasPhoto ? c.seed_images[0].url : '',
                consentAcknowledged: hasPhoto ? !!existingConsent : false,
                consentAt: hasPhoto ? existingConsent : undefined,
                attributes: {
                  gender: cAttrs.gender ?? '', ageRange: cAttrs.ageRange ?? '', ethnicity: cAttrs.ethnicity ?? '',
                  bodyType: '', hair: cAttrs.hairStyle ?? '', wardrobe: cAttrs.wardrobe ?? '',
                  expression: cAttrs.personality ?? '', energyLevel: (cAttrs.energyLevel as CreatorAttributes['energyLevel']) ?? 'medium',
                  cameraConfidence: cAttrs.cameraConfidence ?? '',
                },
              })}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                  selected ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                }`}>
                {hasPhoto ? (
                  <img src={c.seed_images[0].url} alt={c.name} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-bold text-white" style={{ background: '#FF6B35' }}>{initials}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{hasPhoto ? 'Uploaded photo' : 'AI Creator'}</p>
                </div>
                {selected && <Check className="h-4 w-4 flex-shrink-0 text-fire-start" />}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Upload your own ── */}
      {value.mode === 'uploaded_seed' && (
        <div className="space-y-4">
          {value.seedImages.length === 0 ? (
            <>
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
                <p className="mt-2.5 text-sm font-semibold text-ink">Drag photos here or click to browse</p>
                <p className="mt-1 text-xs text-ink-faint">1–{MAX_IMAGES} clear photos of the same person</p>
              </div>
              <button onClick={() => setCameraOpen(true)} className="btn-ghost flex w-full items-center justify-center gap-2 py-3 text-sm">
                <Camera className="h-4 w-4" /> Or take a photo now
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {value.seedImages.map(src => {
                  const isPrimary = src === value.primarySeedImage
                  return (
                    <div key={src} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-void-900">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => patch({ primarySeedImage: src, resolvedImageUrl: value.usagePath === 'as_is' ? src : '', consentAcknowledged: false, consentAt: undefined })}
                        className={`absolute inset-0 transition-colors ${isPrimary ? 'ring-2 ring-inset ring-fire-start' : 'hover:bg-black/30'}`} aria-label="Set as identity photo" />
                      {isPrimary && <span className="absolute left-1 top-1 rounded bg-fire-start px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Main</span>}
                      <button onClick={() => removeImage(src)}
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600/80" aria-label="Remove photo">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
                {value.seedImages.length < MAX_IMAGES && (
                  <button onClick={() => fileRef.current?.click()}
                    className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/15 text-ink-faint transition-colors hover:border-fire-start/40 hover:text-fire-start" aria-label="Add another photo">
                    <Plus className="h-5 w-5" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onFiles(e.target.files)} />
              </div>

              {/* Path 1 / Path 2 — never assumed, always chosen */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => choosePath('as_is')}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    value.usagePath === 'as_is' ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                  }`}>
                  <p className="text-sm font-bold text-ink">Use this person exactly as they are</p>
                  <p className="mt-1 text-xs text-ink-muted">No changes to appearance — placed directly in the scene.</p>
                </button>
                <button type="button" onClick={() => choosePath('transform')}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    value.usagePath === 'transform' ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30' : 'border-white/[0.08] bg-void-800 hover:border-white/20'
                  }`}>
                  <p className="text-sm font-bold text-ink">Transform this person</p>
                  <p className="mt-1 text-xs text-ink-muted">Keep their identity, direct changes to look or setting.</p>
                </button>
              </div>

              {value.usagePath === 'transform' && (
                <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-void-800/50 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {TRANSFORM_CHIPS.map(c => (
                      <button key={c.label} type="button" onClick={() => patch({ transformInstruction: c.text, resolvedImageUrl: '' })}
                        className="rounded-lg bg-void-900 px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink">
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={value.transformInstruction}
                    onChange={e => patch({ transformInstruction: e.target.value, resolvedImageUrl: '' })}
                    rows={2} placeholder="Describe the change — e.g. change their shirt to red"
                    className="w-full resize-none rounded-xl border border-white/10 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none"
                  />
                  <button onClick={previewTransform} disabled={transformBusy || !value.transformInstruction.trim()}
                    className="btn-ghost flex w-full items-center justify-center gap-1.5 py-2.5 text-sm disabled:opacity-40">
                    {transformBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand className="h-4 w-4" />}
                    {transformBusy ? 'Generating preview…' : 'Preview transform'}
                  </button>

                  {value.resolvedImageUrl && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint">Original</p>
                        <img src={value.primarySeedImage} alt="Original" className="aspect-square w-full rounded-lg object-cover" />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-fire-start">Transformed</p>
                        <img src={value.resolvedImageUrl} alt="Transformed" className="aspect-square w-full rounded-lg object-cover ring-1 ring-fire-start/40" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Save this creator */}
              {value.resolvedImageUrl && value.consentAcknowledged && user?.id && (
                <div className="rounded-xl border border-white/[0.07] bg-void-800/40 p-3.5">
                  {saved ? (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Check className="h-3.5 w-3.5" /> Saved to your creators</p>
                  ) : saveOpen ? (
                    <div className="flex gap-2">
                      <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Name this creator"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none" />
                      <button onClick={doSaveCreator} disabled={saveBusy} className="btn-fire px-3 py-2 text-xs disabled:opacity-40">
                        {saveBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setSaveOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-fire-start hover:text-fire-end">
                      <Star className="h-3.5 w-3.5" /> Save this creator for next time
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Consent — required, single line, for ANY use of a real person's photo.
          Shown for a new upload always; for a reused saved creator only if it
          predates this feature and has no consent already on file. */}
      {(value.mode === 'uploaded_seed' || value.mode === 'saved') && value.resolvedImageUrl && (
        value.mode === 'saved' && value.consentAcknowledged ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <Check className="h-3.5 w-3.5 text-emerald-400" /> Likeness consent already on file for this creator.
          </p>
        ) : (
          <label className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-void-800/60 p-3.5">
            <input type="checkbox" checked={value.consentAcknowledged} onChange={e => toggleConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-orange-500" />
            <span className="text-xs leading-relaxed text-ink-muted">
              I have the right to use this person's likeness in this ad.
            </span>
          </label>
        )
      )}

      {error && <p className="text-xs text-amber-300">{error}</p>}
    </div>
  )
}

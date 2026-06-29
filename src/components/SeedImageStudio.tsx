/**
 * SeedImageStudio — the image workshop shared by the Creator and Product studios.
 *
 * Gives the user direct control over what their creator/product actually LOOKS
 * like before it ever reaches the video generator:
 *   • Upload a reference photo (working file picker + drag-drop), OR
 *   • Generate a seed image from a text description (no reference needed), OR
 *   • Edit a reference with a preset instruction (remove/replace background,
 *     recolor, restage, change wardrobe…), then preview and regenerate.
 * Approved images are uploaded to storage and returned as durable https URLs via
 * onChange, so they can be reused as the seed/reference image in any project.
 *
 * All generation goes through /api/modelsheet (Gemini "nano-banana"): mode
 * 'generate' for text-only, 'edit' for reference transforms, and the turnaround
 * toggle reuses mode 'sheet'.
 */
import { useRef, useState } from 'react'
import { generateImage, generateModelSheet, uploadAsset } from '../lib/api'
import { Upload, Wand, RefreshCw, Check, Trash, Spark, Grid, ImageIcon } from './icons'

export type SeedImage = { url: string; label?: string }

const PRESETS: Record<'character' | 'product', { label: string; instruction: string }[]> = {
  character: [
    { label: 'Remove background (clean studio)', instruction: 'Remove the background and place the person on a clean seamless light-grey studio backdrop' },
    { label: 'Cozy living room setting', instruction: 'Place the person in a warm, cozy modern living room with soft natural window light' },
    { label: 'Outdoor, golden hour', instruction: 'Place the person outdoors in a park at golden hour with warm natural light' },
    { label: 'Casual streetwear', instruction: 'Change the wardrobe to stylish casual streetwear' },
    { label: 'Professional headshot light', instruction: 'Relight as a professional studio headshot with soft key lighting' },
    { label: 'Full-body, neutral A-pose', instruction: 'Show the person full-body in a neutral relaxed A-pose, facing camera' },
  ],
  product: [
    { label: 'Remove background (pure white)', instruction: 'Remove the background and place the product on a pure white (#FFFFFF) studio background with a soft contact shadow' },
    { label: 'Marble kitchen counter', instruction: 'Place the product on a clean marble kitchen counter with soft daylight' },
    { label: 'Outdoor lifestyle setting', instruction: 'Place the product in a bright outdoor lifestyle setting' },
    { label: 'Studio lighting + reflections', instruction: 'Add soft studio lighting with subtle reflections on a glossy surface' },
    { label: 'Held in-hand', instruction: 'Show the product held in a person\'s hand, natural framing' },
    { label: 'Recolor (edit text below)', instruction: 'Change the color of the product to ' },
  ],
}

export default function SeedImageStudio({
  subjectType,
  subjectHint,
  images,
  onChange,
}: {
  subjectType: 'character' | 'product'
  subjectHint?: string
  images: SeedImage[]
  onChange: (next: SeedImage[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  // The working reference for edit mode: an https URL (existing seed) or a data URL (just uploaded).
  const [refUrl, setRefUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [makeTurnaround, setMakeTurnaround] = useState(true)

  const mode: 'generate' | 'edit' = refUrl ? 'edit' : 'generate'
  const presets = PRESETS[subjectType]

  function pickFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20 MB.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => { setRefUrl(String(reader.result)); setResult(null) }
    reader.readAsDataURL(file)
  }

  /** Build the imageUrl/imageBase64 field for the API from whatever refUrl holds. */
  function refImageArgs(): { imageUrl?: string; imageBase64?: string } {
    if (!refUrl) return {}
    return refUrl.startsWith('data:') ? { imageBase64: refUrl } : { imageUrl: refUrl }
  }

  async function handleGenerate() {
    if (!prompt.trim()) { setError(mode === 'edit' ? 'Pick or write an edit instruction.' : 'Describe the image to generate.'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const { imageDataUrl } = await generateImage({
        mode,
        subjectType,
        editPrompt: prompt.trim(),
        ...refImageArgs(),
      })
      setResult(imageDataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  /** Approve the previewed image: host it, add it (plus optional turnaround) to seeds. */
  async function useResult() {
    if (!result) return
    setSaving(true); setError('')
    try {
      const hosted = await uploadAsset(result)
      const additions: SeedImage[] = [{ url: hosted, label: prompt.trim().slice(0, 60) || 'Generated' }]

      if (makeTurnaround) {
        try {
          const { sheetDataUrl } = await generateModelSheet({ subjectType, imageBase64: result, subjectHint })
          const sheetHosted = await uploadAsset(sheetDataUrl)
          additions.push({ url: sheetHosted, label: 'Turnaround sheet' })
        } catch { /* turnaround is best-effort — don't block the main asset */ }
      }

      onChange([...images, ...additions])
      // Reset the workshop for the next asset.
      setResult(null); setPrompt(''); setRefUrl(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the image.')
    } finally {
      setSaving(false)
    }
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  function editExisting(url: string) {
    setRefUrl(url); setResult(null); setPrompt('')
  }

  return (
    <div className="space-y-4">
      {/* Existing seed images */}
      {images.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-faint">
            Seed images ({images.length}) — the first is the primary reference
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.url} className={`group relative overflow-hidden rounded-xl border ${i === 0 ? 'border-fire-start/50 ring-1 ring-fire-start/30' : 'border-white/[0.08]'} bg-void-900`}>
                <img src={img.url} alt={img.label || 'Seed'} className="aspect-square w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-fire-start px-1.5 py-0.5 text-[9px] font-bold text-white">PRIMARY</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => editExisting(img.url)} title="Edit this image"
                    className="rounded-md bg-white/15 p-1 text-white hover:bg-white/25"><Wand className="h-3 w-3" /></button>
                  <button type="button" onClick={() => removeImage(i)} title="Remove"
                    className="rounded-md bg-white/15 p-1 text-white hover:bg-fire-start/60"><Trash className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workshop */}
      <div className="rounded-2xl border border-white/[0.08] bg-void-800/50 p-4">
        {/* Reference row */}
        <div className="flex items-center gap-3">
          {refUrl ? (
            <div className="relative">
              <img src={refUrl} alt="Reference" className="h-16 w-16 rounded-xl object-cover ring-1 ring-fire-start/40" />
              <button type="button" onClick={() => { setRefUrl(null); setResult(null) }}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-void-700 text-ink-faint ring-1 ring-white/10 hover:text-ink">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl border-2 border-dashed border-void-500 text-ink-faint hover:border-fire-start/50 hover:text-fire-start transition-colors">
              <Upload className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {refUrl ? 'Editing a reference image' : 'Generate from a description'}
            </p>
            <p className="text-xs text-ink-faint">
              {refUrl
                ? 'Pick a preset or describe the change, then generate.'
                : 'Upload a reference photo to edit it, or just describe the image to create one.'}
            </p>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />

        {/* Preset dropdown (edit mode) */}
        {refUrl && (
          <select
            value=""
            onChange={e => { if (e.target.value) setPrompt(e.target.value) }}
            className="mt-3 w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2.5 text-sm text-ink focus:border-fire-start/50 focus:outline-none"
          >
            <option value="">Choose a quick edit…</option>
            {presets.map(p => <option key={p.label} value={p.instruction}>{p.label}</option>)}
          </select>
        )}

        {/* Prompt */}
        <textarea
          rows={2}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={refUrl
            ? 'e.g. place on a marble counter with soft daylight'
            : subjectType === 'character'
              ? 'e.g. a friendly 30-something woman with warm energy, casual sweater'
              : 'e.g. a matte black insulated water bottle with a bamboo lid'}
          className="mt-3 w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20"
        />

        <button type="button" onClick={handleGenerate} disabled={busy || !prompt.trim()}
          className="btn-fire mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
          {busy
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
            : <><Wand className="h-4 w-4" /> {mode === 'edit' ? 'Apply edit' : 'Generate image'}</>}
        </button>

        {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

        {/* Result preview */}
        {result && (
          <div className="mt-4 space-y-3 rounded-xl border border-fire-start/30 bg-void-900 p-3">
            <img src={result} alt="Generated" className="w-full rounded-lg object-contain" />
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input type="checkbox" checked={makeTurnaround} onChange={e => setMakeTurnaround(e.target.checked)}
                className="h-4 w-4 accent-fire-start" />
              <Grid className="h-3.5 w-3.5 text-ink-faint" />
              Also save a 2×3 turnaround reference sheet (recommended)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleGenerate} disabled={busy}
                className="btn-ghost flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
              <button type="button" onClick={useResult} disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-fire py-2.5 text-sm font-bold text-white shadow-fire-soft disabled:opacity-50">
                {saving
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
                  : <><Check className="h-4 w-4" /> Use as seed</>}
              </button>
            </div>
          </div>
        )}

        {!result && images.length === 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
            <ImageIcon className="h-3.5 w-3.5" /> <Spark className="h-3 w-3" /> Saved seed images become the reference for this {subjectType === 'character' ? 'creator' : 'product'} in every video.
          </p>
        )}
      </div>
    </div>
  )
}

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
 * 'generate' for text-only, 'edit' for reference transforms, and turnaround
 * uses mode 'sheet'.
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

  // Turnaround-specific state (separate flow from generate/edit)
  const [turnaroundBusy, setTurnaroundBusy] = useState(false)
  const [turnaroundResult, setTurnaroundResult] = useState<string | null>(null)
  const [turnaroundError, setTurnaroundError] = useState('')
  const [turnaroundSaving, setTurnaroundSaving] = useState(false)

  const mode: 'generate' | 'edit' = refUrl ? 'edit' : 'generate'
  const presets = PRESETS[subjectType]

  function pickFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20 MB.'); return }
    setError('')
    // Resize to ≤1280px on the long edge and re-encode as JPEG before storing.
    // This keeps the base64 payload sent to /api/modelsheet well under Vercel's
    // 4.5 MB body limit (a 1280×960 JPEG at 0.85 quality is ~200–400 KB).
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX = 1280
      const scale = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setRefUrl(dataUrl)
      setResult(null)
      setTurnaroundResult(null)
      setTurnaroundError('')
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setError('Could not load this image file.')
    }
    img.src = objectUrl
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

  /** Generate a turnaround sheet from a given image (uploaded ref or existing seed). */
  async function handleTurnaround(args: { imageBase64?: string; imageUrl?: string }) {
    setTurnaroundBusy(true); setTurnaroundError(''); setTurnaroundResult(null)
    try {
      const { sheetDataUrl } = await generateModelSheet({ subjectType, subjectHint, ...args })
      setTurnaroundResult(sheetDataUrl)
    } catch (e) {
      setTurnaroundError(e instanceof Error ? e.message : 'Turnaround generation failed. Try a clearer reference photo.')
    } finally {
      setTurnaroundBusy(false)
    }
  }

  async function saveTurnaround() {
    if (!turnaroundResult) return
    setTurnaroundSaving(true); setTurnaroundError('')
    try {
      const hosted = await uploadAsset(turnaroundResult)
      onChange([...images, { url: hosted, label: 'Turnaround sheet' }])
      setTurnaroundResult(null)
    } catch (e) {
      setTurnaroundError(e instanceof Error ? e.message : 'Could not save the turnaround.')
    } finally {
      setTurnaroundSaving(false)
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
        } catch (e) {
          // Show the turnaround error but still save the main image.
          setError(`Image saved, but turnaround failed: ${e instanceof Error ? e.message : 'unknown error'}`)
        }
      }

      onChange([...images, ...additions])
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
    setRefUrl(url); setResult(null); setPrompt(''); setTurnaroundResult(null); setTurnaroundError('')
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
                  <button
                    type="button"
                    onClick={() => handleTurnaround({ imageUrl: img.url })}
                    title="Generate turnaround sheet"
                    disabled={turnaroundBusy}
                    className="rounded-md bg-white/15 p-1 text-white hover:bg-white/25 disabled:opacity-40"
                  >
                    {turnaroundBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Grid className="h-3 w-3" />}
                  </button>
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
        <div className="flex items-start gap-3">
          {refUrl ? (
            <div className="relative flex-shrink-0">
              <img src={refUrl} alt="Reference" className="h-16 w-16 rounded-xl object-cover ring-1 ring-fire-start/40" />
              <button type="button" onClick={() => { setRefUrl(null); setResult(null); setTurnaroundResult(null); setTurnaroundError('') }}
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
              {refUrl ? 'Reference image loaded' : 'Generate from a description'}
            </p>
            <p className="text-xs text-ink-faint">
              {refUrl
                ? 'Edit it below, or generate a turnaround sheet directly from this photo.'
                : 'Upload a reference photo to edit it, or just describe the image to create one.'}
            </p>

            {/* Turnaround button — visible as soon as a reference is loaded */}
            {refUrl && (
              <button
                type="button"
                onClick={() => handleTurnaround(refImageArgs())}
                disabled={turnaroundBusy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-void-700/60 px-3 py-1.5 text-xs font-semibold text-ink hover:border-fire-start/40 hover:text-fire-start disabled:opacity-50 transition-colors"
              >
                {turnaroundBusy
                  ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating turnaround…</>
                  : <><Grid className="h-3 w-3" /> Generate turnaround sheet</>}
              </button>
            )}
          </div>
        </div>

        {/* Turnaround result preview */}
        {(turnaroundResult || turnaroundError) && (
          <div className="mt-3 rounded-xl border border-white/10 bg-void-900 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Turnaround sheet</p>
            {turnaroundResult && (
              <>
                <img src={turnaroundResult} alt="Turnaround" className="w-full rounded-lg object-contain" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleTurnaround(refImageArgs())} disabled={turnaroundBusy}
                    className="btn-ghost flex items-center justify-center gap-2 py-2 text-xs disabled:opacity-50">
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                  <button type="button" onClick={saveTurnaround} disabled={turnaroundSaving}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-fire py-2 text-xs font-bold text-white shadow-fire-soft disabled:opacity-50">
                    {turnaroundSaving
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                      : <><Check className="h-3.5 w-3.5" /> Save to seeds</>}
                  </button>
                </div>
              </>
            )}
            {turnaroundError && <p className="text-xs text-amber-300">{turnaroundError}</p>}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />

        {/* Divider between turnaround and edit flows */}
        {refUrl && (
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">or edit</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
        )}

        {/* Preset dropdown (edit mode) */}
        {refUrl && (
          <select
            value=""
            onChange={e => { if (e.target.value) setPrompt(e.target.value) }}
            className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2.5 text-sm text-ink focus:border-fire-start/50 focus:outline-none"
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
          className={`w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 ${refUrl ? 'mt-3' : 'mt-3'}`}
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

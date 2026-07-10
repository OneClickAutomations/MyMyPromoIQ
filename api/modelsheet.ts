/**
 * POST /api/modelsheet
 * Body: { mode?, imageUrl? | imageBase64?, mimeType?, subjectType, subjectHint?, editPrompt? }
 *
 * One Gemini image endpoint ("nano-banana"), five modes — kept in a single
 * serverless function to stay under Vercel's 12-function Hobby limit:
 *
 *   mode 'sheet'    (default) — turn ONE reference photo into a 2x3 multi-angle
 *                               turnaround model sheet (six consistent views).
 *                               Returns { sheetDataUrl, imageDataUrl, ... }.
 *   mode 'edit'               — apply an edit instruction to a reference image
 *                               (remove/replace background, recolor, restage,
 *                               etc.). Requires editPrompt + an image.
 *                               Returns { imageDataUrl, prompt }.
 *   mode 'generate'           — generate a fresh image from a text description
 *                               only (no reference). Requires editPrompt.
 *                               Returns { imageDataUrl, prompt }.
 *   mode 'soul-styles'        — list Higgsfield Soul's preset style catalog.
 *                               Requires Higgsfield credentials (no Gemini
 *                               fallback — Soul is Higgsfield-only).
 *                               Returns { styles: SoulStyle[] }.
 *   mode 'soul'               — generate a stylized image via Higgsfield Soul
 *                               (a style_id from 'soul-styles' + a prompt,
 *                               optionally conditioned on a reference image).
 *                               Requires Higgsfield credentials. Returns
 *                               { imageDataUrl, prompt }.
 *
 * Powers the Creator and Product studios (seed-image generation/editing) and the
 * turnaround reference. Requires GEMINI_API_KEY (for sheet/edit/generate) or
 * Higgsfield credentials. ANTHROPIC_API_KEY enhances the sheet prompt but isn't
 * required. Self-contained (no src/ imports, except the Higgsfield client).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  submitJob, pollJob, firstImageUrl, MODELS, HiggsfieldError, type NanoBananaArgs,
  getSoulStyles, submitSoulImage, type SoulImageArgs,
} from '../src/lib/higgsfield'

// ── Higgsfield image path (rebuild Stage 3) ──────────────────────────────────
// When Higgsfield credentials are present, image generation routes to Nano
// Banana Pro; otherwise it falls back to the existing Gemini path so the branch
// works either way until the Gemini cleanup stage. Higgsfield's `image` field
// wants a URL/media id (not a data URL) and it returns a hosted URL, so this
// path hosts data-URL references to Supabase first and downloads the result
// back to a data URL to preserve the existing { imageDataUrl, sheetDataUrl }
// contract the frontend already consumes.

function higgsfieldEnabled(): boolean {
  return !!((process.env.HIGGSFIELD_API_KEY && (process.env.HIGGSFIELD_SECRET || process.env.HIGGSFIELD_API_SECRET))
    || (process.env.HIGGSFIELD_API_TOKEN || '').includes(':'))
}

/** Upload raw image bytes to the public product-images bucket, return public URL.
 *  Returns null when Supabase Storage isn't configured (caller decides fallback). */
async function uploadToBucket(buf: Buffer, mime: string, prefix: string): Promise<string | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return null
  const supabase = createClient(supabaseUrl, serviceKey)
  const bucket = 'product-images'
  await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 20_971_520 }).catch(() => {})
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: mime, upsert: true })
  if (error) throw new Error(`Could not host image: ${error.message}`)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Host a base64/data-URL image on Supabase Storage and return its public URL —
 *  Higgsfield references images by URL, not by inline data. An https URL passes
 *  through untouched. */
async function hostRefUrl(imageUrl?: string, imageBase64?: string, mimeType?: string): Promise<string | undefined> {
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) return imageUrl
  const raw = imageBase64 || (imageUrl?.startsWith('data:') ? imageUrl : undefined)
  if (!raw) return undefined
  const b64 = raw.includes(',') ? raw.split(',')[1] : raw
  const mime = mimeType || raw.match(/^data:(.*?);base64/)?.[1] || 'image/jpeg'
  const url = await uploadToBucket(Buffer.from(b64, 'base64'), mime, 'hf-refs')
  if (!url) throw new Error('Image hosting not configured (SUPABASE_SERVICE_KEY) — needed to send an uploaded image to Higgsfield.')
  return url
}

/** Re-host a generated image (a hosted https URL) onto Supabase and return the
 *  durable public URL. Returning a URL — not an inlined base64 data URL — keeps
 *  the JSON response tiny: a 2k image as base64 would blow Vercel's 4.5 MB
 *  response-body cap and crash the function (FUNCTION_INVOCATION_FAILED). Also
 *  insulates callers from Higgsfield's 7-day URL TTL. Falls back to the source
 *  URL if Supabase Storage isn't configured. */
async function rehostToSupabase(sourceUrl: string): Promise<string> {
  const resp = await fetch(sourceUrl)
  if (!resp.ok) throw new Error(`Could not fetch generated image (${resp.status}).`)
  const mime = resp.headers.get('content-type') || 'image/png'
  const buf = Buffer.from(await resp.arrayBuffer())
  const hosted = await uploadToBucket(buf, mime, 'hf-out').catch(() => null)
  return hosted || sourceUrl
}

/** Generate an image via Higgsfield Nano Banana Pro and return it as a data URL. */
async function generateImageHiggsfield(
  prompt: string,
  refUrl: string | undefined,
  opts: { aspectRatio?: NanoBananaArgs['aspect_ratio']; resolution?: NanoBananaArgs['resolution'] } = {},
): Promise<string> {
  const args: NanoBananaArgs = { prompt, resolution: opts.resolution ?? '2k' }
  if (refUrl) args.image = refUrl
  if (opts.aspectRatio) args.aspect_ratio = opts.aspectRatio
  const { request_id } = await submitJob(MODELS.nanoBananaPro, args as unknown as Record<string, unknown>)
  // Kept well under Vercel's 60s hard ceiling: this poll runs inside a request
  // that also uploads the reference image beforehand (hostRefUrl) and downloads
  // + re-hosts the result afterward (rehostToSupabase). A 50s poll left too
  // little headroom for those — the whole function got SIGKILLed mid-flight
  // (FUNCTION_INVOCATION_FAILED) instead of hitting our own handled timeout path.
  const result = await pollJob(request_id, { intervalMs: 3_000, timeoutMs: 35_000 })
  if (result.status === 'nsfw') throw new Error('The image was flagged by content moderation. Try a different photo or prompt.')
  if (result.status !== 'completed') throw new Error(result.error || `Image generation did not finish (status: ${result.status}).`)
  const outUrl = firstImageUrl(result)
  if (!outUrl) throw new Error('Higgsfield returned no image.')
  return rehostToSupabase(outUrl)
}

// Model candidates for native image output via generateContent, best-first.
// gemini-2.0-flash-preview-image-generation (the previous default here) was a
// 2.0-preview model and has since been retired by Google — that retirement is
// exactly what produced the 404 this fixes. Rather than hardcode a single name
// again (the same mistake), try the current models in order and only fall
// through to the next on a 404 (model not found/retired for this key/tier).
// Set GEMINI_IMAGE_MODEL to pin one and skip the list.
const GEMINI_MODEL_CANDIDATES = process.env.GEMINI_IMAGE_MODEL
  ? [process.env.GEMINI_IMAGE_MODEL]
  : ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview']

/**
 * Scope an edit instruction to the SUPPLIED reference image, never a
 * from-scratch regeneration. This is the enforcement point for identity
 * preservation — critical for "Transform this person" (Task A): the person's
 * face/identity must survive the edit, only the directed attribute changes.
 */
function buildIdentityLockedEditPrompt(subjectType: 'product' | 'character', instruction: string): string {
  const lock = subjectType === 'character'
    ? 'Keep the SAME person — identical face, identity, skin tone, and features — change only what the instruction asks.'
    : 'Keep the SAME product — identical shape, materials, label, and proportions — change only what the instruction asks.'
  return `${instruction.trim()}. ${lock} Photorealistic, high detail, sharp focus, no added text or watermark.`
}

function buildPrompt(subjectType: 'product' | 'character', subject: string): string {
  if (subjectType === 'character') {
    return `A professional character turnaround model sheet of ${subject}. Strict 2x3 grid layout (2 rows, 3 columns) showing the SAME person as a multi-angle reference turnaround. The six cells, in order, are distinct views: (1) front view, (2) three-quarter front view, (3) left profile side view, (4) three-quarter back view, (5) full back view, (6) front close-up of the face. The identity must stay PERFECTLY consistent across all six cells — identical face, skin tone, facial features, hairstyle, body type, age, and wardrobe, lit identically in every cell. Neutral relaxed A-pose, full body where shown, neutral calm expression. Clean seamless light-grey studio background, soft even key lighting, photorealistic natural skin texture with visible pores (never plastic, waxy, or airbrushed). High-definition photography, sharp focus, accurate color, orthographic projection with minimal perspective distortion, each cell evenly spaced and centered. No text, no labels, no callouts, no measurement lines, no watermark, no logos. Consistent, production-ready character model sheet.`
  }
  return `A professional studio asset model sheet of ${subject}. Strict 2x3 grid layout (2 rows, 3 columns) showing the SAME identical object as a multi-angle view turnaround. The six cells, in order, are distinct camera angles: (1) front view, (2) left profile side view, (3) three-quarter front view, (4) top-down view, (5) bottom view, (6) rear/back view. The object must stay PERFECTLY consistent across all six cells — identical color, materials, proportions, label text, and surface details, at the same scale and lit identically. Clean seamless pure-white background (#FFFFFF), soft even studio softbox lighting, no harsh shadows, only a subtle contact shadow. High-definition product photography, sharp focus, color-accurate, isometric orthographic projection with minimal perspective distortion. Each cell evenly spaced and centered. No text, no labels, no callouts, no measurement lines, no watermark, no logos, no people, no hands. Photorealistic, production-ready asset sheet.`
}

async function resolveImage(imageUrl?: string, imageBase64?: string, mimeType?: string): Promise<{ data: string; mime: string }> {
  if (imageBase64) {
    const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    const mime = mimeType || (imageBase64.match(/^data:(.*?);base64/)?.[1]) || 'image/png'
    return { data, mime }
  }
  if (imageUrl) {
    // Meta CDN (fbcdn.net, cdninstagram.com) blocks bare server fetches with 403.
    const META_CDN = /(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com)/i
    const fetchHeaders: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
    }
    if (META_CDN.test(imageUrl)) fetchHeaders['referer'] = 'https://www.facebook.com/'
    const r = await fetch(imageUrl, { headers: fetchHeaders })
    if (!r.ok) throw new Error(`Could not fetch reference image (${r.status}). If this is a Meta/Facebook URL it may have expired — upload the image directly instead.`)
    const mime = r.headers.get('content-type') || 'image/jpeg'
    const data = Buffer.from(await r.arrayBuffer()).toString('base64')
    return { data, mime }
  }
  throw new Error('Provide an image URL or upload.')
}

async function describeSubject(img: { data: string; mime: string }, subjectType: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  try {
    const anthropic = new Anthropic()
    const noun = subjectType === 'character' ? 'person/character' : 'product/object'
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.mime as any, data: img.data } },
          { type: 'text', text: `Describe the single main ${noun} in this image as ONE concise phrase with the key visual details (color, material, form, distinctive features) for an image-generation prompt. Output only the phrase, no preamble.` },
        ],
      }],
    })
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
  } catch {
    return ''
  }
}

/**
 * Call Gemini image generation with an optional inline reference image. Tries
 * each candidate model in order — a 404 means that model is retired/unavailable
 * for this key and we move to the next; any other failure (auth, quota, safety
 * block) is real and surfaces immediately with the actual upstream detail, never
 * a bare status code. Returns the first image part as a data URL.
 */
async function generateImage(
  apiKey: string,
  prompt: string,
  ref?: { data: string; mime: string },
  temperature = 0.4,
): Promise<string> {
  const parts: any[] = []
  if (ref) parts.push({ inline_data: { mime_type: ref.mime, data: ref.data } })
  parts.push({ text: prompt })

  let lastNotFound = ''
  for (const model of GEMINI_MODEL_CANDIDATES) {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature, responseModalities: ['IMAGE', 'TEXT'] },
        }),
      },
    )

    if (geminiResp.status === 404) {
      lastNotFound = model
      console.warn(`[modelsheet] ${model} → 404 (retired or unavailable for this key), trying next`)
      continue
    }
    if (!geminiResp.ok) {
      const detail = await geminiResp.text().catch(() => '')
      console.error(`[modelsheet] ${model} failed (${geminiResp.status}):`, detail.slice(0, 500))
      throw new Error(`Couldn't generate the image (${model} returned ${geminiResp.status}). ${summarizeUpstreamError(detail)}`)
    }

    const data = (await geminiResp.json()) as any
    const candidate = data?.candidates?.[0]
    const outParts = candidate?.content?.parts ?? []
    const imagePart = outParts.find((p: any) => p.inline_data?.data || p.inlineData?.data)
    const out = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data

    if (!out) {
      // Model responded 200 but produced no image — usually a safety/content
      // block. Surface the REAL reason instead of a generic "no image" message.
      const blockReason = data?.promptFeedback?.blockReason || candidate?.finishReason
      console.error(`[modelsheet] ${model} returned no image. blockReason/finishReason: ${blockReason ?? 'none'}. Raw:`, JSON.stringify(data).slice(0, 500))
      if (blockReason && blockReason !== 'STOP') {
        throw new Error(`Couldn't generate the image — the reference photo or prompt was flagged (${blockReason}). Try a different photo.`)
      }
      throw new Error('Couldn\'t generate the image. Try a clearer reference photo or a more specific description.')
    }

    const outMime = imagePart?.inline_data?.mime_type ?? imagePart?.inlineData?.mimeType ?? 'image/png'
    return `data:${outMime};base64,${out}`
  }

  throw new Error(`No image model is available for this API key (tried: ${GEMINI_MODEL_CANDIDATES.join(', ')}; last: ${lastNotFound} 404). Verify GEMINI_API_KEY has image generation access at aistudio.google.com.`)
}

/** Turn a raw Gemini error body into one honest, actionable sentence. */
function summarizeUpstreamError(detail: string): string {
  try {
    const parsed = JSON.parse(detail)
    const msg = parsed?.error?.message
    if (msg) return String(msg).slice(0, 200)
  } catch { /* not JSON */ }
  return 'Try again in a moment.'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const useHiggsfield = higgsfieldEnabled()
  const geminiKey = process.env.GEMINI_API_KEY
  if (!useHiggsfield && !geminiKey) {
    return res.status(503).json({ error: 'No image provider configured. Add HIGGSFIELD_API_KEY + HIGGSFIELD_SECRET (or GEMINI_API_KEY) in Vercel → Environment Variables.' })
  }

  const { mode = 'sheet', imageUrl, imageBase64, mimeType, subjectType = 'product', subjectHint, editPrompt, styleId } =
    (req.body ?? {}) as Record<string, string>
  const type = subjectType === 'character' ? 'character' : 'product'
  // Turnarounds/products read best square; character stills default to vertical.
  const aspect = mode === 'sheet' ? '1:1' : type === 'character' ? '9:16' : '1:1'

  try {
    // ── soul-styles: list the preset style catalog (Higgsfield-only) ─────────
    if (mode === 'soul-styles') {
      if (!useHiggsfield) return res.status(503).json({ error: 'Soul styles require Higgsfield credentials (HIGGSFIELD_API_KEY + HIGGSFIELD_SECRET).' })
      const styles = await getSoulStyles()
      return res.status(200).json({ styles })
    }

    // ── soul: generate a stylized image via Higgsfield Soul (Higgsfield-only) ─
    if (mode === 'soul') {
      if (!useHiggsfield) return res.status(503).json({ error: 'Soul generation requires Higgsfield credentials (HIGGSFIELD_API_KEY + HIGGSFIELD_SECRET).' })
      if (!editPrompt?.trim()) return res.status(400).json({ error: 'Describe the image you want to generate.' })
      const args: SoulImageArgs = { prompt: editPrompt.trim(), width_and_height: type === 'character' ? '1152x2048' : '1536x1536' }
      if (styleId) args.style_id = styleId
      const refUrl = await hostRefUrl(imageUrl, imageBase64, mimeType).catch(() => undefined)
      if (refUrl) args.image_reference = { type: 'image_url', image_url: refUrl }
      const { request_id } = await submitSoulImage(args)
      const result = await pollJob(request_id, { intervalMs: 3_000, timeoutMs: 35_000 })
      if (result.status === 'nsfw') return res.status(502).json({ error: 'The image was flagged by content moderation. Try a different photo or prompt.' })
      if (result.status !== 'completed') return res.status(502).json({ error: result.error || `Image generation did not finish (status: ${result.status}).` })
      const outUrl = firstImageUrl(result)
      if (!outUrl) return res.status(502).json({ error: 'Higgsfield returned no image.' })
      const imageDataUrl = await rehostToSupabase(outUrl)
      return res.status(200).json({ imageDataUrl, prompt: args.prompt })
    }

    // ── generate: text-only, no reference image ──────────────────────────────
    if (mode === 'generate') {
      if (!editPrompt?.trim()) return res.status(400).json({ error: 'Describe the image you want to generate.' })
      const guidance = type === 'character'
        ? 'Photorealistic portrait of a person for a UGC ad, natural skin texture with visible pores (never plastic or airbrushed), authentic lighting, vertical 9:16 framing, single subject, no text or watermark.'
        : 'Photorealistic product photo for an ad, clean composition, accurate materials and color, soft studio lighting, sharp focus, no text or watermark.'
      const prompt = `${editPrompt.trim()}. ${guidance}`
      const imageDataUrl = useHiggsfield
        ? await generateImageHiggsfield(prompt, undefined, { aspectRatio: aspect })
        : await generateImage(geminiKey!, prompt, undefined, 0.7)
      return res.status(200).json({ imageDataUrl, prompt })
    }

    if (mode === 'edit') {
      if (!editPrompt?.trim()) return res.status(400).json({ error: 'Pick or write an edit instruction.' })
      const prompt = buildIdentityLockedEditPrompt(type, editPrompt)
      const imageDataUrl = useHiggsfield
        ? await generateImageHiggsfield(prompt, await hostRefUrl(imageUrl, imageBase64, mimeType), { aspectRatio: aspect })
        : await generateImage(geminiKey!, prompt, await resolveImage(imageUrl, imageBase64, mimeType), 0.5)
      return res.status(200).json({ imageDataUrl, prompt })
    }

    // mode 'sheet' (default) — turnaround model sheet.
    let subject = subjectHint?.trim() || ''
    if (!subject && !useHiggsfield) {
      // Gemini path already has the reference in base64 for the vision describe.
      subject = (await describeSubject(await resolveImage(imageUrl, imageBase64, mimeType), type))
    }
    subject = subject || (type === 'character' ? 'the person shown in the reference image' : 'the product shown in the reference image')
    const prompt = buildPrompt(type, subject)
    const imageDataUrl = useHiggsfield
      ? await generateImageHiggsfield(prompt, await hostRefUrl(imageUrl, imageBase64, mimeType), { aspectRatio: aspect })
      : await generateImage(geminiKey!, prompt, await resolveImage(imageUrl, imageBase64, mimeType), 0.4)
    // Keep sheetDataUrl for backward compatibility; imageDataUrl is the new name.
    return res.status(200).json({ sheetDataUrl: imageDataUrl, imageDataUrl, subject, prompt })
  } catch (err) {
    console.error('[/api/modelsheet]', err)
    const message = err instanceof HiggsfieldError || err instanceof Error ? err.message : 'Image generation failed.'
    return res.status(502).json({ error: message })
  }
}

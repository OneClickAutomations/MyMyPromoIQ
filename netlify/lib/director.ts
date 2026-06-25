/**
 * Shared backend logic for the generation pipeline.
 *
 * Two providers, both server-side only (keys never reach the browser):
 *   1. Anthropic (Claude "director")  — writes the cinematic motion prompt
 *   2. Higgsfield (image-to-video)    — renders the finished UGC video
 *
 * Grounded against the @higgsfield/client SDK source:
 *   base URL  https://platform.higgsfield.ai
 *   auth      Authorization: Key <KEY_ID>:<KEY_SECRET>
 *   submit    POST /v1/image2video/dop      -> { request_id, status, ... }
 *   status    GET  /requests/{id}/status    -> { status, video?: { url } }
 */
import Anthropic from '@anthropic-ai/sdk'

export const HF_BASE = 'https://platform.higgsfield.ai'

export type StyleId = 'testimonial' | 'unboxing' | 'day-in-life' | 'fast-cut'
export type Quality = 'lite' | 'turbo' | 'standard'

type StyleDef = {
  label: string
  /** Direction handed to the Claude director for this UGC format. */
  brief: string
}

export const STYLES: Record<StyleId, StyleDef> = {
  testimonial: {
    label: 'Testimonial',
    brief:
      'A real person speaking to camera about the product. Warm handheld feel, soft natural window light, subtle push-in. Authentic, trustworthy, like a creator filmed it on their phone.',
  },
  unboxing: {
    label: 'Unboxing',
    brief:
      'Close, tactile product reveal. Hands entering frame, packaging opening, satisfying detail shots. Crisp focus pulls, clean tabletop surface, bright even light.',
  },
  'day-in-life': {
    label: 'Day-in-the-life',
    brief:
      'The product woven into a real moment of someone’s day. Lifestyle b-roll energy, gentle motion, lived-in environment, golden ambient light. Aspirational but believable.',
  },
  'fast-cut': {
    label: 'Fast-cut hook',
    brief:
      'High-energy scroll-stopping opener. Punchy camera moves, quick dynamic motion, bold framing engineered to kill the thumb-scroll in the first second. Vertical, kinetic.',
  },
}

/** Quality tier → Higgsfield DoP model. */
const QUALITY_MODEL: Record<Quality, 'dop-lite' | 'dop-turbo' | 'dop-standard'> = {
  lite: 'dop-lite',
  turbo: 'dop-turbo',
  standard: 'dop-standard',
}

/** Resolve Higgsfield credentials from either env layout. */
function higgsfieldAuth(): string {
  const combined = process.env.HF_CREDENTIALS || process.env.HF_KEY
  let key = process.env.HF_API_KEY
  let secret = process.env.HF_API_SECRET
  if (combined && combined.includes(':')) {
    ;[key, secret] = combined.split(':')
  }
  if (!key || !secret) {
    throw new Error(
      'Missing Higgsfield credentials. Set HF_API_KEY + HF_API_SECRET (or HF_CREDENTIALS="id:secret").',
    )
  }
  return `Key ${key}:${secret}`
}

/**
 * Claude is the director: given the product and the chosen UGC style, it writes
 * a single tight image-to-video motion prompt for the video model.
 */
export async function writeDirectorPrompt(opts: {
  productDescription: string
  style: StyleId
}): Promise<string> {
  const style = STYLES[opts.style]
  const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env

  const system = `You are an expert UGC ad director writing prompts for an image-to-video model. You are given a product and a creative style. Write ONE vivid image-to-video motion prompt that turns a still product photo into a scroll-stopping ${style.label} ad clip.

Style direction: ${style.brief}

Rules:
- Output ONLY the prompt text. No preamble, no quotes, no markdown, no explanation.
- 2-4 sentences. Describe camera movement, subject action, lighting, and mood.
- Keep it concrete and physical (what moves, how the camera moves). Avoid brand claims and text overlays.
- Vertical 9:16, social-native, authentic — not a glossy TV commercial.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system,
    messages: [
      {
        role: 'user',
        content: `Product: ${opts.productDescription}\n\nWrite the ${style.label} motion prompt.`,
      },
    ],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  if (!text) throw new Error('Director returned an empty prompt.')
  return text
}

/** Submit an image-to-video job. Does NOT block on the render. */
export async function submitVideoJob(opts: {
  prompt: string
  imageUrl: string
  quality: Quality
}): Promise<{ requestId: string; status: string }> {
  const res = await fetch(`${HF_BASE}/v1/image2video/dop`, {
    method: 'POST',
    headers: { Authorization: higgsfieldAuth(), 'content-type': 'application/json' },
    body: JSON.stringify({
      model: QUALITY_MODEL[opts.quality],
      prompt: opts.prompt,
      input_images: [{ type: 'image_url', image_url: opts.imageUrl }],
      enhance_prompt: true,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Higgsfield submit failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as { request_id: string; status: string }
  return { requestId: data.request_id, status: data.status }
}

/** Poll a job by id. Returns a normalized status + the video URL when ready. */
export async function getVideoStatus(
  requestId: string,
): Promise<{ status: 'pending' | 'completed' | 'failed'; videoUrl: string | null; raw: string }> {
  const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(requestId)}/status`, {
    headers: { Authorization: higgsfieldAuth() },
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Higgsfield status failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as { status: string; video?: { url: string } }
  const raw = data.status
  if (raw === 'completed') return { status: 'completed', videoUrl: data.video?.url ?? null, raw }
  if (raw === 'failed' || raw === 'nsfw') return { status: 'failed', videoUrl: null, raw }
  return { status: 'pending', videoUrl: null, raw } // queued | in_progress
}

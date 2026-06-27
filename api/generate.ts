/**
 * POST /api/generate
 * Body: { productImageUrl, productDescription, style, quality }
 *
 * 1. Claude writes the cinematic motion prompt.
 * 2. Submits the image-to-video job to Higgsfield (non-blocking).
 * 3. Returns { requestId, status, directorPrompt } for the client to poll.
 *
 * Self-contained on purpose: Vercel only reliably bundles files inside the
 * api/ directory, so this function imports node_modules packages only — no
 * cross-directory relative imports (that caused FUNCTION_INVOCATION_FAILED).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

type Quality = 'lite' | 'turbo' | 'standard'
type StyleId = 'testimonial' | 'unboxing' | 'day-in-life' | 'fast-cut'

const QUALITIES: Quality[] = ['lite', 'turbo', 'standard']

const STYLES: Record<StyleId, { label: string; brief: string }> = {
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
      `The product woven into a real moment of someone's day. Lifestyle b-roll energy, gentle motion, lived-in environment, golden ambient light. Aspirational but believable.`,
  },
  'fast-cut': {
    label: 'Fast-cut hook',
    brief:
      'High-energy scroll-stopping opener. Punchy camera moves, quick dynamic motion, bold framing engineered to kill the thumb-scroll in the first second. Vertical, kinetic.',
  },
}

const HF_BASE = 'https://platform.higgsfield.ai'
const QUALITY_MODEL: Record<Quality, string> = {
  lite: 'dop-lite',
  turbo: 'dop-turbo',
  standard: 'dop-standard',
}

function higgsfieldAuth(): string {
  const combined = process.env.HF_CREDENTIALS || process.env.HF_KEY
  let key = process.env.HF_API_KEY
  let secret = process.env.HF_API_SECRET
  if (combined?.includes(':')) {
    ;[key, secret] = combined.split(':')
  }
  if (!key || !secret) {
    throw new Error('Missing Higgsfield credentials. Set HF_API_KEY + HF_API_SECRET.')
  }
  return `Key ${key}:${secret}`
}

async function writeDirectorPrompt(productDescription: string, styleId: StyleId): Promise<string> {
  const style = STYLES[styleId]
  const anthropic = new Anthropic()

  const system = `You are an expert UGC ad director writing prompts for an image-to-video model. You are given a product and a creative style. Write ONE vivid image-to-video motion prompt that turns a still product photo into a scroll-stopping ${style.label} ad clip.

Style direction: ${style.brief}

Rules:
- Output ONLY the prompt text. No preamble, no quotes, no markdown, no explanation.
- 2-4 sentences. Describe camera movement, subject action, lighting, and mood.
- Keep it concrete and physical (what moves, how the camera moves). Avoid brand claims and text overlays.
- Vertical 9:16, social-native, authentic — not a glossy TV commercial.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system,
    messages: [
      {
        role: 'user',
        content: `Product: ${productDescription}\n\nWrite the ${style.label} motion prompt.`,
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

async function submitVideoJob(prompt: string, imageUrl: string, quality: Quality) {
  const res = await fetch(`${HF_BASE}/v1/image2video/dop`, {
    method: 'POST',
    headers: { Authorization: higgsfieldAuth(), 'content-type': 'application/json' },
    body: JSON.stringify({
      model: QUALITY_MODEL[quality],
      params: {
        prompt,
        input_images: [{ type: 'image_url', image_url: imageUrl }],
        enhance_prompt: true,
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Higgsfield submit failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as { request_id: string; status: string }
  return { requestId: data.request_id, status: data.status }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
    }
    const hfReady = process.env.HF_CREDENTIALS || (process.env.HF_API_KEY && process.env.HF_API_SECRET)
    if (!hfReady) {
      return res.status(503).json({ error: 'Higgsfield credentials missing. Set HF_API_KEY + HF_API_SECRET in Vercel → Settings → Environment Variables.' })
    }

    const {
      productImageUrl,
      productDescription,
      style,
      quality = 'turbo',
    } = (req.body ?? {}) as Record<string, string>

    if (!productImageUrl || !/^https?:\/\//i.test(productImageUrl)) {
      return res.status(400).json({ error: 'Provide a public product image URL (https://…).' })
    }
    if (!productDescription?.trim()) {
      return res.status(400).json({ error: 'Describe the product in a sentence.' })
    }
    if (!STYLES[style as StyleId]) {
      return res.status(400).json({ error: `Unknown style. Pick one of: ${Object.keys(STYLES).join(', ')}.` })
    }
    if (!QUALITIES.includes(quality as Quality)) {
      return res.status(400).json({ error: `Unknown quality. Pick one of: ${QUALITIES.join(', ')}.` })
    }

    const directorPrompt = await writeDirectorPrompt(productDescription.trim(), style as StyleId)
    const { requestId, status } = await submitVideoJob(directorPrompt, productImageUrl, quality as Quality)
    return res.status(200).json({ requestId, status, directorPrompt })
  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return res.status(502).json({ error: message })
  }
}

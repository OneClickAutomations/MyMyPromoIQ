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

// The wizard (Commercial Studio) uses richer style-preset ids; map them onto the
// four canonical render styles so generation accepts either vocabulary.
const STYLE_ALIASES: Record<string, StyleId> = {
  ugc_testimonial:   'testimonial',
  founder_story:     'testimonial',
  luxury_commercial: 'day-in-life',
  cinematic_brand:   'day-in-life',
  fast_cut_hook:     'fast-cut',
  unboxing:          'unboxing',
  explainer:         'unboxing',
}

/** Resolve any incoming style id (canonical or wizard preset) to a StyleId. */
function resolveStyle(style: string): StyleId | null {
  if (style in STYLES) return style as StyleId
  return STYLE_ALIASES[style] ?? null
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

interface BrandContext {
  voice?: string
  taglines?: string[]
  cta?: string
}

async function writeDirectorPrompt(
  productDescription: string,
  styleId: StyleId,
  brand?: BrandContext,
  composedPrompt?: string,
): Promise<string> {
  const style = STYLES[styleId]
  const anthropic = new Anthropic()

  const brandLines: string[] = []
  if (brand?.voice) brandLines.push(`Brand voice: ${brand.voice}.`)
  if (brand?.taglines?.length) brandLines.push(`Brand taglines: ${brand.taglines.join(' / ')}.`)
  if (brand?.cta) brandLines.push(`Preferred CTA: "${brand.cta}".`)
  const brandSection = brandLines.length
    ? `\nBrand context (honour this voice and weave the CTA naturally into the scene if it fits):\n${brandLines.join('\n')}\n`
    : ''

  // When the Composition Engine supplied a compiled prompt, it is AUTHORITATIVE on
  // the cast identity (ethnicity, skin tone, gender, age) and product scale. Claude
  // expands it into motion language but must NOT alter those facts — identity drift
  // is the failure we're fixing.
  const identitySection = composedPrompt
    ? `\nAUTHORITATIVE SCENE (preserve every casting detail VERBATIM — do not change the person's ethnicity, skin tone, gender, age, or the product's real-world scale; you may only add camera movement and timing):\n${composedPrompt}\n`
    : ''

  const system = `You are an expert UGC ad director writing prompts for an image-to-video model. Write ONE vivid image-to-video motion prompt that turns a still product photo into a scroll-stopping ${style.label} ad clip.

Style direction: ${style.brief}
${brandSection}${identitySection}
Rules:
- Output ONLY the prompt text. No preamble, no quotes, no markdown, no explanation.
- 2-4 sentences. Describe camera movement, subject action, lighting, and mood.
- Keep it concrete and physical (what moves, how the camera moves). Avoid brand claims and text overlays.${composedPrompt ? '\n- Preserve the cast person\'s ethnicity and skin tone exactly as stated. Keep the product at realistic real-world scale. Keep hands anatomically correct and the face stable (no morphing).' : ''}
- Vertical 9:16, social-native, authentic — not a glossy TV commercial.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 320,
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

async function submitVideoJob(
  prompt: string,
  imageUrl: string,
  quality: Quality,
  opts?: { negativePrompt?: string; enhance?: boolean },
) {
  // Fold negatives inline as an "Avoid:" clause rather than a separate param —
  // the dop endpoint only documents prompt/input_images/enhance_prompt, so an
  // unknown field could 400 a request that otherwise works. Cap length to stay sane.
  const avoid = opts?.negativePrompt?.trim()
  const finalPrompt = avoid ? `${prompt} Avoid: ${avoid.slice(0, 400)}.` : prompt

  const params: Record<string, unknown> = {
    prompt: finalPrompt,
    input_images: [{ type: 'image_url', image_url: imageUrl }],
    // When we supply a strong composed prompt we disable enhancement so Higgsfield
    // doesn't rewrite the cast identity away. Defaults to enhanced otherwise.
    enhance_prompt: opts?.enhance ?? true,
  }

  const res = await fetch(`${HF_BASE}/v1/image2video/dop`, {
    method: 'POST',
    headers: { Authorization: higgsfieldAuth(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: QUALITY_MODEL[quality], params }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Higgsfield submit failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as Record<string, unknown>
  // The id field name varies across Higgsfield API versions. Try the common
  // variants; nested under `job`/`data` on some responses.
  const nested = (data.job ?? data.data ?? data.result ?? {}) as Record<string, unknown>
  const requestId =
    (data.request_id ?? data.id ?? data.requestId ?? data.job_id ??
      nested.request_id ?? nested.id ?? nested.requestId) as string | undefined
  const status = (data.status ?? nested.status ?? 'queued') as string

  if (!requestId) {
    throw new Error(
      `Higgsfield submit returned no job id. Raw response: ${JSON.stringify(data).slice(0, 400)}`,
    )
  }
  return { requestId, status }
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
      composedPrompt,
      negativePrompt,
      brandVoice,
      brandTaglines,
      brandCta,
    } = (req.body ?? {}) as Record<string, string> & { brandTaglines?: string[] }

    if (!productImageUrl || !/^https?:\/\//i.test(productImageUrl)) {
      return res.status(400).json({ error: 'Provide a public product image URL (https://…).' })
    }
    if (!productDescription?.trim()) {
      return res.status(400).json({ error: 'Describe the product in a sentence.' })
    }
    const styleId = resolveStyle(style)
    if (!styleId) {
      const accepted = [...Object.keys(STYLES), ...Object.keys(STYLE_ALIASES)].join(', ')
      return res.status(400).json({ error: `Unknown style "${style}". Pick one of: ${accepted}.` })
    }
    if (!QUALITIES.includes(quality as Quality)) {
      return res.status(400).json({ error: `Unknown quality. Pick one of: ${QUALITIES.join(', ')}.` })
    }

    const brand: BrandContext = {
      voice: brandVoice || undefined,
      taglines: Array.isArray(brandTaglines) ? brandTaglines : undefined,
      cta: brandCta || undefined,
    }

    const directorPrompt = await writeDirectorPrompt(productDescription.trim(), styleId, brand, composedPrompt)
    const { requestId, status } = await submitVideoJob(directorPrompt, productImageUrl, quality as Quality, {
      negativePrompt,
      // Disable Higgsfield's own prompt rewrite when we already supplied a strong,
      // identity-locked composed prompt — keeps ethnicity/scale from drifting.
      enhance: composedPrompt ? false : true,
    })
    return res.status(200).json({ requestId, status, directorPrompt })
  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return res.status(502).json({ error: message })
  }
}

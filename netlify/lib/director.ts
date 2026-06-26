/**
 * Shared backend logic for the generation pipeline.
 *
 * This module owns two things:
 *   1. The Claude "director" — writes the cinematic motion prompt.
 *   2. Thin wrappers (submitVideoJob / getVideoStatus) that delegate to
 *      whichever VideoProvider is active (see ./providers/index.ts).
 *
 * Swap providers via VIDEO_PROVIDER env var:  higgsfield (default) | arcads
 */
import Anthropic from '@anthropic-ai/sdk'
import { getProvider } from './providers'
import type { SubmitOptions, SubmitResult, JobResult } from './providers'

export { getProvider }
export type { SubmitOptions, SubmitResult, JobResult }

export type StyleId = 'testimonial' | 'unboxing' | 'day-in-life' | 'fast-cut'
export type Quality = 'lite' | 'turbo' | 'standard'

type StyleDef = { label: string; brief: string }

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
      "The product woven into a real moment of someone's day. Lifestyle b-roll energy, gentle motion, lived-in environment, golden ambient light. Aspirational but believable.",
  },
  'fast-cut': {
    label: 'Fast-cut hook',
    brief:
      'High-energy scroll-stopping opener. Punchy camera moves, quick dynamic motion, bold framing engineered to kill the thumb-scroll in the first second. Vertical, kinetic.',
  },
}

/**
 * Claude is the director: given the product and the chosen UGC style, it writes
 * a single tight image-to-video motion prompt for the downstream video model.
 */
export async function writeDirectorPrompt(opts: {
  productDescription: string
  style: StyleId
}): Promise<string> {
  const style = STYLES[opts.style]
  const anthropic = new Anthropic()

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

/** Submit an image-to-video job via the active provider. */
export async function submitVideoJob(opts: {
  prompt: string
  imageUrl: string
  quality: Quality
}): Promise<SubmitResult> {
  return getProvider().submit(opts)
}

/** Poll a job. Returns a normalized status + the video URL when ready. */
export async function getVideoStatus(requestId: string): Promise<JobResult> {
  return getProvider().poll(requestId)
}

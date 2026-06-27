/**
 * POST /api/generate
 * Body: { productImageUrl, productDescription, style, quality }
 *
 * 1. Claude writes the cinematic motion prompt.
 * 2. Submits the image-to-video job (non-blocking).
 * 3. Returns { requestId, status, directorPrompt } for the client to poll.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  STYLES,
  submitVideoJob,
  writeDirectorPrompt,
  type Quality,
  type StyleId,
} from '../netlify/lib/director'

const QUALITIES: Quality[] = ['lite', 'turbo', 'standard']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Fail fast with a clear message if secrets aren't configured in Vercel.
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
      return res.status(400).json({
        error: `Unknown style. Pick one of: ${Object.keys(STYLES).join(', ')}.`,
      })
    }
    if (!QUALITIES.includes(quality as Quality)) {
      return res.status(400).json({
        error: `Unknown quality. Pick one of: ${QUALITIES.join(', ')}.`,
      })
    }

    const directorPrompt = await writeDirectorPrompt({
      productDescription: productDescription.trim(),
      style: style as StyleId,
    })
    const { requestId, status } = await submitVideoJob({
      prompt: directorPrompt,
      imageUrl: productImageUrl,
      quality: quality as Quality,
    })
    return res.status(200).json({ requestId, status, directorPrompt })
  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return res.status(502).json({ error: message })
  }
}

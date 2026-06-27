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

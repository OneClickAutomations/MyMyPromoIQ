/**
 * POST /api/generate
 * Body: { productImageUrl, productDescription, style, quality }
 *
 * 1. Claude (the "director") writes the cinematic motion prompt.
 * 2. Submit the Higgsfield image-to-video job (non-blocking).
 * 3. Return the request id + the director's prompt so the client can poll.
 */
import type { Handler } from '@netlify/functions'
import {
  STYLES,
  submitVideoJob,
  writeDirectorPrompt,
  type Quality,
  type StyleId,
} from '../lib/director'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const QUALITIES: Quality[] = ['lite', 'turbo', 'standard']

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let payload: {
    productImageUrl?: string
    productDescription?: string
    style?: string
    quality?: string
  }
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  const productImageUrl = payload.productImageUrl?.trim()
  const productDescription = payload.productDescription?.trim()
  const style = payload.style as StyleId
  const quality = (payload.quality as Quality) || 'turbo'

  // Validate.
  if (!productImageUrl || !/^https?:\/\//i.test(productImageUrl)) {
    return json(400, { error: 'Provide a public product image URL (https://…).' })
  }
  if (!productDescription) {
    return json(400, { error: 'Describe the product in a sentence.' })
  }
  if (!STYLES[style]) {
    return json(400, { error: `Unknown style. Pick one of: ${Object.keys(STYLES).join(', ')}.` })
  }
  if (!QUALITIES.includes(quality)) {
    return json(400, { error: `Unknown quality. Pick one of: ${QUALITIES.join(', ')}.` })
  }

  try {
    const directorPrompt = await writeDirectorPrompt({ productDescription, style })
    const { requestId, status } = await submitVideoJob({
      prompt: directorPrompt,
      imageUrl: productImageUrl,
      quality,
    })
    return json(200, { requestId, status, directorPrompt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.'
    // Surface the cause without leaking secrets.
    return json(502, { error: message })
  }
}

/**
 * GET /api/status?id=<requestId>
 * Returns the normalized render status and, when ready, the video URL.
 */
import type { Handler } from '@netlify/functions'
import { getVideoStatus } from '../lib/director'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' })

  const id = event.queryStringParameters?.id?.trim()
  if (!id) return json(400, { error: 'Missing ?id=<requestId>.' })

  try {
    const result = await getVideoStatus(id)
    return json(200, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return json(502, { error: message })
  }
}

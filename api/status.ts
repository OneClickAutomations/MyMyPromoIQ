/**
 * GET /api/status?id=<requestId>
 *
 * Polls the active video provider and returns a normalised status.
 * On Vercel's free tier, function invocations are unlimited, so the client
 * can poll this freely without hitting any quota.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVideoStatus } from '../netlify/lib/director.ts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const id = req.query.id as string | undefined
    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required.' })
    }

    const result = await getVideoStatus(id)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[/api/status]', err)
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return res.status(502).json({ error: message })
  }
}

/**
 * GET /api/status?id=<requestId>
 *
 * Polls Higgsfield and returns a normalised status.
 * Self-contained (node_modules packages only, no cross-directory relative
 * imports) so Vercel reliably bundles it — see api/generate.ts for why.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const HF_BASE = 'https://platform.higgsfield.ai'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const id = req.query.id as string | undefined
    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required.' })
    }

    const hfRes = await fetch(`${HF_BASE}/requests/${encodeURIComponent(id)}/status`, {
      headers: { Authorization: higgsfieldAuth() },
    })

    if (!hfRes.ok) {
      const detail = await hfRes.text().catch(() => '')
      throw new Error(`Higgsfield status failed (${hfRes.status}): ${detail.slice(0, 300)}`)
    }

    const data = (await hfRes.json()) as Record<string, any>
    const raw = String(data.status ?? '')
    const norm = raw.toLowerCase().replace(/[\s-]/g, '_')

    // Video URL location varies across API versions.
    const videoUrl: string | null =
      data.video?.url ??
      data.video_url ??
      data.output?.url ??
      data.result?.url ??
      (Array.isArray(data.results) ? data.results[0]?.url : null) ??
      null

    if (norm === 'completed' || norm === 'succeeded' || norm === 'success') {
      return res.status(200).json({ status: 'completed', videoUrl, raw })
    }
    if (norm === 'failed' || norm === 'nsfw' || norm === 'error' || norm === 'canceled' || norm === 'cancelled') {
      return res.status(200).json({ status: 'failed', videoUrl: null, raw })
    }
    return res.status(200).json({ status: 'pending', videoUrl: null, raw })
  } catch (err) {
    console.error('[/api/status]', err)
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return res.status(502).json({ error: message })
  }
}

/**
 * GET /api/status?id=<requestId>
 *
 * Polls the video provider and returns a normalised status. The id encodes the
 * provider: ids prefixed with "veo:" are Google Veo operations; anything else is
 * a Higgsfield request id (kept unprefixed for backward compatibility).
 *
 * For Veo, when the render completes we download the file (the Veo file URL needs
 * the API key, so it can't be handed to the browser) and re-host it in the public
 * Supabase bucket. That gives a plain https URL the <video> tag, the muxer, and
 * the stitcher can all use. If Supabase isn't configured we fall back to an inline
 * data URL (plays fine, but can't be stitched).
 *
 * Self-contained (node_modules packages only) so Vercel reliably bundles it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const HF_BASE = 'https://platform.higgsfield.ai'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const BUCKET = 'product-images'

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

/** Re-host a finished render in the public bucket → returns a plain https URL (or null). */
async function rehostRender(buf: Buffer): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 104_857_600 }).catch(() => {})
    const path = `renders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: 'video/mp4', upsert: false })
    if (error) return null
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

/** Poll a Veo long-running operation and, when done, re-host the resulting clip. */
async function pollVeo(opName: string, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (required to poll Veo).')

  // The `name` field from Veo's predictLongRunning varies across API versions:
  //   "operations/abc123"                      → append to base
  //   "models/veo-3.../operations/abc123"      → append to base
  //   "https://generativelanguage.../..."       → use as-is (full URL)
  const opUrl = opName.startsWith('http') ? opName : `${GEMINI_BASE}/${opName}`
  const opResp = await fetch(opUrl, { headers: { 'x-goog-api-key': apiKey } })
  if (!opResp.ok) {
    const detail = await opResp.text().catch(() => '')
    throw new Error(`Veo status failed (${opResp.status}): ${detail.slice(0, 300)}`)
  }
  const data = (await opResp.json()) as Record<string, any>

  if (!data.done) return res.status(200).json({ status: 'pending', videoUrl: null, raw: 'running' })
  if (data.error) {
    return res.status(200).json({ status: 'failed', videoUrl: null, raw: JSON.stringify(data.error).slice(0, 200) })
  }

  // The video URI location varies across Veo API revisions — try the known shapes.
  const response = data.response ?? {}
  const sample =
    response.generateVideoResponse?.generatedSamples?.[0] ??
    response.generatedVideos?.[0] ??
    response.videos?.[0] ??
    null
  const uri: string | null =
    sample?.video?.uri ?? sample?.video?.url ?? sample?.uri ?? (typeof sample?.video === 'string' ? sample.video : null)

  if (!uri) {
    return res.status(200).json({ status: 'failed', videoUrl: null, raw: 'veo-no-video-uri' })
  }

  // The Veo file URL needs the API key to download.
  const downloadUrl = /[?&]key=/.test(uri) ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`
  const fileResp = await fetch(downloadUrl, { headers: { 'x-goog-api-key': apiKey } })
  if (!fileResp.ok) throw new Error(`Veo file download failed (${fileResp.status}).`)
  const buf = Buffer.from(await fileResp.arrayBuffer())

  const hosted = await rehostRender(buf)
  if (hosted) return res.status(200).json({ status: 'completed', videoUrl: hosted, raw: 'done' })

  // Fallback: inline data URL (plays, but stitch/mux need an https URL).
  return res.status(200).json({
    status: 'completed',
    videoUrl: `data:video/mp4;base64,${buf.toString('base64')}`,
    raw: 'done-inline',
  })
}

/** Poll a Higgsfield request. */
async function pollHiggsfield(id: string, res: VercelResponse) {
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

    if (id.startsWith('veo:')) {
      return await pollVeo(id.slice(4), res)
    }
    return await pollHiggsfield(id, res)
  } catch (err) {
    console.error('[/api/status]', err)
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return res.status(502).json({ error: message })
  }
}

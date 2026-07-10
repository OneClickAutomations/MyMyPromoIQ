/**
 * GET /api/status?id=<requestId>
 *
 * Polls a Veo 3 long-running operation and returns a normalised status.
 * Request ids are prefixed with "veo:" (set by /api/generate).
 *
 * When the render completes we download the file (the Veo URI needs the API
 * key so it can't be given to the browser) and re-host it in the public
 * Supabase bucket.  That gives a plain https URL the <video> tag, the muxer,
 * and the stitcher can all use.  If Supabase isn't configured we fall back to
 * an inline data URL (plays fine, but can't be stitched).
 *
 * Self-contained (node_modules packages only) so Vercel reliably bundles it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getJobStatus, videoUrl as hfVideoUrl } from './_lib/higgsfield.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const BUCKET = 'product-images'

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

/**
 * Extract the video download URI from a completed Veo operation response.
 *
 * Veo 3 via `predictLongRunning` returns generatedSamples directly on the
 * `response` object (not nested under generateVideoResponse).  Older / preview
 * API revisions used different nesting — we try all known shapes so a future
 * API change doesn't silently break every generation.
 */
function extractVeoUri(response: Record<string, any>): string | null {
  const sample: any =
    // Veo 3 stable: generatedSamples directly on response
    response.generatedSamples?.[0] ??
    // Older preview nesting
    response.generateVideoResponse?.generatedSamples?.[0] ??
    // Other variant field names
    response.generatedVideos?.[0] ??
    response.videos?.[0] ??
    null

  if (!sample) return null

  return (
    sample?.video?.uri ??
    sample?.video?.url ??
    sample?.uri ??
    sample?.url ??
    (typeof sample?.video === 'string' ? sample.video : null) ??
    null
  )
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

  const response = data.response ?? {}
  const uri = extractVeoUri(response)

  if (!uri) {
    // Log the actual response shape so format changes are diagnosable.
    console.error('[/api/status] veo-no-video-uri — response keys:', Object.keys(response), JSON.stringify(response).slice(0, 500))
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

/** Poll a Higgsfield request and, when done, re-host the resulting clip.
 *  Higgsfield output URLs expire in ~7 days, so the download-to-Supabase step
 *  is mandatory — never hand the raw Higgsfield URL to the client as the final
 *  asset (it must survive for stitching, muxing, and history). */
async function pollHiggsfield(requestId: string, res: VercelResponse) {
  const result = await getJobStatus(requestId)
  if (result.status === 'queued' || result.status === 'in_progress') {
    return res.status(200).json({ status: 'pending', videoUrl: null, raw: result.status })
  }
  if (result.status === 'nsfw') {
    return res.status(200).json({ status: 'failed', videoUrl: null, raw: 'nsfw' })
  }
  if (result.status !== 'completed') {
    return res.status(200).json({ status: 'failed', videoUrl: null, raw: (result.error || result.status).slice(0, 200) })
  }
  const url = hfVideoUrl(result)
  if (!url) {
    console.error('[/api/status] hf-no-video-url — result:', JSON.stringify(result).slice(0, 500))
    return res.status(200).json({ status: 'failed', videoUrl: null, raw: 'hf-no-video-url' })
  }
  const fileResp = await fetch(url)
  if (!fileResp.ok) throw new Error(`Higgsfield file download failed (${fileResp.status}).`)
  const buf = Buffer.from(await fileResp.arrayBuffer())
  const hosted = await rehostRender(buf)
  if (hosted) return res.status(200).json({ status: 'completed', videoUrl: hosted, raw: 'done' })
  return res.status(200).json({ status: 'completed', videoUrl: `data:video/mp4;base64,${buf.toString('base64')}`, raw: 'done-inline' })
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

    if (id.startsWith('hf:')) {
      return await pollHiggsfield(id.slice(3), res)
    }
    if (id.startsWith('veo:')) {
      return await pollVeo(id.slice(4), res)
    }

    return res.status(400).json({ error: `Unknown request id format: "${id.slice(0, 40)}". Expected an hf:- or veo:-prefixed id.` })
  } catch (err) {
    console.error('[/api/status]', err)
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return res.status(502).json({ error: message })
  }
}

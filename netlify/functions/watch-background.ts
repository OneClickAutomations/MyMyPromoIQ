/**
 * POST /api/watch  (Netlify background function — runs up to 15 minutes)
 * Body: { requestId: string, sceneId: string }
 *
 * Polls the video provider until the render finishes or fails, then writes the
 * result into the Supabase `scenes` row. The browser polls that row directly
 * via the Supabase JS client — eliminating ~120 /api/status invocations per
 * render session and replacing them with zero Netlify function calls.
 *
 * File must end in -background so Netlify treats it as a background function
 * (returns 202 immediately; handler runs async for up to 15 minutes).
 */
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getVideoStatus } from '../lib/director'

const POLL_INTERVAL_MS = 6_000
const TIMEOUT_MS = 13 * 60 * 1_000  // 13 min — leaves buffer before Netlify's 15-min hard limit

export const handler: Handler = async (event) => {
  let payload: { requestId?: string; sceneId?: string } = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { requestId, sceneId } = payload
  if (!requestId || !sceneId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'requestId and sceneId are required.' }) }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Supabase not configured.' }) }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    try {
      const result = await getVideoStatus(requestId)

      if (result.status === 'completed' && result.videoUrl) {
        await supabase
          .from('scenes')
          .update({ phase: 'done', video_url: result.videoUrl, error_message: null })
          .eq('id', sceneId)
        return { statusCode: 200, body: JSON.stringify({ status: 'done' }) }
      }

      if (result.status === 'failed') {
        await supabase
          .from('scenes')
          .update({ phase: 'error', error_message: result.raw || 'Render failed.' })
          .eq('id', sceneId)
        return { statusCode: 200, body: JSON.stringify({ status: 'failed' }) }
      }
      // status === 'pending' — continue polling
    } catch (err) {
      console.error('[watch] poll error:', err instanceof Error ? err.message : err)
      // Transient error — keep trying until deadline
    }
  }

  // Timed out
  await supabase
    .from('scenes')
    .update({ phase: 'error', error_message: 'Render timed out.' })
    .eq('id', sceneId)
    .catch(() => {})

  return { statusCode: 200, body: JSON.stringify({ status: 'timeout' }) }
}

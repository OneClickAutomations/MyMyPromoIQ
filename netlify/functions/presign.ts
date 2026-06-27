/**
 * POST /api/presign
 * Body: { mimeType?: string }
 *
 * Generates a one-time signed upload URL for Supabase Storage using the
 * service-role key (which never reaches the browser). The client then
 * PUT-uploads the file directly to Supabase — the file data bypasses Netlify
 * entirely, eliminating bandwidth costs and function execution time.
 *
 * Returns: { signedUrl, token, path, publicUrl }
 */
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'product-images'

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(body),
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json(503, { error: 'Image hosting not configured. Please use the Image URL tab instead.' })
  }

  let body: { mimeType?: string } = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  const mimeType = body.mimeType || 'image/jpeg'
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    // Ensure bucket exists (idempotent)
    await supabase.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: 20_971_520 })
      .catch(() => {})

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) throw new Error(error?.message || 'Could not create signed URL.')

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return json(200, {
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Presign failed.'
    return json(502, { error: message })
  }
}

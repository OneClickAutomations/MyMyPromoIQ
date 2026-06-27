/**
 * POST /api/upload
 * Body: { imageData: string (base64 or data URL), mimeType?: string }
 *
 * Uploads an image to Supabase Storage and returns a public URL.
 * Requires SUPABASE_SERVICE_KEY in Netlify environment variables.
 *
 * If storage isn't configured the endpoint returns 503 with a clear message;
 * the Studio UI falls back to "Please use the Image URL tab."
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
    return json(503, {
      error: 'Image hosting not configured. Please use the Image URL tab instead.',
    })
  }

  let body: { imageData?: string; mimeType?: string } = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  const { imageData, mimeType = 'image/jpeg' } = body
  if (!imageData) return json(400, { error: 'imageData is required.' })

  // Strip the data URL prefix if present
  const base64 = imageData.replace(/^data:[^;]+;base64,/, '')
  if (!base64) return json(400, { error: 'imageData appears to be empty.' })

  // Size guard: 20 MB encoded in base64 ≈ 27 MB base64 string
  if (base64.length > 27_000_000) return json(413, { error: 'Image exceeds the 20 MB limit.' })

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    // Ensure bucket exists (ignore "already exists" errors)
    await supabase.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: 20_971_520 })
      .catch(() => { /* bucket already exists — fine */ })

    const buffer = Buffer.from(base64, 'base64')
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: mimeType, upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)

    return json(200, { url: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.'
    return json(502, { error: message })
  }
}

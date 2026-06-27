/**
 * POST /api/presign
 * Body: { mimeType?: string }
 *
 * Uses the Supabase service-role key (server-only) to mint a one-time signed
 * upload URL. The browser then PUT-uploads the file straight to Supabase —
 * the file data never passes through this function or Vercel's bandwidth.
 *
 * Returns: { signedUrl, token, path, publicUrl }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'product-images'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
      res.setHeader('access-control-allow-headers', 'content-type')
      return res.status(204).send('')
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !serviceKey) {
      return res.status(503).json({
        error: 'Image hosting not configured. Please use the Image URL tab instead.',
      })
    }

    const mimeType = (req.body as Record<string, string>)?.mimeType || 'image/jpeg'
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const supabase = createClient(supabaseUrl, serviceKey)

    await supabase.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: 20_971_520 })
      .catch(() => {})

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) throw new Error(error?.message || 'Could not create signed URL.')

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return res.status(200).json({
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl,
    })
  } catch (err) {
    console.error('[/api/presign]', err)
    const message = err instanceof Error ? err.message : 'Presign failed.'
    return res.status(502).json({ error: message })
  }
}

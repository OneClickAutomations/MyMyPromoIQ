/**
 * GET /api/ping
 *
 * Health-check endpoint. No external imports, no API calls.
 * Returns which server-side env vars are configured (not their values).
 * Useful for diagnosing missing Vercel environment variables.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const vars = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    HF_API_KEY: !!process.env.HF_API_KEY,
    HF_API_SECRET: !!process.env.HF_API_SECRET,
    HF_CREDENTIALS: !!process.env.HF_CREDENTIALS,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    VIDEO_PROVIDER: process.env.VIDEO_PROVIDER || 'higgsfield (default)',
  }

  const missing = Object.entries(vars)
    .filter(([k, v]) => v === false && k !== 'HF_CREDENTIALS')
    .map(([k]) => k)

  return res.status(200).json({
    ok: true,
    env: vars,
    missing,
    hint: missing.length
      ? `Add these to Vercel → Settings → Environment Variables: ${missing.join(', ')}`
      : 'All required env vars are set.',
  })
}

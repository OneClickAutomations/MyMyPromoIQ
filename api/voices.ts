/**
 * GET /api/voices
 * Lists available ElevenLabs voices for the voiceover picker.
 *
 * Returns the account's voices plus ElevenLabs' premade premium voices, each
 * with a preview URL and labels (gender, accent, use case) for filtering.
 *
 * Requires ELEVENLABS_API_KEY (server-side only — never exposed to the bundle).
 * Self-contained: no cross-directory imports (Vercel bundling constraint).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EL_BASE = 'https://api.elevenlabs.io/v1'

interface VoiceOut {
  voiceId: string
  name: string
  category: string
  previewUrl?: string
  gender?: string
  accent?: string
  description?: string
  useCase?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
  }

  try {
    const resp = await fetch(`${EL_BASE}/voices`, {
      headers: { 'xi-api-key': apiKey },
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      return res.status(502).json({ error: `ElevenLabs voices failed (${resp.status}): ${detail.slice(0, 200)}` })
    }
    const data = (await resp.json()) as { voices?: any[] }
    const voices: VoiceOut[] = (data.voices ?? []).map((v) => {
      const labels = (v.labels ?? {}) as Record<string, string>
      return {
        voiceId: v.voice_id,
        name: v.name,
        category: v.category ?? 'premade',
        previewUrl: v.preview_url,
        gender: labels.gender,
        accent: labels.accent,
        description: labels.description,
        useCase: labels['use case'] ?? labels.use_case,
      }
    })
    // Surface cloned/generated (the user's own) voices first, then premade.
    voices.sort((a, b) => (a.category === 'premade' ? 1 : 0) - (b.category === 'premade' ? 1 : 0))
    return res.status(200).json({ voices })
  } catch (err) {
    console.error('[/api/voices]', err)
    const message = err instanceof Error ? err.message : 'Failed to load voices.'
    return res.status(502).json({ error: message })
  }
}

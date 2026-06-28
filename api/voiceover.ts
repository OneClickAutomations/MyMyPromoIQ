/**
 * POST /api/voiceover
 * Body: { text, voiceId, modelId?, stability?, similarityBoost?, style?, speed? }
 *
 * Generates a spoken voiceover from the ad script via ElevenLabs TTS and returns
 * it as a base64 data URL the client can play and download. (Muxing the audio
 * into the silent render is a follow-up — see the result screen.)
 *
 * Requires ELEVENLABS_API_KEY (server-side only).
 * Self-contained: no cross-directory imports (Vercel bundling constraint).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EL_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_MODEL = 'eleven_multilingual_v2'
const MAX_CHARS = 5000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
  }

  const {
    text,
    voiceId,
    modelId = DEFAULT_MODEL,
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0,
    speed = 1,
  } = (req.body ?? {}) as Record<string, any>

  if (!text?.trim()) return res.status(400).json({ error: 'Script text is required for the voiceover.' })
  if (!voiceId) return res.status(400).json({ error: 'Pick a voice first.' })
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Script is too long (${text.length} chars). Keep it under ${MAX_CHARS}.` })
  }

  try {
    const resp = await fetch(`${EL_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: Number(stability),
          similarity_boost: Number(similarityBoost),
          style: Number(style),
          use_speaker_boost: true,
          speed: Number(speed),
        },
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      return res.status(502).json({ error: `ElevenLabs TTS failed (${resp.status}): ${detail.slice(0, 200)}` })
    }

    const buf = Buffer.from(await resp.arrayBuffer())
    const audioDataUrl = `data:audio/mpeg;base64,${buf.toString('base64')}`
    return res.status(200).json({ audioDataUrl, bytes: buf.length })
  } catch (err) {
    console.error('[/api/voiceover]', err)
    const message = err instanceof Error ? err.message : 'Voiceover generation failed.'
    return res.status(502).json({ error: message })
  }
}

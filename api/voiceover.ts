/**
 * /api/voiceover
 *
 *   GET   → list available ElevenLabs voices for the picker (account voices +
 *           premade premium voices, each with preview URL + labels).
 *   POST  → generate a spoken voiceover from the ad script via ElevenLabs TTS,
 *           returned as a base64 data URL the client can play and download.
 *           Body: { text, voiceId, modelId?, stability?, similarityBoost?, style?, speed? }
 *
 * (Voice listing used to live in api/voices.ts — folded in here to stay under
 * the Vercel Hobby 12-function limit. GET vs POST keeps them cleanly separate.)
 *
 * Requires ELEVENLABS_API_KEY (server-side only — never exposed to the bundle).
 * Self-contained: no cross-directory imports (Vercel bundling constraint).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EL_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_MODEL = 'eleven_multilingual_v2'
const MAX_CHARS = 5000

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

/** GET — list the account's voices plus ElevenLabs premade premium voices. */
async function listVoices(apiKey: string, res: VercelResponse) {
  const resp = await fetch(`${EL_BASE}/voices`, { headers: { 'xi-api-key': apiKey } })
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
}

/** POST — synthesize a voiceover from the ad script. */
async function synthesize(req: VercelRequest, res: VercelResponse, apiKey: string) {
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
  }

  try {
    if (req.method === 'GET') return await listVoices(apiKey, res)
    if (req.method === 'POST') return await synthesize(req, res, apiKey)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[/api/voiceover]', err)
    const message = err instanceof Error ? err.message : 'Voiceover request failed.'
    return res.status(502).json({ error: message })
  }
}

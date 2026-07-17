/**
 * /api/voiceover
 *
 *   GET   → list voices for the picker: the account's own voices PLUS the
 *           ElevenLabs shared voice library (featured, up to 100), each
 *           normalized with gender/accent/age/use-case labels so the client
 *           can filter gender-first.
 *   POST  → mode-dispatched:
 *           (default) generate a spoken voiceover from the ad script via TTS.
 *             Body: { text, voiceId, ownerId?, voiceName?, modelId?, stability?,
 *                     similarityBoost?, style?, speed?, withTimestamps? }
 *             ownerId marks a shared-library voice: it is auto-added to the
 *             account's voice list on first use (required by ElevenLabs before
 *             TTS can run against a shared voice), then synthesis retries.
 *           mode:'music' → generate a background-music track via Eleven Music.
 *             Body: { mode:'music', prompt, durationSeconds? }
 *
 * (Voice listing used to live in api/voices.ts — folded in here to stay under
 * the Vercel Hobby 12-function limit.)
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
  age?: string
  description?: string
  useCase?: string
  /** Present for shared-library voices — needed to add the voice before TTS. */
  ownerId?: string
  source: 'mine' | 'library'
}

/** ElevenLabs labels gender as male/female/neutral (occasionally 'non-binary'). */
function normGender(g?: string): string | undefined {
  const v = g?.trim().toLowerCase()
  if (!v) return undefined
  if (v === 'non-binary' || v === 'non binary' || v === 'nonbinary') return 'neutral'
  return v
}

/** GET — account voices + the shared voice library, merged and normalized. */
async function listVoices(apiKey: string, res: VercelResponse) {
  const headers = { 'xi-api-key': apiKey }
  const [mineResp, sharedResp] = await Promise.all([
    fetch(`${EL_BASE}/voices`, { headers }),
    // Featured shared voices only — the curated, high-quality slice of the
    // community library. page_size=100 is the API maximum per page.
    fetch(`${EL_BASE}/shared-voices?page_size=100&featured=true`, { headers }),
  ])

  if (!mineResp.ok) {
    const detail = await mineResp.text().catch(() => '')
    return res.status(502).json({ error: `ElevenLabs voices failed (${mineResp.status}): ${detail.slice(0, 200)}` })
  }

  const mine = (await mineResp.json()) as { voices?: any[] }
  const voices: VoiceOut[] = (mine.voices ?? []).map((v) => {
    const labels = (v.labels ?? {}) as Record<string, string>
    return {
      voiceId: v.voice_id,
      name: v.name,
      category: v.category ?? 'premade',
      previewUrl: v.preview_url,
      gender: normGender(labels.gender),
      accent: labels.accent?.toLowerCase(),
      age: labels.age?.toLowerCase(),
      description: labels.description,
      useCase: (labels['use case'] ?? labels.use_case)?.toLowerCase(),
      source: 'mine' as const,
    }
  })

  // The shared library is additive — if it fails (plan restrictions, transient
  // errors) the picker still works with the account's own voices.
  if (sharedResp.ok) {
    const seen = new Set(voices.map((v) => v.voiceId))
    const shared = (await sharedResp.json()) as { voices?: any[] }
    for (const v of shared.voices ?? []) {
      if (!v.voice_id || seen.has(v.voice_id)) continue
      seen.add(v.voice_id)
      voices.push({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category ?? 'shared',
        previewUrl: v.preview_url,
        gender: normGender(v.gender),
        accent: v.accent?.toLowerCase(),
        age: v.age?.toLowerCase(),
        description: v.descriptive,
        useCase: v.use_case?.toLowerCase(),
        ownerId: v.public_owner_id,
        source: 'library' as const,
      })
    }
  } else {
    console.warn('[voiceover] shared-voices unavailable:', sharedResp.status)
  }

  // The user's own cloned/generated voices first, then premade, then library.
  const rank = (v: VoiceOut) => (v.source === 'mine' && v.category !== 'premade' ? 0 : v.source === 'mine' ? 1 : 2)
  voices.sort((a, b) => rank(a) - rank(b))
  return res.status(200).json({ voices })
}

/** Add a shared-library voice to the account (required before TTS can use it). */
async function addSharedVoice(apiKey: string, ownerId: string, voiceId: string, name: string): Promise<string | null> {
  const resp = await fetch(`${EL_BASE}/voices/add/${ownerId}/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ new_name: name || 'Library voice' }),
  })
  if (resp.ok) return null
  const detail = await resp.text().catch(() => '')
  // Already in the library is a success for our purposes.
  if (/already/i.test(detail)) return null
  return `Could not add this library voice (${resp.status}): ${detail.slice(0, 200)}`
}

/** POST (default) — synthesize a voiceover from the ad script. */
async function synthesize(req: VercelRequest, res: VercelResponse, apiKey: string) {
  const {
    text,
    voiceId,
    ownerId,
    voiceName,
    modelId = DEFAULT_MODEL,
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0,
    speed = 1,
  } = (req.body ?? {}) as Record<string, any>

  // When the caller wants captions synced to this voice, use the with-timestamps
  // endpoint — it returns per-character alignment we group into word cues for
  // pixel-accurate caption sync (impossible to get from Veo's native audio).
  const withTimestamps = !!(req.body as Record<string, any>)?.withTimestamps

  if (!text?.trim()) return res.status(400).json({ error: 'Script text is required for the voiceover.' })
  if (!voiceId) return res.status(400).json({ error: 'Pick a voice first.' })
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Script is too long (${text.length} chars). Keep it under ${MAX_CHARS}.` })
  }

  const voiceSettings = {
    stability: Number(stability),
    similarity_boost: Number(similarityBoost),
    style: Number(style),
    use_speaker_boost: true,
    speed: Number(speed),
  }
  const path = withTimestamps ? `/text-to-speech/${voiceId}/with-timestamps` : `/text-to-speech/${voiceId}`
  const body = JSON.stringify({ text: text.trim(), model_id: modelId, voice_settings: voiceSettings })
  const doTts = () =>
    fetch(`${EL_BASE}${path}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', ...(withTimestamps ? {} : { accept: 'audio/mpeg' }) },
      body,
    })

  let resp = await doTts()
  // Shared-library voices must be added to the account before first use — a
  // 400/404 on a voice that carries an ownerId means exactly that. Add + retry.
  if (!resp.ok && ownerId && (resp.status === 400 || resp.status === 404 || resp.status === 422)) {
    const addErr = await addSharedVoice(apiKey, String(ownerId), String(voiceId), String(voiceName ?? ''))
    if (addErr) return res.status(502).json({ error: addErr })
    resp = await doTts()
  }
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    return res.status(502).json({ error: `ElevenLabs TTS failed (${resp.status}): ${detail.slice(0, 200)}` })
  }

  if (withTimestamps) {
    // { audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds } }
    const data = (await resp.json()) as any
    const a = data.alignment ?? data.normalized_alignment ?? {}
    return res.status(200).json({
      audioDataUrl: `data:audio/mpeg;base64,${data.audio_base64}`,
      alignment: {
        characters: a.characters ?? [],
        startTimes: a.character_start_times_seconds ?? [],
        endTimes: a.character_end_times_seconds ?? [],
      },
    })
  }

  const buf = Buffer.from(await resp.arrayBuffer())
  const audioDataUrl = `data:audio/mpeg;base64,${buf.toString('base64')}`
  return res.status(200).json({ audioDataUrl, bytes: buf.length })
}

/** POST mode:'music' — generate a background track via Eleven Music. */
async function composeMusic(req: VercelRequest, res: VercelResponse, apiKey: string) {
  const { prompt, durationSeconds } = (req.body ?? {}) as Record<string, any>
  if (!prompt?.trim()) return res.status(400).json({ error: 'Describe the music you want.' })

  // Eleven Music accepts 10s–300s.
  const ms = Math.min(300_000, Math.max(10_000, Math.round(Number(durationSeconds) || 30) * 1000))

  const resp = await fetch(`${EL_BASE}/music?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: String(prompt).trim().slice(0, 2000), music_length_ms: ms }),
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    return res.status(502).json({ error: `ElevenLabs Music failed (${resp.status}): ${detail.slice(0, 300)}` })
  }
  const buf = Buffer.from(await resp.arrayBuffer())
  return res.status(200).json({ audioDataUrl: `data:audio/mpeg;base64,${buf.toString('base64')}`, bytes: buf.length })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
  }

  try {
    if (req.method === 'GET') return await listVoices(apiKey, res)
    if (req.method === 'POST') {
      if ((req.body as Record<string, any>)?.mode === 'music') return await composeMusic(req, res, apiKey)
      return await synthesize(req, res, apiKey)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[/api/voiceover]', err)
    const message = err instanceof Error ? err.message : 'Voiceover request failed.'
    return res.status(502).json({ error: message })
  }
}

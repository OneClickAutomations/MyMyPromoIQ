/**
 * ArcadsAdapter — AI UGC video via external-api.arcads.ai
 *
 * Auth:   HTTP Basic — API key as username, empty password
 * Submit: POST /v2/videos/generate  → 201 { id, status: "pending", creditsCharged }
 * Poll:   GET  /v1/videos/{id}         (all models except Seedance)
 *         GET  /v1/assets/{id}         (seedance-2.0 ONLY — 404 on the other endpoint)
 *
 * Presigned uploads (when imageUrl is a local file):
 *   POST /v1/file-upload/get-presigned-url → { presignedUrl, filePath }
 *   PUT  presignedUrl  (Content-Type: image/*)
 *   pass filePath as the image reference in the generate body
 *   NOTE: filePath is single-use; request a fresh one per job.
 *
 * Credits are charged at create-time; there are no refunds on cancellation.
 */
import type { VideoProvider, ProviderCapabilities, SubmitOptions, SubmitResult, JobResult } from './types.ts'

const BASE = 'https://external-api.arcads.ai'

/**
 * Arcads model IDs mapped to quality tiers.
 * sora2/veo31 → standard; kling-2.6 → turbo; kling-3.0 → lite/turbo
 * Default model per tier — can be overridden via ARCADS_MODEL env var.
 */
const QUALITY_MODEL: Record<SubmitOptions['quality'], string> = {
  lite: 'kling-2.6',
  turbo: 'kling-3.0',
  standard: 'sora2',
}

/** Models that use /v1/assets/{id} for polling instead of /v1/videos/{id}. */
const ASSET_POLL_MODELS = new Set(['seedance-2.0'])

function authHeaders(): Record<string, string> {
  const key = process.env.ARCADS_API_KEY
  if (!key) throw new Error('Missing ARCADS_API_KEY environment variable.')
  const encoded = Buffer.from(`${key}:`).toString('base64')
  return { Authorization: `Basic ${encoded}`, 'content-type': 'application/json' }
}

/**
 * Arcads submit body shape (v2).
 * We store the chosen model in the requestId using a "|" prefix so the poller
 * knows which endpoint to hit without a separate lookup table.
 */
interface ArcadsGenerateBody {
  imageUrl: string
  prompt: string
  model: string
  aspectRatio?: string
}

interface ArcadsGenerateResponse {
  id: string
  status: string
  creditsCharged?: number
  model?: string
}

interface ArcadsVideoResponse {
  id: string
  status: string // "pending" | "processing" | "completed" | "failed"
  videoUrl?: string
  url?: string
}

export class ArcadsAdapter implements VideoProvider {
  readonly id = 'arcads'

  readonly capabilities: ProviderCapabilities = {
    name: 'Arcads AI',
    qualities: ['lite', 'turbo', 'standard'],
    maxResolution: 1080,
    p50LatencySeconds: 120,
    costPerSecond: 10,
  }

  async submit(opts: SubmitOptions): Promise<SubmitResult> {
    const model = process.env.ARCADS_MODEL || QUALITY_MODEL[opts.quality]
    const body: ArcadsGenerateBody = {
      imageUrl: opts.imageUrl,
      prompt: opts.prompt,
      model,
      aspectRatio: '9:16',
    }

    const res = await fetch(`${BASE}/v2/videos/generate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Arcads submit failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as ArcadsGenerateResponse
    // Encode the model into the requestId so poll() can route correctly.
    // Format: "<model>|<job-id>"
    const requestId = `${data.model ?? model}|${data.id}`
    return { requestId, status: data.status }
  }

  async poll(requestId: string): Promise<JobResult> {
    // Decode model + job id (see submit() above).
    const pipeIdx = requestId.indexOf('|')
    let model: string
    let jobId: string
    if (pipeIdx === -1) {
      // Legacy / direct id — assume standard poll path.
      model = 'sora2'
      jobId = requestId
    } else {
      model = requestId.slice(0, pipeIdx)
      jobId = requestId.slice(pipeIdx + 1)
    }

    // Seedance polls /v1/assets/, everything else polls /v1/videos/.
    const endpoint = ASSET_POLL_MODELS.has(model)
      ? `${BASE}/v1/assets/${encodeURIComponent(jobId)}`
      : `${BASE}/v1/videos/${encodeURIComponent(jobId)}`

    const res = await fetch(endpoint, { headers: authHeaders() })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Arcads poll failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as ArcadsVideoResponse
    const raw = data.status
    const videoUrl = data.videoUrl ?? data.url ?? null

    if (raw === 'completed') return { status: 'completed', videoUrl, raw }
    if (raw === 'failed') return { status: 'failed', videoUrl: null, raw }
    return { status: 'pending', videoUrl: null, raw }
  }

  estimateCost(durationSeconds: number, quality: SubmitOptions['quality']): number {
    const multiplier = quality === 'standard' ? 2.5 : quality === 'turbo' ? 1.5 : 1
    return Math.round(durationSeconds * this.capabilities.costPerSecond * multiplier)
  }
}

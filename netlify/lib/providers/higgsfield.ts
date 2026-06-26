/**
 * HiggsfieldAdapter — image-to-video via platform.higgsfield.ai
 *
 * Auth:   Authorization: Key <KEY_ID>:<KEY_SECRET>
 * Submit: POST /v1/image2video/dop  → { request_id, status }
 * Poll:   GET  /requests/{id}/status → { status, video?: { url } }
 */
import type { VideoProvider, ProviderCapabilities, SubmitOptions, SubmitResult, JobResult } from './types'

const BASE = 'https://platform.higgsfield.ai'

const QUALITY_MODEL = {
  lite: 'dop-lite',
  turbo: 'dop-turbo',
  standard: 'dop-standard',
} as const

function auth(): string {
  const combined = process.env.HF_CREDENTIALS || process.env.HF_KEY
  let key = process.env.HF_API_KEY
  let secret = process.env.HF_API_SECRET
  if (combined?.includes(':')) {
    ;[key, secret] = combined.split(':')
  }
  if (!key || !secret) {
    throw new Error('Missing Higgsfield credentials. Set HF_API_KEY + HF_API_SECRET.')
  }
  return `Key ${key}:${secret}`
}

export class HiggsfieldAdapter implements VideoProvider {
  readonly id = 'higgsfield'

  readonly capabilities: ProviderCapabilities = {
    name: 'Higgsfield DoP',
    qualities: ['lite', 'turbo', 'standard'],
    maxResolution: 1080,
    p50LatencySeconds: 90,
    costPerSecond: 8,
  }

  async submit(opts: SubmitOptions): Promise<SubmitResult> {
    const res = await fetch(`${BASE}/v1/image2video/dop`, {
      method: 'POST',
      headers: { Authorization: auth(), 'content-type': 'application/json' },
      body: JSON.stringify({
        model: QUALITY_MODEL[opts.quality],
        prompt: opts.prompt,
        input_images: [{ type: 'image_url', image_url: opts.imageUrl }],
        enhance_prompt: true,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Higgsfield submit failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as { request_id: string; status: string }
    return { requestId: data.request_id, status: data.status }
  }

  async poll(requestId: string): Promise<JobResult> {
    const res = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, {
      headers: { Authorization: auth() },
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Higgsfield status failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as { status: string; video?: { url: string } }
    const raw = data.status
    if (raw === 'completed') return { status: 'completed', videoUrl: data.video?.url ?? null, raw }
    if (raw === 'failed' || raw === 'nsfw') return { status: 'failed', videoUrl: null, raw }
    return { status: 'pending', videoUrl: null, raw }
  }

  estimateCost(durationSeconds: number, quality: SubmitOptions['quality']): number {
    const multiplier = quality === 'standard' ? 2 : quality === 'turbo' ? 1.4 : 1
    return Math.round(durationSeconds * this.capabilities.costPerSecond * multiplier)
  }
}

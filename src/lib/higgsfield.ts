/**
 * Higgsfield API client — typed wrapper around the Higgsfield queue REST API.
 *
 * Verified against https://docs.higgsfield.ai/docs (the "How to use API" page):
 *   - Base URL:  https://platform.higgsfield.ai   (NOT api.higgsfield.ai)
 *   - Auth:      Authorization: Key {api_key}:{api_key_secret}   (two credentials,
 *                NOT a single Bearer token)
 *   - Submit:    POST /{model_id}                 → { status, request_id, status_url, cancel_url }
 *   - Status:    GET  /requests/{request_id}/status
 *   - Cancel:    POST /requests/{request_id}/cancel   (only while `queued`)
 *   - Webhook:   append ?hf_webhook=<url> to the submit call for push delivery
 *   - Completed result carries `images: [{url}]` (image jobs) or `video: {url}`
 *     (video jobs). Statuses: queued | in_progress | completed | failed | nsfw.
 *
 * Async by design: submit returns a request_id immediately; poll the status URL
 * (or receive a webhook) until a terminal status. This matches the app's existing
 * submit→poll pattern (api/status.ts).
 *
 * Server-side only. Reads credentials from env — never accepts them as arguments,
 * never runs in the browser. Uses global fetch (Node 18+/Vercel runtime).
 */

const BASE_URL = 'https://platform.higgsfield.ai'

/**
 * Server-side env access that type-checks under BOTH the browser tsconfig
 * (no @types/node) and the node tsconfig. This module is imported by Vercel
 * serverless functions where `process.env` is real; client-side it resolves to
 * an empty object and authHeader() throws a clear 503 (no secret is ever
 * embedded in a client bundle — env is undefined there).
 */
const ENV: Record<string, string | undefined> =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

export type HiggsfieldStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'cancelled'

/** Terminal statuses — polling stops here. */
const TERMINAL: HiggsfieldStatus[] = ['completed', 'failed', 'nsfw', 'cancelled']

export interface HiggsfieldSubmitResponse {
  status: HiggsfieldStatus
  request_id: string
  status_url: string
  cancel_url: string
}

export interface HiggsfieldResult {
  status: HiggsfieldStatus
  request_id: string
  status_url?: string
  cancel_url?: string
  /** Present on completed image jobs. */
  images?: Array<{ url: string }>
  /** Present on completed video jobs. */
  video?: { url: string }
  /** Present on `failed`. */
  error?: string
}

/** Typed error — never swallow a non-2xx silently. */
export class HiggsfieldError extends Error {
  statusCode: number
  requestId?: string
  constructor(message: string, statusCode: number, requestId?: string) {
    super(message)
    this.name = 'HiggsfieldError'
    this.statusCode = statusCode
    this.requestId = requestId
  }
}

/**
 * Build the `Key {key}:{secret}` auth header from env. Accepts either separate
 * key/secret vars or a single combined "key:secret" token (matching the Python
 * SDK's HF_KEY / HF_API_KEY+HF_API_SECRET options). Set these in Vercel:
 *   HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET   (preferred), or
 *   HIGGSFIELD_API_TOKEN = "key:secret"          (combined fallback)
 */
function authHeader(): string {
  const key = ENV.HIGGSFIELD_API_KEY
  const secret = ENV.HIGGSFIELD_API_SECRET
  if (key && secret) return `Key ${key}:${secret}`
  const combined = ENV.HIGGSFIELD_API_TOKEN || ENV.HF_KEY
  if (combined && combined.includes(':')) return `Key ${combined}`
  throw new HiggsfieldError(
    'Higgsfield credentials are not set. Add HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET ' +
      '(or a combined HIGGSFIELD_API_TOKEN="key:secret") in Vercel → Settings → Environment Variables.',
    503,
  )
}

function headers(): Record<string, string> {
  return {
    'Authorization': authHeader(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

/**
 * Submit a generation job to a model's queue. `modelId` is a verified slug (see
 * MODELS below), `args` are the model-specific arguments (prompt, aspect_ratio,
 * resolution, image URLs, etc. — these vary per model). Returns the request id
 * to poll. Optionally registers a webhook for push delivery.
 */
export async function submitJob(
  modelId: string,
  args: Record<string, unknown>,
  opts?: { webhookUrl?: string },
): Promise<HiggsfieldSubmitResponse> {
  const url = new URL(`${BASE_URL}/${modelId}`)
  if (opts?.webhookUrl) url.searchParams.set('hf_webhook', opts.webhookUrl)

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new HiggsfieldError(
      `Higgsfield submit failed (${resp.status}) for ${modelId}: ${detail.slice(0, 300)}`,
      resp.status,
    )
  }
  return (await resp.json()) as HiggsfieldSubmitResponse
}

/** Fetch the current status/result of a request. */
export async function getJobStatus(requestId: string): Promise<HiggsfieldResult> {
  const resp = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
    method: 'GET',
    headers: headers(),
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new HiggsfieldError(
      `Higgsfield status fetch failed (${resp.status}): ${detail.slice(0, 300)}`,
      resp.status,
      requestId,
    )
  }
  return (await resp.json()) as HiggsfieldResult
}

/** Cancel a request — only succeeds while it is still `queued` (202 Accepted). */
export async function cancelJob(requestId: string): Promise<boolean> {
  const resp = await fetch(`${BASE_URL}/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: headers(),
  })
  return resp.status === 202
}

/**
 * Poll a request to a terminal status. Kept well under Vercel's 60s function
 * ceiling by default; for long video jobs prefer the webhook path (pass a
 * webhookUrl to submitJob) and let api/status.ts serve the last-known state.
 */
export async function pollJob(
  requestId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onUpdate?: (s: HiggsfieldStatus) => void } = {},
): Promise<HiggsfieldResult> {
  const intervalMs = opts.intervalMs ?? 5_000
  const timeoutMs = opts.timeoutMs ?? 50_000
  const started = Date.now()
  let last: HiggsfieldResult | null = null
  while (Date.now() - started < timeoutMs) {
    last = await getJobStatus(requestId)
    opts.onUpdate?.(last.status)
    if (TERMINAL.includes(last.status)) return last
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return last ?? { status: 'in_progress', request_id: requestId }
}

/** First image URL from a completed image job, or null. */
export function firstImageUrl(result: HiggsfieldResult): string | null {
  return result.images?.[0]?.url ?? null
}

/** Video URL from a completed video job, or null. */
export function videoUrl(result: HiggsfieldResult): string | null {
  return result.video?.url ?? null
}

/**
 * Model registry — the exact `vendor/model/variant` slugs. The queue API keys on
 * these, and their argument schemas differ per model.
 *
 * VERIFIED (from the docs "How to use API" page and the Python client README):
 *   - higgsfield-ai/soul/standard          — Soul character image generation
 *   - bytedance/seedream/v4/text-to-image  — text-to-image
 *
 * The rebuild targets several more models (Soul video, Seedance/Kling video,
 * Nano Banana Pro image, Marketing Studio, background removal, upscale, assembly,
 * dubbing). Their slugs are NOT in the public "How to use API" page and the full
 * model catalog (docs/llms.txt) is access-gated. Do NOT guess them — the rebuild
 * prompt's names (`seedance_2_0`, `nano_banana_pro`, ...) are product labels, not
 * the real `vendor/model/variant` slugs. Fill each from the model's own
 * API-reference page in the Higgsfield dashboard as it's wired, and add it here.
 */
export const MODELS = {
  soulImage: 'higgsfield-ai/soul/standard',
  seedreamTextToImage: 'bytedance/seedream/v4/text-to-image',
  // TODO(catalog): confirm and add — soul video, seedance/kling video,
  // nano-banana image edit, marketing studio, background removal, upscale,
  // assembly, dubbing. Source: Higgsfield dashboard → each model's API reference.
} as const

export type KnownModelId = (typeof MODELS)[keyof typeof MODELS]

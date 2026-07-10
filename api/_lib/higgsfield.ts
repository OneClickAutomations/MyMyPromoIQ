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
 * Resolve the {key, secret} pair from env. Accepts either separate key/secret
 * vars or a single combined "key:secret" token (matching the Python SDK's
 * HF_KEY / HF_API_KEY+HF_API_SECRET options). Set these in Vercel:
 *   HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET   (preferred), or
 *   HIGGSFIELD_API_TOKEN = "key:secret"          (combined fallback)
 */
function credentials(): { key: string; secret: string } {
  const key = ENV.HIGGSFIELD_API_KEY
  // The official skills repo / MCP config uses HIGGSFIELD_SECRET; accept the
  // earlier HIGGSFIELD_API_SECRET spelling too so either env setup works.
  const secret = ENV.HIGGSFIELD_SECRET || ENV.HIGGSFIELD_API_SECRET
  if (key && secret) return { key, secret }
  const combined = ENV.HIGGSFIELD_API_TOKEN || ENV.HF_KEY
  if (combined?.includes(':')) {
    const [k, ...rest] = combined.split(':')
    return { key: k, secret: rest.join(':') }
  }
  throw new HiggsfieldError(
    'Higgsfield credentials are not set. Add HIGGSFIELD_API_KEY and HIGGSFIELD_SECRET ' +
      '(or a combined HIGGSFIELD_API_TOKEN="key:secret") in Vercel → Settings → Environment Variables.',
    503,
  )
}

/**
 * Auth headers. The verified API reference (Soul endpoints) shows two
 * separate headers — `hf-api-key` / `hf-secret` — rather than the single
 * combined `Authorization: Key {key}:{secret}` the original docs page implied.
 * Send both forms: the queue endpoints (submit/status/cancel) were already
 * working against the combined header, so keep it, and add the two-header
 * form the Soul reference confirms — harmless extra headers either way.
 */
function headers(): Record<string, string> {
  const { key, secret } = credentials()
  return {
    'Authorization': `Key ${key}:${secret}`,
    'hf-api-key': key,
    'hf-secret': secret,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

/**
 * fetch with a hard timeout. Node's fetch has NO default timeout, so a request
 * to a slow/missing endpoint (e.g. a model slug not on this account) can hang
 * open until Vercel SIGKILLs the whole function at its 60s ceiling — which
 * surfaces as an unrecoverable FUNCTION_INVOCATION_FAILED instead of a clean,
 * catchable error. Abort well before that so callers always get a real error.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new HiggsfieldError(`Higgsfield request timed out after ${Math.round(timeoutMs / 1000)}s (${url.replace(BASE_URL, '')}).`, 504)
    }
    throw new HiggsfieldError(`Higgsfield request failed: ${e instanceof Error ? e.message : String(e)}`, 502)
  } finally {
    clearTimeout(timer)
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

  const resp = await fetchWithTimeout(url.toString(), {
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

/** Fetch the current status/result of a request.
 *  Accepts either a bare request_id (constructs the generic status URL) or a
 *  full status_url returned by the submit response — DoP and other params-wrapped
 *  endpoints may return a different path than the generic queue pattern. */
export async function getJobStatus(requestIdOrUrl: string): Promise<HiggsfieldResult> {
  const url = requestIdOrUrl.startsWith('http')
    ? requestIdOrUrl
    : `${BASE_URL}/requests/${requestIdOrUrl}/status`
  const resp = await fetchWithTimeout(url, {
    method: 'GET',
    headers: headers(),
  }, 15_000)
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
  const resp = await fetchWithTimeout(`${BASE_URL}/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: headers(),
  }, 10_000)
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
 * Model registry — job slugs from the official `higgsfield-ai/skills` repo.
 *
 * NOTE ON SLUG FORM: the docs "How to use API" page showed `vendor/model/variant`
 * (e.g. `higgsfield-ai/soul/standard`); the skills repo / CLI uses short job
 * slugs (`seedance_2_0`). These are the CLI `job_set_type` values. Whether
 * `POST /{slug}` accepts the short form directly, or needs the vendor-path form,
 * is the ONE thing a first live call on the branch preview confirms — if it
 * needs the long form, only these constants change.
 */
export const MODELS = {
  // ── Image ──
  nanoBanana2: 'nano_banana_2',      // standard character/reference image work
  nanoBananaPro: 'nano_banana_pro',  // harder briefs, product compositing
  // Soul stills do NOT use this flat POST /{slug} pattern — see submitSoulImage()
  // above, which calls the verified `POST /v1/text2image/soul` directly with
  // its params-wrapped body. The 'text2image_soul_v2' slug guessed here
  // earlier was never confirmed and is now known wrong; removed.
  seedreamTextToImage: 'bytedance/seedream/v4/text-to-image', // confirmed vendor-path form
  // ── Video ──
  seedance: 'seedance_2_0',          // default UGC clip model
  kling: 'kling3_0',
  klingTurbo: 'kling3_0_turbo',
  soulCinematic: 'soul_cinematic',   // UNVERIFIED — see SoulVideoArgs note above
  marketingStudioVideo: 'marketing_studio_video', // highest-quality ad path
  // ── Analysis ──
  viralityPredictor: 'brain_activity',
} as const

export type KnownModelId = (typeof MODELS)[keyof typeof MODELS]

/**
 * Marketing Studio modes. Hooks/settings are ONLY valid for the modes listed in
 * MARKETING_MODES_WITH_HOOKS — passing hook_id/setting_id to any other mode is
 * an error, so callers must gate on this.
 */
export const MARKETING_MODES = [
  'ugc', 'ugc_how_to', 'ugc_unboxing', 'product_showcase', 'product_review',
  'tv_spot', 'wild_card', 'ugc_virtual_try_on', 'virtual_try_on',
] as const
export type MarketingMode = (typeof MARKETING_MODES)[number]
export const MARKETING_MODES_WITH_HOOKS: MarketingMode[] = [
  'ugc', 'ugc_how_to', 'ugc_unboxing', 'product_review', 'ugc_virtual_try_on',
]

// ── REST body shapes (snake_case, mapped from the CLI flags). These are the
//    best-verified mapping from the skills-repo flag names; the exact key
//    spelling is confirmed on the first live call and fixed here if it differs.

export interface SeedanceArgs {
  prompt: string
  start_image?: string   // URL or media id (--start-image)
  end_image?: string
  audio?: string
  duration?: 4 | 5 | 8 | 10 | 12 | 15
  resolution?: '720p' | '1080p' | '4k'
  aspect_ratio?: '9:16' | '16:9' | '1:1'
  mode?: 'std'
  bitrate_mode?: 'high'
  generate_audio?: boolean
}

export interface KlingArgs {
  prompt: string
  start_image: string    // REQUIRED for kling3_0
  end_image?: string
  duration?: 5 | 10
  mode?: 'pro' | 'std'
}

export interface NanoBananaArgs {
  prompt: string
  image?: string         // reference image (product or character) — URL or id
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '3:4' | '4:3'
  resolution?: '2k' | '4k'
}

/**
 * UNVERIFIED — no docs page has been seen for `soul_cinematic` (video). Kept as
 * a speculative shape from the skills-repo CLI flags; do not wire a call site
 * against it until confirmed the same way the image Soul API below was.
 */
export interface SoulVideoArgs {
  prompt: string
  soul_id: string        // trained soul reference (--soul-id)
  quality?: '1.5k' | '2k'
  aspect_ratio?: '9:16' | '16:9' | '1:1'
}

/**
 * Soul — stylized image generation, verified against the Higgsfield Soul API
 * Reference (platform.higgsfield.ai docs, `POST /v1/text2image/soul` +
 * `GET /v1/text2image/soul-styles`). NOTE: despite the "soul_id" naming
 * elsewhere in this file, there is NO documented endpoint to train/create a
 * custom identity — Soul is a library of preset visual styles (style_id) you
 * generate with, optionally conditioned on a reference image. It does not do
 * identity training.
 */
export interface SoulStyle {
  id: string
  name: string
  description: string | null
  preview_url: string
}

export interface SoulImageArgs {
  prompt: string
  width_and_height?: '1152x2048' | '2048x1152' | '2048x1536' | '1536x2048' | '1344x2016' | '1536x1536'
  batch_size?: 1 | 4
  enhance_prompt?: boolean
  style_id?: string
  style_strength?: number
  quality?: '720p' | '1080p'
  seed?: number
  image_reference?: { type: 'image_url'; image_url: string }
  /** Reference an already-registered custom reference — no documented
   *  create/list endpoint exists yet, so this stays unset in practice. */
  custom_reference_id?: string
  custom_reference_strength?: number
}

/** `GET /v1/text2image/soul-styles` — the preset style catalog for a picker UI. */
export async function getSoulStyles(): Promise<SoulStyle[]> {
  const resp = await fetchWithTimeout(`${BASE_URL}/v1/text2image/soul-styles`, { method: 'GET', headers: headers() }, 15_000)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new HiggsfieldError(`Could not load Soul styles (${resp.status}): ${detail.slice(0, 300)}`, resp.status)
  }
  return (await resp.json()) as SoulStyle[]
}

/**
 * Submit to one of the `params`-wrapped endpoints (Soul, DoP). Unlike the flat
 * queue models (`submitJob`), these take `{ params: {...}, webhook }`. Both the
 * Soul image API and the DoP video API (verified docs) use this exact shape.
 */
async function submitParamsJob(
  path: string,
  params: Record<string, unknown>,
  label: string,
  opts?: { webhookUrl?: string },
): Promise<HiggsfieldSubmitResponse> {
  const resp = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ params, webhook: opts?.webhookUrl ?? null }),
  }, 20_000)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new HiggsfieldError(`Higgsfield ${label} submit failed (${resp.status}): ${detail.slice(0, 300)}`, resp.status)
  }
  return (await resp.json()) as HiggsfieldSubmitResponse
}

/** `POST /v1/text2image/soul` — stylized image generation. */
export function submitSoulImage(args: SoulImageArgs, opts?: { webhookUrl?: string }): Promise<HiggsfieldSubmitResponse> {
  return submitParamsJob('/v1/text2image/soul', args as unknown as Record<string, unknown>, 'Soul', opts)
}

// ── DoP — image-to-video, verified against the DoP API Reference (user PDF).
//    `POST /v1/image2video/dop` with a params-wrapped body. `model` selects the
//    tier (dop-lite / dop-standard / dop-turbo — the three on this account).
//    `input_images` is the first frame; `input_images_end` (optional) the last
//    frame for the first-last-frame variants. Same submit→poll→status contract.

export type DopModel = 'dop-lite' | 'dop-standard' | 'dop-turbo'
export interface DopImageRef { type: 'image_url'; image_url: string }
export interface DopArgs {
  prompt: string
  model?: DopModel
  seed?: number
  /** Motion ids from getDopMotions(); [] = no forced motion. */
  motions?: string[]
  check_nsfw?: boolean
  enhance_prompt?: boolean
  /** First frame (image-to-video conditioning). */
  input_images?: DopImageRef[]
  /** Last frame — only for the first-last-frame variants. */
  input_images_end?: DopImageRef[]
}
export interface DopMotion { id: string; name?: string; [k: string]: unknown }

/** `GET /v1/motions` — the DoP motion catalog (ids for DopArgs.motions). */
export async function getDopMotions(): Promise<DopMotion[]> {
  const resp = await fetchWithTimeout(`${BASE_URL}/v1/motions`, { method: 'GET', headers: headers() }, 15_000)
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new HiggsfieldError(`Could not load DoP motions (${resp.status}): ${detail.slice(0, 300)}`, resp.status)
  }
  return (await resp.json()) as DopMotion[]
}

/** `POST /v1/image2video/dop` — submit a DoP image-to-video job. */
export function submitDopVideo(args: DopArgs, opts?: { webhookUrl?: string }): Promise<HiggsfieldSubmitResponse> {
  const { motions, ...rest } = args
  const params: Record<string, unknown> = {
    model: 'dop-lite',
    check_nsfw: true,
    enhance_prompt: true,
    ...rest,
  }
  // DoP rejects motions:[] (422) — only include the field when at least one id is provided.
  if (motions && motions.length > 0) params.motions = motions
  return submitParamsJob('/v1/image2video/dop', params, 'DoP', opts)
}

export interface MarketingStudioArgs {
  prompt: string
  mode: MarketingMode
  product_ids?: string[]                       // ["<product_id>"]
  avatars?: Array<{ id: string; type: 'preset' }>
  url?: string                                 // fetch product from URL (skips create)
  duration?: number
  resolution?: '480p' | '720p'
  aspect_ratio?: '9:16' | '16:9' | '1:1'
  generate_audio?: boolean
  hook_id?: string                             // only for MARKETING_MODES_WITH_HOOKS
  setting_id?: string                          // only for MARKETING_MODES_WITH_HOOKS
}

/**
 * Workflow operations (background removal, upscale, assemble, dubbing,
 * voice-change) are CLI `generate workflow …` commands. Their REST endpoint
 * shape is not in the public API page and the CLI abstracts it, so wire these
 * only after confirming the workflow REST route from the dashboard / a live
 * call. Left unimplemented deliberately rather than guessed.
 */


/**
 * Client-side API layer.
 *
 * Upload path (new):
 *   presignUpload()          → asks /api/presign for a signed Supabase URL
 *   uploadDirectToStorage()  → PUT the file straight to Supabase (bypasses Netlify)
 *
 * Generation path (new):
 *   startGeneration()        → POST /api/generate  (unchanged)
 *   pollSceneUntilDone()     → queries the Supabase `scenes` row directly;
 *                              zero Netlify function calls while waiting
 *   pollUntilDone()          → legacy /api/status fallback (used when Supabase
 *                              DB is unavailable)
 *
 * Secret keys never appear here — they live in Netlify functions only.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// ── Types ──────────────────────────────────────────────────────────────────────

export type GenerateInput = {
  productImageUrl: string
  productDescription: string
  style: string
  quality: string
  /** Composition Engine's compiled prompt — carries cast identity + scale. */
  composedPrompt?: string
  negativePrompt?: string
  brandVoice?: string
  brandTaglines?: string[]
  brandCta?: string
  /** Scene focus label (Hook, Problem, Solution, etc.) for multi-scene generation. */
  sceneLabel?: string
  /** Spoken script line — Claude writes it verbatim into the Veo prompt with delivery direction. */
  script?: string
  /** "Bring Your Own Creator" — an uploaded/transformed creator photo. Takes
   *  priority over productImageUrl as Veo's single identity reference. */
  creatorImageUrl?: string
  /** ISO timestamp of the likeness-use consent acknowledgment. Required
   *  server-side whenever creatorImageUrl is set. */
  creatorConsentAt?: string
  /** Turnaround sheet (preferred) or hero photo — shown to Claude as a vision
   *  reference so the written product description matches reality. */
  productReferenceImageUrl?: string
}

export type GenerateResponse = {
  requestId: string
  status: string
  directorPrompt: string
}

export type StatusResponse = {
  status: 'pending' | 'completed' | 'failed'
  videoUrl: string | null
  raw: string
}

export type PresignResponse = {
  signedUrl: string
  token: string
  path: string
  publicUrl: string
}

// ── Persistence (server-side via service key, bypasses RLS) ──────────────────────

export type StoredCampaign = {
  id: string
  user_id: string
  name: string
  product_image_url: string | null
  product_description: string | null
  style: string | null
  quality: string
  status: string
  created_at: string
  updated_at: string
}

export type StoredScene = {
  id: string
  campaign_id: string
  label: string
  style: string
  order_index: number
  phase: string
  request_id: string | null
  director_prompt: string | null
  video_url: string | null
  error_message: string | null
}

async function store<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/store', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export function saveCampaign(userId: string, campaign: Partial<StoredCampaign>): Promise<{ id: string }> {
  return store({ action: 'saveCampaign', userId, campaign })
}

export function saveScene(userId: string, scene: Partial<StoredScene> & { campaign_id: string }): Promise<{ id: string }> {
  return store({ action: 'saveScene', userId, scene })
}

export function getCampaign(userId: string, campaignId: string): Promise<{ campaign: StoredCampaign | null; scenes: StoredScene[] }> {
  return store({ action: 'get', userId, campaignId })
}

export function listCampaigns(userId: string): Promise<{ campaigns: StoredCampaign[]; videos: Record<string, string>; videoCount: number }> {
  return store({ action: 'list', userId })
}

export function deleteCampaignRemote(userId: string, campaignId: string): Promise<{ ok: boolean }> {
  return store({ action: 'delete', userId, campaignId })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function readError(res: Response): Promise<string> {
  // Read the body once as text, then try to parse it as JSON. This lets us
  // surface the *real* server error even when Vercel returns a non-JSON
  // page (e.g. a platform 500 / FUNCTION_INVOCATION_TIMEOUT), instead of a
  // useless generic "Request failed (500)".
  const text = await res.text().catch(() => '')
  try {
    const data = JSON.parse(text)
    if (data?.error) return data.error
  } catch {
    // not JSON — fall through and surface the raw text
  }
  const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
  return snippet
    ? `Request failed (${res.status}): ${snippet}`
    : `Request failed (${res.status})`
}

/**
 * Convert a data URL (e.g. from FileReader or a camera capture) to a Blob
 * suitable for a direct storage upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

// ── Upload ─────────────────────────────────────────────────────────────────────

/**
 * Ask the server to mint a one-time signed upload URL.
 * The server uses SUPABASE_SERVICE_KEY — the key never reaches the browser.
 */
export async function presignUpload(mimeType: string): Promise<PresignResponse> {
  const res = await fetch('/api/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mimeType }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

/**
 * Upload a file (File | Blob) directly to Supabase Storage using the signed
 * URL obtained from presignUpload(). The file data travels browser → Supabase
 * and never passes through a Netlify function.
 */
export async function uploadDirectToStorage(
  path: string,
  token: string,
  file: Blob,
  mimeType: string,
): Promise<void> {
  const uploadUrl =
    `${SUPABASE_URL}/storage/v1/object/upload/sign/product-images/${path}?token=${encodeURIComponent(token)}`

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: file,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Storage upload failed (${res.status})${detail ? ': ' + detail.slice(0, 200) : ''}`)
  }
}

/**
 * One-shot upload: presign → PUT to Supabase → return the public https URL.
 * Accepts a File/Blob or a data: URL (generated images come back as data URLs,
 * so this is how we turn a generated seed image into a durable hosted asset).
 */
export async function uploadAsset(input: Blob | string): Promise<string> {
  const blob = typeof input === 'string' ? dataUrlToBlob(input) : input
  const mimeType = blob.type || 'image/png'
  const { token, path, publicUrl } = await presignUpload(mimeType)
  await uploadDirectToStorage(path, token, blob, mimeType)
  return publicUrl
}

// ── Product URL extraction ─────────────────────────────────────────────────────

export type ProductExtract = {
  title: string | null
  description: string | null
  imageUrl: string | null
}

/** Scrape a product page URL and return title, description, and hero image. */
export async function extractProductFromUrl(pageUrl: string): Promise<ProductExtract> {
  const res = await fetch('/api/sourcing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productUrl: pageUrl }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ── Generation ─────────────────────────────────────────────────────────────────

export async function startGeneration(input: GenerateInput): Promise<GenerateResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ── Voiceover (ElevenLabs) ──────────────────────────────────────────────────────

export type ElevenVoice = {
  voiceId: string
  name: string
  category: string
  previewUrl?: string
  gender?: string
  accent?: string
  description?: string
  useCase?: string
}

export async function listVoices(): Promise<{ voices: ElevenVoice[] }> {
  // Voice listing is the GET side of /api/voiceover (merged from /api/voices to
  // stay under Vercel's 12-function Hobby limit).
  const res = await fetch('/api/voiceover')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export type VoiceoverInput = {
  text: string
  voiceId: string
  modelId?: string
  stability?: number
  similarityBoost?: number
  style?: number
  speed?: number
}

export async function generateVoiceover(input: VoiceoverInput): Promise<{ audioDataUrl: string; bytes: number }> {
  const res = await fetch('/api/voiceover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

/** Stitch 2–6 silent video URLs into one concatenated MP4. */
export async function stitchVideos(videoUrls: string[]): Promise<{ videoDataUrl: string; bytes: number; clips: number }> {
  const res = await fetch('/api/stitch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ videoUrls }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

/** Combine a silent video URL + voiceover audio into one MP4 with sound. */
export async function muxVideoAudio(input: { videoUrl: string; audioBase64: string }): Promise<{ videoDataUrl: string; bytes: number }> {
  const res = await fetch('/api/mux', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ── Model sheet / turnaround (Gemini image) ─────────────────────────────────────

export type ModelSheetInput = {
  imageUrl?: string
  imageBase64?: string
  mimeType?: string
  subjectType: 'product' | 'character'
  subjectHint?: string
}

/** Turn one reference photo into a 2x3 multi-angle turnaround model sheet. */
export async function generateModelSheet(input: ModelSheetInput): Promise<{ sheetDataUrl: string; subject: string; prompt: string }> {
  const res = await fetch('/api/modelsheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export type ImageGenInput = {
  /** 'generate' = from text only; 'edit' = transform the supplied reference image. */
  mode: 'generate' | 'edit'
  subjectType: 'product' | 'character'
  /** The instruction (edit) or description (generate). */
  editPrompt: string
  /** Reference image for edit mode (one of these). */
  imageUrl?: string
  imageBase64?: string
  mimeType?: string
}

/**
 * Generate or edit a seed image via Gemini ("nano-banana"). Used by the Creator
 * and Product studios to produce/refine a reference image before video.
 * Returns the result as a data URL.
 */
export async function generateImage(input: ImageGenInput): Promise<{ imageDataUrl: string; prompt: string }> {
  const res = await fetch('/api/modelsheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ── Polling ────────────────────────────────────────────────────────────────────

type SceneRow = {
  phase: string
  video_url: string | null
  error_message: string | null
} | null

/**
 * Poll the Supabase `scenes` row directly (via the authenticated browser client)
 * until the background watcher writes a terminal phase ('done' | 'error').
 *
 * This replaces the old /api/status polling loop and generates zero Netlify
 * function invocations while waiting for the render to finish.
 */
export async function pollSceneUntilDone(
  fetchScene: () => Promise<SceneRow>,
  onTick: () => void,
  { intervalMs = 5_000, timeoutMs = 12 * 60 * 1_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<StatusResponse> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs))
    onTick()

    try {
      const row = await fetchScene()
      if (row?.phase === 'done' && row.video_url) {
        return { status: 'completed', videoUrl: row.video_url, raw: 'done' }
      }
      if (row?.phase === 'error') {
        return { status: 'failed', videoUrl: null, raw: row.error_message || 'failed' }
      }
    } catch {
      // Transient Supabase query error — keep polling
    }
  }

  return { status: 'failed', videoUrl: null, raw: 'timeout' }
}

/**
 * Legacy: poll /api/status until done. Used as a fallback when Supabase DB is
 * unavailable and pollSceneUntilDone cannot be used.
 */
export async function checkStatus(requestId: string): Promise<StatusResponse> {
  const res = await fetch(`/api/status?id=${encodeURIComponent(requestId)}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function pollUntilDone(
  requestId: string,
  onTick: (s: StatusResponse) => void,
  { intervalMs = 5_000, timeoutMs = 10 * 60 * 1_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<StatusResponse> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const s = await checkStatus(requestId)
    onTick(s)
    if (s.status === 'completed' || s.status === 'failed') return s
    if (Date.now() > deadline) return { status: 'failed', videoUrl: null, raw: 'timeout' }
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

// ── Creative Brief persistence ────────────────────────────────────────────────

export type DirectorLogEntry = {
  timestamp: string
  stage: 'analyzing' | 'casting' | 'scripting' | 'storyboarding' | 'rendering'
  message: string
}

export function saveBrief(
  userId: string,
  brief: Record<string, unknown>,
): Promise<{ id: string }> {
  return store({ action: 'saveBrief', userId, brief })
}

export function getBrief(
  userId: string,
  briefId: string,
): Promise<{ brief: Record<string, unknown> | null }> {
  return store({ action: 'getBrief', userId, briefId })
}

export type StoredBriefSummary = {
  id: string
  status: string
  product: Record<string, unknown>
  style: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function listBriefs(
  userId: string,
): Promise<{ briefs: StoredBriefSummary[] }> {
  return store({ action: 'listBriefs', userId })
}

// ── Creative Studio asset types ───────────────────────────────────────────────

export type StoredCreator = {
  id: string
  user_id: string
  name: string
  mode: 'generated' | 'uploaded_seed'
  attributes: Record<string, unknown>
  seed_images: { url: string; label?: string }[]
  created_at: string
  updated_at: string
}

export type StoredProduct = {
  id: string
  user_id: string
  name: string
  brand: string | null
  category: string | null
  primary_image_url: string | null
  images: { url: string; label?: string }[]
  description: string | null
  features: string[]
  benefits: string[]
  target_audience: string | null
  logo_url: string | null
  colors: string[]
  default_prompt: string | null
  created_at: string
  updated_at: string
}

export type StoredBrand = {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  primary_colors: string[]
  secondary_colors: string[]
  brand_voice: string | null
  taglines: string[]
  target_audience: string | null
  industry: string | null
  brand_guidelines: string | null
  cta_preferences: string | null
  created_at: string
  updated_at: string
}

export function saveCreator(userId: string, creator: Partial<StoredCreator> & { id?: string }): Promise<{ id: string }> {
  return store({ action: 'saveCreator', userId, creator })
}

export function listCreators(userId: string): Promise<{ creators: StoredCreator[] }> {
  return store({ action: 'listCreators', userId })
}

export function deleteCreator(userId: string, creatorId: string): Promise<{ ok: boolean }> {
  return store({ action: 'deleteCreator', userId, creatorId })
}

export function saveProduct(userId: string, product: Partial<StoredProduct> & { id?: string }): Promise<{ id: string }> {
  return store({ action: 'saveProduct', userId, product })
}

export function listProducts(userId: string): Promise<{ products: StoredProduct[] }> {
  return store({ action: 'listProducts', userId })
}

export function deleteProduct(userId: string, productId: string): Promise<{ ok: boolean }> {
  return store({ action: 'deleteProduct', userId, productId })
}

export function saveBrand(userId: string, brand: Partial<StoredBrand> & { id?: string }): Promise<{ id: string }> {
  return store({ action: 'saveBrand', userId, brand })
}

export function getBrand(userId: string): Promise<{ brand: StoredBrand | null }> {
  return store({ action: 'getBrand', userId })
}

// ── Director feed ─────────────────────────────────────────────────────────────

export async function runDirector(params: {
  productName: string
  description: string
  style: string
  creatorMode?: string
  energyLevel?: string
}): Promise<{ log: DirectorLogEntry[] }> {
  const res = await fetch('/api/director', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ── Storyboard planning (rides on /api/director) ──────────────────────────────

export type StoryboardPlanInput = {
  productName: string
  description: string
  style: string
  /** Desired clip count (1–10). Omit to let Claude infer. */
  clipCount?: number
  /** Clone mode: the reference ad's beat labels + total seconds, to match pacing. */
  referenceBeats?: string[]
  referenceDurationSeconds?: number
  brandVoice?: string
  cta?: string
}

export async function planStoryboard(input: StoryboardPlanInput): Promise<{ plan: import('./studio/storyboard').StoryboardPlan }> {
  const res = await fetch('/api/director', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'storyboard', ...input }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

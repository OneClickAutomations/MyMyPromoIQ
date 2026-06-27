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

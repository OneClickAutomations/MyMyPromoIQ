/**
 * Thin client for the generation API. Talks to the Netlify functions via the
 * /api/* redirects in netlify.toml. No keys here — everything secret stays
 * server-side in the functions.
 */
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

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/**
 * Upload a local image (data URL) to Supabase Storage via the /api/upload
 * Netlify function. Returns the public URL for use with startGeneration.
 * Throws if the server returns an error (e.g. SUPABASE_SERVICE_KEY not set).
 */
export async function uploadProductImage(imageDataUrl: string): Promise<string> {
  const mimeType = imageDataUrl.startsWith('data:image/png')
    ? 'image/png'
    : imageDataUrl.startsWith('data:image/webp')
      ? 'image/webp'
      : 'image/jpeg'

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageData: imageDataUrl, mimeType }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || 'Upload failed')
  }
  const { url } = await res.json()
  return url as string
}

export async function startGeneration(input: GenerateInput): Promise<GenerateResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function checkStatus(requestId: string): Promise<StatusResponse> {
  const res = await fetch(`/api/status?id=${encodeURIComponent(requestId)}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

/**
 * Poll until the render finishes, fails, or times out.
 * Calls onTick on every poll so the UI can show progress.
 */
export async function pollUntilDone(
  requestId: string,
  onTick: (s: StatusResponse) => void,
  { intervalMs = 4000, timeoutMs = 5 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<StatusResponse> {
  const deadline = Date.now() + timeoutMs
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const s = await checkStatus(requestId)
    onTick(s)
    if (s.status === 'completed' || s.status === 'failed') return s
    if (Date.now() > deadline) {
      return { status: 'failed', videoUrl: null, raw: 'timeout' }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/**
 * AWS Lambda — video stitcher (offloads ffmpeg concat off Vercel).
 *
 * Why: Vercel Hobby functions have tight execution-time / memory / payload
 * limits, so stitching many/large clips into a long ad times out there. Lambda
 * gives you up to 15 min, up to 10 GB RAM, and up to 10 GB of /tmp — plenty for
 * a 30–60s multi-clip ad. This is the same "render in Lambda" pattern used in
 * MyMotionIQ.
 *
 * Contract (matches the app's /api/stitch so it's a drop-in):
 *   POST { videoUrls: string[], action?: 'stitch' }
 *   →   { videoUrl, bytes, clips }        // videoUrl is a public Supabase URL
 *
 * The clips must already be hosted (the client uploads data: clips to Supabase
 * first), so this only receives https URLs. It downloads them to /tmp, runs the
 * ffmpeg concat demuxer (stream-copy first, re-encode fallback), uploads the
 * result back to Supabase, and returns the public URL.
 *
 * Security: set ALLOWED_URL_PREFIX to your Supabase storage origin so this can
 * only ever fetch YOUR clips (blocks SSRF abuse of a public Function URL). An
 * optional STITCH_SHARED_SECRET adds a bearer check.
 *
 * Env vars (Lambda → Configuration → Environment variables):
 *   SUPABASE_URL           e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY   service-role key (server-only; never shipped to the browser)
 *   SUPABASE_BUCKET        default: product-images
 *   ALLOWED_URL_PREFIX     e.g. https://xxxx.supabase.co/storage/v1/object/public/
 *   STITCH_SHARED_SECRET   optional; if set, callers must send it (see below)
 *   FFMPEG_PATH            optional; defaults to a bundled/layer ffmpeg (see README)
 */
import { spawn } from 'node:child_process'
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const FFMPEG = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg' // /opt/bin = Lambda layer
const BUCKET = process.env.SUPABASE_BUCKET || 'product-images'

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args)
    let stderr = ''
    p.stderr.on('data', d => { stderr += d.toString() })
    p.on('error', reject)
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`))))
  })
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      // CORS — required for a browser to call the Function URL directly.
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-stitch-secret',
      'access-control-allow-methods': 'POST,OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

export const handler = async (event) => {
  // CORS preflight.
  const method = event?.requestContext?.http?.method || event?.httpMethod
  if (method === 'OPTIONS') return json(204, {})

  try {
    const secret = process.env.STITCH_SHARED_SECRET
    if (secret) {
      const sent = event?.headers?.['x-stitch-secret'] || event?.headers?.['X-Stitch-Secret']
      if (sent !== secret) return json(401, { error: 'Unauthorized' })
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
    const videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls : []
    if (videoUrls.length < 2) return json(400, { error: 'Provide at least 2 hosted video URLs to stitch.' })

    const allowed = process.env.ALLOWED_URL_PREFIX
    if (allowed && !videoUrls.every(u => typeof u === 'string' && u.startsWith(allowed))) {
      return json(400, { error: 'A clip URL is outside the allowed origin.' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !serviceKey) return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured on the Lambda.' })

    const dir = await mkdtemp(join(tmpdir(), 'stitch-'))
    try {
      // 1. Download every clip to /tmp.
      const localPaths = []
      for (let i = 0; i < videoUrls.length; i++) {
        const r = await fetch(videoUrls[i])
        if (!r.ok) throw new Error(`Could not fetch clip ${i + 1} (${r.status}).`)
        const p = join(dir, `clip-${String(i).padStart(3, '0')}.mp4`)
        await writeFile(p, Buffer.from(await r.arrayBuffer()))
        localPaths.push(p)
      }

      // 2. ffmpeg concat demuxer list file.
      const listPath = join(dir, 'list.txt')
      await writeFile(listPath, localPaths.map(p => `file '${p}'`).join('\n'))
      const outPath = join(dir, 'out.mp4')

      // 3. Fast path: stream-copy concat (no re-encode). If the clips differ in
      //    codec/params it can fail — fall back to a uniform re-encode.
      try {
        await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outPath])
      } catch {
        await run(FFMPEG, [
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath,
        ])
      }

      // 4. Upload the stitched result back to Supabase; return its public URL.
      const out = await readFile(outPath)
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 524_288_000 }).catch(() => {})
      const path = `stitched/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
      const { error } = await supabase.storage.from(BUCKET).upload(path, out, { contentType: 'video/mp4', upsert: true })
      if (error) throw new Error(`Upload failed: ${error.message}`)
      const videoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

      return json(200, { videoUrl, bytes: out.length, clips: videoUrls.length })
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (err) {
    console.error('[stitch]', err)
    return json(502, { error: err instanceof Error ? err.message : 'Stitch failed.' })
  }
}

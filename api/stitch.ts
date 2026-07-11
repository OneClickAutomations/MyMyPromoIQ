/**
 * POST /api/stitch
 * Body: { videoUrls: string[] }   — 2–6 public https:// video URLs (Higgsfield CDN)
 *
 * Concatenates multiple silent video clips into one MP4 using ffmpeg's concat
 * demuxer. Returns the result as a base64 data URL.
 *
 * Self-contained: no cross-directory relative imports.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
// CJS default export types as a module namespace under Node16 resolution; at
// runtime it's the ffmpeg binary path string (or null), so narrow it here.
import ffmpegStatic from 'ffmpeg-static'
const ffmpegPath = ffmpegStatic as unknown as string | null

const MAX_CLIPS = 6
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`))
    })
  })
}

/**
 * Extract the LAST FRAME of a rendered clip as a JPEG data URL. Used to chain
 * multi-scene generation: scene N+1's image-to-video conditioning frame is
 * scene N's last frame (not the original product photo), so the creator/
 * environment/pose carries forward continuously instead of every scene
 * snapping back to the same static product shot when stitched together.
 */
async function extractLastFrame(videoUrl: string, res: VercelResponse) {
  if (!ffmpegPath) return res.status(503).json({ error: 'ffmpeg binary unavailable.' })
  const id = randomUUID()
  const inPath = join(tmpdir(), `${id}-in.mp4`)
  const outPath = join(tmpdir(), `${id}-frame.jpg`)
  const cleanup = () => Promise.all([unlink(inPath).catch(() => {}), unlink(outPath).catch(() => {})])
  try {
    let vbuf: Buffer
    if (/^data:/i.test(videoUrl)) {
      const b64 = videoUrl.includes(',') ? videoUrl.split(',')[1] : ''
      vbuf = Buffer.from(b64, 'base64')
    } else {
      const resp = await fetch(videoUrl)
      if (!resp.ok) throw new Error(`Could not fetch the video (${resp.status}).`)
      vbuf = Buffer.from(await resp.arrayBuffer())
    }
    await writeFile(inPath, vbuf)
    // -sseof -0.2: seek to 0.2s before end (a hair earlier than the exact
    // last frame — the very last frame of some codecs is a black/blank
    // flush frame). -update 1 -frames:v 1 grabs a single still.
    await run(ffmpegPath, ['-y', '-sseof', '-0.2', '-i', inPath, '-update', '1', '-frames:v', '1', '-q:v', '2', outPath])
    const frame = await readFile(outPath)
    await cleanup()
    return res.status(200).json({ imageDataUrl: `data:image/jpeg;base64,${frame.toString('base64')}` })
  } catch (err) {
    await cleanup()
    console.error('[/api/stitch extractLastFrame]', err)
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Frame extraction failed.' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ffmpegPath) return res.status(503).json({ error: 'ffmpeg binary unavailable.' })

  const body = (req.body ?? {}) as Record<string, unknown>
  if (body.action === 'extractLastFrame') {
    if (typeof body.videoUrl !== 'string') return res.status(400).json({ error: 'videoUrl is required.' })
    return extractLastFrame(body.videoUrl, res)
  }

  const { videoUrls } = (req.body ?? {}) as { videoUrls?: unknown }
  if (!Array.isArray(videoUrls) || videoUrls.length < 2 || videoUrls.length > MAX_CLIPS) {
    return res.status(400).json({ error: `Provide 2–${MAX_CLIPS} video URLs.` })
  }
  // Clips are either hosted https:// URLs (silent Veo renders) OR inline
  // data:video/... base64 URLs (clips that had a voiceover muxed in — that's
  // the common case when a voice is selected). Both are valid here; rejecting
  // data: URLs is exactly what made assembly fail whenever a voice was picked.
  if (videoUrls.some((u: unknown) => typeof u !== 'string' || !/^(https?:\/\/|data:)/i.test(u))) {
    return res.status(400).json({ error: 'All entries must be https:// or data: video URLs.' })
  }

  const id = randomUUID()
  const dir = join(tmpdir(), `${id}-clips`)
  const listPath = join(tmpdir(), `${id}-list.txt`)
  const outPath  = join(tmpdir(), `${id}-stitched.mp4`)

  const cleanup = () => Promise.all([
    rm(dir, { recursive: true, force: true }),
    unlink(listPath).catch(() => {}),
    unlink(outPath).catch(() => {}),
  ])

  try {
    await mkdir(dir, { recursive: true })

    // Download all clips IN PARALLEL — Vercel Hobby's maxDuration is a hard 60s
    // ceiling (can't be raised without a paid plan), and the old sequential
    // for-loop burned a large chunk of that budget just waiting on network I/O
    // before ffmpeg ever started. This is the fix for the 504
    // FUNCTION_INVOCATION_TIMEOUT, not a bigger timeout — there isn't one.
    const clipPaths = await Promise.all(videoUrls.map(async (url, i) => {
      let vbuf: Buffer
      if (/^data:/i.test(url as string)) {
        // Decode inline base64 directly — Node's fetch doesn't reliably read
        // large data: URLs, and there's no network round-trip to make anyway.
        const b64 = (url as string).includes(',') ? (url as string).split(',')[1] : ''
        vbuf = Buffer.from(b64, 'base64')
        if (!vbuf.length) throw new Error(`Clip ${i + 1} is an empty data URL.`)
      } else {
        const vresp = await fetch(url as string)
        if (!vresp.ok) throw new Error(`Could not fetch clip ${i + 1} (${vresp.status}).`)
        vbuf = Buffer.from(await vresp.arrayBuffer())
      }
      if (vbuf.length > MAX_VIDEO_BYTES) throw new Error(`Clip ${i + 1} exceeds 80 MB.`)
      const p = join(dir, `clip${String(i).padStart(2, '0')}.mp4`)
      await writeFile(p, vbuf)
      return p
    }))

    // Build concat list (ffmpeg concat demuxer format)
    await writeFile(listPath, clipPaths.map(p => `file '${p}'`).join('\n'))

    // Fast path: stream-copy concat — no re-encode, just remuxing. Takes
    // roughly a second regardless of clip count. Works whenever all clips
    // share codec/resolution/pixel format, which Veo-rendered clips always do
    // (same aspectRatio, same model). Also the only path that PRESERVES
    // Veo's native audio track — the old code discarded audio unconditionally.
    try {
      await run(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        outPath,
      ])
    } catch {
      // Fallback: clips don't match (mixed sources/resolutions) — re-encode.
      // ultrafast trades file size for speed; it's the only preset with real
      // margin under a hard 60s wall once download + startup time is spent.
      console.warn('[/api/stitch] stream-copy failed, falling back to re-encode')
      await run(ffmpegPath, [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        outPath,
      ])
    }

    const out = await readFile(outPath)
    const dataUrl = `data:video/mp4;base64,${out.toString('base64')}`
    await cleanup()
    return res.status(200).json({ videoDataUrl: dataUrl, bytes: out.length, clips: videoUrls.length })
  } catch (err) {
    await cleanup()
    console.error('[/api/stitch]', err)
    const message = err instanceof Error ? err.message : 'Stitching failed.'
    return res.status(502).json({ error: message })
  }
}

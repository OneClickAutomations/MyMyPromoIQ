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
import ffmpegPath from 'ffmpeg-static'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ffmpegPath) return res.status(503).json({ error: 'ffmpeg binary unavailable.' })

  const { videoUrls } = (req.body ?? {}) as { videoUrls?: unknown }
  if (!Array.isArray(videoUrls) || videoUrls.length < 2 || videoUrls.length > MAX_CLIPS) {
    return res.status(400).json({ error: `Provide 2–${MAX_CLIPS} video URLs.` })
  }
  if (videoUrls.some((u: unknown) => typeof u !== 'string' || !/^https?:\/\//i.test(u))) {
    return res.status(400).json({ error: 'All entries must be valid https:// URLs.' })
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

    // Download all clips
    const clipPaths: string[] = []
    for (let i = 0; i < videoUrls.length; i++) {
      const vresp = await fetch(videoUrls[i] as string)
      if (!vresp.ok) throw new Error(`Could not fetch clip ${i + 1} (${vresp.status}).`)
      const vbuf = Buffer.from(await vresp.arrayBuffer())
      if (vbuf.length > MAX_VIDEO_BYTES) throw new Error(`Clip ${i + 1} exceeds 80 MB.`)
      const p = join(dir, `clip${String(i).padStart(2, '0')}.mp4`)
      await writeFile(p, vbuf)
      clipPaths.push(p)
    }

    // Build concat list (ffmpeg concat demuxer format)
    await writeFile(listPath, clipPaths.map(p => `file '${p}'`).join('\n'))

    // Concat: re-encode to ensure consistent codec/resolution across clips.
    // scale2ref + pad normalizes any resolution mismatches to 1080×1920 (9:16).
    await run(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-an',
      '-movflags', '+faststart',
      outPath,
    ])

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

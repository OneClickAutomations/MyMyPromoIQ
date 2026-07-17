/**
 * POST /api/mux
 * Body: { videoUrl, audioBase64 }  (audioBase64 may be a data: URL)
 *
 * Combines the silent Higgsfield render with the ElevenLabs voiceover into ONE
 * downloadable MP4 with sound. Returns the muxed file as a base64 data URL.
 *
 * Runs ffmpeg (ffmpeg-static binary, bundled via vercel.json includeFiles) on the
 * function's writable /tmp. Self-contained: no cross-directory imports.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
// ffmpeg-static exports the path to a prebuilt ffmpeg binary (or null). Its CJS
// default export types as a module namespace under Node16 resolution; at
// runtime it's the string path, so narrow it here.
import ffmpegStatic from 'ffmpeg-static'
const ffmpegPath = ffmpegStatic as unknown as string | null

const MAX_VIDEO_BYTES = 80 * 1024 * 1024 // 80 MB guard

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!ffmpegPath) {
    return res.status(503).json({ error: 'ffmpeg binary unavailable in this environment.' })
  }

  const { videoUrl, audioBase64, mixMode, overlayVolume } = (req.body ?? {}) as Record<string, string>
  // data: URLs are accepted too — the stitched final ad comes back from
  // /api/stitch as a data URL, and Node's fetch reads data: URLs natively.
  if (!videoUrl || !/^(https?:\/\/|data:video\/)/i.test(videoUrl)) {
    return res.status(400).json({ error: 'A valid video URL is required.' })
  }
  if (!audioBase64) {
    return res.status(400).json({ error: 'Voiceover audio is required.' })
  }
  // 'replace' (default): the provided track becomes the video's audio.
  // 'mix': the provided track is layered UNDER the video's existing audio at
  // reduced volume — the background-music path (voice/native audio stays).
  const mix = mixMode === 'mix'
  const bedVolume = Math.min(1, Math.max(0.05, Number(overlayVolume) || 0.35))

  const id = randomUUID()
  const videoPath = join(tmpdir(), `${id}-v.mp4`)
  const audioPath = join(tmpdir(), `${id}-a.mp3`)
  const outPath = join(tmpdir(), `${id}-out.mp4`)
  const cleanup = () => Promise.all([unlink(videoPath), unlink(audioPath), unlink(outPath)].map(p => p.catch(() => {})))

  try {
    // 1. Download the silent video.
    const vresp = await fetch(videoUrl)
    if (!vresp.ok) throw new Error(`Could not fetch video (${vresp.status}).`)
    const vbuf = Buffer.from(await vresp.arrayBuffer())
    if (vbuf.length > MAX_VIDEO_BYTES) throw new Error('Video is too large to mux.')
    await writeFile(videoPath, vbuf)

    // 2. Write the voiceover (strip data: URL prefix if present).
    const b64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64
    await writeFile(audioPath, Buffer.from(b64, 'base64'))

    // 3. Mux: keep the video stream as-is, encode audio to AAC. The audio
    //    track is generated independently of the clip's real pace, so its
    //    length rarely matches exactly. Pad it with silence (apad) rather than
    //    trusting `-shortest` on the raw track: without padding, a track
    //    SHORTER than the video truncates the picture itself, chopping the
    //    clip short mid-scene. Padding makes the video's own length
    //    authoritative; `-shortest` then only ever trims trailing silence.
    //
    //    'mix' layers the provided track (a music bed) UNDER the video's
    //    existing audio at reduced volume instead of replacing it —
    //    normalize=0 keeps the original voice level untouched.
    const audioFilter = mix
      ? `[1:a:0]volume=${bedVolume},apad[m];[0:a:0][m]amix=inputs=2:duration=first:normalize=0[aout]`
      : '[1:a:0]apad[aout]'
    await run(ffmpegPath, [
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      '-filter_complex', audioFilter,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map', '0:v:0',
      '-map', '[aout]',
      '-shortest',
      '-movflags', '+faststart',
      outPath,
    ])

    // 4. Return the muxed file.
    const out = await readFile(outPath)
    const dataUrl = `data:video/mp4;base64,${out.toString('base64')}`
    await cleanup()
    return res.status(200).json({ videoDataUrl: dataUrl, bytes: out.length })
  } catch (err) {
    await cleanup()
    console.error('[/api/mux]', err)
    const message = err instanceof Error ? err.message : 'Muxing failed.'
    return res.status(502).json({ error: message })
  }
}

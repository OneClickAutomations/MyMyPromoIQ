/**
 * Caption burn-in (node-only) — the ffmpeg half of captions.ts. Kept separate
 * so the pure cue/ASS logic in captions.ts stays browser-importable.
 *
 * Uses the bundled Anton font via libass `fontsdir` so text renders identically
 * everywhere and never falls back to a missing system font (which would garble).
 */
import { spawn } from 'node:child_process'
import { writeFile, readFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAss, type CaptionCue, type CaptionStyleId } from './captions.js'

/** Absolute path to the bundled caption font directory (libass fontsdir). */
export function fontsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'fonts')
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args)
    let stderr = ''
    p.stderr.on('data', d => { stderr += d.toString() })
    p.on('error', reject)
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))))
  })
}

/** ffmpeg filter strings need `:`, `\`, `'` escaped. */
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/** Burn captions onto a local video file; returns the output path. A failure is
 *  the caller's to catch — captions are an enhancement and must never sink a
 *  render (the caller falls back to the un-captioned clip). */
export async function burnCaptions(
  ffmpegPath: string,
  inputPath: string,
  cues: CaptionCue[],
  style: CaptionStyleId,
  size: { width: number; height: number },
): Promise<string> {
  if (style === 'none' || !cues.length) return inputPath
  const dir = await mkdtemp(join(tmpdir(), 'cap-'))
  const assPath = join(dir, 'subs.ass')
  const outPath = join(dir, 'out.mp4')
  await writeFile(assPath, buildAss(cues, style, size), 'utf8')
  const vf = `subtitles=${escapeFilterPath(assPath)}:fontsdir=${escapeFilterPath(fontsDir())}`
  await run(ffmpegPath, [
    '-y', '-i', inputPath, '-vf', vf,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'copy', '-movflags', '+faststart', outPath,
  ])
  return outPath
}

/** The caption font as base64 (so the Lambda can materialize it). */
export async function readFontBase64(): Promise<string> {
  const buf = await readFile(join(fontsDir(), 'Anton-Regular.ttf'))
  return buf.toString('base64')
}

export async function cleanupDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch(() => {})
}

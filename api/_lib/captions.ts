/**
 * Captions — cue timing + ASS (Advanced SubStation Alpha) generation + burn-in.
 *
 * WHY captions are a burn-in from KNOWN TEXT, not from the video model:
 * Veo hallucinates garbled on-screen text, so we suppress its text entirely
 * (TEXT_NEGATIVES) and instead render captions ourselves from the exact script
 * — guaranteeing correct spelling, spacing, and no invented words.
 *
 * SYNC — three audio sources, three timing strategies:
 *  - ElevenLabs voice → PRECISE. The with-timestamps endpoint returns per-
 *    character timings; we group them into word cues (see buildCuesFromEleven).
 *  - Veo native audio / uploaded audio → ESTIMATED. We don't have word timings,
 *    so we distribute the known words across the clip weighted by length
 *    (buildCuesFromText). Good enough for short clips; word-accurate sync there
 *    needs ASR, which is a documented follow-up.
 *
 * The ASS generator is pure string logic (unit-tested); only burnCaptions()
 * shells out to ffmpeg.
 */
// This module is PURE and browser-safe (no node imports) so the Vite client can
// import the cue/style/ASS logic. The ffmpeg burn-in (node-only) lives in
// captionsBurn.ts.

export type CaptionStyleId = 'none' | 'clean' | 'highlight' | 'karaoke'

/** One on-screen word (or short phrase) with its start/end within the clip. */
export interface CaptionCue {
  text: string
  /** Seconds from the start of the clip. */
  start: number
  end: number
}

export interface CaptionStyle {
  id: CaptionStyleId
  label: string
  description: string
}

export const CAPTION_STYLES: CaptionStyle[] = [
  { id: 'none', label: 'No captions', description: 'No text on screen.' },
  { id: 'clean', label: 'Clean', description: 'Bold white words, black outline — the TikTok standard.' },
  { id: 'highlight', label: 'Highlight', description: 'Each word pops in a fire-colored box as it’s spoken.' },
  { id: 'karaoke', label: 'Karaoke', description: 'The whole line shows; each word lights up in sync.' },
]

// ── Cue timing ───────────────────────────────────────────────────────────────

/** Estimated cues: split text into words, distribute across [0, duration]
 *  weighted by word length (+ a little for punctuation pauses). */
export function buildCuesFromText(text: string, durationSeconds: number): CaptionCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length || durationSeconds <= 0) return []
  const weight = (w: string) => w.replace(/[^\w]/g, '').length + 1 + (/[.,!?…]$/.test(w) ? 2 : 0)
  const total = words.reduce((s, w) => s + weight(w), 0)
  const cues: CaptionCue[] = []
  let t = 0
  for (const w of words) {
    const dur = (weight(w) / total) * durationSeconds
    cues.push({ text: w, start: round2(t), end: round2(t + dur) })
    t += dur
  }
  // Snap the last cue to the exact clip end.
  if (cues.length) cues[cues.length - 1].end = durationSeconds
  return cues
}

/** ElevenLabs with-timestamps returns character arrays. Group into word cues. */
export function buildCuesFromEleven(
  chars: string[],
  startTimes: number[],
  endTimes: number[],
): CaptionCue[] {
  const cues: CaptionCue[] = []
  let cur = ''
  let curStart: number | null = null
  let curEnd = 0
  const flush = () => {
    const t = cur.trim()
    if (t && curStart !== null) cues.push({ text: t, start: round2(curStart), end: round2(curEnd) })
    cur = ''
    curStart = null
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) { flush(); continue }
    if (curStart === null) curStart = startTimes[i] ?? curEnd
    cur += ch
    curEnd = endTimes[i] ?? curEnd
  }
  flush()
  return cues
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

// ── ASS generation ─────────────────────────────────────────────────────────

const FIRE = '&H002C34E8' // ASS is &HAABBGGRR — this is ~#E8342C (fire) as BGR
const WHITE = '&H00FFFFFF'
const BLACK = '&H00000000'

function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

function assEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, ' ')
}

/** Build an .ass subtitle document for the given cues + style + frame size. */
export function buildAss(
  cues: CaptionCue[],
  style: CaptionStyleId,
  opts: { width: number; height: number },
): string {
  const { width, height } = opts
  // Font size scales with frame height; big and bold for mobile readability.
  const fontSize = Math.round(height * 0.058)
  const marginV = Math.round(height * 0.12)
  const outline = Math.max(2, Math.round(height * 0.005))

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Anton,${fontSize},${WHITE},${WHITE},${BLACK},${BLACK},0,0,0,0,100,100,0,0,1,${outline},2,2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  const lines: string[] = []

  if (style === 'clean' || style === 'highlight') {
    // One word (or a couple) at a time, centered — punchy captions.
    for (const cue of cues) {
      const txt = assEscape(cue.text.toUpperCase())
      const body = style === 'highlight'
        // Fire-colored box behind the word (BorderStyle 3 = opaque box via override).
        ? `{\\3c${FIRE}\\bord${Math.round(outline * 2)}\\shad0}${txt}`
        : txt
      lines.push(`Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Base,,0,0,0,,${body}`)
    }
  } else if (style === 'karaoke') {
    // Group cues into lines (~5 words), show the whole line, light each word up
    // in sync using \k (centiseconds) karaoke tags.
    const groups = chunk(cues, 5)
    for (const g of groups) {
      const start = g[0].start
      const end = g[g.length - 1].end
      let text = ''
      for (const c of g) {
        const durCs = Math.max(1, Math.round((c.end - c.start) * 100))
        // \kf sweeps the primary colour over the word; unswept stays secondary.
        text += `{\\kf${durCs}\\1c${WHITE}\\2c&H00AAAAAA}${assEscape(c.text.toUpperCase())} `
      }
      lines.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Base,,0,0,0,,${text.trim()}`)
    }
  }

  return `${header}\n${lines.join('\n')}\n`
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

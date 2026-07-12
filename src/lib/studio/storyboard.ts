/**
 * Storyboard Intelligence — shared types + word-count math.
 *
 * Fixes the duration mismatch: Veo 3 renders in fixed short durations, so a full
 * commercial is a sequence of short clips, each carrying exactly the dialogue it
 * can speak at a natural pace. Claude plans the clips; this module holds the
 * contract and the calibration constant both client and server enforce.
 */

/** Veo 3's supported per-clip durations (seconds). */
export const CLIP_DURATIONS = [4, 5, 6, 7, 8] as const
export type ClipDuration = (typeof CLIP_DURATIONS)[number]

/** Natural speaking pace. 4s ⇒ 10 words, 6s ⇒ 15, 8s ⇒ 20. */
export const WORDS_PER_SECOND = 2.5

export function maxWords(durationSeconds: number): number {
  return Math.floor(durationSeconds * WORDS_PER_SECOND)
}

/** Veo renders at most 8s per clip, so a video's clip count is the total
 *  duration divided by that ceiling — never fewer than 1. A single ~8s ad is
 *  ONE clip (one generation, no stitching); longer ads are several clips
 *  stitched together. This is the honest math the UI shows the user, and the
 *  count the client passes to the planner so client and server agree exactly. */
export const MAX_CLIP_SECONDS = 8
export function estimateClipCount(totalSeconds: number): number {
  return Math.max(1, Math.min(10, Math.ceil(totalSeconds / MAX_CLIP_SECONDS)))
}

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** 'full' (over max), 'tight' (≥80%), or 'fits'. Drives the live counter colour. */
export function wordFit(text: string, durationSeconds: number): 'fits' | 'tight' | 'over' {
  const used = countWords(text)
  const cap = maxWords(durationSeconds)
  if (used > cap) return 'over'
  if (used >= Math.floor(cap * 0.8)) return 'tight'
  return 'fits'
}

export interface StoryboardClip {
  id: string
  order: number
  /** hook | problem | solution | demo | proof | cta | bridge | reveal | outro */
  beat: string
  durationSeconds: number
  /** What's physically in frame, camera-direction language. */
  visualDescription: string
  /** The EXACT words spoken in this clip, calibrated to duration. */
  dialogue: string
  /** Computed from dialogue; must not exceed maxWords(durationSeconds). */
  wordCount: number
  cameraDirection: string
  /** What the creator is physically doing with the product. */
  creatorAction: string
  /** When true, "regenerate all" leaves this clip untouched. */
  locked: boolean
}

export interface StoryboardPlan {
  totalEstimatedDurationSeconds: number
  clipCount: number
  /** Claude's suggestion (may differ from clipCount after the user adjusts). */
  recommendedClipCount: number
  /** One-sentence reasoning shown above the cards. */
  reasoning: string
  clips: StoryboardClip[]
}

export const MIN_CLIPS = 1
export const MAX_CLIPS = 10

export function recomputeTotals(clips: StoryboardClip[]): number {
  return clips.reduce((sum, c) => sum + c.durationSeconds, 0)
}

/** Small icon key per beat so cards stay scannable without a preview image. */
export function beatGlyph(beat: string): string {
  const b = beat.toLowerCase()
  if (b.includes('hook')) return '👁'
  if (b.includes('problem') || b.includes('pain')) return '❓'
  if (b.includes('solution') || b.includes('demo')) return '▶'
  if (b.includes('proof') || b.includes('social')) return '★'
  if (b.includes('cta') || b.includes('call')) return '→'
  if (b.includes('reveal')) return '✦'
  if (b.includes('outro') || b.includes('brand')) return '◆'
  return '●'
}

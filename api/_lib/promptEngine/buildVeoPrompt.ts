/**
 * buildVeoPrompt — turns one planned clip into a Veo 3.1 timed-beat prompt.
 *
 * The output ALWAYS uses the [00:00-00:02] segment format (Rule 1). Each 2s
 * segment is a discrete instruction: shot type, identity/product anchor,
 * physical action, dialogue (≤5 words), and SFX. Deterministic string assembly
 * — no model call inside the engine, so the same brief always yields the same
 * prompt and validation is meaningful.
 */
import type { AdTypeTemplate, BeatDefinition } from './adTypeTemplates.js'
import type { EngineBrief, EngineClip, VeoDuration } from './types.js'
import { resolveCamera } from './cameraVocabulary.js'
import {
  buildIdentityAnchor,
  buildProductAnchor,
  buildProductShort,
  buildShortDescriptor,
} from './characterLock.js'

/** Abstract adjectives that tell the model how GOOD the shot is instead of what
 *  to shoot. The builder strips these and validation throws if any survive. */
export const BANNED_WORDS = [
  'cinematic', 'epic', 'stunning', 'beautiful', 'amazing', 'professional',
  'masterpiece', 'high quality', 'high-quality', 'perfect', 'incredible',
  'awesome', 'energetic', 'confident', 'seamless', 'elegant', 'luxurious',
  'premium', '4k', 'ultra hd', 'hyperrealistic', 'aesthetic', 'vibrant',
]

/** Format seconds as MM:SS. */
function ts(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Split dialogue into ≤maxPerChunk-word chunks, one per available segment. */
function chunkDialogue(dialogue: string, segments: number, maxPerChunk = 5): string[] {
  const words = dialogue.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return new Array(segments).fill('')
  // Distribute words as evenly as possible, capped at maxPerChunk per segment.
  const chunks: string[] = []
  const per = Math.min(maxPerChunk, Math.max(1, Math.ceil(words.length / segments)))
  for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per).join(' '))
  // Pad/truncate to exactly `segments` slots (dialogue tends to sit in the
  // middle+end; leave the opening segment for the visual hook).
  const slots: string[] = new Array(segments).fill('')
  // Place chunks starting from segment index 1 when we have room, so the first
  // 2s is action-led (stronger hook), spilling back to 0 only if needed.
  let start = segments > chunks.length ? 1 : 0
  if (start + chunks.length > segments) start = Math.max(0, segments - chunks.length)
  for (let i = 0; i < chunks.length && start + i < segments; i++) slots[start + i] = chunks[i]
  return slots
}

/** Remove any banned adjective from a fragment (case-insensitive, word-ish). */
function stripBanned(text: string): string {
  let out = text
  for (const w of BANNED_WORDS) {
    out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '')
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim()
}

/** Fill {product} {creator} {scene} slots in a beat's instruction. */
function fillSlots(tpl: string, product: string, creator: string, scene: string): string {
  return tpl
    .replace(/\{product\}/g, product)
    .replace(/\{creator\}/g, creator)
    .replace(/\{scene\}/g, scene)
}

export interface BuildVeoOptions {
  /** The template the clip belongs to (camera/lighting/sfx defaults). */
  template: AdTypeTemplate
  /** The matching beat definition for this clip, if known. */
  beat?: BeatDefinition
}

export function buildVeoPrompt(
  clip: EngineClip,
  brief: EngineBrief,
  opts: BuildVeoOptions,
): { prompt: string; segments: number; durationSeconds: VeoDuration } {
  const duration = clip.durationSeconds
  const segments = Math.max(1, Math.floor(duration / 2))

  const identity = buildIdentityAnchor(brief.creator)
  const shortId = buildShortDescriptor(brief.creator)
  const productAnchor = buildProductAnchor(brief.product)
  const productShort = buildProductShort(brief.product)
  const scene = brief.environment?.trim() || 'a real, lived-in room'

  const beat = opts.beat
  const camera = resolveCamera(clip.cameraDirection || beat?.cameraKey)
  // Slot-fill the beat with the SHORT product ref — the full anchor is stated
  // once as its own sentence in segment 1, so this avoids double-stating it.
  const action = clip.action?.trim()
    || (beat ? fillSlots(beat.visualInstruction, productShort, shortId, scene) : `${shortId} uses ${productShort} at ${scene}`)
  const sfx = beat?.sfx || 'quiet room tone, the soft sound of the action'

  const dialogueSlots = chunkDialogue(clip.dialogue, segments)
  const tone = clip.dialogueTone?.trim() || 'natural, direct eye contact with the lens'

  const lines: string[] = []
  for (let i = 0; i < segments; i++) {
    const from = ts(i * 2)
    const to = ts((i + 1) * 2)
    const shot = camera

    const parts: string[] = []
    if (i === 0) {
      // First segment: full identity + product anchor + the action.
      parts.push(`${shot}.`)
      parts.push(`${identity}.`)
      parts.push(`${productAnchor}.`)
      parts.push(stripBanned(action) + (action.trim().endsWith('.') ? '' : '.'))
    } else {
      // Continuation: short descriptor, no re-establishing.
      parts.push(`${shot}, continuing the same shot.`)
      parts.push(`${shortId} continues — no cut.`)
    }
    const spoken = dialogueSlots[i]?.trim()
    if (spoken) parts.push(`Dialogue: "${spoken}" — ${tone}.`)
    parts.push(`SFX: ${stripBanned(sfx)}.`)

    lines.push(`[${from}-${to}] ${parts.join(' ').replace(/\s{2,}/g, ' ').trim()}`)
  }

  const prompt = lines.join('\n\n')
  return { prompt, segments, durationSeconds: duration }
}

/** Human-readable audio summary for the storyboard preview / audioNotes. */
export function summarizeAudio(clip: EngineClip, beat?: BeatDefinition): string {
  const bed = beat?.sfx || 'natural room tone'
  return clip.dialogue.trim()
    ? `Spoken line + ${bed}. Veo generates the voice and SFX natively.`
    : `No dialogue — ${bed}. Sound design carries the beat.`
}

/**
 * Negative prompt library, organized by category so callers combine only what
 * they need. Sourced from the spec + the visual-skills continuity checklist.
 */
import type { AdTypeId } from './types.js'

// Universal — apply to every generation.
export const UNIVERSAL_NEGATIVES = [
  'floating hands', 'extra fingers', 'melting skin', 'morphing face',
  'text on screen', 'watermark', 'logo overlay', 'blurry product label',
  'distorted product shape', 'wrong number of items', 'multiple products',
  'inconsistent lighting between shots', 'background flicker',
  'unnatural skin texture', 'plastic-looking skin', 'AI glow',
  'unintentional lens flare', 'hand entering frame from wrong side',
  'subject looking off-axis without motivation', 'abrupt cut mid-motion',
  'subtitles', 'on-screen captions',
]

// Character consistency.
export const CHARACTER_NEGATIVES = [
  'different face in same clip', 'changing hair color mid-clip',
  'changing eye color', 'changing skin tone', 'age inconsistency',
  'changing wardrobe mid-clip', 'disappearing jewelry or accessories',
]

// Product accuracy.
export const PRODUCT_NEGATIVES = [
  'wrong product color', 'wrong product shape', 'unreadable label',
  'label on wrong side', 'product too large',
  'product too small relative to hand', 'extra product copies in frame',
  'product changing shape', 'incorrect product label text',
]

// Physics / gravity — the product must be held or resting, never hovering, and
// hands must be correct. Applied unless the user explicitly wants floating.
export const PHYSICS_NEGATIVES = [
  'floating product', 'product hovering in mid-air', 'levitating product',
  'product suspended with no support', 'product defying gravity',
  'product not touching the hand', 'hand not gripping the product',
  'product passing through the hand', 'product stuck to the palm unnaturally',
  'deformed hands', 'extra fingers', 'missing fingers', 'fused fingers',
  'fingers merging with the product', 'mangled hands', 'unnatural grip',
]

// On-screen text — Veo tends to hallucinate garbled captions/watermarks. We add
// captions ourselves as a clean burn-in from the real script (perfect spelling),
// so the video model must render NONE.
export const TEXT_NEGATIVES = [
  'text on screen', 'captions', 'subtitles', 'garbled text', 'gibberish text',
  'misspelled words', 'random letters', 'fake writing', 'watermark',
  'on-screen graphics', 'title cards', 'lower-third text',
]

// UGC — avoid anything that reads "produced".
export const UGC_NEGATIVES = [
  'studio backdrop', 'overly obvious ring light in eyes',
  'teleprompter eye movement', 'corporate hand gestures',
  'staged smile', 'stiff posture', 'green screen artifacts',
  'over-saturated colors', 'HDR tone mapping', 'drone shot',
  'jib crane movement', 'anamorphic lens flare',
  'heavily processed color grading',
]

export const TESTIMONIAL_NEGATIVES = [
  'reading from script with eyes moving left to right', 'multiple takes visible',
  'jump cut within same shot', 'echo or room reverb on voice',
]

export const UNBOXING_NEGATIVES = [
  'pre-opened packaging', 'packaging already damaged',
  'product already out of box at start', 'missing packaging elements',
  'hands not in frame during opening', 'product hidden behind hands',
]

export const REVEAL_NEGATIVES = [
  'creator hands in frame', 'cluttered background', 'busy set dressing',
  'competing focal points',
]

const PER_TYPE: Partial<Record<AdTypeId, string[]>> = {
  testimonial: TESTIMONIAL_NEGATIVES,
  street_interview: TESTIMONIAL_NEGATIVES,
  founder_story: TESTIMONIAL_NEGATIVES,
  unboxing: UNBOXING_NEGATIVES,
  product_reveal: REVEAL_NEGATIVES,
  comparison: REVEAL_NEGATIVES,
}

/** Assemble the negative prompt for an ad type: universal + character + product
 *  + physics + text + (UGC vs. commercial) + per-type extras + any additions.
 *  Pass allowFloating to drop the anti-gravity negatives (intentional float). */
export function buildNegativePrompt(adType: AdTypeId, extra: string[] = [], allowFloating = false): string {
  const commercialTypes: AdTypeId[] = ['product_reveal', 'comparison']
  const base = [
    ...UNIVERSAL_NEGATIVES,
    ...CHARACTER_NEGATIVES,
    ...PRODUCT_NEGATIVES,
    ...(allowFloating ? [] : PHYSICS_NEGATIVES),
    ...TEXT_NEGATIVES,
    ...(commercialTypes.includes(adType) ? [] : UGC_NEGATIVES),
    ...(PER_TYPE[adType] ?? []),
    ...extra,
  ]
  // De-dupe while preserving order.
  return Array.from(new Set(base)).join(', ')
}

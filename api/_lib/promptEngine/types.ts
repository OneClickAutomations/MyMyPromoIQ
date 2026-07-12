/**
 * Prompt Engine — shared types.
 *
 * WHY this lives in api/_lib (not src/lib): Vercel cannot bundle `api/` functions
 * that import from `src/`, but `api/_lib/` (underscore = not a routable function)
 * is importable by BOTH the server functions and the Vite client. So the engine
 * defines its OWN lean input types here; the wizard (client) and api/generate.ts
 * each adapt their richer objects into these before calling the engine. This is
 * the single contract that keeps the two sides in sync.
 */

/** The 12 supported ad-type ids. */
export type AdTypeId =
  // UGC formats
  | 'testimonial'
  | 'unboxing'
  | 'problem_solution'
  | 'day_in_the_life'
  | 'before_after'
  | 'tutorial'
  | 'street_interview'
  | 'pov'
  // Commercial formats
  | 'product_reveal'
  | 'comparison'
  | 'founder_story'
  | 'hook_only'

/** Veo's supported per-clip durations. Every beat is 2s, so duration must be even. */
export type VeoDuration = 4 | 6 | 8
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type Resolution = '720p' | '1080p'

/** A physically-described product. `physicalDescription` is the exact wording
 *  repeated verbatim in every clip to prevent product drift (Rule 4). */
export interface EngineProduct {
  /** e.g. "GLOW SERUM" — the label text, quoted in-frame. */
  name?: string
  /** Free-text marketing description (fallback). */
  description: string
  /** The exact physical sentence: "the 4oz black glass jar labeled GLOW SERUM,
   *  held in her left hand, label facing the camera." Preferred over description
   *  when present. Built by buildProductAnchor() when a spec is available. */
  physicalDescription?: string
  /** Concrete size comparison, e.g. "about the size of a golf ball". */
  scaleComparison?: string
}

/** The creator's locked physical identity (Rule 3). Every field that's set is
 *  woven into the identity anchor sentence. */
export interface EngineCreator {
  gender?: string
  ageRange?: string
  ethnicity?: string
  hair?: string
  wardrobe?: string
  /** Any distinctive accessory: "small gold hoop earrings". */
  distinguishingFeature?: string
  /** Free-text override — if provided, used as the identity anchor verbatim. */
  anchorOverride?: string
}

/** One clip in the storyboard, already planned (beat + calibrated dialogue). */
export interface EngineClip {
  order: number
  /** Beat name: HOOK | PROBLEM | DEMO | PROOF | CTA | REVEAL | etc. */
  beat: string
  durationSeconds: VeoDuration
  /** The EXACT words spoken across this clip (may be empty for silent b-roll). */
  dialogue: string
  /** Delivery/tone note for the dialogue, e.g. "unhurried, slight smile". */
  dialogueTone?: string
  /** Physical action override for this clip; falls back to the beat template. */
  action?: string
  /** Camera direction override; falls back to the template progression. */
  cameraDirection?: string
}

export interface EngineBrief {
  adType: AdTypeId
  product: EngineProduct
  creator?: EngineCreator
  /** Physical environment description, e.g. "a bright kitchen, marble counter". */
  environment?: string
  /** What the creator should physically DO with the product (from the canned
   *  action picker + any free-text direction). When set, this drives the
   *  on-screen action instead of the beat template's generic default. */
  actionDirection?: string
  /** A lighting key from lightingVocabulary, or a free-text physical description. */
  lighting?: string
  aspectRatio?: AspectRatio
  resolution?: Resolution
  /** Total clips in the sequence (drives continuity phrasing). */
  clipCount?: number
  /** When true, the product may float/levitate (the user explicitly wants it,
   *  e.g. a surreal product reveal). Default false → the engine hard-grounds
   *  the product in a hand or on a surface and adds anti-gravity negatives, so
   *  a testimonial never shows a product hovering unheld. */
  allowFloating?: boolean
}

export interface VeoPromptOutput {
  /** The full timed-beat prompt sent to Veo. */
  prompt: string
  /** All negative prompts concatenated. */
  negativePrompt: string
  durationSeconds: VeoDuration
  aspectRatio: AspectRatio
  resolution: Resolution
  /** false when we supply precise beats (we do); true only for loose exploration. */
  enhancePrompt: boolean
  /** The Nano Banana prompt for this clip's start frame. */
  startFramePrompt: string
  /** Human-readable summary of the audio bed. */
  audioNotes: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** The complete package the caller submits: image first, then video. */
export interface PromptPackage {
  veoPrompt: string
  nanaBananaPrompt: string
  negativePrompt: string
  durationSeconds: VeoDuration
  aspectRatio: AspectRatio
  resolution: Resolution
  enhancePrompt: boolean
  audioNotes: string
  validation: ValidationResult
}

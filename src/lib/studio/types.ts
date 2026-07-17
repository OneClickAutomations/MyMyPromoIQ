/**
 * Phase 0.1 — The CreativeBrief object.
 *
 * The single source of truth for the commercial-studio wizard. Every wizard
 * step reads/writes this one object; the Composition Engine (compositionEngine.ts)
 * is the only thing that turns it into a Veo-bound payload. Steps must NOT
 * hold private creative state that isn't reflected here.
 */

export type BriefStatus = 'draft' | 'storyboard_review' | 'rendering' | 'complete' | 'failed'

export interface MediaAsset {
  id: string
  url: string
  kind: 'raw' | 'processed'
  width?: number
  height?: number
  mimeType?: string
  createdAt: string
}

export interface CreatorAttributes {
  gender: string
  ageRange: string
  ethnicity: string
  bodyType: string
  hair: string
  facialHair?: string
  glasses?: boolean
  wardrobe: string
  expression: string
  energyLevel: 'low' | 'medium' | 'high'
  /** "natural_ugc" | "professional_influencer" | etc. */
  cameraConfidence: string
}

export interface StoryboardScene {
  id: string
  order: number
  shotType: string
  durationSeconds: number
  description: string
  cameraDirection: string
  dialogueOrVoiceover?: string
  locked: boolean
  status: 'pending' | 'approved' | 'regenerating'
  previewImageUrl?: string
}

export type DirectorStage = 'analyzing' | 'casting' | 'scripting' | 'storyboarding' | 'rendering'

export interface DirectorLogEntry {
  timestamp: string
  message: string
  stage: DirectorStage
}

export type ScriptGenerationMode =
  | 'product' | 'url' | 'features' | 'benefits' | 'competitor'
  | 'audience' | 'goal' | 'pain_points' | 'cta' | 'manual'

export interface CreativeBrief {
  id: string
  userId: string
  status: BriefStatus
  createdAt: string
  updatedAt: string

  product: {
    rawImages: MediaAsset[]
    processedImages: MediaAsset[]
    productType?: string
    productName: string
    description?: string
    /** Campaign goal (drive conversions, brand awareness, …) — steers the
     *  script writer and Creative Direction toward the right objective. */
    intent?: string
    url?: string
    /** 2x3 multi-angle turnaround sheet, once generated. Passed to Claude as a
     *  vision reference when writing the director prompt, so the product's
     *  actual color/material/label/shape ground the written description
     *  instead of being invented from text alone. */
    turnaroundImageUrl?: string
  }

  creator: {
    mode: 'generated' | 'uploaded_seed' | 'saved'
    seedImages?: MediaAsset[]
    attributes?: CreatorAttributes
    savedCreatorId?: string
    /** 'as_is' = use the upload directly; 'transform' = identity-preserving edit. */
    usagePath?: 'as_is' | 'transform'
    transformInstruction?: string
    /** "Transform this person" (Task A): the identity-preserving edited still,
     *  once previewed. When absent on an uploaded_seed creator, seedImages[0]
     *  (the raw upload) is used as-is. */
    transformedImageUrl?: string
    /** ISO timestamp of the required likeness-use consent acknowledgment. */
    likenessConsentAt?: string
  }

  scene: {
    productAction: string
    /** Free-text direction for what the creator does with the product, on top
     *  of the canned productAction pick. Threaded to the prompt engine so the
     *  user's specific intent drives the on-screen action. */
    actionDirection?: string
    environment: string
    lighting: string
  }

  style: {
    commercialStyle: string
    cameraDirection: string[]
  }

  /** Output aspect ratio (9:16, 16:9, 4:5). Chosen up front; threaded to Veo. */
  aspectRatio?: string

  /** Caption style burned into the video ('none' | 'clean' | 'highlight' |
   *  'karaoke'). Rendered from the known script so spelling is always correct;
   *  synced precisely for ElevenLabs voices, estimated for Veo/uploaded audio. */
  captionStyle?: string

  voice: {
    mode: 'ai_generated' | 'cloned' | 'uploaded'
    gender?: string
    age?: string
    accent?: string
    tone?: string
    speed?: number
    emotion?: string
    voiceId?: string
    /** Shared-library voices carry the ElevenLabs owner id (needed on first TTS use). */
    voiceOwnerId?: string
    voiceName?: string
    /** mode 'uploaded': the user's own track (data URL) — replaces the ad's audio at assembly. */
    uploadDataUrl?: string
    uploadName?: string
    /** ElevenLabs Music bed, generated at assembly and mixed under the voice. */
    musicEnabled?: boolean
    musicPrompt?: string
  }

  script: {
    generationMode: ScriptGenerationMode
    generatedText?: string
    editedText?: string
    cta?: string
  }

  /** Type-specific wizard answers, keyed by the ad type's question ids (see
   *  the prompt engine's AdTypeTemplate.wizardQuestions). These are the concrete
   *  specifics — the result, the first impression, the 3 steps — that the
   *  storyboard planner turns into real dialogue for this format. */
  wizardAnswers?: Record<string, string>

  storyboard: {
    scenes: StoryboardScene[]
    approvedAt?: string
  }

  render: {
    jobId?: string
    renderPayload?: RenderPayload
    outputUrl?: string
    creditsCost?: number
    statusLog: DirectorLogEntry[]
  }

  /** Set when this brief was cloned from a discovered ad (Discovery Engine). */
  sourceAd?: {
    sourceAdId: string
    /** Claude's structured breakdown, summarized for display/storage. */
    analysisSummary: string
    appliedAt: string
  }
}

// ── Composition Engine output ────────────────────────────────────────────────

export interface RenderScenePrompt {
  order: number
  shotType: string
  durationSeconds: number
  cameraDirection: string
  /** The compiled, physical/observable-action prompt sent to Veo 3. */
  prompt: string
}

export interface CompositionWarning {
  /** Which control surfaced the warning, e.g. "style.cameraDirection". */
  field: string
  message: string
  severity: 'soft'
}

export interface RenderPayload {
  aspectRatio: string
  quality: 'lite' | 'turbo' | 'standard'
  negativePrompt: string
  scenes: RenderScenePrompt[]
  warnings: CompositionWarning[]
  estimatedCredits: number
}

/** A minimal, valid empty brief for a new wizard session. */
export function createEmptyBrief(id: string, userId: string): CreativeBrief {
  const now = new Date().toISOString()
  return {
    id,
    userId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    product: { rawImages: [], processedImages: [], productName: '' },
    creator: { mode: 'generated' },
    scene: { productAction: '', environment: '', lighting: '' },
    style: { commercialStyle: '', cameraDirection: [] },
    voice: { mode: 'ai_generated' },
    script: { generationMode: 'product' },
    wizardAnswers: {},
    storyboard: { scenes: [] },
    render: { statusLog: [] },
  }
}

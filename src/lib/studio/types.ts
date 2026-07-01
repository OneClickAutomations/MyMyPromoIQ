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
    url?: string
  }

  creator: {
    mode: 'generated' | 'uploaded_seed' | 'saved'
    seedImages?: MediaAsset[]
    attributes?: CreatorAttributes
    savedCreatorId?: string
  }

  scene: {
    productAction: string
    environment: string
    lighting: string
  }

  style: {
    commercialStyle: string
    cameraDirection: string[]
  }

  voice: {
    mode: 'ai_generated' | 'cloned' | 'uploaded'
    gender?: string
    age?: string
    accent?: string
    tone?: string
    speed?: number
    emotion?: string
    voiceId?: string
  }

  script: {
    generationMode: ScriptGenerationMode
    generatedText?: string
    editedText?: string
    cta?: string
  }

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
    storyboard: { scenes: [] },
    render: { statusLog: [] },
  }
}

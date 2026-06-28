/**
 * Phase 0.2 — The Composition Engine. THIS is the product.
 *
 * A pure, testable function that turns a CreativeBrief into a Higgsfield-bound
 * payload. The user never sees a prompt; they make casting / scene / lighting /
 * voice / story decisions and this engine compiles them into the physical,
 * observable-action language Higgsfield responds to.
 *
 * Pure: no I/O, no React, no network. Given the same brief it returns the same
 * payload. Cost-preflight and submission live in the orchestration layer (0.3).
 */
import type {
  CreativeBrief,
  CompositionWarning,
  HiggsfieldPayload,
  HiggsfieldScenePrompt,
  StoryboardScene,
  CreatorAttributes,
} from './types'
import {
  STYLE_PRESETS,
  CAMERA_OPTIONS,
  LIGHTING_OPTIONS,
  ENVIRONMENT_OPTIONS,
  PRODUCT_ACTION_OPTIONS,
  phraseFor,
} from './presets'

/** Credits per second of rendered video (mirrors the Higgsfield provider capability). */
const CREDITS_PER_SECOND = 8
const QUALITY_MULTIPLIER: Record<HiggsfieldPayload['quality'], number> = {
  lite: 1,
  turbo: 1.4,
  standard: 2,
}

// ── 0.2.1 Conflict resolution ────────────────────────────────────────────────
// Soft warnings only: we surface the tension and let the user keep their choice.
// (The spec: "rather than silently overriding the user.")

interface ConflictRule {
  field: string
  test: (b: CreativeBrief) => boolean
  message: string
}

const CONFLICT_RULES: ConflictRule[] = [
  {
    field: 'style.cameraDirection',
    test: (b) =>
      ['luxury_commercial', 'cinematic_brand', 'founder_story'].includes(b.style.commercialStyle) &&
      b.style.cameraDirection.includes('handheld'),
    message: 'Handheld camera is unusual for this polished style — keep it anyway?',
  },
  {
    field: 'creator.energyLevel',
    test: (b) =>
      b.style.commercialStyle === 'fast_cut_hook' &&
      b.creator.attributes?.energyLevel === 'low',
    message: 'Low energy fights a Fast-Cut Hook — high energy reads better here.',
  },
  {
    field: 'scene.lighting',
    test: (b) =>
      b.style.commercialStyle === 'luxury_commercial' &&
      b.scene.lighting === 'bright_even',
    message: 'Flat even lighting can cheapen a Luxury Commercial — low-key adds richness.',
  },
  {
    field: 'style.cameraDirection',
    test: (b) => b.style.cameraDirection.length > 3,
    message: 'More than 3 camera moves per shot tends to look chaotic — consider trimming.',
  },
]

export function detectConflicts(brief: CreativeBrief): CompositionWarning[] {
  return CONFLICT_RULES.filter(r => r.test(brief)).map(r => ({
    field: r.field,
    message: r.message,
    severity: 'soft' as const,
  }))
}

// ── 0.2.3 Prompt assembly ────────────────────────────────────────────────────

function describeCreator(attrs?: CreatorAttributes): string {
  if (!attrs) return 'a relatable on-camera presenter'
  // Lead with identity — ethnicity and gender first and emphatically, so the
  // render engine casts the right person. Identity drift (e.g. a specified
  // African American woman rendering as white) is the #1 fidelity failure, so we
  // state ethnicity up front and reinforce skin tone consistency.
  const parts: string[] = []
  if (attrs.ageRange) parts.push(attrs.ageRange)
  if (attrs.ethnicity) parts.push(attrs.ethnicity)
  if (attrs.gender) parts.push(attrs.gender)
  const who = parts.join(' ') || 'person'
  const look: string[] = []
  if (attrs.hair) look.push(attrs.hair)
  if (attrs.facialHair) look.push(attrs.facialHair)
  if (attrs.glasses) look.push('wearing glasses')
  if (attrs.wardrobe) look.push(`in ${attrs.wardrobe}`)
  const lookStr = look.length ? `, ${look.join(', ')}` : ''
  const perf = attrs.expression ? `, ${attrs.expression} expression` : ''
  // Reinforce that the cast identity and skin tone stay fixed across the clip.
  const identity = attrs.ethnicity
    ? `, distinctly ${attrs.ethnicity} with a consistent ${attrs.ethnicity.toLowerCase()} skin tone and facial features held identical throughout`
    : ', with a consistent face and skin tone held identical throughout'
  return `a ${who}${lookStr}${perf}${identity}, photorealistic natural skin texture with visible pores (not plastic or airbrushed)`
}

/**
 * Compile ONE coherent, physical per-shot description. Observable actions only:
 * what hands do, where eyes look, what's literally in frame — never adjectives
 * about "vibe".
 */
export function assembleScenePrompt(brief: CreativeBrief, scene?: StoryboardScene): string {
  const product = brief.product.productName || 'the product'
  const action = phraseFor(PRODUCT_ACTION_OPTIONS, scene?.shotType || brief.scene.productAction || 'holding')
  const environment = phraseFor(ENVIRONMENT_OPTIONS, brief.scene.environment || 'cozy_home_interior')
  const lighting = phraseFor(LIGHTING_OPTIONS, brief.scene.lighting || 'soft_natural_window')
  const cameraIds = scene?.cameraDirection ? [scene.cameraDirection] : brief.style.cameraDirection
  const camera = (cameraIds.length ? cameraIds : ['slow_push'])
    .map(id => phraseFor(CAMERA_OPTIONS, id))
    .join(', then ')
  const creator = brief.creator.mode === 'uploaded_seed'
    ? 'the provided creator'
    : describeCreator(brief.creator.attributes)

  // Product specifics (incl. any stated dimensions) help keep scale correct.
  const productDesc = brief.product.description?.trim()
  const productClause = productDesc ? `${product} (${productDesc})` : product

  const beats: string[] = []
  if (brief.scene.productAction === 'hero_display' || (scene?.shotType === 'hero_display')) {
    // Product-only hero shot — no presenter.
    beats.push(`${productClause} shown as the hero of the frame, ${action}`)
  } else {
    beats.push(`${creator} ${action} ${productClause}`)
    beats.push('eyes to camera, speaking naturally')
  }
  // Scale discipline — products routinely render oversized; pin them to reality.
  beats.push(`the product rendered at correct real-world scale and proportion relative to the hands and body, held naturally and comfortably, not oversized`)
  beats.push(`set in ${environment}`)
  beats.push(lighting)
  beats.push(`camera: ${camera}`)
  beats.push('anatomically correct hands with five fingers, stable consistent face, no morphing or warping')
  beats.push('vertical 9:16, social-native, photoreal')

  return beats.join('. ') + '.'
}

function buildNegativePrompt(brief: CreativeBrief): string {
  const preset = STYLE_PRESETS[brief.style.commercialStyle]
  const cues = new Set<string>([
    'text overlays', 'watermark', 'logo', 'distorted hands', 'extra fingers',
    'missing fingers', 'warped product label', 'blurry', 'low resolution',
    // Fidelity guards — identity drift, bad scale, anatomy, plastic skin.
    'oversized product', 'giant product', 'product wrong scale', 'disproportionate product',
    'morphing', 'melting', 'warping', 'deformed body', 'deformed face',
    'changing face', 'inconsistent identity', 'wrong ethnicity', 'skin tone shift',
    'plastic skin', 'waxy skin', 'airbrushed skin', 'uncanny',
  ])
  for (const c of preset?.negativeCues ?? []) cues.add(c)
  return Array.from(cues).join(', ')
}

// ── 0.2.4 Cost estimation ────────────────────────────────────────────────────

export function estimateCredits(
  scenes: { durationSeconds: number }[],
  quality: HiggsfieldPayload['quality'],
): number {
  const seconds = scenes.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
  return Math.round(seconds * CREDITS_PER_SECOND * QUALITY_MULTIPLIER[quality])
}

// ── The engine ───────────────────────────────────────────────────────────────

/**
 * Compile a CreativeBrief into a Higgsfield payload. If the storyboard has no
 * scenes yet, synthesize a single representative scene from the brief so the
 * engine is usable from the moment a style is chosen.
 */
export function composeHiggsfieldPrompt(brief: CreativeBrief): HiggsfieldPayload {
  const preset = STYLE_PRESETS[brief.style.commercialStyle]
  const quality = preset?.defaults.quality ?? 'turbo'

  const sourceScenes: StoryboardScene[] = brief.storyboard.scenes.length
    ? [...brief.storyboard.scenes].sort((a, b) => a.order - b.order)
    : [{
        id: 'synthetic-0',
        order: 0,
        shotType: brief.scene.productAction || preset?.defaults.productAction || 'holding',
        durationSeconds: 8,
        description: '',
        cameraDirection: (brief.style.cameraDirection[0] ?? preset?.defaults.cameraDirection[0] ?? 'slow_push'),
        locked: false,
        status: 'pending',
      }]

  const scenes: HiggsfieldScenePrompt[] = sourceScenes.map(s => ({
    order: s.order,
    shotType: s.shotType,
    durationSeconds: s.durationSeconds,
    cameraDirection: s.cameraDirection,
    prompt: assembleScenePrompt(brief, s),
  }))

  return {
    aspectRatio: '9:16',
    quality,
    negativePrompt: buildNegativePrompt(brief),
    scenes,
    warnings: detectConflicts(brief),
    estimatedCredits: estimateCredits(scenes, quality),
  }
}

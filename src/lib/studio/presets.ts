/**
 * Phase 0.2.2 — Style presets and the option catalogs the wizard renders.
 *
 * Each commercial style carries sane defaults (camera, lighting, environment,
 * pacing, energy) that auto-populate later steps when chosen — but every value
 * stays overridable. This is what makes the wizard feel *directed* instead of
 * like 11 independent dropdowns.
 */
import type { CreativeBrief } from './types'

export type StyleCluster = 'testimonial' | 'cinematic' | 'fast_cut' | 'educational'

export interface StylePreset {
  id: string
  label: string
  cluster: StyleCluster
  blurb: string
  defaults: {
    cameraDirection: string[]
    lighting: string
    environment: string
    productAction: string
    pacing: 'slow' | 'measured' | 'energetic'
    energyLevel: 'low' | 'medium' | 'high'
    quality: 'lite' | 'turbo' | 'standard'
  }
  /** Cues fed to the negative prompt so the look stays on-brand. */
  negativeCues: string[]
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  ugc_testimonial: {
    id: 'ugc_testimonial',
    label: 'UGC Testimonial',
    cluster: 'testimonial',
    blurb: 'A real person talking to camera about the product. Authentic, handheld, phone-shot feel.',
    defaults: {
      cameraDirection: ['handheld', 'slow_push'],
      lighting: 'soft_natural_window',
      environment: 'cozy_home_interior',
      productAction: 'holding',
      pacing: 'measured',
      energyLevel: 'medium',
      quality: 'turbo',
    },
    negativeCues: ['studio gloss', 'overproduced', 'stock-photo stiffness'],
  },
  founder_story: {
    id: 'founder_story',
    label: 'Founder Story',
    cluster: 'testimonial',
    blurb: 'Warm, credible founder speaking candidly. Documentary intimacy.',
    defaults: {
      cameraDirection: ['locked_off', 'slow_push'],
      lighting: 'warm_practical',
      environment: 'workspace_or_studio',
      productAction: 'presenting',
      pacing: 'slow',
      energyLevel: 'low',
      quality: 'standard',
    },
    negativeCues: ['fast cuts', 'hard sell energy'],
  },
  luxury_commercial: {
    id: 'luxury_commercial',
    label: 'Luxury Commercial',
    cluster: 'cinematic',
    blurb: 'Premium, cinematic product hero. Controlled motion, rich contrast.',
    defaults: {
      cameraDirection: ['slow_push', 'orbit'],
      lighting: 'dramatic_low_key',
      environment: 'seamless_studio',
      productAction: 'hero_display',
      pacing: 'slow',
      energyLevel: 'low',
      quality: 'standard',
    },
    negativeCues: ['handheld shake', 'cluttered background', 'flat lighting'],
  },
  cinematic_brand: {
    id: 'cinematic_brand',
    label: 'Cinematic Brand Film',
    cluster: 'cinematic',
    blurb: 'Aspirational lifestyle storytelling with film-grade lighting.',
    defaults: {
      cameraDirection: ['slow_push', 'dolly'],
      lighting: 'golden_hour',
      environment: 'lifestyle_location',
      productAction: 'using',
      pacing: 'measured',
      energyLevel: 'medium',
      quality: 'standard',
    },
    negativeCues: ['amateur framing', 'harsh on-camera flash'],
  },
  fast_cut_hook: {
    id: 'fast_cut_hook',
    label: 'Fast-Cut Hook',
    cluster: 'fast_cut',
    blurb: 'High-energy, scroll-stopping opener engineered for the first second.',
    defaults: {
      cameraDirection: ['whip_pan', 'handheld'],
      lighting: 'punchy_high_contrast',
      environment: 'bold_seamless',
      productAction: 'dynamic_reveal',
      pacing: 'energetic',
      energyLevel: 'high',
      quality: 'turbo',
    },
    negativeCues: ['slow', 'sleepy pacing', 'muted colors'],
  },
  unboxing: {
    id: 'unboxing',
    label: 'Unboxing',
    cluster: 'fast_cut',
    blurb: 'Tactile reveal — hands, packaging, satisfying detail shots.',
    defaults: {
      cameraDirection: ['top_down', 'macro_detail'],
      lighting: 'bright_even',
      environment: 'clean_tabletop',
      productAction: 'opening_package',
      pacing: 'measured',
      energyLevel: 'medium',
      quality: 'turbo',
    },
    negativeCues: ['dark', 'messy surface'],
  },
  explainer: {
    id: 'explainer',
    label: 'Explainer / How-To',
    cluster: 'educational',
    blurb: 'Clear, instructional demonstration of how the product works.',
    defaults: {
      cameraDirection: ['locked_off', 'insert_shots'],
      lighting: 'bright_even',
      environment: 'clean_tabletop',
      productAction: 'demonstrating',
      pacing: 'measured',
      energyLevel: 'medium',
      quality: 'turbo',
    },
    negativeCues: ['moody darkness', 'distracting motion'],
  },
}

export const STYLE_CLUSTER_LABELS: Record<StyleCluster, string> = {
  testimonial: 'Testimonial-style',
  cinematic: 'Cinematic / Brand',
  fast_cut: 'Fast-cut / Trend',
  educational: 'Educational',
}

// ── Option catalogs (wizard card grids) ──────────────────────────────────────

export interface CatalogOption {
  id: string
  label: string
  /** Human, physical description used by the prompt assembler. */
  phrase: string
}

export const CAMERA_OPTIONS: CatalogOption[] = [
  { id: 'handheld',     label: 'Handheld',       phrase: 'loose handheld camera with subtle natural movement' },
  { id: 'slow_push',    label: 'Slow Push-In',   phrase: 'slow steady push-in toward the subject' },
  { id: 'locked_off',   label: 'Locked Off',     phrase: 'static locked-off camera on a tripod' },
  { id: 'orbit',        label: 'Orbit',          phrase: 'smooth orbital move circling the product' },
  { id: 'dolly',        label: 'Dolly',          phrase: 'smooth lateral dolly move' },
  { id: 'whip_pan',     label: 'Whip Pan',       phrase: 'fast whip-pan transition' },
  { id: 'top_down',     label: 'Top-Down',       phrase: 'overhead top-down framing' },
  { id: 'macro_detail', label: 'Macro Detail',   phrase: 'tight macro detail shot' },
  { id: 'insert_shots', label: 'Insert Shots',   phrase: 'cutaway insert shots of key details' },
]

export const LIGHTING_OPTIONS: CatalogOption[] = [
  { id: 'soft_natural_window', label: 'Soft Window Light', phrase: 'soft natural light from a nearby window' },
  { id: 'warm_practical',      label: 'Warm Practical',    phrase: 'warm practical lamps, cozy ambient glow' },
  { id: 'golden_hour',         label: 'Golden Hour',       phrase: 'warm golden-hour sunlight, long soft shadows' },
  { id: 'dramatic_low_key',    label: 'Dramatic Low-Key',  phrase: 'dramatic low-key lighting with rich shadow contrast' },
  { id: 'bright_even',         label: 'Bright & Even',     phrase: 'bright, even, shadowless product lighting' },
  { id: 'punchy_high_contrast',label: 'Punchy Contrast',   phrase: 'punchy high-contrast lighting with bold color' },
  { id: 'seamless_studio',     label: 'Studio Softbox',    phrase: 'clean studio softbox lighting on a seamless backdrop' },
]

/** Sentinel id: skip describing any environment in the prompt at all — the
 *  video model then just continues whatever's actually visible in the
 *  uploaded photo instead of being told to render a contradicting preset
 *  setting. See assembleScenePrompt in compositionEngine.ts. */
export const KEEP_ORIGINAL_ENVIRONMENT = 'keep_original'

export const ENVIRONMENT_OPTIONS: CatalogOption[] = [
  { id: KEEP_ORIGINAL_ENVIRONMENT, label: 'Keep My Setting', phrase: "Don't change the background — use whatever's in your photo" },
  { id: 'cozy_home_interior',  label: 'Cozy Home',       phrase: 'a cozy, lived-in home interior' },
  { id: 'workspace_or_studio', label: 'Workspace',       phrase: 'a modern workspace or creative studio' },
  { id: 'lifestyle_location',  label: 'Lifestyle Scene', phrase: 'an aspirational real-world lifestyle location' },
  { id: 'clean_tabletop',      label: 'Clean Tabletop',  phrase: 'a clean, uncluttered tabletop surface' },
  { id: 'seamless_studio',     label: 'Studio Backdrop', phrase: 'a seamless studio backdrop' },
  { id: 'bold_seamless',       label: 'Bold Backdrop',   phrase: 'a bold, saturated seamless backdrop' },
  { id: 'outdoor_natural',     label: 'Outdoors',        phrase: 'a natural outdoor setting' },
]

export const PRODUCT_ACTION_OPTIONS: CatalogOption[] = [
  { id: 'holding',         label: 'Holding',        phrase: 'holding the product up near their face' },
  { id: 'using',           label: 'Using',          phrase: 'actively using the product' },
  { id: 'presenting',      label: 'Presenting',     phrase: 'presenting the product to camera' },
  { id: 'opening_package', label: 'Unboxing',       phrase: 'opening the product packaging, hands in frame' },
  { id: 'hero_display',    label: 'Hero Display',   phrase: 'the product displayed as a hero on its own' },
  { id: 'dynamic_reveal',  label: 'Dynamic Reveal', phrase: 'a fast dynamic reveal of the product' },
  { id: 'demonstrating',   label: 'Demonstrating',  phrase: 'demonstrating how the product works step by step' },
  { id: 'applying',        label: 'Applying',       phrase: 'applying the product to skin' },
]

/** Look up the human phrase for an option id, falling back to a readable label. */
export function phraseFor(catalog: CatalogOption[], id: string): string {
  return catalog.find(o => o.id === id)?.phrase ?? id.replace(/_/g, ' ')
}

/**
 * Apply a style preset's defaults to a brief WITHOUT clobbering anything the
 * user has already set. Returns a new brief — never mutates the input.
 */
export function applyStylePreset(brief: CreativeBrief, styleId: string): CreativeBrief {
  const preset = STYLE_PRESETS[styleId]
  if (!preset) return { ...brief, style: { ...brief.style, commercialStyle: styleId } }
  const d = preset.defaults
  return {
    ...brief,
    style: {
      commercialStyle: styleId,
      cameraDirection: brief.style.cameraDirection.length ? brief.style.cameraDirection : d.cameraDirection,
    },
    scene: {
      productAction: brief.scene.productAction || d.productAction,
      environment: brief.scene.environment || d.environment,
      lighting: brief.scene.lighting || d.lighting,
    },
    creator: {
      ...brief.creator,
      attributes: brief.creator.attributes
        ? { ...brief.creator.attributes, energyLevel: brief.creator.attributes.energyLevel || d.energyLevel }
        : brief.creator.attributes,
    },
  }
}

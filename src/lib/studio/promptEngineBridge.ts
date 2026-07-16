/**
 * Bridge — adapts the wizard's CreativeBrief + StoryboardClip into the prompt
 * engine's lean input types, so the client can build/preview the exact Veo +
 * Nano Banana prompts the server will run (single source of truth, no drift).
 *
 * The engine lives in api/_lib/promptEngine (importable by both the Vercel
 * functions and this Vite client — api/ can't import src/, but api/_lib can be
 * imported by src/).
 */
import {
  buildPromptPackage,
  AD_TYPE_ORDER,
  getTemplate,
  buildIdentityAnchor,
} from '../../../api/_lib/promptEngine/index.js'
import type {
  AdTypeId,
  EngineBrief,
  EngineClip,
  PromptPackage,
  VeoDuration,
} from '../../../api/_lib/promptEngine/index.js'
import type { CreativeBrief } from './types'
import type { StoryboardClip } from './storyboard'
import { PRODUCT_ACTION_OPTIONS, ENVIRONMENT_OPTIONS, KEEP_ORIGINAL_ENVIRONMENT } from './presets'

/** Resolve an environment id (from the wizard picker) to its physical phrase.
 *  Searches the type-specific presets first, then the generic list. The
 *  "keep my setting" sentinel and free text pass through as-is. */
function resolveEnvironment(adType: AdTypeId, envId?: string): string | undefined {
  const raw = envId?.trim()
  if (!raw || raw === KEEP_ORIGINAL_ENVIRONMENT) return undefined
  const fromType = getTemplate(adType).environmentPresets?.find(e => e.id === raw)?.phrase
  if (fromType) return fromType
  const fromGeneric = ENVIRONMENT_OPTIONS.find(e => e.id === raw)?.phrase
  return fromGeneric ?? raw
}

/** Map the wizard's commercialStyle preset ids onto engine ad types. Engine
 *  ids also map to themselves, so a type chosen via the new selector round-trips. */
const STYLE_TO_ADTYPE: Record<string, AdTypeId> = {
  ugc_testimonial: 'testimonial',
  founder_story: 'founder_story',
  luxury_commercial: 'product_reveal',
  cinematic_brand: 'product_reveal',
  fast_cut_hook: 'hook_only',
  unboxing: 'unboxing',
  explainer: 'tutorial',
}

export function resolveAdType(commercialStyle?: string): AdTypeId {
  if (!commercialStyle) return 'testimonial'
  if ((AD_TYPE_ORDER as string[]).includes(commercialStyle)) return commercialStyle as AdTypeId
  return STYLE_TO_ADTYPE[commercialStyle] ?? 'testimonial'
}

/** Veo only renders 4/6/8s clips — snap the wizard's 4–8s to the nearest even. */
export function toVeoDuration(seconds: number): VeoDuration {
  if (seconds <= 4) return 4
  if (seconds >= 8) return 8
  return 6
}

export function briefToEngineBrief(brief: CreativeBrief): EngineBrief {
  const productName =
    brief.product.productName?.trim() || undefined
  const description =
    brief.product.description?.trim() ||
    brief.product.productType?.trim() ||
    brief.product.productName?.trim() ||
    'the product'

  const adType = resolveAdType(brief.style.commercialStyle)
  // Creator-less formats (e.g. product reveal) get NO creator — the engine then
  // builds a person-free, product-only prompt.
  const needsCreator = getTemplate(adType).needsCreator !== false
  const a = brief.creator.attributes
  const creator = needsCreator && a
    ? {
        gender: a.gender,
        ageRange: a.ageRange,
        ethnicity: a.ethnicity,
        hair: a.hair,
        wardrobe: a.wardrobe,
        distinguishingFeature: a.glasses ? 'wearing glasses' : undefined,
      }
    : undefined

  // Combine the canned product-action pick (resolved to its phrase) with any
  // free-text direction, so both reach the engine's on-screen action.
  const cannedPhrase = PRODUCT_ACTION_OPTIONS.find(o => o.id === brief.scene.productAction)?.phrase
  const freeDirection = brief.scene.actionDirection?.trim()
  const actionDirection = [cannedPhrase, freeDirection].filter(Boolean).join('; ') || undefined

  return {
    adType,
    product: { name: productName, description },
    creator,
    environment: resolveEnvironment(adType, brief.scene.environment),
    lighting: brief.scene.lighting?.trim() || undefined,
    actionDirection,
    aspectRatio: (brief.aspectRatio as EngineBrief['aspectRatio']) || '9:16',
    resolution: '1080p',
    clipCount: brief.storyboard.scenes.length || undefined,
  }
}

export function clipToEngineClip(clip: StoryboardClip): EngineClip {
  return {
    order: clip.order,
    beat: clip.beat,
    durationSeconds: toVeoDuration(clip.durationSeconds),
    dialogue: clip.dialogue ?? '',
    dialogueTone: 'natural, direct eye contact with the lens',
    action: clip.creatorAction?.trim() || clip.visualDescription?.trim() || undefined,
    cameraDirection: clip.cameraDirection?.trim() || undefined,
  }
}

/** Build the full prompt package for one clip, straight from wizard state. */
export function buildClipPromptPackage(
  brief: CreativeBrief,
  clip: StoryboardClip,
): PromptPackage {
  return buildPromptPackage(clipToEngineClip(clip), briefToEngineBrief(brief))
}

export { getTemplate, AD_TYPE_ORDER, buildIdentityAnchor }
export type { AdTypeId, PromptPackage }

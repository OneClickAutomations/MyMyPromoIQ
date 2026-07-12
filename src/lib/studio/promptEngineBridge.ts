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

  const a = brief.creator.attributes
  const creator = a
    ? {
        gender: a.gender,
        ageRange: a.ageRange,
        ethnicity: a.ethnicity,
        hair: a.hair,
        wardrobe: a.wardrobe,
        distinguishingFeature: a.glasses ? 'wearing glasses' : undefined,
      }
    : undefined

  return {
    adType: resolveAdType(brief.style.commercialStyle),
    product: { name: productName, description },
    creator,
    environment: brief.scene.environment?.trim() || undefined,
    lighting: brief.scene.lighting?.trim() || undefined,
    aspectRatio: '9:16',
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

export { getTemplate, AD_TYPE_ORDER }
export type { AdTypeId, PromptPackage }

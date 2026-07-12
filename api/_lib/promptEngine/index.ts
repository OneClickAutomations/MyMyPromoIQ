/**
 * Prompt Engine — public entry point.
 *
 * buildPromptPackage(clip, brief) is the one function callers use. It routes to
 * the right ad-type template, assembles the Veo timed-beat prompt + the Nano
 * Banana start-frame prompt + the negative prompt, and validates before
 * returning. api/generate.ts submits the image first, then the video.
 */
import type {
  EngineBrief,
  EngineClip,
  PromptPackage,
  ValidationResult,
} from './types.js'
import { getTemplate } from './adTypeTemplates.js'
import { buildVeoPrompt, summarizeAudio } from './buildVeoPrompt.js'
import { buildNanaBananaPrompt } from './buildNanaBananaPrompt.js'
import { buildNegativePrompt } from './negativePrompts.js'
import { validateVeoPrompt } from './validation.js'

export * from './types.js'
export {
  AD_TYPE_TEMPLATES,
  AD_TYPE_ORDER,
  getTemplate,
  beatMaxWords,
} from './adTypeTemplates.js'
export type {
  AdTypeTemplate,
  BeatDefinition,
  WizardQuestion,
} from './adTypeTemplates.js'
export { BANNED_WORDS } from './buildVeoPrompt.js'
export { buildNegativePrompt } from './negativePrompts.js'
export { LIGHTING_DESCRIPTIONS } from './lightingVocabulary.js'
export { CAMERA_PRESETS } from './cameraVocabulary.js'
export { validateVeoPrompt, validateNanaBananaPrompt } from './validation.js'

/** Match this clip to its beat definition in the template (by order, then by
 *  beat name), so camera/sfx defaults line up with the planned clip. */
function resolveBeat(clip: EngineClip, brief: EngineBrief) {
  const template = getTemplate(brief.adType)
  const byOrder = template.beats.find(b => b.order === clip.order)
  if (byOrder) return byOrder
  const name = clip.beat?.toUpperCase()
  const byName = template.beats.find(b => b.name.toUpperCase() === name)
  return byName ?? template.beats[Math.min(clip.order - 1, template.beats.length - 1)] ?? template.beats[0]
}

export function buildPromptPackage(clip: EngineClip, brief: EngineBrief): PromptPackage {
  const template = getTemplate(brief.adType)
  const beat = resolveBeat(clip, brief)

  const { prompt: veoPrompt } = buildVeoPrompt(clip, brief, { template, beat })
  const nanaBananaPrompt = buildNanaBananaPrompt(clip, brief, { template, beat })
  const negativePrompt = buildNegativePrompt(brief.adType, template.negativePromptAdditions, brief.allowFloating)
  const validation: ValidationResult = validateVeoPrompt(veoPrompt, clip.durationSeconds)

  return {
    veoPrompt,
    nanaBananaPrompt,
    negativePrompt,
    durationSeconds: clip.durationSeconds,
    aspectRatio: brief.aspectRatio ?? '9:16',
    resolution: brief.resolution ?? '1080p',
    enhancePrompt: false,
    audioNotes: summarizeAudio(clip, beat),
    validation,
  }
}

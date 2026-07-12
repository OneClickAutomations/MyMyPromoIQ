/**
 * buildNanaBananaPrompt — the start-frame image prompt that anchors a Veo clip.
 *
 * Nano Banana generates the first frame; Veo animates from it. The frame must
 * match where the clip's motion BEGINS (segment 1), in the same physical
 * language, so the video starts exactly where the image ends. This is the
 * character-consistency fix: same face, same light, same product every clip.
 *
 * Nano Banana ignores numeric lens params (50mm, f/1.8) — describe optically
 * instead ("shallow depth of field"). Natural-language sentences, not tag soup.
 */
import type { AdTypeTemplate, BeatDefinition } from './adTypeTemplates.js'
import type { EngineBrief, EngineClip } from './types.js'
import { resolveLighting } from './lightingVocabulary.js'
import {
  buildIdentityAnchor,
  buildProductAnchor,
  buildProductShort,
} from './characterLock.js'

function fillSlots(tpl: string, product: string, creator: string, scene: string): string {
  return tpl
    .replace(/\{product\}/g, product)
    .replace(/\{creator\}/g, creator)
    .replace(/\{scene\}/g, scene)
}

export function buildNanaBananaPrompt(
  clip: EngineClip,
  brief: EngineBrief,
  opts: { template: AdTypeTemplate; beat?: BeatDefinition },
): string {
  const identity = buildIdentityAnchor(brief.creator)
  const productAnchor = buildProductAnchor(brief.product)
  const productShort = buildProductShort(brief.product)
  const scene = brief.environment?.trim() || 'a real, lived-in room'
  const lighting = resolveLighting(brief.lighting)
  const beat = opts.beat

  // A per-clip action override wins (the start frame should match where THIS
  // clip's motion begins); otherwise use the beat's opening instruction.
  const openingAction = clip.action?.trim()
    || (beat
      ? fillSlots(beat.visualInstruction, productShort, identity, scene)
      : `${identity} holds ${productShort} at ${scene}`)

  // Point-of-view formats have no visible creator — the frame is the viewer's
  // own hands, so we don't describe a face.
  const isPov = brief.adType === 'pov'
  const subject = isPov
    ? `First-person point of view: the viewer's own hands entering the bottom of the frame, reaching toward ${productAnchor}, at ${scene}.`
    : `${identity}, at ${scene}. ${productAnchor}.`

  const framing = isPov
    ? 'Frame: wide first-person view, hands filling the lower third, sharp focus on the product label, natural background blur.'
    : 'Frame: tight medium shot, the subject fills about 60 percent of the frame, top of the head at the upper third, sharp focus on both the face and the product label, shallow depth of field behind.'

  const lensLine = 'Optically: shallow depth of field, natural bokeh behind the subject, sharp focus on the product label — no visible camera gear, no on-screen text.'

  return [
    `Create a photorealistic vertical first frame for a short UGC ad. ${subject}`,
    `Opening pose: ${openingAction}.`,
    framing,
    `Lighting: ${lighting}.`,
    lensLine,
    'Match a real phone-shot look: natural skin texture, believable imperfection, no studio backdrop. Aspect ratio 9:16.',
  ].join(' ')
}

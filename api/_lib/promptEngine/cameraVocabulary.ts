/**
 * Physical camera terms per shot type. A camera direction is always a physical
 * instruction (framing + lens + one dominant move), never "cinematic camera".
 * From the visual-skills camera-lighting vocabulary + Veo failure-mode fixes.
 */
export const FRAMINGS = [
  'extreme wide shot', 'wide shot', 'medium wide shot', 'medium shot',
  'medium close-up', 'close-up', 'extreme close-up', 'macro insert',
  'over-the-shoulder', 'point-of-view shot', 'low-angle shot', 'top-down shot',
] as const

export const MOVES = [
  'locked-off tripod, no movement',
  'very slow push-in — about 1cm of apparent travel over the whole clip, no shake',
  'slow pull-back revealing the surrounding space',
  'handheld with slight natural drift, eye-level',
  'lateral tracking following the subject',
  'rack focus from the product to the face',
  'slow tilt down from face to hands',
] as const

/** Named camera presets referenced by ad-type templates. Each is framing + lens
 *  + one dominant move — everything Veo needs and nothing it will ignore. */
export const CAMERA_PRESETS: Record<string, string> = {
  talking_head: 'medium close-up, 50mm, locked-off tripod at eye level, subject centered, shallow natural depth of field behind them',
  slow_push: 'medium shot, 50mm, very slow push-in of about 1cm over the clip, no shake',
  tabletop_overhead: 'top-down shot, 35mm, locked-off, hands and product fill the lower two-thirds of the frame',
  tabletop_45: '45-degree tabletop angle, 50mm, locked-off, product occupies the center of the frame',
  handheld_follow: 'medium shot, 35mm, handheld with slight natural drift, following the subject at eye level',
  macro_detail: 'extreme close-up macro insert, 100mm, locked-off, product texture and label fill the frame',
  pov_first_person: 'point-of-view shot from the viewer\'s eyeline, 24mm wide, subtle handheld sway, hands entering from the bottom of the frame',
  reveal_orbit: 'medium shot, 50mm, slow lateral tracking that arcs a few degrees around the product on a clean surface',
  split_static: 'medium shot, 50mm, locked-off tripod, subject held to one side of the frame for a side-by-side comparison',
}

/** Resolve a camera preset key, or pass free text through. */
export function resolveCamera(key?: string): string {
  if (!key) return CAMERA_PRESETS.talking_head
  return CAMERA_PRESETS[key] ?? key
}

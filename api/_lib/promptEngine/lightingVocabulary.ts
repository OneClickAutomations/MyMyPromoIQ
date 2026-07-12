/**
 * Physical lighting descriptions. These replace vague words ("warm", "moody")
 * with source + direction + color temperature + shadow behaviour, per the
 * visual-skills camera-lighting vocabulary. Keyed by mood/setting.
 */
export const LIGHTING_DESCRIPTIONS: Record<string, string> = {
  golden_hour: 'warm directional sunlight from camera-left at roughly 15 degrees above the horizon, 3200K, long soft shadows, slight warmth without flare',
  studio_softbox: 'large octabox 45 degrees camera-left at eye level, 5600K daylight, soft wrap-around fill from camera-right at a 1:3 ratio, minimal facial shadow',
  window_light: 'natural diffused window light from camera-left, 6500K slightly cool, soft gradual falloff across the face, no hard shadow edges',
  moody: 'a single practical light source in frame (lamp or phone screen), 2700K very warm, hard shadow across 60 percent of the face, high contrast, no fill',
  beauty: '180-degree ring light at 5000K, even flat illumination, a catch-light ring visible in both eyes, no directional shadow, faint sheen on skin',
  night_neon: 'two colored practicals — one red from camera-left, one blue from camera-right — over a 3200K base exposure, color spill on skin and background',
  luxury_commercial: 'a large softbox behind and above the subject as a rim light plus a large softbox key 45 degrees camera-left, 5500K, gentle shadow gradient, clean separation from the background',
  outdoor_daylight: 'overcast sky acting as one giant softbox, 6500K slightly cool, flat shadowless illumination, natural skin tones',
  kitchen_morning: 'soft morning light through a window over a kitchen counter, 5000K, gentle highlight on the countertop, warm bounce from the walls, one soft shadow side',
  bathroom_natural: 'diffused daylight from a frosted bathroom window, 6000K clean and slightly cool, even illumination on the face, faint reflection off tile',
  gym_overhead: 'overhead industrial LED panels, 5000K neutral, mild top-down shadow under the brow, matte concrete floor picking up a soft grey bounce',
  office_fluorescent: 'ceiling fluorescent tubes, 4200K flat neutral, even low-contrast illumination, faint green cast controlled to keep skin natural',
  cafe_ambient: 'warm hanging Edison bulbs mixed with soft daylight from a street-facing window, 3400K key with 5500K fill, cozy contrast, gentle background bokeh',
  outdoor_night_street: 'sodium streetlamp from camera-right as key, cool blue ambient sky fill, wet-pavement reflections catching the highlights, 2600K warm on one cheek',
}

/** Resolve a lighting key to a physical description; pass free text through. */
export function resolveLighting(key?: string): string {
  if (!key) return LIGHTING_DESCRIPTIONS.window_light
  return LIGHTING_DESCRIPTIONS[key] ?? key
}

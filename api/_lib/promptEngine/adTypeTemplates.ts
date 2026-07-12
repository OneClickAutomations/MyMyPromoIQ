/**
 * Per-format beat structures + wizard questions for all 12 ad types.
 *
 * Beat patterns are extracted (structurally, not verbatim) from the smixs
 * visual-skills patterns-and-genres reference and the Cliprise UGC library:
 * each format follows a different beat order, hook mechanic, camera progression,
 * and asks the user a completely different set of questions.
 */
import type { AdTypeId } from './types.js'

export interface BeatDefinition {
  order: number
  /** HOOK | PROBLEM | DEMO | PROOF | CTA | REVEAL | REACTION | STEP | etc. */
  name: string
  durationSeconds: number
  /** Physical instruction template. Slots: {product} {creator} {scene}. */
  visualInstruction: string
  /** What the creator says in this beat (empty = b-roll/no dialogue). */
  dialogueTemplate: string
  /** Camera preset key (cameraVocabulary.CAMERA_PRESETS) or free text. */
  cameraKey: string
  /** Default ambient/SFX line for this beat. */
  sfx: string
  isRequired: boolean
}

export interface WizardQuestion {
  id: string
  question: string
  type: 'text' | 'select' | 'multiselect' | 'toggle'
  options?: string[]
  placeholder?: string
  /** Which CreativeBrief-ish field this answer feeds. */
  feedsIntoPromptField: string
}

export interface EnvironmentPreset {
  id: string
  label: string
  phrase: string
}

export interface AdTypeTemplate {
  id: AdTypeId
  displayName: string
  description: string
  previewExample: string
  /** Icon key the UI maps to an SVG/emoji (no external asset needed). */
  icon: string
  recommendedClipCount: number
  defaultClipDurationSeconds: number
  beats: BeatDefinition[]
  wizardQuestions: WizardQuestion[]
  defaultCameraProgression: string[]
  defaultLighting: string
  hookTypes: string[]
  platformNotes: string
  negativePromptAdditions: string[]
  /** Whether this format needs an on-camera creator. Defaults to true; set
   *  false for creator-less formats (product reveal) → the wizard SKIPS the
   *  Creator step and the engine builds a person-free prompt. */
  needsCreator?: boolean
  /** Environment options tailored to this format (a street interview belongs on
   *  a sidewalk, not a cozy living room). Falls back to the generic list when
   *  omitted. */
  environmentPresets?: EnvironmentPreset[]
}

// Reusable environment sets per format family.
const ENV_TALKING = [
  { id: 'bedroom_natural', label: 'Bedroom', phrase: 'a lived-in bedroom with soft natural light' },
  { id: 'bathroom_vanity', label: 'Bathroom Vanity', phrase: 'a bright bathroom vanity with a mirror' },
  { id: 'kitchen_counter', label: 'Kitchen', phrase: 'a kitchen counter with morning light' },
  { id: 'cozy_home_interior', label: 'Cozy Home', phrase: 'a cozy, lived-in home interior' },
]
const ENV_TABLETOP = [
  { id: 'clean_tabletop', label: 'Clean Desk', phrase: 'a clean, uncluttered desk surface' },
  { id: 'kitchen_counter', label: 'Kitchen Counter', phrase: 'a bright kitchen counter' },
  { id: 'wood_table', label: 'Wood Table', phrase: 'a warm wooden tabletop' },
]
const ENV_STREET = [
  { id: 'city_sidewalk', label: 'City Sidewalk', phrase: 'a busy city sidewalk with passersby' },
  { id: 'outdoor_market', label: 'Outdoor Market', phrase: 'a lively outdoor market' },
  { id: 'storefront', label: 'Storefront', phrase: 'in front of a storefront on a shopping street' },
  { id: 'park_path', label: 'Park', phrase: 'a park path with greenery behind' },
]
const ENV_REVEAL = [
  { id: 'wet_stone', label: 'Wet Stone', phrase: 'wet black stone under a single beam of light' },
  { id: 'seamless_studio', label: 'Studio Sweep', phrase: 'a clean seamless studio sweep' },
  { id: 'marble_pedestal', label: 'Marble Pedestal', phrase: 'a marble pedestal in soft shadow' },
  { id: 'bold_seamless', label: 'Bold Color', phrase: 'a bold, saturated seamless backdrop' },
]

/** durationSeconds * 2.5 words/second. */
export function beatMaxWords(durationSeconds: number): number {
  return Math.floor(durationSeconds * 2.5)
}

export const AD_TYPE_TEMPLATES: Record<AdTypeId, AdTypeTemplate> = {
  // ── UGC formats ────────────────────────────────────────────────────────────
  testimonial: {
    id: 'testimonial',
    displayName: 'Testimonial',
    description: 'A real person speaks straight to camera about the result they got.',
    previewExample: '"I didn\'t believe it either — until three weeks in."',
    icon: 'user-voice',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'HOOK', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} sits at {scene}, {product} resting on the surface beside them; they lean a few inches toward the lens as they start speaking, one eyebrow lifting.',
        dialogueTemplate: 'Honestly? {hook}',
        sfx: 'quiet room tone, faint street ambience through a window, one soft chair creak' },
      { order: 2, name: 'PROOF', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} picks up {product} and turns it once in the light so the label faces the lens, then sets it back down, eyes returning to camera.',
        dialogueTemplate: '{result}',
        sfx: 'room tone, soft contact sound as the product touches the surface' },
      { order: 3, name: 'CTA', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} holds {product} at chest height, label to camera, and gives a small nod on the last word.',
        dialogueTemplate: '{cta}',
        sfx: 'room tone, one quiet exhale' },
    ],
    wizardQuestions: [
      { id: 'result', question: 'What specific result did you get?', type: 'text', placeholder: 'e.g. My skin cleared up in three weeks', feedsIntoPromptField: 'proof' },
      { id: 'timeframe', question: 'How long did it take?', type: 'text', placeholder: 'e.g. About 3 weeks', feedsIntoPromptField: 'proof' },
      { id: 'hook', question: 'What\'s the one line that would stop a scroll?', type: 'text', placeholder: 'e.g. I almost returned it on day two', feedsIntoPromptField: 'hook' },
      { id: 'recommend', question: 'Would you recommend it, and to whom?', type: 'text', placeholder: 'e.g. Anyone who\'s tried everything', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'slow_push', 'talking_head'],
    defaultLighting: 'window_light',
    hookTypes: ['contrarian confession', 'result-first', 'skeptic-turned-believer'],
    platformNotes: 'TikTok/Reels: keep the first line under 2s and eyes locked to lens. Meta Feed: front-load the result so it reads with sound off.',
    negativePromptAdditions: ['scripted delivery', 'studio backdrop'],
    environmentPresets: ENV_TALKING,
  },

  unboxing: {
    id: 'unboxing',
    displayName: 'Unboxing',
    description: 'The package arrives and is opened on camera in real time — genuine reaction.',
    previewExample: 'Hands slice the tape, lift the lid, and freeze on what\'s inside.',
    icon: 'package',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'ARRIVAL', durationSeconds: 6, cameraKey: 'tabletop_45', isRequired: true,
        visualInstruction: 'Sealed shipping box sits on {scene}; {creator}\'s hands enter frame and slide a finger under the tape, lifting one flap.',
        dialogueTemplate: '{first_impression}',
        sfx: 'cardboard flex, tape peeling in one continuous pull, quiet room tone' },
      { order: 2, name: 'REVEAL', durationSeconds: 6, cameraKey: 'tabletop_overhead', isRequired: true,
        visualInstruction: '{creator}\'s hands lift {product} out of the packaging and hold it into the light, turning it once so the label faces the lens.',
        dialogueTemplate: '{surprise}',
        sfx: 'tissue paper rustle, a soft gasp, the product tapping the table once' },
      { order: 3, name: 'FIRST_USE', durationSeconds: 6, cameraKey: 'macro_detail', isRequired: false,
        visualInstruction: 'Macro on {creator}\'s fingers working {product} for the first time — a cap popping, a lid lifting, a texture appearing.',
        dialogueTemplate: '{cta}',
        sfx: 'crisp mechanical click of the product opening, close breath' },
    ],
    wizardQuestions: [
      { id: 'first_impression', question: 'What was your first impression of the packaging?', type: 'text', placeholder: 'e.g. It felt heavier and nicer than I expected', feedsIntoPromptField: 'hook' },
      { id: 'surprise', question: 'What surprised you most inside?', type: 'text', placeholder: 'e.g. The little handwritten card', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'What do you want the viewer to do?', type: 'text', placeholder: 'e.g. Link\'s in my bio', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['tabletop_45', 'tabletop_overhead', 'macro_detail'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['what\'s inside', 'genuine reaction', 'satisfying open'],
    platformNotes: 'ASMR-adjacent — sound sells this format. Keep hands always in frame; never cut away during the open.',
    negativePromptAdditions: ['pre-opened box', 'product already visible at start'],
    environmentPresets: ENV_TABLETOP,
  },

  problem_solution: {
    id: 'problem_solution',
    displayName: 'Problem / Solution',
    description: 'Show the pain first, then reveal the product as the fix.',
    previewExample: 'The old way fails on camera — then the product makes it effortless.',
    icon: 'wrench',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'PROBLEM', durationSeconds: 6, cameraKey: 'handheld_follow', isRequired: true,
        visualInstruction: '{creator} struggles with {problem} at {scene} — a visible, physical failure (spilling, fumbling, giving up), shoulders dropping.',
        dialogueTemplate: '{problem_line}',
        sfx: 'the frustrated sound of the failure — a clatter, a sigh, room tone' },
      { order: 2, name: 'SOLUTION', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} reaches for {product}, holds it label-to-lens, and uses it — the problem visibly resolving in one clean motion.',
        dialogueTemplate: '{solution_line}',
        sfx: 'a satisfying contact sound of the product working, a small relieved breath' },
      { order: 3, name: 'CTA', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} sets {product} down facing the lens and looks up with a small shrug, as if to say "that\'s it".',
        dialogueTemplate: '{cta}',
        sfx: 'room tone, one quiet exhale' },
    ],
    wizardQuestions: [
      { id: 'problem', question: 'What was the problem?', type: 'text', placeholder: 'e.g. My old blender left chunks every time', feedsIntoPromptField: 'problem' },
      { id: 'severity', question: 'How bad was it — what did it cost you?', type: 'text', placeholder: 'e.g. I\'d given up on smoothies entirely', feedsIntoPromptField: 'problem' },
      { id: 'solution_line', question: 'What happened when you tried the product?', type: 'text', placeholder: 'e.g. It was smooth on the first try', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. Do yourself a favor', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'slow_push', 'talking_head'],
    defaultLighting: 'kitchen_morning',
    hookTypes: ['relatable frustration', 'the old way vs the new way'],
    platformNotes: 'The problem beat must be instantly recognizable with sound off — exaggerate the physical failure slightly.',
    negativePromptAdditions: [],
  },

  day_in_the_life: {
    id: 'day_in_the_life',
    displayName: 'Day in the Life',
    description: 'The product appears naturally inside a real daily routine.',
    previewExample: 'Coffee, morning light, and the product slotting into the routine.',
    icon: 'sun',
    recommendedClipCount: 4,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'MORNING', durationSeconds: 6, cameraKey: 'handheld_follow', isRequired: true,
        visualInstruction: '{creator} moves through {scene} in an unhurried morning beat; {product} sits in the background, not yet the focus.',
        dialogueTemplate: '{routine_line}',
        sfx: 'kettle, distant traffic, footsteps on a wood floor' },
      { order: 2, name: 'MOMENT', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} reaches for {product} as a natural part of the routine, using it without ceremony, label passing the lens.',
        dialogueTemplate: '{use_line}',
        sfx: 'the specific sound of the product being used, soft ambient room tone' },
      { order: 3, name: 'PAYOFF', durationSeconds: 6, cameraKey: 'talking_head', isRequired: false,
        visualInstruction: '{creator} pauses, a small satisfied moment — a sip, a stretch, a glance out the window — {product} resting in frame.',
        dialogueTemplate: '{payoff_line}',
        sfx: 'a quiet exhale, birds or street sound through a window' },
      { order: 4, name: 'CTA', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} picks up {product}, label to lens, and gives a relaxed nod.',
        dialogueTemplate: '{cta}',
        sfx: 'room tone' },
    ],
    wizardQuestions: [
      { id: 'routine', question: 'What part of your day does this fit into?', type: 'text', placeholder: 'e.g. My 6am before the kids wake up', feedsIntoPromptField: 'scene' },
      { id: 'use_line', question: 'How do you actually use it?', type: 'text', placeholder: 'e.g. Two pumps while the coffee brews', feedsIntoPromptField: 'proof' },
      { id: 'payoff', question: 'What\'s the small payoff you feel?', type: 'text', placeholder: 'e.g. That one calm minute', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. It\'s the little things', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'slow_push', 'talking_head', 'talking_head'],
    defaultLighting: 'golden_hour',
    hookTypes: ['aspirational-but-real', 'a calm moment', 'relatable routine'],
    platformNotes: 'Lean into believable imperfection — a slightly messy counter reads more authentic than a staged set.',
    negativePromptAdditions: ['staged set', 'overly tidy background'],
  },

  before_after: {
    id: 'before_after',
    displayName: 'Before / After',
    description: 'A transformation shown across the clip — the change is the story.',
    previewExample: 'Dull and tired, then the visible turn after the product.',
    icon: 'arrows-swap',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'BEFORE', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} shows the "before" state plainly at {scene} — {before_state} clearly visible, expression flat.',
        dialogueTemplate: '{before_line}',
        sfx: 'quiet room tone, no music yet' },
      { order: 2, name: 'APPLY', durationSeconds: 6, cameraKey: 'macro_detail', isRequired: true,
        visualInstruction: 'Macro on {creator} applying/using {product}, label passing the lens, a single continuous motion.',
        dialogueTemplate: '{apply_line}',
        sfx: 'the specific application sound, a soft breath' },
      { order: 3, name: 'AFTER', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} reveals the "after" — {after_state} — with a small genuine reaction, {product} held to lens on the last beat.',
        dialogueTemplate: '{cta}',
        sfx: 'an upbeat breath, room tone lifting' },
    ],
    wizardQuestions: [
      { id: 'before_state', question: 'Describe the "before" state specifically.', type: 'text', placeholder: 'e.g. Frizzy, dry, impossible to manage', feedsIntoPromptField: 'problem' },
      { id: 'after_state', question: 'What changed after using the product?', type: 'text', placeholder: 'e.g. Smooth and shiny, no frizz', feedsIntoPromptField: 'proof' },
      { id: 'timeframe', question: 'Over what timeframe?', type: 'text', placeholder: 'e.g. One wash', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. I\'m never going back', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'macro_detail', 'slow_push'],
    defaultLighting: 'beauty',
    hookTypes: ['visible transformation', 'the reveal'],
    platformNotes: 'Keep lighting IDENTICAL between before and after or the transformation reads as a lighting trick, not the product.',
    negativePromptAdditions: ['different lighting between before and after', 'filter change mid-clip'],
  },

  tutorial: {
    id: 'tutorial',
    displayName: 'Tutorial / How-To',
    description: 'A step-by-step how-to with the product as the tool.',
    previewExample: '"Three steps. Step one — and this is the part people skip."',
    icon: 'list-checks',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'STEP_1', durationSeconds: 6, cameraKey: 'tabletop_45', isRequired: true,
        visualInstruction: '{creator} demonstrates step one with {product} at {scene}, hands clearly in frame, one deliberate motion.',
        dialogueTemplate: 'Step one: {step1}',
        sfx: 'the sound of the step being performed, room tone' },
      { order: 2, name: 'STEP_2', durationSeconds: 6, cameraKey: 'tabletop_overhead', isRequired: true,
        visualInstruction: 'Overhead on {creator}\'s hands performing step two with {product}, label passing the lens.',
        dialogueTemplate: 'Step two: {step2}',
        sfx: 'the specific action sound, quiet ambience' },
      { order: 3, name: 'STEP_3', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} finishes with step three and holds up the result, {product} beside it label-to-lens.',
        dialogueTemplate: 'Step three: {step3}',
        sfx: 'a small finishing tap, satisfied breath' },
    ],
    wizardQuestions: [
      { id: 'step1', question: 'What\'s step 1?', type: 'text', placeholder: 'e.g. Start on damp hair', feedsIntoPromptField: 'proof' },
      { id: 'step2', question: 'What\'s step 2?', type: 'text', placeholder: 'e.g. Work it through mid-lengths', feedsIntoPromptField: 'proof' },
      { id: 'step3', question: 'What\'s step 3?', type: 'text', placeholder: 'e.g. Air-dry, don\'t touch it', feedsIntoPromptField: 'proof' },
      { id: 'mistake', question: 'What common mistake should viewers avoid?', type: 'text', placeholder: 'e.g. Using too much', feedsIntoPromptField: 'hook' },
    ],
    defaultCameraProgression: ['tabletop_45', 'tabletop_overhead', 'slow_push'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['numbered steps', 'the mistake everyone makes'],
    platformNotes: 'Number the steps on the audio so it works saved-for-later. Keep each step to one clean physical action.',
    negativePromptAdditions: [],
  },

  street_interview: {
    id: 'street_interview',
    displayName: 'Street Interview',
    description: 'A "stranger on the street" discovers and reacts to the product.',
    previewExample: '"Have you ever tried this?" — handed over, tested live.',
    icon: 'microphone',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'APPROACH', durationSeconds: 6, cameraKey: 'handheld_follow', isRequired: true,
        visualInstruction: '{creator} stands on {scene} (a sidewalk, a market), an off-screen interviewer just handed them {product}; they look at it, curious.',
        dialogueTemplate: '{question}',
        sfx: 'outdoor street ambience, passing footsteps, distant traffic' },
      { order: 2, name: 'REACTION', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} tries {product} on the spot, label passing the lens, and reacts genuinely — eyebrows up, a laugh.',
        dialogueTemplate: '{reaction}',
        sfx: 'the product sound, a surprised laugh, street ambience' },
      { order: 3, name: 'VERDICT', durationSeconds: 6, cameraKey: 'handheld_follow', isRequired: true,
        visualInstruction: '{creator} holds {product} up toward the interviewer/lens and gives their verdict with a nod.',
        dialogueTemplate: '{verdict}',
        sfx: 'street ambience, a car passing' },
    ],
    wizardQuestions: [
      { id: 'question', question: 'What does the interviewer ask?', type: 'text', placeholder: 'e.g. Ever paid $80 for this?', feedsIntoPromptField: 'hook' },
      { id: 'reaction', question: 'What\'s the honest first reaction?', type: 'text', placeholder: 'e.g. Wait, that\'s actually good', feedsIntoPromptField: 'proof' },
      { id: 'verdict', question: 'What\'s the final verdict?', type: 'text', placeholder: 'e.g. Yeah, I\'d buy this', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'talking_head', 'handheld_follow'],
    defaultLighting: 'outdoor_daylight',
    hookTypes: ['candid stranger', 'live test', 'unscripted reaction'],
    platformNotes: 'Handheld and outdoor ambience sell authenticity. A slightly imperfect frame beats a stable one here.',
    negativePromptAdditions: ['studio backdrop', 'perfectly stable tripod'],
    environmentPresets: ENV_STREET,
  },

  pov: {
    id: 'pov',
    displayName: 'POV',
    description: 'First-person camera — the viewer is the one experiencing the product.',
    previewExample: 'Your hands reach in, pick it up, and use it — you\'re there.',
    icon: 'eye',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'POV_SETUP', durationSeconds: 6, cameraKey: 'pov_first_person', isRequired: true,
        visualInstruction: 'First-person view at {scene}: the viewer\'s own hands enter from the bottom of the frame and reach toward {product}.',
        dialogueTemplate: '{pov_hook}',
        sfx: 'close, intimate room tone, the soft sound of hands moving' },
      { order: 2, name: 'POV_USE', durationSeconds: 6, cameraKey: 'pov_first_person', isRequired: true,
        visualInstruction: 'The viewer\'s hands pick up {product}, label filling the lower frame, and use it — the action happening right at the camera.',
        dialogueTemplate: '{pov_use}',
        sfx: 'the specific product sound up close, a quiet breath' },
      { order: 3, name: 'POV_PAYOFF', durationSeconds: 6, cameraKey: 'pov_first_person', isRequired: true,
        visualInstruction: 'First-person: the result is revealed in the viewer\'s own hands, {product} set down in frame.',
        dialogueTemplate: '{cta}',
        sfx: 'a satisfied exhale, close room tone' },
    ],
    wizardQuestions: [
      { id: 'pov_hook', question: 'What\'s the "you" moment that opens it?', type: 'text', placeholder: 'e.g. It\'s 7am and you reach for this', feedsIntoPromptField: 'hook' },
      { id: 'pov_use', question: 'What does the viewer do with it?', type: 'text', placeholder: 'e.g. One press and you\'re done', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close the POV?', type: 'text', placeholder: 'e.g. This is your new normal', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['pov_first_person', 'pov_first_person', 'pov_first_person'],
    defaultLighting: 'window_light',
    hookTypes: ['you-are-there', 'first-person immersion'],
    platformNotes: 'Never show the creator\'s face — the viewer IS the creator. Hands must enter from the bottom edge, never the sides.',
    negativePromptAdditions: ['creator face visible', 'third-person angle', 'hands entering from the sides'],
  },

  // ── Commercial formats ──────────────────────────────────────────────────────
  product_reveal: {
    id: 'product_reveal',
    displayName: 'Product Reveal',
    description: 'A cinematic unveiling of the product — no creator needed.',
    previewExample: 'The product turns slowly in the light, label catching the key.',
    icon: 'sparkle',
    recommendedClipCount: 2,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'REVEAL', durationSeconds: 6, cameraKey: 'reveal_orbit', isRequired: true,
        visualInstruction: '{product} alone on a clean surface at {scene}; the camera arcs slowly around it as the key light rakes across the label.',
        dialogueTemplate: '',
        sfx: 'a low sustained tone rising, a single soft chime as the label catches the light' },
      { order: 2, name: 'HERO', durationSeconds: 6, cameraKey: 'macro_detail', isRequired: true,
        visualInstruction: 'Macro on {product}\'s texture and label, then a slow pull to a clean hero frame, label squared to the lens.',
        dialogueTemplate: '{tagline}',
        sfx: 'the tone resolving, a crisp settle as the product lands in its hero position' },
    ],
    wizardQuestions: [
      { id: 'tagline', question: 'What\'s the one-line tagline (spoken or on the beat)?', type: 'text', placeholder: 'e.g. Made for the ones who notice', feedsIntoPromptField: 'cta' },
      { id: 'surface', question: 'What surface / setting should it sit on?', type: 'text', placeholder: 'e.g. Wet black stone', feedsIntoPromptField: 'scene' },
      { id: 'mood', question: 'What single mood word (we translate it to light)?', type: 'select', options: ['luxury', 'clean/minimal', 'bold/energetic', 'warm/natural'], feedsIntoPromptField: 'lighting' },
    ],
    defaultCameraProgression: ['reveal_orbit', 'macro_detail'],
    defaultLighting: 'luxury_commercial',
    hookTypes: ['cinematic unveil', 'texture and light'],
    platformNotes: 'No dialogue in the reveal beat — let sound design and one clean tagline carry it. Works 1:1 and 9:16.',
    negativePromptAdditions: ['creator in frame', 'hands in frame', 'cluttered background'],
    needsCreator: false,
    environmentPresets: ENV_REVEAL,
  },

  comparison: {
    id: 'comparison',
    displayName: 'Comparison',
    description: 'Side-by-side against the "other option" (never a named competitor).',
    previewExample: 'Left: the generic way. Right: the product. The gap is obvious.',
    icon: 'columns',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'OLD_WAY', durationSeconds: 6, cameraKey: 'split_static', isRequired: true,
        visualInstruction: 'On the left third at {scene}, a plain unbranded alternative performs {old_way} poorly — a visible shortfall.',
        dialogueTemplate: '{old_way_line}',
        sfx: 'a flat, underwhelming sound of the old way, room tone' },
      { order: 2, name: 'NEW_WAY', durationSeconds: 6, cameraKey: 'split_static', isRequired: true,
        visualInstruction: 'On the right third, {product} performs the same task cleanly, label to lens — the contrast plain to see.',
        dialogueTemplate: '{new_way_line}',
        sfx: 'a crisp, satisfying sound of the product working' },
      { order: 3, name: 'VERDICT', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{product} held center-frame, label to lens, the alternative set aside and out of focus.',
        dialogueTemplate: '{cta}',
        sfx: 'room tone, one confident tap of the product on the surface' },
    ],
    wizardQuestions: [
      { id: 'old_way', question: 'What does the "other way" do worse?', type: 'text', placeholder: 'e.g. Leaves streaks', feedsIntoPromptField: 'problem' },
      { id: 'new_way_line', question: 'What does your product do better?', type: 'text', placeholder: 'e.g. One pass, no streaks', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. Why settle?', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['split_static', 'split_static', 'slow_push'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['the obvious gap', 'why settle'],
    platformNotes: 'Never show or name a real competitor brand — use a plain unbranded stand-in. Keep both sides in identical light.',
    negativePromptAdditions: ['named competitor brand', 'recognizable rival logo', 'different lighting per side'],
    environmentPresets: ENV_TABLETOP,
  },

  founder_story: {
    id: 'founder_story',
    displayName: 'Founder Story',
    description: 'The founder explains, to camera, why they made the product.',
    previewExample: '"I made this because nothing out there actually worked for me."',
    icon: 'heart',
    recommendedClipCount: 3,
    defaultClipDurationSeconds: 6,
    beats: [
      { order: 1, name: 'WHY', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} sits at {scene} (a workshop, a kitchen table), {product} in front of them, and speaks with quiet conviction, one hand resting near it.',
        dialogueTemplate: '{why}',
        sfx: 'intimate room tone, a soft distant sound of the workspace' },
      { order: 2, name: 'HOW', durationSeconds: 6, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} picks up {product}, turns it once to the lens, and describes what they changed, eyes down at it then back up.',
        dialogueTemplate: '{how}',
        sfx: 'the product handled gently, room tone' },
      { order: 3, name: 'INVITE', durationSeconds: 6, cameraKey: 'talking_head', isRequired: true,
        visualInstruction: '{creator} holds {product} at chest height, label to lens, and offers a warm, direct invitation.',
        dialogueTemplate: '{cta}',
        sfx: 'room tone, a small sincere breath' },
    ],
    wizardQuestions: [
      { id: 'why', question: 'Why did you make this?', type: 'text', placeholder: 'e.g. Everything on the shelf let me down', feedsIntoPromptField: 'hook' },
      { id: 'how', question: 'What did you do differently?', type: 'text', placeholder: 'e.g. No fillers, made in small batches', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you invite them in?', type: 'text', placeholder: 'e.g. Give it one honest week', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'slow_push', 'talking_head'],
    defaultLighting: 'window_light',
    hookTypes: ['origin story', 'personal conviction', 'the gap I found'],
    platformNotes: 'Sincerity over polish. A real workspace behind the founder outperforms a clean studio.',
    negativePromptAdditions: ['corporate boardroom', 'stock-footage feel'],
  },

  hook_only: {
    id: 'hook_only',
    displayName: 'Hook Only',
    description: 'A pure pattern-interrupt hook — 4 to 6 seconds, no explanation.',
    previewExample: 'One jarring, curiosity-spiking beat that stops the thumb cold.',
    icon: 'zap',
    recommendedClipCount: 1,
    defaultClipDurationSeconds: 4,
    beats: [
      { order: 1, name: 'HOOK', durationSeconds: 4, cameraKey: 'slow_push', isRequired: true,
        visualInstruction: '{creator} does one arresting physical thing with {product} at {scene} — a fast reach, a snap of motion, a surprised look straight into the lens.',
        dialogueTemplate: '{hook}',
        sfx: 'a sharp attention-grabbing sound on the first frame, then room tone' },
    ],
    wizardQuestions: [
      { id: 'hook', question: 'What\'s the single pattern-interrupt line?', type: 'text', placeholder: 'e.g. Stop scrolling — you need to see this', feedsIntoPromptField: 'hook' },
      { id: 'action', question: 'What\'s the one physical thing on screen?', type: 'text', placeholder: 'e.g. I dump the whole thing out', feedsIntoPromptField: 'proof' },
    ],
    defaultCameraProgression: ['slow_push'],
    defaultLighting: 'beauty',
    hookTypes: ['pattern interrupt', 'open loop', 'shock open'],
    platformNotes: 'Built to be the first 4s of a longer edit or a standalone scroll-stopper. Front-load everything into frame one.',
    negativePromptAdditions: [],
  },
}

export const AD_TYPE_ORDER: AdTypeId[] = [
  'testimonial', 'unboxing', 'problem_solution', 'day_in_the_life',
  'before_after', 'tutorial', 'street_interview', 'pov',
  'product_reveal', 'comparison', 'founder_story', 'hook_only',
]

export function getTemplate(adType: AdTypeId): AdTypeTemplate {
  return AD_TYPE_TEMPLATES[adType] ?? AD_TYPE_TEMPLATES.testimonial
}

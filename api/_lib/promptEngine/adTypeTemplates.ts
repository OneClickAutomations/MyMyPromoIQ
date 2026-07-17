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
  /** 'image' renders a real upload dropzone (thumbnail preview, stored as a
   *  data URL) — used where a format structurally needs a second photo the
   *  main product shot doesn't cover (packaging, a before/after pair). */
  type: 'text' | 'select' | 'multiselect' | 'toggle' | 'image'
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
   *  false for creator-less formats (product reveal, comparison, POV) → the
   *  wizard SKIPS the Creator step and the engine builds a person-free prompt. */
  needsCreator?: boolean
  /** The expert "skill" for this format — explicit direction telling the AI
   *  exactly how a specialist would shoot it. Distilled from the
   *  smixs/visual-skills references (dramaturgy montage patterns, genre
   *  modules, Veo rules) + Cliprise UGC structures. Injected verbatim into the
   *  storyboard planner and Creative Direction so the output is unmistakably
   *  this format, never a generic product hero shot. */
  expertSkill: string
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
// Founder story reads as documentary intimacy — real places where a thing is made.
const ENV_FOUNDER = [
  { id: 'workshop_bench', label: 'Workshop', phrase: 'a working bench with tools and materials behind them' },
  { id: 'kitchen_table', label: 'Kitchen Table', phrase: 'a home kitchen table with soft window light' },
  { id: 'small_studio', label: 'Studio', phrase: 'a small maker studio with shelves of product batches' },
  { id: 'home_office', label: 'Home Office', phrase: 'a lived-in home office, plants and papers in frame' },
]
// Day in the life — the routine's real rooms, imperfect and unstaged.
const ENV_ROUTINE = [
  { id: 'morning_kitchen', label: 'Morning Kitchen', phrase: 'a kitchen mid-morning-routine, coffee and clutter in frame' },
  { id: 'bedroom_natural', label: 'Bedroom', phrase: 'a lived-in bedroom with soft natural light' },
  { id: 'bathroom_vanity', label: 'Bathroom', phrase: 'a bright bathroom vanity mid-routine' },
  { id: 'entryway_desk', label: 'Desk / Entryway', phrase: 'a desk or entryway with keys, a mug, everyday mess' },
]
// Before/after — beauty-grade settings where identical light can be held.
const ENV_BEAUTY = [
  { id: 'bathroom_vanity', label: 'Bathroom Vanity', phrase: 'a bathroom vanity with an even mirror light' },
  { id: 'bedroom_vanity', label: 'Bedroom Vanity', phrase: 'a bedroom vanity with steady soft window light' },
  { id: 'beauty_seat', label: 'Window Seat', phrase: 'a window seat with flat, consistent daylight' },
  { id: 'clean_backdrop', label: 'Clean Backdrop', phrase: 'a plain neutral backdrop with unchanging light' },
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
      { id: 'result', question: 'What specific result did you get? Be specific — vague results make weak testimonials.', type: 'text', placeholder: 'e.g. My skin cleared up in three weeks (not "it works great")', feedsIntoPromptField: 'proof' },
      { id: 'timeframe', question: 'How long did it take to see results?', type: 'select', options: ['Same day', '2-3 days', '1 week', '2 weeks', '1 month'], feedsIntoPromptField: 'proof' },
      { id: 'skeptical', question: 'Were you skeptical before trying it?', type: 'select', options: ['Yes, very', 'A little', 'Not really'], feedsIntoPromptField: 'hook' },
      { id: 'hook', question: 'What\'s the one line that would stop a scroll?', type: 'text', placeholder: 'e.g. I almost returned it on day two', feedsIntoPromptField: 'hook' },
      { id: 'recommend', question: 'Would you recommend it, and to whom?', type: 'text', placeholder: 'e.g. Anyone who\'s tried everything', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'slow_push', 'talking_head'],
    defaultLighting: 'window_light',
    hookTypes: ['contrarian confession', 'result-first', 'skeptic-turned-believer'],
    platformNotes: 'TikTok/Reels: keep the first line under 2s and eyes locked to lens. Meta Feed: front-load the result so it reads with sound off.',
    expertSkill: 'You are shooting UGC social (genre: authentic, vertical, direct-to-camera). Handheld with natural drift, real window light, a lived-in room — never studio polish. Structure as a first-person account: open MID-STORY (no greeting, no setup), agitate the before-state in one breath, credit the product with ONE specific, checkable result (a number, a timeframe), and close on a personal recommendation. The proof beat IS the testimonial — make it the emotional peak. Every shot needs an environmental pressure (steam, window rain, morning light), a physical micro-action (leans in, taps the jar, small head shake), and a sound anchor (room tone, a click). Eyes stay locked to the lens; delivery is telling a friend, not reading an ad.',
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
      { id: 'packaging_image', question: 'Show us the packaging — upload a photo of the box, mailer, or bag it arrives in', type: 'image', feedsIntoPromptField: 'scene' },
      { id: 'order_reason', question: 'Why did you order this?', type: 'text', placeholder: 'e.g. My skin has been so dry this winter', feedsIntoPromptField: 'hook' },
      { id: 'packaging_type', question: 'What kind of packaging does it arrive in?', type: 'select', options: ['Retail box', 'Mailer', 'Bag', 'Gift box', 'Bottle in box'], feedsIntoPromptField: 'scene' },
      { id: 'packaging_quality', question: 'How nice is the packaging?', type: 'select', options: ['Budget — plain/basic', 'Standard', 'Premium', 'Luxury — really impressive'], feedsIntoPromptField: 'hook' },
      { id: 'extras', question: 'Anything else in the box?', type: 'multiselect', options: ['Tissue paper', 'Ribbon', 'Thank-you card', 'Freebie', 'Sample', 'Packing peanuts', 'None'], feedsIntoPromptField: 'proof' },
      { id: 'first_impression', question: 'What was your first impression of the packaging?', type: 'text', placeholder: 'e.g. It felt heavier and nicer than I expected', feedsIntoPromptField: 'hook' },
      { id: 'surprise', question: 'What surprised you most inside?', type: 'text', placeholder: 'e.g. The little handwritten card', feedsIntoPromptField: 'proof' },
      { id: 'opening_energy', question: 'Opening energy?', type: 'select', options: ['Calm and genuine', 'Pleasantly surprised', 'Genuinely excited', 'Skeptical → surprised'], feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'What do you want the viewer to do?', type: 'text', placeholder: 'e.g. Link\'s in my bio', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['tabletop_45', 'tabletop_overhead', 'macro_detail'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['what\'s inside', 'genuine reaction', 'satisfying open'],
    platformNotes: 'ASMR-adjacent — sound sells this format. Keep hands always in frame; never cut away during the open.',
    expertSkill: 'You are shooting commercial product drama (pattern: anticipation → reveal → macro texture → reaction → first use). Sound IS the content: tape ripping in one continuous pull, cardboard flexing, tissue rustle, the first click of the product — specify a crisp sound event in every beat. Hands never leave frame during the open; the product is NOT visible until the reveal beat; open in real time with no jump cuts mid-unboxing. Camera grammar: 45-degree tabletop for the arrival, overhead for the lift-out, macro insert for first touch. The emotional beat is the half-second pause AFTER the lid opens — hold it before the reaction. If extras (a thank-you card, a freebie, tissue paper) were named, give ONE of them its own beat — pulling out a handwritten card is a genuine reaction moment, not a footnote.',
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
      { id: 'problem', question: 'What was the problem? Describe the frustration in your own words.', type: 'text', placeholder: 'e.g. My old blender left chunks every time', feedsIntoPromptField: 'problem' },
      { id: 'intensity', question: 'How intense was the problem?', type: 'select', options: ['Mild annoyance', 'Real struggle', 'Desperate'], feedsIntoPromptField: 'problem' },
      { id: 'duration', question: 'How long had this been a problem?', type: 'select', options: ['Recent', 'Months', 'Years', 'Forever'], feedsIntoPromptField: 'problem' },
      { id: 'tried_already', question: 'What did you already try that didn\'t work?', type: 'text', placeholder: 'e.g. Cheaper blenders, pre-chopping everything', feedsIntoPromptField: 'problem' },
      { id: 'severity', question: 'How bad was it — what did it cost you?', type: 'text', placeholder: 'e.g. I\'d given up on smoothies entirely', feedsIntoPromptField: 'problem' },
      { id: 'solution_line', question: 'What happened when you tried the product?', type: 'text', placeholder: 'e.g. It was smooth on the first try', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. Do yourself a favor', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'slow_push', 'talking_head'],
    defaultLighting: 'kitchen_morning',
    hookTypes: ['relatable frustration', 'the old way vs the new way'],
    platformNotes: 'The problem beat must be instantly recognizable with sound off — exaggerate the physical failure slightly.',
    expertSkill: 'You are shooting a contrast story built on a deliberate LIGHTING TURN. The problem beat is cool and cluttered — flat, slightly harsh or dim light, messy counter, tight nervous framing — and the moment the product solves it the world visibly warms and opens: light lifts, shadows soften, the frame breathes wider. That lighting shift IS the emotional payoff and must be legible with sound off. The pain must be PHYSICAL and on-camera first — a real failed attempt (spill, fumble, mess), shoulders dropping, an audible sigh — never a narrated complaint over neutral footage. The solution lands in ONE clean motion with a satisfying contact sound; the framing must let the viewer SEE the before/after difference, not be told it. Close with a shrug-to-lens that-is-it beat in the new warm light. If the user named things they already tried, work ONE into the problem beat as a physical prop (the failed gadget visible and pushed aside) — it is the agitation that makes this product read as the thing that finally worked, not just another option.',
    negativePromptAdditions: ['narrated complaint over neutral footage', 'identical mood before and after'],
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
      { id: 'routine_slot', question: 'When do you use this?', type: 'multiselect', options: ['Morning routine', 'Night routine', 'Pre-workout', 'Post-workout', 'With coffee', 'With meals', 'Travel', 'Work desk', 'Shower/bath'], feedsIntoPromptField: 'scene' },
      { id: 'routine', question: 'What part of your day does this fit into? Describe the vibe in one sentence.', type: 'text', placeholder: 'e.g. My 6am before the kids wake up, cozy and slow', feedsIntoPromptField: 'scene' },
      { id: 'use_line', question: 'How do you actually use it?', type: 'text', placeholder: 'e.g. Two pumps while the coffee brews', feedsIntoPromptField: 'proof' },
      { id: 'payoff', question: 'What\'s the small payoff you feel?', type: 'text', placeholder: 'e.g. That one calm minute', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. It\'s the little things', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'slow_push', 'talking_head', 'talking_head'],
    defaultLighting: 'golden_hour',
    hookTypes: ['aspirational-but-real', 'a calm moment', 'relatable routine'],
    platformNotes: 'Lean into believable imperfection — a slightly messy counter reads more authentic than a staged set.',
    expertSkill: 'You are shooting lifestyle b-roll woven around a routine (genre: day-in-the-life). The product is NEVER pitched head-on — it enters mid-scene as a natural step in the routine, used without ceremony, often half out of focus before the hand finds it. Handheld follow at eye level, golden ambient light that shifts naturally across the day, real environmental mess (a mug, keys, an unmade corner) — believable imperfection outperforms staging. The signature move is the OVERLOOKED-then-noticed beat: the product sits ignored in the background of an earlier shot, then becomes the quiet hinge of the routine. Proof is shown through the person\'s genuine micro-reaction (a pause, an exhale, a second glance out the window), never a spoken claim. Dialogue is soft voiceover cadence, half-heard, like narrating your own morning to no one — never ad copy.',
    negativePromptAdditions: ['staged set', 'overly tidy background'],
    environmentPresets: ENV_ROUTINE,
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
      { id: 'before_image', question: 'Before photo (optional — upload or just describe it below)', type: 'image', feedsIntoPromptField: 'problem' },
      { id: 'after_image', question: 'After photo (optional — upload or just describe it below)', type: 'image', feedsIntoPromptField: 'proof' },
      { id: 'before_state', question: 'Describe the "before" state specifically.', type: 'text', placeholder: 'e.g. Frizzy, dry, impossible to manage', feedsIntoPromptField: 'problem' },
      { id: 'after_state', question: 'What changed after using the product?', type: 'text', placeholder: 'e.g. Smooth and shiny, no frizz', feedsIntoPromptField: 'proof' },
      { id: 'timeframe', question: 'Over what timeframe?', type: 'select', options: ['1 week', '2 weeks', '1 month', '3 months'], feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. I\'m never going back', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'macro_detail', 'slow_push'],
    defaultLighting: 'beauty',
    hookTypes: ['visible transformation', 'the reveal'],
    platformNotes: 'Keep lighting IDENTICAL between before and after or the transformation reads as a lighting trick, not the product.',
    expertSkill: 'You are shooting a transformation. The ONLY thing that may change between the before and after states is the subject itself — identical framing, identical lens, identical lighting direction and color temperature, or the transformation reads as a camera trick and credibility dies. Shoot the application as a macro insert (fingers, texture, product label passing the lens). The after-reveal is the emotional peak: a small, genuine reaction, not a gasp. State the timeframe out loud — specificity is the proof.',
    negativePromptAdditions: ['different lighting between before and after', 'filter change mid-clip'],
    environmentPresets: ENV_BEAUTY,
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
      { id: 'step4', question: 'Step 4? (optional — 4 max, more gets long for short-form)', type: 'text', placeholder: 'e.g. Touch up with a drop of oil after', feedsIntoPromptField: 'proof' },
      { id: 'mistake', question: 'What common mistake should viewers avoid? (strong retention hook)', type: 'text', placeholder: 'e.g. Using too much', feedsIntoPromptField: 'hook' },
      { id: 'camera_style', question: 'Camera style for the demo?', type: 'select', options: ['Eye level — talking head', 'Overhead — hands', 'Split — talking + overhead'], feedsIntoPromptField: 'scene' },
    ],
    defaultCameraProgression: ['tabletop_45', 'tabletop_overhead', 'slow_push'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['numbered steps', 'the mistake everyone makes'],
    platformNotes: 'Number the steps on the audio so it works saved-for-later. Keep each step to one clean physical action.',
    expertSkill: 'You are shooting an instructional demo (genre: clarity above all). Spoken numbered steps so it works saved-for-later and sound-off with captions. SIGNATURE MOTIF: return to the SAME clean overhead "reset" frame at the start of every step — identical camera height, identical layout — so each step reads as a beat in a rhythm and the viewer never loses their place; the repetition is the format\'s fingerprint. One clean physical action per step — never two motions in one beat, no speed ramps, hands and product fully visible. Name the common mistake mid-way and physically show the WRONG way for half a second before the right way (contrast is the retention hook). End on the finished result held beside the product, label to lens.',
    negativePromptAdditions: ['jump cut mid-step', 'two actions in one step'],
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
      { id: 'interview_style', question: 'Interview style?', type: 'select', options: ['"Have you tried this?" — brand awareness', 'Show product, get first reaction — raw discovery', 'Results interview — "your skin looks amazing..."'], feedsIntoPromptField: 'hook' },
      { id: 'question', question: 'What does the interviewer ask?', type: 'text', placeholder: 'e.g. Ever paid $80 for this?', feedsIntoPromptField: 'hook' },
      { id: 'initial_reaction', question: 'Initial reaction to capture?', type: 'select', options: ['Skeptical then curious', 'Never heard of it', 'Already a fan', 'Would try it'], feedsIntoPromptField: 'proof' },
      { id: 'reaction', question: 'What\'s the honest first reaction?', type: 'text', placeholder: 'e.g. Wait, that\'s actually good', feedsIntoPromptField: 'proof' },
      { id: 'verdict', question: 'What\'s the final verdict?', type: 'text', placeholder: 'e.g. Yeah, I\'d buy this', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['handheld_follow', 'talking_head', 'handheld_follow'],
    defaultLighting: 'outdoor_daylight',
    hookTypes: ['candid stranger', 'live test', 'unscripted reaction'],
    platformNotes: 'Handheld and outdoor ambience sell authenticity. A slightly imperfect frame beats a stable one here.',
    expertSkill: 'You are shooting man-on-the-street. Authenticity signals ARE the format: outdoor ambience (traffic wash, passersby cutting through frame, wind on the mic), handheld imperfection with a real reframe or refocus, an off-screen interviewer\'s question audibly starting the clip. Make the cadence concretely unscripted: a false start or filler ("um— wait, really?"), the eyes flicking to the off-screen interviewer before answering, a half-laugh, and a visible beat of SKEPTICISM before trying the product — the arms-crossed doubt is what makes the turn land. Then a genuine, involuntary surprised reaction ON camera the instant they try it (eyebrows up, a step back). The verdict is tossed to the interviewer, only half to lens. Never let it feel staged: no perfect framing, no studio silence, no polished delivery.',
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
      { id: 'scenario', question: 'What moment are we capturing from the viewer\'s eyes?', type: 'select', options: ['Receiving and opening it for the first time', 'Using it in your morning routine', 'Seeing the result in the mirror', 'Someone noticing and asking about it'], feedsIntoPromptField: 'hook' },
      { id: 'pov_hook', question: 'What\'s the "you" moment that opens it?', type: 'text', placeholder: 'e.g. It\'s 7am and you reach for this', feedsIntoPromptField: 'hook' },
      { id: 'pov_use', question: 'What does the viewer do with it?', type: 'text', placeholder: 'e.g. One press and you\'re done', feedsIntoPromptField: 'proof' },
      { id: 'audio_style', question: 'Audio style?', type: 'select', options: ['Voiceover (internal thoughts)', 'Natural sounds only', 'Trending audio (no dialogue)'], feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close the POV?', type: 'text', placeholder: 'e.g. This is your new normal', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['pov_first_person', 'pov_first_person', 'pov_first_person'],
    defaultLighting: 'window_light',
    hookTypes: ['you-are-there', 'first-person immersion'],
    platformNotes: 'Never show the creator\'s face — the viewer IS the creator. Hands must enter from the bottom edge, never the sides.',
    expertSkill: 'You are shooting strict first-person POV — the camera IS the viewer\'s eyes. Hands enter from the BOTTOM edge only, never the sides; the face is never visible, no mirrors. Subtle natural head-sway on the camera, intimate close-mic audio (breath, fabric, the product\'s sounds inches away). The arc is embodiment: reach → handle → use → payoff, all at arm\'s length. Dialogue is inner-voice narration in you-language, quiet and close.',
    negativePromptAdditions: ['creator face visible', 'third-person angle', 'hands entering from the sides'],
    needsCreator: false,
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
      { id: 'reveal_style', question: 'Reveal style?', type: 'select', options: ['Slow orbit — camera circles the product', 'Hand reveal — hand carries it into frame', 'Box open — packaging reveals it inside', 'Mist reveal — emerges from atmosphere', 'Macro to wide — starts extreme close-up'], feedsIntoPromptField: 'scene' },
      { id: 'tagline', question: 'What\'s the one-line tagline (spoken or on the beat)?', type: 'text', placeholder: 'e.g. Made for the ones who notice', feedsIntoPromptField: 'cta' },
      { id: 'surface', question: 'What surface / setting should it sit on?', type: 'text', placeholder: 'e.g. Wet black stone', feedsIntoPromptField: 'scene' },
      { id: 'mood', question: 'What single mood word (we translate it to light)?', type: 'select', options: ['luxury', 'clean/minimal', 'bold/energetic', 'warm/natural'], feedsIntoPromptField: 'lighting' },
    ],
    defaultCameraProgression: ['reveal_orbit', 'macro_detail'],
    defaultLighting: 'luxury_commercial',
    hookTypes: ['cinematic unveil', 'texture and light'],
    platformNotes: 'No dialogue in the reveal beat — let sound design and one clean tagline carry it. Works 1:1 and 9:16.',
    expertSkill: 'You are shooting a cinematic product reveal (pattern: escalation — wide → medium → macro → hero). NO people, NO hands: light does the acting — a key light raking across the label, reflections traveling on the surface, shadow edges moving as the camera arcs. Controlled single camera move per beat (slow orbit, then macro push). Sound design carries it: a low riser, one crisp settle when the product lands in its hero position, at most ONE spoken tagline at the end. Final frame: label perfectly squared to lens, clean negative space.',
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
      { id: 'compare_against', question: 'What are you comparing against? (never a specific competitor brand)', type: 'select', options: ['The expensive version', 'What I used to use', 'Other products I\'ve tried', 'DIY / doing it manually'], feedsIntoPromptField: 'problem' },
      { id: 'old_way', question: 'What does the "other way" do worse?', type: 'text', placeholder: 'e.g. Leaves streaks', feedsIntoPromptField: 'problem' },
      { id: 'new_way_line', question: 'What does your product do better?', type: 'text', placeholder: 'e.g. One pass, no streaks', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you close?', type: 'text', placeholder: 'e.g. Why settle?', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['split_static', 'split_static', 'slow_push'],
    defaultLighting: 'studio_softbox',
    hookTypes: ['the obvious gap', 'why settle'],
    platformNotes: 'Never show or name a real competitor brand — use a plain unbranded stand-in. Keep both sides in identical light.',
    expertSkill: 'You are shooting a side-by-side comparison where the gap must be VISIBLE, not narrated. Run the SAME task on both sides under a locked split-frame with IDENTICAL lighting, distance and lens per side — the only variable allowed to change is the result, or the comparison is a rigged trick and dies. Make the difference physical and undeniable: streaks vs none, chunks vs smooth, a puddle vs a dry surface — a difference the eye settles in under a second. The rival is a plain, unbranded generic stand-in (no logos, no recognizable shape). No people on camera; a spare voiceover states ONE concrete checkable number (time, count, residue) and nothing more. Verdict beat: the product slides center-frame into sharp focus as the alternative is pushed soft and out.',
    negativePromptAdditions: ['named competitor brand', 'recognizable rival logo', 'different lighting per side'],
    needsCreator: false,
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
      { id: 'role', question: 'Your role?', type: 'select', options: ['Founder / creator of this product', 'Passionate customer turned advocate', 'Affiliate / content creator who believes in it'], feedsIntoPromptField: 'hook' },
      { id: 'why', question: 'Why does this product exist? What was life like before it?', type: 'text', placeholder: 'e.g. Everything on the shelf let me down', feedsIntoPromptField: 'hook' },
      { id: 'how', question: 'The turning point — what did you do differently?', type: 'text', placeholder: 'e.g. No fillers, made in small batches', feedsIntoPromptField: 'proof' },
      { id: 'cta', question: 'How do you invite them in?', type: 'text', placeholder: 'e.g. Give it one honest week', feedsIntoPromptField: 'cta' },
    ],
    defaultCameraProgression: ['talking_head', 'slow_push', 'talking_head'],
    defaultLighting: 'window_light',
    hookTypes: ['origin story', 'personal conviction', 'the gap I found'],
    platformNotes: 'Sincerity over polish. A real workspace behind the founder outperforms a clean studio.',
    expertSkill: 'You are shooting documentary intimacy (founder story). Real workspace behind them — shelves, tools, half-finished product batches, a whiteboard — window key light, a locked-off or barely-breathing camera on a longer lens so the background falls soft. The hook is a candid, specific admission of a struggle, delivered like a confession to one person off-lens, not a pitch to a crowd. Credibility lives entirely in specifics: a real date, a batch number, a named failure ("the first 200 units were wrong"). Hands touch the product like it is theirs, because it is — turning it, checking a seam, a small proprietary gesture. The close is a warm, personal invitation ("give it one honest week"), never a corporate CTA, never "shop now".',
    negativePromptAdditions: ['corporate boardroom', 'stock-footage feel'],
    environmentPresets: ENV_FOUNDER,
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
      { id: 'duration', question: 'Duration?', type: 'select', options: ['4s', '5s', '6s'], feedsIntoPromptField: 'scene' },
    ],
    defaultCameraProgression: ['slow_push'],
    defaultLighting: 'beauty',
    hookTypes: ['pattern interrupt', 'open loop', 'shock open'],
    platformNotes: 'Built to be the first 4s of a longer edit or a standalone scroll-stopper. Front-load everything into frame one.',
    expertSkill: 'You are shooting a pure pattern-interrupt (rhythm: impact-first). Frame ONE must already contain the arresting thing — a fast reach, an object dropped, a snap of eye-contact to lens — with a sharp transient sound event landing on that very first frame (zero ramp-up). No setup, no context, no brand-first, no slow build. The mechanic is a deliberately UNCLOSED loop: pose or imply a question the frame refuses to answer, and cut on the motion BEFORE any resolution — the itch to see what happens is what holds the thumb. One idea, one motion, maximum contrast (fast against still, loud against silence, one bold element against empty space). The last frame should feel like it was clipped a half-second early on purpose.',
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

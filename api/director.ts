/**
 * POST /api/director
 * Body: { productName, description, style, creatorMode?, energyLevel? }
 *
 * Uses Claude to generate a 4-stage director's commentary for the live feed:
 *   analyzing → casting → scripting → storyboarding
 * The rendering stage is driven by /api/generate + /api/status on the client.
 *
 * Self-contained: no cross-directory imports (Vercel bundling constraint).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { getTemplate, type AdTypeId } from './_lib/promptEngine/index.js'

const STYLE_BLURBS: Record<string, string> = {
  ugc_testimonial:   'authentic UGC testimonial — real person, phone-shot feel',
  founder_story:     'founder story — warm, credible, documentary intimacy',
  luxury_commercial: 'luxury commercial — premium, cinematic, controlled motion',
  cinematic_brand:   'cinematic brand film — aspirational lifestyle storytelling',
  fast_cut_hook:     'fast-cut hook — high-energy, scroll-stopping opener',
  unboxing:          'unboxing — tactile reveal, hands, satisfying detail shots',
  explainer:         'explainer / how-to — clear instructional demonstration',
  // legacy keys from old Studio
  testimonial:       'authentic UGC testimonial — real person, phone-shot feel',
  'fast-cut':        'fast-cut hook — high-energy, scroll-stopping opener',
  'day-in-life':     'cinematic lifestyle — the product woven into a real moment',
}

// Each style implies a genuinely different NARRATIVE ARC, not just different
// camera work — this is what makes the style picker actually change the
// story shape instead of only the visual treatment.
const STYLE_NARRATIVE: Record<string, string> = {
  testimonial: 'Structure as a first-person account: open mid-story ("So this changed everything for me..."), agitate the before-state briefly, credit the product with a specific result, close on a genuine personal recommendation. The proof beat IS the testimonial — make it the emotional peak.',
  ugc_testimonial: 'Structure as a first-person account: open mid-story, agitate the before-state briefly, credit the product with a specific result, close on a genuine personal recommendation. The proof beat IS the testimonial — make it the emotional peak.',
  unboxing: 'Structure as anticipation → reveal → hands-on demo → satisfaction → cta. The hook is the anticipation of opening/receiving it; the proof beat is the satisfying tactile payoff and first-use reaction, not a separate spoken claim.',
  'day-in-life': 'Weave the product into a real moment of someone\'s day rather than pitching it head-on — the hook is the relatable moment itself, the product enters naturally mid-scene, and proof is shown through the person\'s genuine reaction rather than stated as a claim.',
  'fast-cut': 'Compress aggressively: the hook must land in the first 1-2 seconds with a jarring visual or line, every beat moves fast with minimal dwell time, and the proof beat is a rapid-fire specific stat or before/after flash rather than a lingering testimonial.',
  founder_story: 'Structure as the founder speaking directly and personally about why they built this — the hook is a candid, specific admission (a problem they personally had), proof is their own credibility plus early customer results, cta is a personal invitation, not a corporate push.',
}

// ── Storyboard Intelligence ──────────────────────────────────────────────────
// Veo 3 renders in fixed short durations, so a commercial is a sequence of short
// clips, each carrying only the dialogue it can speak at ~2.5 words/second. This
// plans that sequence and HARD-ENFORCES the per-clip word budget server-side so
// no clip is ever overstuffed (the failure that produced rushed, cut-off output).
const WORDS_PER_SECOND = 2.5
const CLIP_DURATIONS = [4, 5, 6, 7, 8]

function clampDuration(n: any): number {
  const d = Math.round(Number(n) || 6)
  return CLIP_DURATIONS.includes(d) ? d : Math.min(8, Math.max(4, d))
}
function maxWords(sec: number): number { return Math.floor(sec * WORDS_PER_SECOND) }
function trimToWords(text: string, cap: number): string {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  return words.length <= cap ? words.join(' ') : words.slice(0, cap).join(' ')
}
function countWords(text: string): number {
  const t = String(text || '').trim()
  return t ? t.split(/\s+/).length : 0
}

async function planStoryboard(body: Record<string, any>, res: VercelResponse) {
  const {
    productName, description, style,
    clipCount, referenceBeats, referenceDurationSeconds, brandVoice, cta,
    creator,
    // Optional hook line (e.g. from the "Write with AI" / manual script field)
    // — when set, clip 1's dialogue should open with or closely echo it.
    hookLine,
    // Free-text notes from the "Regenerate" panel — incorporated into the
    // whole storyboard with priority over the generic style brief.
    regenerationNotes,
    // Type-specific wizard answers (the result, the first impression, the 3
    // steps, …) keyed by question label — the concrete specifics the user gave
    // for this ad format. The planner must weave these into the actual dialogue.
    answers,
    // Campaign goal — steers the hook/angle/CTA toward the objective.
    intent,
  } = body

  // Who's on camera. Without this, the planner invents a person and defaults to
  // "a woman" in visualDescription/creatorAction — wrong when the user uploaded
  // their own photo. For an uploaded real creator we tell Claude to stay neutral
  // ("the creator"/"the presenter") and NEVER assign a gender or appearance,
  // since the actual look is fixed by the photo Veo conditions on. For a
  // generated creator we pass whatever attributes were chosen.
  let creatorSection = ''
  if (creator?.source === 'uploaded') {
    creatorSection = '\nCREATOR: A specific real person (the user) whose exact appearance is fixed by an uploaded photo. Refer to them ONLY as "the creator" or "the presenter". Do NOT state or imply their gender, age, ethnicity, hair, or any physical appearance — describe only their ACTIONS and what they say. Never write "a woman", "a man", "she", or "he".'
  } else if (creator?.source === 'generated') {
    const attrs = [creator.gender, creator.ageRange, creator.ethnicity, creator.description].filter(Boolean).join(', ')
    creatorSection = attrs
      ? `\nCREATOR: ${attrs}. Keep this exact person consistent across every clip.`
      : '\nCREATOR: Refer to the on-camera person neutrally as "the creator"; do not invent a specific gender or appearance.'
  }

  // Desired clip count: explicit, else inferred from a reference ad's length, else 4.
  let desired = Number(clipCount)
  if (!desired || desired < 1) {
    desired = referenceDurationSeconds ? Math.max(2, Math.min(10, Math.round(referenceDurationSeconds / 5))) : 4
  }
  desired = Math.max(1, Math.min(10, desired))

  const styleBlurb = STYLE_BLURBS[style] ?? style ?? 'commercial ad'
  const narrativeSection = STYLE_NARRATIVE[style] ? `\nNARRATIVE ARC for this style: ${STYLE_NARRATIVE[style]}` : ''
  const refSection = Array.isArray(referenceBeats) && referenceBeats.length
    ? `\nThis clones a winning ad with these beats: ${referenceBeats.join(' → ')}. Match its pacing and structure, but sell the product below.`
    : ''
  const brandSection = [brandVoice ? `Brand voice: ${brandVoice}.` : '', cta ? `End on this CTA: "${cta}".` : ''].filter(Boolean).join(' ')
  const hookSection = hookLine?.trim() ? `\nHOOK LINE (given by the user) — clip 1's dialogue must open with or closely echo this line verbatim, then continue naturally: "${hookLine.trim()}"` : ''
  const regenSection = regenerationNotes?.trim() ? `\nREGENERATION NOTES from the user — incorporate these specific changes into the storyboard (priority over the generic style direction where they conflict): ${regenerationNotes.trim()}` : ''
  // The user's concrete, type-specific answers are the truth of this ad — the
  // real result, the real first impression, the real steps. Ground the dialogue
  // in them; never invent generic filler when a specific answer exists.
  const answerLines = answers && typeof answers === 'object'
    ? Object.entries(answers as Record<string, string>)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `- ${k}: ${String(v).trim()}`)
    : []
  const answersSection = answerLines.length
    ? `\nWHAT THE USER TOLD US (ground the dialogue in these specifics — use their real words/claims, don't invent vaguer ones):\n${answerLines.join('\n')}`
    : ''
  const intentSection = intent && String(intent).trim()
    ? `\nCAMPAIGN GOAL: ${String(intent).trim()} — bias the hook, emotional angle, and CTA toward achieving this objective (e.g. a conversions goal wants a sharper offer/CTA; a brand-awareness goal wants a memorable, shareable hook).`
    : ''

  // ── TYPE-SPECIFIC beat structure (the fix for "unboxing looks like a generic
  // product reveal"). Pull the chosen ad type's real beat sequence from the
  // prompt-engine template and REQUIRE the plan to follow it — an unboxing must
  // be a package arriving/opening/first-use, a POV must be first-person hands,
  // a product reveal has no creator, etc. This is what makes each template
  // actually behave like its format instead of a generic hook→proof→cta arc.
  // Map legacy/wizard style ids onto engine ad types so the right beat DNA is
  // used even from clone mode (which may pass an old style id).
  const LEGACY_TO_ADTYPE: Record<string, AdTypeId> = {
    ugc_testimonial: 'testimonial', founder_story: 'founder_story',
    luxury_commercial: 'product_reveal', cinematic_brand: 'product_reveal',
    fast_cut_hook: 'hook_only', 'fast-cut': 'hook_only', explainer: 'tutorial',
    'day-in-life': 'day_in_the_life',
  }
  const adTypeForTemplate = (LEGACY_TO_ADTYPE[style] ?? style) as AdTypeId
  const template = getTemplate(adTypeForTemplate)
  const fillBeat = (s: string) => s
    .replace(/\{product\}/g, 'the product')
    .replace(/\{creator\}/g, template.needsCreator === false ? 'no on-camera person' : 'the creator')
    .replace(/\{scene\}/g, 'the setting')
  const beatSequence = template.beats
    .map((b, i) => `  ${i + 1}. ${b.name} — ${fillBeat(b.visualInstruction)}${b.dialogueTemplate ? ` (they say something like: "${b.dialogueTemplate}")` : ' (no dialogue — visual/sound only)'}`)
    .join('\n')
  const formatSection = `
THIS IS A "${template.displayName}" AD — ${template.description}
It MUST play like a real ${template.displayName}, NOT a generic product hero shot. Follow THIS format's beat DNA (adapt the wording to the actual product, but keep each beat's PURPOSE and physical action):
${beatSequence}
Hook mechanics that work for this format: ${template.hookTypes.join('; ')}.
Platform behaviour: ${template.platformNotes}
${template.needsCreator === false ? 'There is NO on-camera creator — describe the PRODUCT and the environment/camera only; never write a person speaking.' : ''}
When you output clips, set each clip's "beat" to the beat NAME above (lowercased). If the requested clip count differs from the number of beats, compress or expand while KEEPING this format's signature moments (e.g. an unboxing must still show the package being opened; a POV must stay first-person; a before/after must show both states).`

  const system = `You are an expert direct-response copywriter AND short-form video director planning a ${styleBlurb}. You break a commercial into EXACTLY ${desired} sequential clips for Google Veo 3. The dialogue you write is real sales copy, not filler — it must be good enough to actually move someone to buy, using the same craft a senior DR copywriter would bring to a script.

THE #1 RULE — COMPLETENESS OVER COUNT:
Regardless of how few clips you're given, the finished sequence must play as one complete, usable, standalone commercial — a full arc from hook to call-to-action, never a fragment that stops mid-pitch and never feeling rushed. A complete sales narrative has five elements: (1) hook/attention, (2) problem or desire (agitate it — make the pain or want specific and relatable), (3) solution/demonstration, (4) credibility or proof (a testimonial beat: a specific, believable result — a number, a timeframe, a before/after, an "I was skeptical until..." moment — never a vague "it's amazing"), (5) call-to-action (a direct, specific action verb — "Tap the link", "Get yours today", "Try it risk-free" — plus a reason to act NOW, not generic "check it out"). When ${desired} is smaller than 5, you do NOT get to drop elements — you COMPRESS multiple elements into the same clip's dialogue and visual direction instead. Concretely:
- 1 clip: hook + problem + solution + proof + CTA all land in that single clip's dialogue and action, in that order, still fitting the word budget below.
- 2 clips: clip 1 = hook + problem + solution; clip 2 = proof + CTA.
- 3 clips: clip 1 = hook + problem; clip 2 = solution + proof; clip 3 = CTA.
- 4 clips: hook; problem + solution; proof; CTA.
- 5+ clips: one element per clip (hook, problem, solution, proof, cta), with any extra clips elaborating the solution/proof (more demo detail, a second proof point, an objection handled).
Never write a clip that only teases or sets up without also paying it off somewhere in the sequence — by the last clip, someone who has only ever seen this ad must understand what the product does, why they'd want it, why they should believe it works, and exactly what to do next. Longer total runtime means MORE selling substance (a second proof point, an objection addressed, a richer demo) — never padding, repetition, or the same claim restated in different words.

COPYWRITING CRAFT (this is what separates a script that sells from one that just describes):
- Hook: a pattern interrupt or a sharp, specific claim/question — never "Hey guys, check this out."
- Specificity beats generality everywhere: "saved me $340 a year" beats "saves money"; "in 11 days" beats "quickly"; a named, ordinary use-case beats an abstract benefit.
- Sound like a real person talking, not an ad: contractions, natural rhythm, the way someone would actually tell a friend — never stiff marketing-speak ("revolutionary", "game-changing", "unlock").
- The proof/testimonial beat is the credibility hinge of the whole ad — treat it as seriously as the hook. Give it a real, specific, checkable-feeling detail.
- The CTA closes with urgency or a low-risk framing (a guarantee, a limited-time framing, "before it's gone") when it fits the product honestly — never a limp "learn more."
- Vary sentence rhythm clip to clip — a script where every line is the same length and cadence reads as robotic even if the words are different.

HARD RULES:
- Exactly ${desired} clips, ordered 1..${desired}.
- Each clip durationSeconds is one of 4,5,6,7,8.
- Dialogue is what a person SPEAKS in that clip. Natural pace ≈ 2.5 words/second, so the word count MUST fit: 4s→≤10 words, 5s→≤12, 6s→≤15, 7s→≤17, 8s→≤20. If an idea needs more words, shorten it — do not overstuff. Compression means writing TIGHTER, more efficient lines that still cover every compressed element, not cramming more words in.
- visualDescription: physically observable, camera-direction language (no mood adjectives). If a CREATOR is specified below, honor it exactly — never invent or contradict the creator's gender or appearance.
- creatorAction: what the person physically does with the product.
- beat: one of hook, problem, solution, demo, proof, cta, bridge, reveal, outro — pick the DOMINANT element for clips that compress more than one (e.g. a clip compressing hook+problem+solution is still tagged "hook").
- The final clip's beat is cta or outro, and must contain an explicit call-to-action.

CONTINUITY ACROSS CLIPS (critical — the clips are stitched into ONE seamless video, not separate ads):
- The dialogue must flow as ONE continuous spoken monologue across all clips. Read clips 1→N end to end: it must sound like one person talking without interruption.
- NEVER end a clip's dialogue mid-sentence or on a cut-off word. Each clip's dialogue ends on a natural clause or sentence boundary (a breath point), and the next clip PICKS UP the thought and continues it — do not restart, do not re-hook, do not repeat what was already said.
- Only clip 1 opens the ad. Clips 2..N continue mid-conversation ("...and that's when I noticed", "so I kept using it", "which is why") — they must NOT re-introduce the speaker, the product, or the premise.
- creatorAction/visualDescription must also continue: each clip begins in the pose/position the previous clip ended in (same hands, same product position), so the motion is unbroken across the cut.

Respond with STRICT JSON only, no markdown:
{"recommendedClipCount":N,"reasoning":"one sentence explaining how the narrative was compressed to fit","clips":[{"order":1,"beat":"hook","durationSeconds":5,"visualDescription":"...","dialogue":"...","cameraDirection":"...","creatorAction":"..."}]}`

  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system,
    messages: [{
      role: 'user',
      content: `Product: ${productName || 'the product'}
What it is / who it's for: ${description}
${formatSection}
Style: ${styleBlurb}${narrativeSection}${refSection}${creatorSection}${hookSection}${regenSection}${answersSection}${intentSection}
${brandSection}

Plan the ${desired} clips — and make them unmistakably a ${template.displayName}.`,
    }],
  })

  const rawText = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text?.trim() ?? '{}'
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  const rawClips: any[] = Array.isArray(parsed.clips) ? parsed.clips : []

  // Server-side enforcement: clamp duration, recompute + trim word budget.
  const clips = rawClips.slice(0, 10).map((c, i) => {
    const durationSeconds = clampDuration(c.durationSeconds)
    const dialogue = trimToWords(c.dialogue ?? '', maxWords(durationSeconds))
    return {
      id: `clip_${Date.now()}_${i}`,
      order: i + 1,
      beat: String(c.beat ?? 'demo').toLowerCase(),
      durationSeconds,
      visualDescription: String(c.visualDescription ?? ''),
      dialogue,
      wordCount: countWords(dialogue),
      cameraDirection: String(c.cameraDirection ?? ''),
      creatorAction: String(c.creatorAction ?? ''),
      locked: false,
    }
  })

  if (!clips.length) return res.status(502).json({ error: 'Storyboard planner returned no clips. Try again.' })

  const plan = {
    totalEstimatedDurationSeconds: clips.reduce((s, c) => s + c.durationSeconds, 0),
    clipCount: clips.length,
    recommendedClipCount: Math.max(1, Math.min(10, Number(parsed.recommendedClipCount) || clips.length)),
    reasoning: String(parsed.reasoning ?? `Planned ${clips.length} clips to pace this ${styleBlurb}.`),
    clips,
  }
  return res.status(200).json({ plan })
}

async function writeScript(body: Record<string, any>, res: VercelResponse) {
  const { productName, description, style, niche, goal, tone, creator } = body
  if (!description && !productName) {
    return res.status(400).json({ error: 'description or productName is required' })
  }

  const styleBlurb = STYLE_BLURBS[style] ?? style ?? 'UGC ad'

  let creatorLine = ''
  if (creator?.source === 'uploaded') {
    creatorLine = 'Creator: real person (appearance fixed by uploaded photo — do not describe appearance).'
  } else if (creator?.source === 'generated') {
    const attrs = [creator.gender, creator.ageRange, creator.ethnicity].filter(Boolean).join(', ')
    if (attrs) creatorLine = `Creator: ${attrs}.`
  }

  const context = [
    niche ? `Audience / niche: ${niche}` : '',
    goal ? `Goal: ${goal}` : '',
    tone ? `Tone: ${tone}` : '',
    creatorLine,
  ].filter(Boolean).join('\n')

  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `You are an expert UGC ad scriptwriter. Write a single, compelling spoken line (the hook/script) for a ${styleBlurb} ad.

Rules:
- 10–25 words maximum — it must fit in a 4–8 second video clip
- Natural spoken cadence — sounds human, not corporate
- Opens with a pattern-interrupt or relatable hook
- Ends with emotion, curiosity, or urgency — not a corporate CTA
- No hashtags, no emojis, no "link in bio"
- No quotation marks in output — just the raw line

Output ONLY the script line. Nothing else.`,
    messages: [{
      role: 'user',
      content: `Product: ${productName || 'the product'}
What it does: ${description}
Ad style: ${styleBlurb}
${context}

Write the spoken hook line.`,
    }],
  })

  const script = (message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '').trim()
    .replace(/^["'`]+|["'`]+$/g, '') // strip any wrapper quotes
    .trim()

  return res.status(200).json({ script })
}

/** "AI Magic" — expand a few user keywords into a concrete, specific
 *  regeneration directive: physically observable actions/camera/detail, not
 *  vague mood words. Powers the enhance button next to the Regenerate
 *  keyword field (any generation module). */
async function enhancePrompt(body: Record<string, any>, res: VercelResponse) {
  const { text, productDescription, style } = body
  if (!text?.trim()) return res.status(400).json({ error: 'Enter a few keywords first.' })

  const styleBlurb = STYLE_BLURBS[style] ?? style ?? ''
  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: `You expand a short, rough keyword note into ONE concrete, physically specific creative direction for regenerating a UGC ad video clip.

Rules:
- Turn vague ideas into observable actions, camera moves, or concrete visual details a camera could literally capture.
- 1-2 sentences maximum.
- No mood adjectives (cinematic, professional, stunning, amazing, perfect).
- Preserve every specific noun/detail the user already gave — only ADD specificity, never remove their intent.
- Output ONLY the expanded direction. No preamble, no quotes.`,
    messages: [{
      role: 'user',
      content: `Product: ${productDescription || 'the product'}${styleBlurb ? `\nAd style: ${styleBlurb}` : ''}\nUser's rough note: "${text.trim()}"\n\nExpand this into a concrete direction.`,
    }],
  })

  const enhanced = (message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '').trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()

  return res.status(200).json({ enhanced: enhanced || text.trim() })
}

/** Enrich a thin product description (or just a name) into a fuller one the
 *  script writer / Creative Direction can actually use — what it is, who it's
 *  for, and the core benefit — biased toward the campaign intent when given. */
async function enhanceDescription(body: Record<string, any>, res: VercelResponse) {
  const { name, description, intent } = body
  const seed = (description || name || '').toString().trim()
  if (!seed) return res.status(400).json({ error: 'Add a product name or a few words first.' })

  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 220,
    system: `You sharpen a rough product description into a tight, concrete one an ad scriptwriter can use. Given a product name and/or a thin description${intent ? ', plus the campaign intent' : ''}, write 1–2 sentences that state: what the product is, who it's for, and the single core benefit.

Rules:
- Stay faithful to what's given — never invent a product category or feature that contradicts the input. If the input is only a name, infer the most likely product conservatively.
- Concrete and specific — real benefit, real audience — not marketing fluff.
- No hype words: amazing, incredible, revolutionary, game-changing, best-in-class, premium, luxurious.
- No hashtags, emojis, or quotes.
- Output ONLY the improved description. No preamble.`,
    messages: [{
      role: 'user',
      content: `Product name: ${name || '(none)'}
Current description: ${description || '(none)'}${intent ? `\nCampaign intent: ${intent}` : ''}

Write the improved description.`,
    }],
  })

  const enhanced = (message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '').trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()

  return res.status(200).json({ enhanced: enhanced || seed })
}

/**
 * "Creative Direction" mode — the AI-authored alternative to answering the
 * type-specific wizard questions by hand. Reads the ad type's real
 * wizardQuestions from the prompt engine template (so the two modes always
 * stay in lockstep — new ad types automatically get both), then has Claude
 * invent a complete, specific, on-brand answer to EVERY question by reasoning
 * about the product, its title/description, the chosen creator/character
 * type, and direct-response UGC copywriting craft — hook, tone, proof, CTA,
 * all grounded in claims a real person could plausibly make about this
 * specific product, never generic filler.
 */
async function autoAnswerWizard(body: Record<string, any>, res: VercelResponse) {
  const { adType, productName, description, intent, creator } = body
  if (!description && !productName) {
    return res.status(400).json({ error: 'description or productName is required' })
  }
  const template = getTemplate((adType as AdTypeId) || 'testimonial')

  let creatorLine = 'Creator: unspecified — write as a believable, relatable person for this product\'s audience.'
  if (creator?.source === 'uploaded') {
    creatorLine = 'Creator: a specific real person (their look is fixed by an uploaded photo) — write only what they SAY and CLAIM, never describe their appearance.'
  } else if (creator?.source === 'generated') {
    const attrs = [creator.gender, creator.ageRange, creator.ethnicity].filter(Boolean).join(', ')
    if (attrs) creatorLine = `Creator: ${attrs} — write dialogue/claims that read as authentic coming from this person.`
  }

  const questionList = template.wizardQuestions
    .map((q, i) => `${i + 1}. [id: ${q.id}] ${q.question}`)
    .join('\n')

  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    system: `You are a senior direct-response copywriter who specializes in UGC (user-generated-content-style) ad scripts. You are answering, ON BEHALF OF a creator, the exact questions a wizard would ask a real person before writing a "${template.displayName}" ad (${template.description}).

Your answers become the raw material for the actual video script — they must read like something a real, specific person would say about THIS specific product, not generic ad copy. Apply direct-response craft:
- HOOK: a pattern-interrupt or a genuinely surprising, specific claim — never "I love this product" energy.
- TONE: match ${template.displayName} conventions (${template.hookTypes.join(', ')}).
- PROOF: concrete, plausible specifics — a number, a timeframe, a before/after, a sensory detail — never vague superlatives ("amazing", "life-changing").
- CTA: a direct, specific push tied to what was just claimed, never a generic "check it out".
- Ground every answer in the ACTUAL product description given — do not invent features that contradict it, but you MAY invent a plausible personal anecdote/result/context that a real user of this exact product could have.
- Keep each answer to ONE tight, spoken-sounding sentence (this is dialogue material, not a paragraph).
- Never use these words: cinematic, professional, amazing, incredible, perfect, stunning, seamless, elegant, luxurious, premium, life-changing.

Respond with STRICT JSON only, no markdown, no preamble:
{"answers": {"<question id>": "<your answer>", ...}}
Include every question id listed. No other keys.`,
    messages: [{
      role: 'user',
      content: `Product name: ${productName || '(unnamed)'}
Product description: ${description || '(none given)'}
Ad format: ${template.displayName} — ${template.description}${intent ? `\nCampaign goal: ${intent} — bias the hook, angle, and CTA toward this objective.` : ''}
${creatorLine}

Answer these questions as if you are the creator, in character, selling this exact product:
${questionList}`,
    }],
  })

  const rawText = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text?.trim() ?? '{}'
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  const byId: Record<string, string> = parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {}

  // The planner keys answers by the human-readable question label (see
  // director.ts planStoryboard's answersSection) — map id -> question here so
  // both wizard modes produce the exact same shape for downstream planning.
  const answers: Record<string, string> = {}
  for (const q of template.wizardQuestions) {
    const val = byId[q.id]
    if (typeof val === 'string' && val.trim()) answers[q.question] = val.trim()
  }
  if (!Object.keys(answers).length) {
    return res.status(502).json({ error: 'Creative Direction returned no answers. Try again.' })
  }
  return res.status(200).json({ answers })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as Record<string, any>

  // Storyboard planning rides on this endpoint (api/ is capped at 12 functions).
  if (body.mode === 'storyboard') {
    try {
      return await planStoryboard(body, res)
    } catch (err) {
      console.error('[/api/director storyboard]', err)
      const message = err instanceof Error ? err.message : 'Storyboard planning failed.'
      return res.status(502).json({ error: message })
    }
  }

  if (body.mode === 'write-script') {
    try {
      return await writeScript(body, res)
    } catch (err) {
      console.error('[/api/director write-script]', err)
      const message = err instanceof Error ? err.message : 'Script generation failed.'
      return res.status(502).json({ error: message })
    }
  }

  if (body.mode === 'enhance-prompt') {
    try {
      return await enhancePrompt(body, res)
    } catch (err) {
      console.error('[/api/director enhance-prompt]', err)
      const message = err instanceof Error ? err.message : 'Enhancement failed.'
      return res.status(502).json({ error: message })
    }
  }

  if (body.mode === 'enhance-description') {
    try {
      return await enhanceDescription(body, res)
    } catch (err) {
      console.error('[/api/director enhance-description]', err)
      const message = err instanceof Error ? err.message : 'Description enhancement failed.'
      return res.status(502).json({ error: message })
    }
  }

  if (body.mode === 'auto-answer-wizard') {
    try {
      return await autoAnswerWizard(body, res)
    } catch (err) {
      console.error('[/api/director auto-answer-wizard]', err)
      const message = err instanceof Error ? err.message : 'Creative Direction failed.'
      return res.status(502).json({ error: message })
    }
  }

  const { productName, description, style, creatorMode, energyLevel } = body

  if (!description) return res.status(400).json({ error: 'description is required' })

  const styleBlurb = STYLE_BLURBS[style] ?? style ?? 'commercial ad'
  const creatorHint = creatorMode === 'uploaded_seed'
    ? 'using the provided creator seed image'
    : energyLevel ? `${energyLevel}-energy on-camera presenter` : 'on-camera AI creator'

  const now = new Date().toISOString()

  try {
    const anthropic = new Anthropic()

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are an expert AI commercial director. You are about to direct a ${styleBlurb} ad for:

Product: ${productName || 'the product'}
Brief: ${description}
Creator: ${creatorHint}

Write 4 short director's notes — one for each production stage. Each note must be 1-2 sentences, specific to THIS product and style. First-person, confident, like a real director's log.

Respond with valid JSON only, no markdown:
{"analyzing":"...","casting":"...","scripting":"...","storyboarding":"..."}`
      }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    const log = [
      {
        timestamp: now,
        stage: 'analyzing',
        message: parsed.analyzing ?? `Analyzing ${productName || 'the product'} and identifying the core audience hook.`,
      },
      {
        timestamp: now,
        stage: 'casting',
        message: parsed.casting ?? `Casting a ${creatorHint} whose presence amplifies the brand message.`,
      },
      {
        timestamp: now,
        stage: 'scripting',
        message: parsed.scripting ?? 'Writing the scene script and motion prompt for maximum scroll-stopping impact.',
      },
      {
        timestamp: now,
        stage: 'storyboarding',
        message: parsed.storyboarding ?? 'Blocking the scene — camera moves, product action, and lighting cues locked.',
      },
    ]

    return res.status(200).json({ log })
  } catch (err) {
    console.error('[/api/director]', err)
    // Fallback director log — generation still proceeds without Claude commentary
    return res.status(200).json({
      log: [
        { timestamp: now, stage: 'analyzing',     message: 'Analyzing product brief and target audience.' },
        { timestamp: now, stage: 'casting',        message: 'Selecting the optimal on-camera creator for this brand.' },
        { timestamp: now, stage: 'scripting',      message: 'Writing the scene script and motion direction.' },
        { timestamp: now, stage: 'storyboarding',  message: 'Blocking camera moves and product action.' },
      ],
    })
  }
}

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
  const refSection = Array.isArray(referenceBeats) && referenceBeats.length
    ? `\nThis clones a winning ad with these beats: ${referenceBeats.join(' → ')}. Match its pacing and structure, but sell the product below.`
    : ''
  const brandSection = [brandVoice ? `Brand voice: ${brandVoice}.` : '', cta ? `End on this CTA: "${cta}".` : ''].filter(Boolean).join(' ')
  const hookSection = hookLine?.trim() ? `\nHOOK LINE (given by the user) — clip 1's dialogue must open with or closely echo this line verbatim, then continue naturally: "${hookLine.trim()}"` : ''
  const regenSection = regenerationNotes?.trim() ? `\nREGENERATION NOTES from the user — incorporate these specific changes into the storyboard (priority over the generic style direction where they conflict): ${regenerationNotes.trim()}` : ''

  const system = `You are an expert short-form video director planning a ${styleBlurb}. You break a commercial into EXACTLY ${desired} sequential clips for Google Veo 3.

THE #1 RULE — COMPLETENESS OVER COUNT:
Regardless of how few clips you're given, the finished sequence must play as one complete, usable, standalone commercial — a full arc from hook to call-to-action, never a fragment that stops mid-pitch. A complete sales narrative has five elements: (1) hook/attention, (2) problem or desire, (3) solution/demonstration, (4) credibility or proof, (5) call-to-action. When ${desired} is smaller than 5, you do NOT get to drop elements — you COMPRESS multiple elements into the same clip's dialogue and visual direction instead. Concretely:
- 1 clip: hook + problem + solution + proof + CTA all land in that single clip's dialogue and action, in that order, still fitting the word budget below.
- 2 clips: clip 1 = hook + problem + solution; clip 2 = proof + CTA.
- 3 clips: clip 1 = hook + problem; clip 2 = solution + proof; clip 3 = CTA.
- 4 clips: hook; problem + solution; proof; CTA.
- 5+ clips: one element per clip (hook, problem, solution, proof, cta), with any extra clips elaborating the solution/proof.
Never write a clip that only teases or sets up without also paying it off somewhere in the sequence — by the last clip, someone who has only ever seen this ad must understand what the product does, why they'd want it, and what to do next.

HARD RULES:
- Exactly ${desired} clips, ordered 1..${desired}.
- Each clip durationSeconds is one of 4,5,6,7,8.
- Dialogue is what a person SPEAKS in that clip. Natural pace ≈ 2.5 words/second, so the word count MUST fit: 4s→≤10 words, 5s→≤12, 6s→≤15, 7s→≤17, 8s→≤20. If an idea needs more words, shorten it — do not overstuff. Compression means writing TIGHTER, more efficient lines that still cover every compressed element, not cramming more words in.
- visualDescription: physically observable, camera-direction language (no mood adjectives). If a CREATOR is specified below, honor it exactly — never invent or contradict the creator's gender or appearance.
- creatorAction: what the person physically does with the product.
- beat: one of hook, problem, solution, demo, proof, cta, bridge, reveal, outro — pick the DOMINANT element for clips that compress more than one (e.g. a clip compressing hook+problem+solution is still tagged "hook").
- The final clip's beat is cta or outro, and must contain an explicit call-to-action.

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
Style: ${styleBlurb}${refSection}${creatorSection}${hookSection}${regenSection}
${brandSection}

Plan the ${desired} clips.`,
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

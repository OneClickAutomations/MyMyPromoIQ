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
  } = body

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

  const system = `You are an expert short-form video director planning a ${styleBlurb}. You break a commercial into ${desired} sequential clips for Google Veo 3.

HARD RULES:
- Exactly ${desired} clips, ordered 1..${desired}.
- Each clip durationSeconds is one of 4,5,6,7,8.
- Dialogue is what a person SPEAKS in that clip. Natural pace ≈ 2.5 words/second, so the word count MUST fit: 4s→≤10 words, 5s→≤12, 6s→≤15, 7s→≤17, 8s→≤20. If an idea needs more words, shorten it — do not overstuff.
- visualDescription: physically observable, camera-direction language (no mood adjectives).
- creatorAction: what the person physically does with the product.
- beat: one of hook, problem, solution, demo, proof, cta, bridge, reveal, outro.
- The final clip's beat is cta or outro.

Respond with STRICT JSON only, no markdown:
{"recommendedClipCount":N,"reasoning":"one sentence","clips":[{"order":1,"beat":"hook","durationSeconds":5,"visualDescription":"...","dialogue":"...","cameraDirection":"...","creatorAction":"..."}]}`

  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system,
    messages: [{
      role: 'user',
      content: `Product: ${productName || 'the product'}
What it is / who it's for: ${description}
Style: ${styleBlurb}${refSection}
${brandSection}

Plan the ${desired} clips.`,
    }],
  })

  const rawText = message.content.find((b: any) => b.type === 'text')?.text?.trim() ?? '{}'
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

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as Record<string, any>
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
      model: 'claude-opus-4-8',
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

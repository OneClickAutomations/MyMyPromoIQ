/**
 * POST /api/analyze-ad
 * Body: { ad: SourceAd, userProduct?: { name?, description? } }
 *
 * Claude reads a winning ad and returns a STRUCTURED analysis (JSON) used to
 * pre-fill the wizard: hook, structure, suggested style + creator, and a
 * DIFFERENTIATED rewritten script.
 *
 * Hard rule: inspired-by, never copied. Claude identifies what makes the ad work
 * structurally (hook mechanics, pacing, claim shape) and applies those mechanics
 * to the user's product with new wording — it must not reproduce the original's
 * verbatim copy or claims. differentiationNotes is surfaced to the user.
 *
 * Self-contained: no cross-directory imports (Vercel bundling constraint).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

// Valid Step-4 style ids the analysis is allowed to suggest.
const STYLE_IDS = [
  'ugc_testimonial', 'founder_story', 'luxury_commercial',
  'cinematic_brand', 'fast_cut_hook', 'unboxing', 'explainer',
]

interface AdAnalysis {
  hookType: string
  hookText: string
  structure: string[]
  claimsAndAngles: string[]
  suggestedCommercialStyle: string
  suggestedCreatorAttributes: Record<string, string>
  improvedScript: string
  differentiationNotes: string
}

function coerce(parsed: Record<string, unknown>): AdAnalysis {
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : []
  const str = (v: unknown): string => typeof v === 'string' ? v : ''
  let style = str(parsed.suggestedCommercialStyle)
  if (!STYLE_IDS.includes(style)) style = 'ugc_testimonial'
  const attrsIn = (parsed.suggestedCreatorAttributes ?? {}) as Record<string, unknown>
  const attrs: Record<string, string> = {}
  for (const k of ['gender', 'ageRange', 'ethnicity', 'bodyType', 'hair', 'wardrobe', 'expression', 'energyLevel', 'cameraConfidence']) {
    if (attrsIn[k] != null) attrs[k] = String(attrsIn[k])
  }
  return {
    hookType: str(parsed.hookType) || 'attention hook',
    hookText: str(parsed.hookText),
    structure: arr(parsed.structure),
    claimsAndAngles: arr(parsed.claimsAndAngles),
    suggestedCommercialStyle: style,
    suggestedCreatorAttributes: attrs,
    improvedScript: str(parsed.improvedScript),
    differentiationNotes: str(parsed.differentiationNotes),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set.' })
  }

  const { ad, userProduct } = (req.body ?? {}) as Record<string, any>
  if (!ad?.creative) {
    return res.status(400).json({ error: 'A source ad is required.' })
  }

  const c = ad.creative ?? {}
  const productLine = userProduct?.name || userProduct?.description
    ? `The user is making an ad for THEIR product: ${userProduct?.name ?? ''}${userProduct?.description ? ` — ${userProduct.description}` : ''}.`
    : `The user has not specified their product yet; keep the rewritten script lightly templated so it adapts to any product in the same niche (${ad.product?.name ?? 'this category'}).`

  const system = `You are an elite direct-response ad strategist. You reverse-engineer WHY a winning ad works — its hook mechanics, pacing, and claim structure — and translate those mechanics onto a different brand.

ABSOLUTE RULE: inspired-by, never copied. Do NOT reproduce the source ad's specific wording, headline, or claims verbatim. Identify the underlying structure and write fresh, differentiated copy. Ad platforms penalize duplicate creative, so genuine differentiation is mandatory, not optional.

Map suggestedCommercialStyle to EXACTLY ONE of these ids: ${STYLE_IDS.join(', ')}.

For suggestedCreatorAttributes infer from the ad's casting. Allowed keys: gender, ageRange, ethnicity, bodyType, hair, wardrobe, expression, energyLevel (one of: low, medium, high), cameraConfidence. Omit any you cannot reasonably infer.

Respond with VALID JSON only — no markdown, no preamble:
{"hookType":"","hookText":"","structure":["",""],"claimsAndAngles":["",""],"suggestedCommercialStyle":"","suggestedCreatorAttributes":{},"improvedScript":"","differentiationNotes":""}`

  const userMsg = `SOURCE AD (${ad.platform}, ${ad.pageOrShopName ?? 'unknown page'}):
Headline: ${c.headline ?? '(none)'}
Body: ${c.bodyText ?? '(none)'}
CTA: ${c.cta ?? '(none)'}
Media type: ${c.mediaType ?? 'unknown'}
Product category: ${ad.product?.name ?? 'unknown'}

${productLine}

Analyze the ad and produce the differentiated rewrite. improvedScript should be a ready-to-shoot spoken script (2–5 short lines). differentiationNotes: 1–2 sentences naming what you changed from the original and why.`

  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })

    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Analysis returned no JSON.')
    const analysis = coerce(JSON.parse(jsonMatch[0]))

    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('[/api/analyze-ad]', err)
    const message = err instanceof Error ? err.message : 'Analysis failed.'
    return res.status(502).json({ error: message })
  }
}

/**
 * POST /api/generate
 * Body: { productImageUrl, productDescription, style, quality, script? }
 *
 * 1. Claude writes the cinematic motion prompt.
 * 2. Submits the image-to-video job to Google Veo 3 (non-blocking).
 * 3. Returns { requestId, status, directorPrompt } for the client to poll.
 *
 * Self-contained on purpose: Vercel only reliably bundles files inside the
 * api/ directory, so this function imports node_modules packages only — no
 * cross-directory relative imports (that caused FUNCTION_INVOCATION_FAILED).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

type Quality = 'lite' | 'turbo' | 'standard'
type StyleId = 'testimonial' | 'unboxing' | 'day-in-life' | 'fast-cut'

const QUALITIES: Quality[] = ['lite', 'turbo', 'standard']

const STYLES: Record<StyleId, { label: string; brief: string }> = {
  testimonial: {
    label: 'Testimonial',
    brief:
      'A real person speaking to camera about the product. Warm handheld feel, soft natural window light, subtle push-in. Authentic, trustworthy, like a creator filmed it on their phone.',
  },
  unboxing: {
    label: 'Unboxing',
    brief:
      'Close, tactile product reveal. Hands entering frame, packaging opening, satisfying detail shots. Crisp focus pulls, clean tabletop surface, bright even light.',
  },
  'day-in-life': {
    label: 'Day-in-the-life',
    brief:
      `The product woven into a real moment of someone's day. Lifestyle b-roll energy, gentle motion, lived-in environment, golden ambient light. Aspirational but believable.`,
  },
  'fast-cut': {
    label: 'Fast-cut hook',
    brief:
      'High-energy scroll-stopping opener. Punchy camera moves, quick dynamic motion, bold framing engineered to kill the thumb-scroll in the first second. Vertical, kinetic.',
  },
}

// The wizard (Commercial Studio) uses richer style-preset ids; map them onto the
// four canonical render styles so generation accepts either vocabulary.
const STYLE_ALIASES: Record<string, StyleId> = {
  ugc_testimonial:   'testimonial',
  founder_story:     'testimonial',
  luxury_commercial: 'day-in-life',
  cinematic_brand:   'day-in-life',
  fast_cut_hook:     'fast-cut',
  unboxing:          'unboxing',
  explainer:         'unboxing',
}

/** Resolve any incoming style id (canonical or wizard preset) to a StyleId. */
function resolveStyle(style: string): StyleId | null {
  if (style in STYLES) return style as StyleId
  return STYLE_ALIASES[style] ?? null
}

// ── Video provider ────────────────────────────────────────────────────────────
// Google Veo via the Gemini Developer API (API key, not Vertex AI).
// Method + body shape are per the official google-genai SDK: POST to
// `{model}:predictLongRunning` with { instances: [{ prompt, image }], parameters }.
// Veo job ids are prefixed with "veo:" so /api/status routes the poll correctly.
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Known Veo model ids, best-first — used as a safety net if a key can generate
// video but doesn't enumerate Veo in ListModels. Discovery is still primary.
const KNOWN_VEO_MODELS = [
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-001',
  'veo-2.0-generate-001',
]

const rankVeo = (id: string) =>
  /veo-3.*fast/i.test(id) ? 0 :
  /veo-3/i.test(id)       ? 1 :
  /veo-2/i.test(id)       ? 2 : 3

/**
 * Return an ordered list of Veo model ids to try for THIS API key, instead of
 * hard-coding one id that Google may rename or gate by tier. Google's own 404
 * says: "Call ModelService.ListModels to see the list of available models and
 * their supported methods." — so discovery is primary; the known ids are a net.
 */
async function resolveVeoModels(apiKey: string): Promise<string[]> {
  if (process.env.VEO_MODEL) return [process.env.VEO_MODEL]

  const discovered: string[] = []
  let pageToken = ''
  try {
    // Paginate the full model catalogue (Veo can sit on a later page).
    for (let i = 0; i < 10; i++) {
      const url = `${GEMINI_BASE}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
      const resp = await fetch(url, { headers: { 'x-goog-api-key': apiKey } })
      if (!resp.ok) break // fall through to known-ids net
      const data = (await resp.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>; nextPageToken?: string }
      for (const m of data.models ?? []) {
        const id = (m.name ?? '').replace(/^models\//, '')
        const methods = m.supportedGenerationMethods ?? []
        if (/veo/i.test(id) && methods.includes('predictLongRunning')) discovered.push(id)
      }
      if (!data.nextPageToken) break
      pageToken = data.nextPageToken
    }
  } catch {
    // Network hiccup — fall through to known ids.
  }

  discovered.sort((a, b) => rankVeo(a) - rankVeo(b))
  // Discovered first (authoritative for this key), then any known id not already listed.
  const ordered = [...discovered]
  for (const k of KNOWN_VEO_MODELS) if (!ordered.includes(k)) ordered.push(k)
  return ordered
}

interface BrandContext {
  voice?: string
  taglines?: string[]
  cta?: string
}

// Per-style camera vocabulary embedded into the user message as direction hints.
const STYLE_CAMERA: Record<StyleId, string> = {
  testimonial:  'locked tripod, slow push-in starting at chest-level, hold face in center frame',
  unboxing:     'overhead or 45-degree angle, tight on hands, product fills 60% of frame',
  'day-in-life':'handheld with natural drift, following subject through environment, eye-level',
  'fast-cut':   'rapid zoom-in to face, then pull to product at waist level, high energy physical motion',
}

async function writeDirectorPrompt(
  productDescription: string,
  styleId: StyleId,
  brand?: BrandContext,
  composedPrompt?: string,
  sceneLabel?: string,
  script?: string,
): Promise<string> {
  const style = STYLES[styleId]
  const anthropic = new Anthropic()

  const brandLines: string[] = []
  if (brand?.voice) brandLines.push(`Brand voice: ${brand.voice}.`)
  if (brand?.taglines?.length) brandLines.push(`Brand taglines: ${brand.taglines.join(' / ')}.`)
  if (brand?.cta) brandLines.push(`Preferred CTA: "${brand.cta}".`)
  const brandSection = brandLines.length
    ? `\nBrand context (honour this voice and weave the CTA naturally into the scene if it fits):\n${brandLines.join('\n')}\n`
    : ''

  // When the Composition Engine supplied a compiled prompt, it is AUTHORITATIVE on
  // the cast identity (ethnicity, skin tone, gender, age) and product scale. Claude
  // expands it into motion language but must NOT alter those facts — identity drift
  // is the failure we're fixing.
  const identitySection = composedPrompt
    ? `\nAUTHORITATIVE SCENE (preserve every casting detail VERBATIM — do not change the person's ethnicity, skin tone, gender, age, or the product's real-world scale; you may only add camera movement and timing):\n${composedPrompt}\n`
    : ''

  const sceneFocusMap: Record<string, string> = {
    'Hook':               'SCENE FOCUS — Hook (0-3s): Stop the scroll. Open with a surprising visual, bold movement, or striking emotion that demands attention before a single word is read.',
    'Problem / Agitation':'SCENE FOCUS — Problem: Show the pain point or frustration this product solves. The viewer should feel seen — this is their life before the product.',
    'Solution':           'SCENE FOCUS — Solution: Reveal the product as the answer. Show it working, being used, delivering the result. Clear cause-and-effect.',
    'Social Proof':       'SCENE FOCUS — Social Proof: Convey credibility. Real-person testimonial energy, reactions, visible results, or an "I can\'t believe it worked" moment.',
    'Call to Action':     'SCENE FOCUS — CTA: Drive action. Strong close, product prominently visible, urgency or excitement in the body language. Make the viewer want to tap now.',
    'Outro':              'SCENE FOCUS — Outro/Brand Close: Leave a lasting impression. Product logo area, confident pose, brand color energy, and a final memorable visual beat.',
  }
  const sceneFocusSection = sceneLabel && sceneFocusMap[sceneLabel]
    ? `\n${sceneFocusMap[sceneLabel]}\n`
    : ''

  const system = `You are an expert UGC video director. Your job is to write image-to-video prompts for Google Veo 3 that produce scroll-stopping, authentic-feeling content. Veo 3 responds to physically specific, observable descriptions — not mood words or adjectives.

RULES (violating any one produces unusable output):

1. ACTIONS, not adjectives.
   BAD:  "an energetic woman excitedly shows off the product"
   GOOD: "She picks up the matte black bottle with both hands, holds it at chest height with the label facing the lens, pops the pump twice, then rubs the serum between her palms — eyes locked on camera the whole time."
   Every beat must be something a camera can literally capture.

2. ANCHOR the product in every sentence.
   State its exact visual appearance (color, material, shape, label text if known). Never assume Veo remembers what was described in a prior sentence.

3. PRECISE camera language only.
   Good: "locked tripod, slow push-in starting at chest level", "handheld with slight natural drift", "overhead tight on hands, product fills 70% of frame", "fast zoom-in to face then snap to product"
   Banned words: cinematic, professional, high-quality, aesthetic, stunning, beautiful, seamless, vibrant, amazing, incredible, perfect.

4. AUDIO is first-class — Veo 3 generates sound with the image.
   If a script line is provided, embed it verbatim with delivery notes:
   Example: She looks directly into the lens and says "I used to spend $80 on this — now I spend $12," voice calm and matter-of-fact, slight upward smile at the end.
   If no script, describe ambient sound: the click of a lid, the rustle of packaging, a quiet exhale.

5. ONE continuous shot — no cuts, no scene transitions.

6. VERTICAL 9:16 framing. Creator occupies the center third of frame.

7. BE CREATIVE AND SPECIFIC. Imagine a real creator in a real environment — morning light through a bathroom window, kitchen counter with a plant just visible at frame edge, a bedroom nightstand. Concrete environmental detail makes the output feel genuine, not studio-fake.

Output ONLY the prompt text. No preamble, no quotes, no markdown. 4-6 sentences.${composedPrompt ? '\nPreserve the cast person\'s ethnicity and skin tone exactly as stated in the AUTHORITATIVE SCENE. Keep the product at realistic real-world scale. Keep hands anatomically correct and the face stable (no morphing).' : ''}`

  const userLines: string[] = []
  userLines.push(`Product: ${productDescription}`)
  if (script?.trim()) {
    userLines.push(`Script line to speak verbatim: "${script.trim()}"`)
  }
  userLines.push(`Style direction: ${style.brief}`)
  userLines.push(`Camera direction: ${STYLE_CAMERA[styleId]}`)
  if (brandSection.trim()) userLines.push(brandSection.trim())
  if (sceneFocusSection.trim()) userLines.push(sceneFocusSection.trim())
  if (identitySection.trim()) userLines.push(identitySection.trim())
  userLines.push(`\nWrite the ${style.label} motion prompt.`)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 650,
    system,
    messages: [
      {
        role: 'user',
        content: userLines.join('\n\n'),
      },
    ],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  if (!text) throw new Error('Director returned an empty prompt.')
  return text
}

/**
 * Submit an image-to-video job to Google Veo 3 (Gemini API). Veo is a
 * long-running operation: we POST and get back an operation name, then
 * /api/status polls it. Veo renders the clip WITH synchronized audio, so the
 * finished video is not silent the way a Higgsfield render is.
 *
 * Veo wants the reference image as inline base64 (not a URL), so we fetch and
 * encode the product photo here.
 */
async function submitVeoJob(
  prompt: string,
  imageUrl?: string,
  opts?: { negativePrompt?: string },
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (required for Veo video generation).')

  // Fetch and encode the reference image (image-to-video).
  let imagePayload: { bytesBase64Encoded: string; mimeType: string } | undefined
  if (imageUrl) {
    const META_CDN = /(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com)/i
    const fetchHeaders: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
    }
    if (META_CDN.test(imageUrl)) fetchHeaders['referer'] = 'https://www.facebook.com/'
    const imgResp = await fetch(imageUrl, { headers: fetchHeaders })
    if (!imgResp.ok) throw new Error(`Could not fetch the product image (${imgResp.status}). Upload the image directly instead.`)
    imagePayload = {
      bytesBase64Encoded: Buffer.from(await imgResp.arrayBuffer()).toString('base64'),
      mimeType: imgResp.headers.get('content-type') || 'image/jpeg',
    }
  }

  // Discover the models this key actually has — no guessing, no single hard-coded id.
  const candidates = await resolveVeoModels(apiKey)

  const aspectRatio = process.env.VEO_ASPECT_RATIO || '9:16'
  const avoid = opts?.negativePrompt?.trim()

  const instance: Record<string, unknown> = { prompt }
  if (imagePayload) instance.image = imagePayload

  // Body shape per the google-genai SDK: instances[] + parameters.
  const body = JSON.stringify({
    instances: [instance],
    parameters: {
      aspectRatio,
      sampleCount: 1,
      ...(avoid ? { negativePrompt: avoid.slice(0, 400) } : {}),
    },
  })

  let lastStatus = 0
  let lastDetail = ''
  for (const model of candidates) {
    const resp = await fetch(`${GEMINI_BASE}/models/${model}:predictLongRunning`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body,
    })
    if (resp.status === 404) {
      // Model not on this key — try the next candidate.
      lastStatus = 404
      lastDetail = `${model} not available`
      console.warn(`[generate] ${model} → 404, trying next`)
      continue
    }
    if (!resp.ok) {
      // A non-404 error (quota, auth, bad request) is real — surface it now.
      const detail = await resp.text().catch(() => '')
      throw new Error(`Veo submit failed (${resp.status}) with ${model}: ${detail.slice(0, 400)}`)
    }
    const data = (await resp.json()) as Record<string, unknown>
    const opName = data.name as string | undefined
    if (!opName) throw new Error(`Veo submit returned no operation name. Raw: ${JSON.stringify(data).slice(0, 300)}`)
    console.info(`[generate] Veo model in use: ${model} — op: ${opName}`)
    return { requestId: `veo:${opName}`, status: 'queued', provider: model }
  }

  // Every candidate 404'd → the key genuinely lacks Veo access. Say so clearly.
  throw new Error(
    `No Veo video model is available on this GEMINI_API_KEY (tried: ${candidates.join(', ')}; last: ${lastStatus} ${lastDetail}). ` +
    'Veo requires a Google Cloud project with billing enabled. Fix: create a key at ' +
    'aistudio.google.com/apikey on a paid project, set it as GEMINI_API_KEY in Vercel → Settings → Environment Variables, and redeploy.',
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.' })
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables to enable Veo video generation.' })
    }

    const {
      productImageUrl,
      productDescription,
      style,
      quality = 'turbo',
      composedPrompt,
      negativePrompt,
      brandVoice,
      brandTaglines,
      brandCta,
      sceneLabel,
      script,
      // "Bring Your Own Creator" (Task A): an uploaded/transformed creator photo
      // takes priority over the product photo as Veo's single identity reference.
      creatorImageUrl,
      creatorConsentAt,
    } = (req.body ?? {}) as Record<string, string> & { brandTaglines?: string[] }

    // ProductInput/CreatorInput both emit resized data: URLs directly (no
    // upload round-trip needed — Node's fetch reads data: URLs natively), so
    // accept either an https link or an inline data URL.
    const VALID_IMAGE_URL = /^(https?:\/\/|data:image\/[a-z0-9.+-]+;base64,)/i
    if (productImageUrl && !VALID_IMAGE_URL.test(productImageUrl)) {
      return res.status(400).json({ error: 'Product image must be an https:// URL or an uploaded photo.' })
    }
    if (creatorImageUrl && !VALID_IMAGE_URL.test(creatorImageUrl)) {
      return res.status(400).json({ error: 'Creator image must be an https:// URL or an uploaded photo.' })
    }
    // A real person's likeness is in play — never generate without the explicit
    // consent acknowledgment (Task A.3). Enforced server-side, not just in the UI.
    if (creatorImageUrl && !creatorConsentAt) {
      return res.status(400).json({ error: 'Confirm you have the right to use this person\'s likeness before generating.' })
    }
    if (!productDescription?.trim()) {
      return res.status(400).json({ error: 'Describe the product in a sentence.' })
    }
    const styleId = resolveStyle(style)
    if (!styleId) {
      const accepted = [...Object.keys(STYLES), ...Object.keys(STYLE_ALIASES)].join(', ')
      return res.status(400).json({ error: `Unknown style "${style}". Pick one of: ${accepted}.` })
    }
    if (!QUALITIES.includes(quality as Quality)) {
      return res.status(400).json({ error: `Unknown quality. Pick one of: ${QUALITIES.join(', ')}.` })
    }

    const brand: BrandContext = {
      voice: brandVoice || undefined,
      taglines: Array.isArray(brandTaglines) ? brandTaglines : undefined,
      cta: brandCta || undefined,
    }

    const directorPrompt = await writeDirectorPrompt(
      productDescription.trim(),
      styleId,
      brand,
      composedPrompt,
      sceneLabel,
      script,
    )

    // Veo takes exactly one conditioning image per job. When a creator photo is
    // present, it wins — identity drift on a face is far more noticeable (and
    // more consequential, since it's a real person) than on a product, and the
    // product's appearance/scale is already carried in the text prompt.
    const veoReferenceImage = creatorImageUrl || productImageUrl
    const { requestId, status } = await submitVeoJob(directorPrompt, veoReferenceImage || undefined, { negativePrompt })

    return res.status(200).json({ requestId, status, directorPrompt, provider: 'veo3' })
  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return res.status(502).json({ error: message })
  }
}

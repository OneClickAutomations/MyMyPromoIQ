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
import { createClient } from '@supabase/supabase-js'
import { submitDopVideo, type DopArgs, type DopModel } from './_lib/higgsfield.js'
import { validateVeoPrompt } from './_lib/promptEngine/index.js'

type Quality = 'lite' | 'turbo' | 'standard'

// ── Higgsfield video path (rebuild Stage 4) ──────────────────────────────────
// When Higgsfield creds are present, video generation routes to Seedance 2.0;
// otherwise it falls back to the existing Veo path so the branch works either
// way until the Veo cleanup stage. Higgsfield references the conditioning image
// by URL (start_image), so a data-URL reference is hosted to Supabase first.
// The returned request id is prefixed "hf:" so /api/status polls Higgsfield.

function higgsfieldEnabled(): boolean {
  return !!((process.env.HIGGSFIELD_API_KEY && (process.env.HIGGSFIELD_SECRET || process.env.HIGGSFIELD_API_SECRET))
    || (process.env.HIGGSFIELD_API_TOKEN || '').includes(':'))
}

/** https URLs pass through; data-URL/base64 refs are hosted to Supabase so
 *  Higgsfield can fetch the conditioning image by URL. */
async function hostRefUrl(imageUrl?: string): Promise<string | undefined> {
  if (!imageUrl) return undefined
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl
  if (!imageUrl.startsWith('data:')) return undefined
  const b64 = imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl
  const mime = imageUrl.match(/^data:(.*?);base64/)?.[1] || 'image/jpeg'
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Image hosting not configured (SUPABASE_SERVICE_KEY) — needed to send the conditioning image to Higgsfield.')
  const supabase = createClient(supabaseUrl, serviceKey)
  const bucket = 'product-images'
  await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 20_971_520 }).catch(() => {})
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const path = `hf-refs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(b64, 'base64'), { contentType: mime, upsert: true })
  if (error) throw new Error(`Could not host the conditioning image: ${error.message}`)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Submit a Higgsfield DoP image-to-video job. Returns an "hf:"-prefixed
 *  request id for /api/status. DoP is this account's verified video model
 *  (dashboard: DoP Lite/Standard/Turbo) — NOT Seedance, which was an unverified
 *  slug that hung the function. The tier is set by DOP_MODEL (default dop-lite,
 *  the lightest/cheapest). DoP needs a conditioning image (image-to-video), so
 *  a start image is required. The app layers the ElevenLabs voiceover downstream
 *  (api/mux.ts). */
async function submitHiggsfieldVideo(
  prompt: string,
  imageUrl?: string,
  _opts?: { durationSeconds?: number },
): Promise<{ requestId: string; status: string; provider: string }> {
  const startImage = await hostRefUrl(imageUrl)
  if (!startImage) throw new Error('Higgsfield DoP needs a product or creator image to animate. Upload or generate one first.')
  const model = (process.env.DOP_MODEL as DopModel) || 'dop-lite'
  const args: DopArgs = {
    prompt,
    model,
    enhance_prompt: true,
    input_images: [{ type: 'image_url', image_url: startImage }],
  }
  const jobSet = await submitDopVideo(args)
  // Log the raw submit response so the Vercel Runtime Log shows the exact shape.
  console.info('[generate] DoP submit response:', JSON.stringify(jobSet).slice(0, 500))
  // The submit response is a JobSet {id, jobs} (per the official SDK); polling
  // is GET /v1/job-sets/{id} — done by /api/status via the hf:-prefixed id.
  const status = jobSet.jobs?.[0]?.status || 'queued'
  return { requestId: `hf:${jobSet.id}`, status, provider: `higgsfield-${model}` }
}
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
  // Prompt-engine ad-type ids — so the legacy/Higgsfield fallback path also
  // accepts a type chosen via the new type-first selector (the engine path
  // ignores `style`, but this keeps the fallback from 400-ing on an engine id).
  testimonial:       'testimonial',
  problem_solution:  'testimonial',
  before_after:      'testimonial',
  street_interview:  'testimonial',
  day_in_the_life:   'day-in-life',
  pov:               'day-in-life',
  tutorial:          'unboxing',
  product_reveal:    'day-in-life',
  comparison:        'unboxing',
  hook_only:         'fast-cut',
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
  productReference?: { data: string; mime: string },
  creatorReference?: { data: string; mime: string },
  sceneIndex?: number,
  sceneCount?: number,
  regenerationNotes?: string,
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

  // Cross-clip continuity. Each clip is a separate Veo generation, so without
  // this every clip opens with its own product-hero establishing shot and the
  // stitched commercial feels like the same ad repeating. Tell clips 2..N they
  // are a CONTINUATION and must NOT re-establish — begin mid-action so the
  // sequence reads as one uninterrupted take.
  const idx = typeof sceneIndex === 'number' ? sceneIndex : 0
  const total = typeof sceneCount === 'number' ? sceneCount : 1
  let continuitySection = ''
  if (total > 1) {
    if (idx <= 1) {
      continuitySection = `\nSEQUENCE — This is clip 1 of ${total} in ONE continuous commercial. Open the scene and hook the viewer. The creator, wardrobe, lighting, and setting you establish here MUST carry through the rest of the sequence.\n`
    } else if (idx >= total) {
      continuitySection = `\nSEQUENCE — This is the FINAL clip (${idx} of ${total}) of ONE continuous commercial. Do NOT restart with a product beauty-shot or a new establishing frame — the camera is already rolling on the same creator in the same setting. Continue seamlessly from the previous moment and land the close/CTA.\n`
    } else {
      continuitySection = `\nSEQUENCE — This is clip ${idx} of ${total} in ONE continuous commercial. Do NOT re-introduce the product with a static hero shot and do NOT re-establish the scene — the SAME creator is already on screen mid-action, in the same wardrobe, lighting and setting as the previous clip. Begin mid-motion and continue the single take as if there was never a cut.\n`
    }
  }

  const system = `You are an expert UGC video director. Your job is to write image-to-video prompts that produce scroll-stopping, authentic-feeling content for a physics-aware video model. The model responds to physically specific, observable descriptions — not mood words or adjectives.

RULES (violating any one produces unusable output):

1. ACTIONS, not adjectives.
   BAD:  "an energetic woman excitedly shows off the product"
   GOOD: "She picks up the matte black bottle with both hands, holds it at chest height with the label facing the lens, pops the pump twice, then rubs the serum between her palms — eyes locked on camera the whole time."
   Every beat must be something a camera can literally capture.

2. ANCHOR the product in every sentence.
   State its exact visual appearance (color, material, shape, label text if known). Never assume the model remembers what was described in a prior sentence.${productReference ? ' A reference image of the product is attached — describe ONLY what you actually observe in it (exact color, material, shape, proportions, and any visible label/text). Do NOT invent details that contradict the photo; if the description text conflicts with the photo, the photo wins.' : ''}

2a. SCALE — state the product's real-world size relative to the body EVERY time, using a concrete comparison object a viewer already knows (e.g. "about the size of a golf ball", "roughly a deck of cards", "small enough to close a fist around", "the length of a thumb"). Never leave size to the model's imagination — undersized text-only description is the single most common failure mode (products rendering comically oversized, dwarfing the hand or face).

2b. PARTS — if the product is a CONTAINER with a smaller item that comes OUT of it (an earbud case with earbuds, a pill bottle with pills, a lipstick tube with the bullet, a jar with cream on a fingertip), you MUST name both the container and the smaller part explicitly, and be precise about which one performs the described action. Concretely: "She opens the charging case, lifts ONE earbud out between two fingers, and places just the earbud in her ear — the case stays closed in her other hand at waist height, never touching her face." NEVER describe the outer container itself being pressed to an ear, eye, mouth, or skin — only the small inner part that is physically sized for that contact ever touches the body.
${creatorReference ? `
2c. ANCHOR the creator's appearance to their reference photo.
   A reference image of the creator is also attached. Describe their hair style/color, facial features, skin tone, clothing, and hands EXACTLY as observed in that photo — never invent or vary these across scenes. The only appearance details that may change are ones the scene direction below explicitly calls for (e.g. a different action, pose, or setting); absent an explicit instruction, hair, face, clothing, hands, and skin tone must stay identical to the photo.` : ''}

3. PRECISE camera language only.
   Good: "locked tripod, slow push-in starting at chest level", "handheld with slight natural drift", "overhead tight on hands, product fills 70% of frame", "fast zoom-in to face then snap to product"
   Banned words: cinematic, professional, high-quality, aesthetic, stunning, beautiful, seamless, vibrant, amazing, incredible, perfect.

4. AUDIO is first-class — the model generates sound with the image.
   If a script line is provided, embed it verbatim with delivery notes:
   Example: She looks directly into the lens and says "I used to spend $80 on this — now I spend $12," voice calm and matter-of-fact, slight upward smile at the end.
   If no script, describe ambient sound: the click of a lid, the rustle of packaging, a quiet exhale.

5. ONE continuous shot — no cuts, no scene transitions.

6. VERTICAL 9:16 framing. Creator occupies the center third of frame.

7. BE CREATIVE AND SPECIFIC. Imagine a real creator in a real environment — morning light through a bathroom window, kitchen counter with a plant just visible at frame edge, a bedroom nightstand. Concrete environmental detail makes the output feel genuine, not studio-fake.

Output ONLY the prompt text. No preamble, no quotes, no markdown. 4-6 sentences.${composedPrompt ? '\nPreserve the cast person\'s ethnicity and skin tone exactly as stated in the AUTHORITATIVE SCENE. Keep hands anatomically correct and the face stable (no morphing).' : ''}
Keep the product at realistic real-world scale and anatomically/functionally correct part usage (rules 2a-2b) in EVERY case, composed scene or not.`

  const userLines: string[] = []
  userLines.push(`Product: ${productDescription}`)
  if (script?.trim()) {
    userLines.push(`Script line to speak verbatim: "${script.trim()}"`)
  }
  userLines.push(`Style direction: ${style.brief}`)
  userLines.push(`Camera direction: ${STYLE_CAMERA[styleId]}`)
  if (brandSection.trim()) userLines.push(brandSection.trim())
  if (continuitySection.trim()) userLines.push(continuitySection.trim())
  if (sceneFocusSection.trim()) userLines.push(sceneFocusSection.trim())
  if (identitySection.trim()) userLines.push(identitySection.trim())
  if (regenerationNotes?.trim()) {
    userLines.push(`\nREGENERATION NOTES from the user — incorporate these specific changes/keywords into the scene (they take priority over the generic style direction where they conflict): ${regenerationNotes.trim()}`)
  }
  userLines.push(`\nWrite the ${style.label} motion prompt.`)

  const imageBlocks = [productReference, creatorReference]
    .filter((r): r is { data: string; mime: string } => !!r)
    .map(r => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: r.mime as any, data: r.data } }))

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 650,
    system,
    messages: [
      {
        role: 'user',
        content: imageBlocks.length
          ? [...imageBlocks, { type: 'text', text: userLines.join('\n\n') }]
          : userLines.join('\n\n'),
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
/** Fetch any https:// or data: image URL and return it as base64 + mime type. */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mime: string }> {
  const META_CDN = /(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com)/i
  const fetchHeaders: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
  }
  if (META_CDN.test(imageUrl)) fetchHeaders['referer'] = 'https://www.facebook.com/'
  const imgResp = await fetch(imageUrl, { headers: fetchHeaders })
  if (!imgResp.ok) throw new Error(`Could not fetch the reference image (${imgResp.status}). Upload the image directly instead.`)
  return {
    data: Buffer.from(await imgResp.arrayBuffer()).toString('base64'),
    mime: imgResp.headers.get('content-type') || 'image/jpeg',
  }
}

// Nano Banana start-frame image models (same candidates modelsheet.ts uses).
// Runtime discovery, not a hardcoded id — a 404 means retired for this key.
const GEMINI_IMAGE_MODELS = process.env.GEMINI_IMAGE_MODEL
  ? [process.env.GEMINI_IMAGE_MODEL]
  : ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview']

/**
 * Generate the Nano Banana start frame for a clip (the mandatory image→video
 * handoff — character consistency comes from anchoring every clip on a matching
 * first frame). Accepts up to a few reference images (product + creator) that
 * Nano Banana composites. Returns a data URL, or null if the key has no image
 * model / the call is blocked (caller then falls back to a raw reference photo
 * rather than hard-failing the whole generation).
 */
async function generateStartFrame(
  apiKey: string,
  prompt: string,
  refs: Array<{ data: string; mime: string }>,
): Promise<string | null> {
  const parts: Array<Record<string, unknown>> = []
  for (const r of refs) parts.push({ inline_data: { mime_type: r.mime, data: r.data } })
  parts.push({ text: prompt })

  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const resp = await fetch(
        `${GEMINI_BASE}/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.35, responseModalities: ['IMAGE', 'TEXT'] },
          }),
        },
      )
      if (resp.status === 404) { console.warn(`[generate] start-frame ${model} → 404, trying next`); continue }
      if (!resp.ok) {
        console.warn(`[generate] start-frame ${model} failed (${resp.status}); falling back to reference photo`)
        return null
      }
      const data = (await resp.json()) as any
      const outParts = data?.candidates?.[0]?.content?.parts ?? []
      const imagePart = outParts.find((p: any) => p.inline_data?.data || p.inlineData?.data)
      const out = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data
      if (!out) {
        const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason
        console.warn(`[generate] start-frame ${model} produced no image (${reason ?? 'unknown'}); falling back`)
        return null
      }
      const outMime = imagePart?.inline_data?.mime_type ?? imagePart?.inlineData?.mimeType ?? 'image/png'
      return `data:${outMime};base64,${out}`
    } catch (err) {
      console.warn('[generate] start-frame error, falling back:', err instanceof Error ? err.message : err)
      return null
    }
  }
  return null
}

// Veo accepts a limited set of aspect ratios. Map a requested UI ratio to the
// closest supported one (4:5 → 9:16, since Veo has no tall-feed ratio).
const VEO_SUPPORTED_RATIOS = new Set(['9:16', '16:9', '1:1'])
function resolveVeoAspectRatio(requested?: string): string {
  const r = (requested || process.env.VEO_ASPECT_RATIO || '9:16').trim()
  if (VEO_SUPPORTED_RATIOS.has(r)) return r
  if (r === '4:5') return '9:16' // nearest portrait
  return '9:16'
}

async function submitVeoJob(
  prompt: string,
  imageUrl?: string,
  opts?: { negativePrompt?: string; aspectRatio?: string },
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (required for Veo video generation).')

  // Fetch and encode the reference image (image-to-video).
  let imagePayload: { bytesBase64Encoded: string; mimeType: string } | undefined
  if (imageUrl) {
    const img = await fetchImageAsBase64(imageUrl)
    imagePayload = { bytesBase64Encoded: img.data, mimeType: img.mime }
  }

  // Discover the models this key actually has — no guessing, no single hard-coded id.
  const candidates = await resolveVeoModels(apiKey)

  const aspectRatio = resolveVeoAspectRatio(opts?.aspectRatio)
  const avoid = opts?.negativePrompt?.trim()

  const instance: Record<string, unknown> = { prompt }
  if (imagePayload) instance.image = imagePayload

  // Body shape per the google-genai SDK: instances[] + parameters.
  // IMPORTANT: for image-to-video Veo derives the aspect ratio from the
  // conditioning image; passing an EXPLICIT aspectRatio that conflicts with the
  // image returns a 400 (the "Retry" failure when a non-9:16 ratio was picked).
  // So only send aspectRatio for text-to-video; for image-to-video the chosen
  // ratio is honoured via the start frame's aspect instead.
  const body = JSON.stringify({
    instances: [instance],
    parameters: {
      ...(imagePayload ? {} : { aspectRatio }),
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
      // Product consistency: the turnaround sheet (or the hero photo, as a
      // fallback) is shown to Claude as a VISION input so the written
      // description matches the real product instead of being invented from
      // text alone. This is separate from Veo's single conditioning image.
      productReferenceImageUrl,
      // Multi-clip continuity: this clip's 1-based position in the sequence and
      // the total, so clips 2..N continue the take instead of each re-opening
      // on a product establishing shot.
      sceneIndex,
      sceneCount,
      // Free-text keywords/notes from the "Regenerate" panel — incorporated
      // into the director prompt with priority over the generic style brief.
      regenerationNotes,
      // Multi-scene chaining: the PREVIOUS scene's last frame, used as THIS
      // scene's DoP conditioning image instead of the static product photo —
      // continues the same take (same environment/pose) instead of every
      // scene snapping back to the same opening shot when stitched together.
      // The Claude vision reference (productReferenceImageUrl) is deliberately
      // NOT overridden by this — it stays pinned to the real product photo so
      // the written description never drifts across a chain of re-derived frames.
      conditioningImageUrl,
      // ── Prompt-engine path (opt-in) ──────────────────────────────────────
      // When the type-first wizard builds prompts via api/_lib/promptEngine,
      // it sends the finished timed-beat Veo prompt + the Nano Banana start-
      // frame prompt + the negative prompt. Their presence switches generate
      // into the engine path: render the start frame first (Nano Banana),
      // then animate it (Veo). This is the mandatory image→video handoff.
      veoPrompt,
      nanaBananaPrompt,
      clipDurationSeconds,
      // The creator's reference selfie/photos to composite into the start frame
      // (character consistency). Product ref is productReferenceImageUrl/
      // productImageUrl. Optional — Nano Banana works text-only too.
      creatorReferenceImageUrl,
      // Output aspect ratio (9:16 / 16:9 / 4:5) — mapped to a Veo-supported value.
      aspectRatio,
    } = (req.body ?? {}) as Record<string, string> & { brandTaglines?: string[]; sceneIndex?: number; sceneCount?: number }

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

    // ── Prompt-engine path ─────────────────────────────────────────────────
    // The wizard pre-built the timed-beat prompt. Validate it (blocking gate,
    // never submit a known-bad prompt), render the Nano Banana start frame from
    // the matching image prompt + reference photos, then animate with Veo.
    // Only when a Gemini key is present — otherwise fall through to the legacy
    // path (which can still use Higgsfield DoP) rather than dead-ending.
    if (typeof veoPrompt === 'string' && veoPrompt.trim() && process.env.GEMINI_API_KEY) {
      const apiKey = process.env.GEMINI_API_KEY
      const dur = Number(clipDurationSeconds) || 6
      const check = validateVeoPrompt(veoPrompt, dur)
      // A bad engine prompt must NOT dead-end the render with a 422 (the user
      // just sees "Retry"). Log it and fall through to the legacy director-
      // prompt path below, which can still produce a video from the same
      // request. The client also sends productDescription/style/composedPrompt,
      // so the fallback has everything it needs.
      if (!check.valid) {
        console.warn('[generate] engine prompt failed validation, falling back to legacy path:', check.errors.join('; '))
      } else {

      // Conditioning-image priority for THIS clip:
      //  1. A chain frame (previous clip's last frame) — seamless continuity.
      //  2. A REAL creator photo — condition Veo DIRECTLY on it so an
      //     uploaded/saved person keeps their exact face. A Nano Banana
      //     recomposite can drift a real face into "a random person" (the
      //     saved-creator bug), so we deliberately skip the start frame here.
      //  3. A Nano Banana start frame — only for GENERATED creators (no photo),
      //     giving them a consistent invented opening.
      //  4. The product photo — last resort.
      const realCreatorPhoto =
        creatorImageUrl && /^(https?:|data:)/i.test(creatorImageUrl) ? creatorImageUrl : undefined

      let startFrame: string | null = null
      if (!conditioningImageUrl && !realCreatorPhoto && nanaBananaPrompt && typeof nanaBananaPrompt === 'string') {
        // No real face to preserve — build the start frame from the product
        // (and any creator reference) so a generated creator opens consistently.
        const refUrls = [creatorReferenceImageUrl, productReferenceImageUrl || productImageUrl]
          .filter((u): u is string => !!u)
        const refs: Array<{ data: string; mime: string }> = []
        for (const u of refUrls) {
          const img = await fetchImageAsBase64(u).catch(() => undefined)
          if (img) refs.push(img)
        }
        startFrame = await generateStartFrame(apiKey, nanaBananaPrompt, refs)
      }
      const conditioning = conditioningImageUrl || realCreatorPhoto || startFrame || productImageUrl
      const { requestId, status } = await submitVeoJob(veoPrompt, conditioning || undefined, { negativePrompt, aspectRatio })
      return res.status(200).json({
        requestId,
        status,
        directorPrompt: veoPrompt,
        provider: 'veo3',
        startFrameGenerated: !!startFrame,
        validation: check,
      })
      } // end engine path (valid prompt)
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

    // Ground the written description in the real product: prefer the
    // turnaround sheet (richer — 6 angles), fall back to the hero photo. A
    // failed fetch here is non-fatal — generation proceeds text-only rather
    // than failing the whole request over a vision nice-to-have.
    const referenceUrl = productReferenceImageUrl || productImageUrl
    const productReference = referenceUrl
      ? await fetchImageAsBase64(referenceUrl).catch(err => {
          console.warn('[generate] product reference fetch failed, continuing text-only:', err instanceof Error ? err.message : err)
          return undefined
        })
      : undefined

    // Creator consistency: the same uploaded/transformed photo Veo uses as its
    // conditioning image is also shown to Claude, so hair, face, clothing,
    // hands, and skin tone stay locked to the real photo instead of drifting
    // scene-to-scene from a text-only description.
    const creatorReference = creatorImageUrl
      ? await fetchImageAsBase64(creatorImageUrl).catch(err => {
          console.warn('[generate] creator reference fetch failed, continuing text-only:', err instanceof Error ? err.message : err)
          return undefined
        })
      : undefined

    const directorPrompt = await writeDirectorPrompt(
      productDescription.trim(),
      styleId,
      brand,
      composedPrompt,
      sceneLabel,
      script,
      productReference,
      creatorReference,
      Number(sceneIndex) || undefined,
      Number(sceneCount) || undefined,
      regenerationNotes,
    )

    // Exactly one conditioning image per job. A chaining override (this
    // scene continuing the previous scene's last frame) wins over everything
    // else — that's what keeps a multi-scene ad visually continuous instead
    // of every scene restarting from the same static photo. Absent that, a
    // creator photo wins over the product photo — identity drift on a face is
    // far more noticeable (and more consequential, since it's a real person)
    // than on a product, and the product's appearance/scale is already
    // carried in the text prompt.
    const referenceImage = conditioningImageUrl || creatorImageUrl || productImageUrl

    // Video provider: PREFER GOOGLE VEO when a Gemini key is present — Veo 3 is
    // the stronger general video model (native audio, better product/creator
    // consistency) and its API is directly callable. Higgsfield DoP is the
    // fallback (used only when there's no Gemini key). This ordering was
    // reversed deliberately: DoP is a capable general animator but the app was
    // assembling ads from general parts with no faithful editor in the stack.
    if (process.env.GEMINI_API_KEY) {
      const { requestId, status } = await submitVeoJob(directorPrompt, referenceImage || undefined, { negativePrompt, aspectRatio })
      return res.status(200).json({ requestId, status, directorPrompt, provider: 'veo3' })
    }

    if (higgsfieldEnabled()) {
      const out = await submitHiggsfieldVideo(directorPrompt, referenceImage || undefined, {
        durationSeconds: Number((req.body as Record<string, unknown>)?.durationSeconds) || undefined,
      })
      return res.status(200).json({ ...out, directorPrompt })
    }

    return res.status(503).json({ error: 'No video provider configured. Set GEMINI_API_KEY (for Veo) or Higgsfield credentials in Vercel.' })
  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return res.status(502).json({ error: message })
  }
}

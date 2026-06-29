/**
 * POST /api/discover
 * Body: { type: 'keyword' | 'product_url', value: string, platform: 'meta' | 'tiktok' | 'both' }
 *
 * Returns a scored list of running ads (SourceAd[]) for the query.
 *
 * Data source is pluggable:
 *   - If APIFY_TOKEN is set, the real scraper adapter runs (Meta/TikTok ad
 *     libraries via Apify actors). Swap the adapter body once the actor IDs are
 *     confirmed — the rest of the system never sees Apify.
 *   - Otherwise it serves a curated, clearly-labeled demo dataset so the entire
 *     downstream flow (scoring → Claude analysis → clone → wizard) is testable
 *     today. Demo results carry `live: false`.
 *
 * Scoring runs server-side here so the client only renders. Self-contained on
 * purpose: Vercel only reliably bundles files inside api/ — no src/ imports.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AdPlatform = 'meta' | 'tiktok'
type ScoreRating = 'green' | 'yellow' | 'red'

interface ScoreFactor { value: number; rawSignal: string; weight: number }
interface OpportunityScore {
  rating: ScoreRating
  total: number
  factors: { longevity: ScoreFactor; reachProxy: ScoreFactor; sourceability: ScoreFactor; cloneComplexity: ScoreFactor }
}
interface SourcingResult {
  provider: 'aliexpress' | 'cj_dropshipping'
  matchedProductUrl: string
  matchedImageUrl?: string
  unitCost: number
  currency: string
  supplierRating?: number
  shippingEstimateDays?: number
  confidence: 'high' | 'medium' | 'low'
}
interface SourceAd {
  id: string
  platform: AdPlatform
  externalAdId: string
  pageOrShopName: string
  creative: {
    bodyText?: string
    headline?: string
    cta?: string
    mediaUrls: string[]
    mediaType: 'image' | 'video' | 'carousel'
  }
  delivery: {
    startDate: string
    isActive: boolean
    daysRunning: number
    impressionsRange?: string
    spendRange?: string
  }
  product: { name?: string; sourceUrl?: string; matchedSourcingResult?: SourcingResult }
  score: OpportunityScore
  fetchedAt: string
}

// ── Raw seed ad (pre-score). Scores are computed below so they always reflect
//    the live scoring function, never a hand-typed number that can drift. ───────
interface RawAd {
  id: string
  platform: AdPlatform
  externalAdId: string
  pageOrShopName: string
  keywords: string[]
  creative: SourceAd['creative']
  delivery: Omit<SourceAd['delivery'], 'daysRunning'> & { startDate: string }
  product: { name?: string; sourceUrl?: string; matchedSourcingResult?: SourcingResult }
  /** Inferred scene/cut count for clone-complexity scoring. */
  sceneCount: number
  durationSeconds: number
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

// ── Scoring (0.5) ─────────────────────────────────────────────────────────────
function clamp(n: number): number { return Math.max(0, Math.min(100, n)) }

function scoreLongevity(daysRunning: number): ScoreFactor {
  // 14+ days is the strongest free signal; saturates near 30.
  const value = clamp((daysRunning / 30) * 100)
  return { value, rawSignal: `Running ${daysRunning} day${daysRunning === 1 ? '' : 's'}`, weight: 0.3 }
}

function scoreReachProxy(ad: RawAd): ScoreFactor {
  const range = ad.delivery.impressionsRange || ad.delivery.spendRange
  if (!range) {
    return { value: 35, rawSignal: 'No public reach data', weight: 0.25 }
  }
  // Pull the upper bound of a "10K–50K" / "$1K–$5K" style range as a rough proxy.
  const nums = range.replace(/[$,]/g, '').match(/[\d.]+\s*[KMkm]?/g) ?? []
  const parse = (s: string) => {
    const m = s.trim().match(/([\d.]+)\s*([KMkm]?)/)
    if (!m) return 0
    const base = parseFloat(m[1])
    const mult = /k/i.test(m[2]) ? 1_000 : /m/i.test(m[2]) ? 1_000_000 : 1
    return base * mult
  }
  const upper = nums.length ? parse(nums[nums.length - 1]) : 0
  // Log-scale: 1K→~30, 50K→~70, 1M→100.
  const value = upper > 0 ? clamp((Math.log10(upper) / 6) * 100) : 35
  return { value, rawSignal: `Reach proxy: ${range}`, weight: 0.25 }
}

function scoreSourceability(s?: SourcingResult): ScoreFactor {
  if (!s) {
    return { value: 10, rawSignal: 'No sourcing match found', weight: 0.3 }
  }
  const confWeight = s.confidence === 'high' ? 1 : s.confidence === 'medium' ? 0.65 : 0.35
  // Cheaper unit cost = more margin headroom. $2→~95, $15→~45, $40→~15.
  const marginScore = clamp(100 - (s.unitCost / 0.4))
  const value = clamp(marginScore * confWeight)
  return {
    value,
    rawSignal: `${s.provider === 'aliexpress' ? 'AliExpress' : 'CJ'} match · $${s.unitCost.toFixed(2)} · ${s.confidence} confidence`,
    weight: 0.3,
  }
}

function scoreCloneComplexity(ad: RawAd): ScoreFactor {
  // Shorter, fewer-cut ads are easier to replicate well → higher score.
  const cutPenalty = Math.max(0, ad.sceneCount - 1) * 12
  const durationPenalty = Math.max(0, ad.durationSeconds - 15) * 1.5
  const value = clamp(100 - cutPenalty - durationPenalty)
  return {
    value,
    rawSignal: `${ad.sceneCount} scene${ad.sceneCount === 1 ? '' : 's'} · ${ad.durationSeconds}s`,
    weight: 0.15,
  }
}

function computeOpportunityScore(ad: RawAd, daysRunning: number): OpportunityScore {
  const longevity = scoreLongevity(daysRunning)
  const reachProxy = scoreReachProxy(ad)
  const sourceability = scoreSourceability(ad.product.matchedSourcingResult)
  const cloneComplexity = scoreCloneComplexity(ad)
  const total = Math.round(
    longevity.value * longevity.weight +
    reachProxy.value * reachProxy.weight +
    sourceability.value * sourceability.weight +
    cloneComplexity.value * cloneComplexity.weight,
  )
  const rating: ScoreRating = total >= 70 ? 'green' : total >= 40 ? 'yellow' : 'red'
  return { rating, total, factors: { longevity, reachProxy, sourceability, cloneComplexity } }
}

// ── Curated demo dataset ──────────────────────────────────────────────────────
// Spread across niches and quality tiers so keyword search returns relevant
// subsets and the score function produces a real green/yellow/red mix.
const SEED_ADS: RawAd[] = [
  {
    id: 'seed-skincare-1',
    platform: 'meta',
    externalAdId: 'mock_2381',
    pageOrShopName: 'GlowLab Skincare',
    keywords: ['skincare', 'serum', 'vitamin c', 'glow', 'beauty', 'face'],
    creative: {
      headline: 'Brighter skin in 14 days',
      bodyText: 'I was skeptical too — then I tried it for two weeks. The dark spots faded and my skin actually glows now. No filter.',
      cta: 'Shop Now',
      mediaUrls: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80'],
      mediaType: 'video',
    },
    delivery: { startDate: new Date(Date.now() - 26 * 86_400_000).toISOString(), isActive: true, impressionsRange: '50K–100K', spendRange: '$5K–$10K' },
    product: {
      name: 'Vitamin C Brightening Serum',
      sourceUrl: 'https://example.com/glowlab-serum',
      matchedSourcingResult: { provider: 'aliexpress', matchedProductUrl: 'https://aliexpress.com/item/vitc-serum', matchedImageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80', unitCost: 3.2, currency: 'USD', supplierRating: 4.7, shippingEstimateDays: 12, confidence: 'high' },
    },
    sceneCount: 2,
    durationSeconds: 18,
  },
  {
    id: 'seed-skincare-2',
    platform: 'tiktok',
    externalAdId: 'tt_5510',
    pageOrShopName: 'DewyDrop',
    keywords: ['skincare', 'serum', 'hyaluronic', 'glow', 'beauty', 'face', 'moisturizer'],
    creative: {
      headline: 'The 3-second glow trick',
      bodyText: 'POV: you found the serum that actually works. Watch what happens.',
      cta: 'Get Yours',
      mediaUrls: ['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=600&q=80'],
      mediaType: 'video',
    },
    delivery: { startDate: new Date(Date.now() - 9 * 86_400_000).toISOString(), isActive: true },
    product: {
      name: 'Hyaluronic Glow Serum',
      matchedSourcingResult: { provider: 'cj_dropshipping', matchedProductUrl: 'https://cjdropshipping.com/hyaluronic', unitCost: 4.8, currency: 'USD', supplierRating: 4.4, shippingEstimateDays: 8, confidence: 'medium' },
    },
    sceneCount: 4,
    durationSeconds: 27,
  },
  {
    id: 'seed-fitness-1',
    platform: 'meta',
    externalAdId: 'mock_7742',
    pageOrShopName: 'CoreFlex',
    keywords: ['fitness', 'workout', 'resistance', 'home gym', 'exercise', 'band'],
    creative: {
      headline: 'Your whole gym in one band',
      bodyText: 'Cancelled my gym membership after I got this. 20-minute full-body workout at home, no excuses.',
      cta: 'Learn More',
      mediaUrls: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80'],
      mediaType: 'image',
    },
    delivery: { startDate: new Date(Date.now() - 41 * 86_400_000).toISOString(), isActive: true, impressionsRange: '100K–500K' },
    product: {
      name: 'Resistance Band System',
      sourceUrl: 'https://example.com/coreflex-bands',
      matchedSourcingResult: { provider: 'aliexpress', matchedProductUrl: 'https://aliexpress.com/item/resistance-bands', matchedImageUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=300&q=80', unitCost: 5.5, currency: 'USD', supplierRating: 4.8, shippingEstimateDays: 14, confidence: 'high' },
    },
    sceneCount: 1,
    durationSeconds: 12,
  },
  {
    id: 'seed-kitchen-1',
    platform: 'tiktok',
    externalAdId: 'tt_9931',
    pageOrShopName: 'PrepPro Kitchen',
    keywords: ['kitchen', 'chopper', 'vegetable', 'cooking', 'gadget', 'food prep'],
    creative: {
      headline: 'Dinner prep in 60 seconds',
      bodyText: 'This little gadget changed how I cook. Watch me dice a whole onion without crying.',
      cta: 'Shop Now',
      mediaUrls: ['https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80'],
      mediaType: 'video',
    },
    delivery: { startDate: new Date(Date.now() - 19 * 86_400_000).toISOString(), isActive: true },
    product: {
      name: 'Rapid Vegetable Chopper',
      matchedSourcingResult: { provider: 'cj_dropshipping', matchedProductUrl: 'https://cjdropshipping.com/chopper', unitCost: 6.9, currency: 'USD', supplierRating: 4.5, shippingEstimateDays: 10, confidence: 'high' },
    },
    sceneCount: 3,
    durationSeconds: 22,
  },
  {
    id: 'seed-pet-1',
    platform: 'meta',
    externalAdId: 'mock_3120',
    pageOrShopName: 'PawComfort',
    keywords: ['pet', 'dog', 'cat', 'grooming', 'brush', 'fur', 'animal'],
    creative: {
      headline: 'No more fur everywhere',
      bodyText: 'My golden retriever sheds less now and actually loves grooming time. The fur comes off in one pass.',
      cta: 'Get 50% Off',
      mediaUrls: ['https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=80'],
      mediaType: 'image',
    },
    delivery: { startDate: new Date(Date.now() - 33 * 86_400_000).toISOString(), isActive: true, impressionsRange: '50K–100K' },
    product: {
      name: 'Self-Cleaning Pet Brush',
      matchedSourcingResult: { provider: 'aliexpress', matchedProductUrl: 'https://aliexpress.com/item/pet-brush', matchedImageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300&q=80', unitCost: 4.1, currency: 'USD', supplierRating: 4.6, shippingEstimateDays: 13, confidence: 'medium' },
    },
    sceneCount: 2,
    durationSeconds: 16,
  },
  {
    id: 'seed-tech-1',
    platform: 'tiktok',
    externalAdId: 'tt_6604',
    pageOrShopName: 'LumosGear',
    keywords: ['tech', 'gadget', 'led', 'light', 'desk', 'rgb', 'setup'],
    creative: {
      headline: 'Upgrade your setup in 5 minutes',
      bodyText: 'Stuck this behind my monitor and my whole room feels different. Reacts to whatever is on screen.',
      cta: 'Shop the Drop',
      mediaUrls: ['https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80'],
      mediaType: 'video',
    },
    delivery: { startDate: new Date(Date.now() - 4 * 86_400_000).toISOString(), isActive: true },
    product: {
      name: 'Reactive LED Strip',
      matchedSourcingResult: { provider: 'cj_dropshipping', matchedProductUrl: 'https://cjdropshipping.com/led', unitCost: 8.4, currency: 'USD', supplierRating: 4.2, shippingEstimateDays: 11, confidence: 'low' },
    },
    sceneCount: 5,
    durationSeconds: 31,
  },
  {
    id: 'seed-home-1',
    platform: 'meta',
    externalAdId: 'mock_8857',
    pageOrShopName: 'NestGlow',
    keywords: ['home', 'lamp', 'sunset', 'decor', 'light', 'projector', 'aesthetic'],
    creative: {
      headline: 'Golden hour, anytime',
      bodyText: 'The sunset lamp everyone is obsessed with. My photos have never looked better and it just feels cozy.',
      cta: 'Shop Now',
      mediaUrls: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80'],
      mediaType: 'image',
    },
    delivery: { startDate: new Date(Date.now() - 2 * 86_400_000).toISOString(), isActive: true },
    product: {
      name: 'Sunset Projection Lamp',
      // No sourcing match → demonstrates a red/low sourceability case.
    },
    sceneCount: 1,
    durationSeconds: 10,
  },
  {
    id: 'seed-wellness-1',
    platform: 'meta',
    externalAdId: 'mock_4419',
    pageOrShopName: 'CalmRoot',
    keywords: ['wellness', 'sleep', 'magnesium', 'supplement', 'health', 'relax', 'stress'],
    creative: {
      headline: 'The reason you cannot sleep',
      bodyText: 'A doctor explained why magnesium changed my nights. I fall asleep in minutes now instead of scrolling for hours.',
      cta: 'Learn More',
      mediaUrls: ['https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=600&q=80'],
      mediaType: 'video',
    },
    delivery: { startDate: new Date(Date.now() - 52 * 86_400_000).toISOString(), isActive: true, impressionsRange: '500K–1M', spendRange: '$10K–$50K' },
    product: {
      name: 'Magnesium Sleep Complex',
      sourceUrl: 'https://example.com/calmroot',
      matchedSourcingResult: { provider: 'aliexpress', matchedProductUrl: 'https://aliexpress.com/item/magnesium', unitCost: 7.6, currency: 'USD', supplierRating: 4.5, shippingEstimateDays: 15, confidence: 'medium' },
    },
    sceneCount: 3,
    durationSeconds: 24,
  },
]

function matchesQuery(ad: RawAd, type: string, value: string): boolean {
  const q = value.toLowerCase().trim()
  if (!q) return true
  if (type === 'product_url') {
    // URL-first: loose token overlap against product name + keywords.
    const tokens = q.replace(/https?:\/\//, '').split(/[^a-z0-9]+/).filter(t => t.length > 3)
    const hay = `${ad.product.name ?? ''} ${ad.keywords.join(' ')}`.toLowerCase()
    return tokens.some(t => hay.includes(t))
  }
  return ad.keywords.some(k => k.includes(q) || q.includes(k)) ||
    (ad.product.name?.toLowerCase().includes(q) ?? false)
}

function finalize(ad: RawAd): SourceAd {
  const daysRunning = daysSince(ad.delivery.startDate)
  return {
    id: ad.id,
    platform: ad.platform,
    externalAdId: ad.externalAdId,
    pageOrShopName: ad.pageOrShopName,
    creative: ad.creative,
    delivery: { ...ad.delivery, daysRunning },
    product: ad.product,
    score: computeOpportunityScore(ad, daysRunning),
    fetchedAt: new Date().toISOString(),
  }
}

// ── Apify Meta Ad Library adapter ─────────────────────────────────────────────
// Driven by apify/facebook-ads-scraper. Everything actor-specific is isolated in
// this one config so it's correctable in a single place. The actor scrapes from a
// Facebook Ad Library URL you hand it via `startUrls` — that URL interface has
// been the actor's stable contract across versions, so we build the search URL
// rather than guessing at a keyword field.
//
// Output field names DO drift; mapItem is deliberately defensive (tries several
// field-name variants and returns null when an item can't be mapped). If the
// mapping is wrong, items map to null → the endpoint falls back to the labeled
// demo set (live:false) rather than breaking or inventing data. Confirm the real
// output shape with GET /api/sourcing?schema=meta and by inspecting one
// dataset item, then tighten mapItem below.
const APIFY_BASE = 'https://api.apify.com/v2'

const META_ACTOR = {
  actorId: 'apify~facebook-ads-scraper',
  enabled: true, // official actor; safe to attempt — degrades to demo set on miss.
  maxResults: 20,
  /** Build a Facebook Ad Library search URL for the query. */
  searchUrl(type: string, value: string): string {
    const params = new URLSearchParams({
      active_status: 'all',
      ad_type: 'all',
      country: 'ALL',
      media_type: 'all',
    })
    if (type === 'product_url') {
      // No direct URL search in Ad Library; fall back to loose keyword tokens.
      const kw = value.replace(/https?:\/\//, '').split(/[^a-zA-Z0-9]+/).filter(t => t.length > 3).slice(0, 4).join(' ')
      params.set('q', kw || value)
    } else {
      params.set('q', value)
    }
    params.set('search_type', 'keyword_unordered')
    return `https://www.facebook.com/ads/library/?${params.toString()}`
  },
  /** ⚠️ Output mapping — confirm field names against a real dataset item. */
  mapItem(item: any): RawAd | null {
    const snap = item?.snapshot ?? item?.snapShot ?? {}
    const externalAdId = String(item?.adArchiveID ?? item?.adArchiveId ?? item?.ad_archive_id ?? item?.id ?? '')
    if (!externalAdId) return null

    const bodyText = snap?.body?.text ?? snap?.body ?? item?.adText ?? undefined
    const headline = snap?.title ?? snap?.linkTitle ?? item?.title ?? undefined
    const cta = snap?.ctaText ?? snap?.cta_text ?? snap?.cta ?? undefined
    const pageName = item?.pageName ?? item?.page_name ?? snap?.pageName ?? 'Unknown advertiser'

    const images: string[] = (snap?.images ?? snap?.cards ?? [])
      .map((m: any) => m?.resizedImageUrl ?? m?.originalImageUrl ?? m?.imageUrl ?? m?.url)
      .filter(Boolean)
    const videos: string[] = (snap?.videos ?? [])
      .map((v: any) => v?.videoSdUrl ?? v?.videoHdUrl ?? v?.url)
      .filter(Boolean)
    const mediaUrls = videos.length ? videos : images
    const mediaType: SourceAd['creative']['mediaType'] =
      videos.length ? 'video' : images.length > 1 ? 'carousel' : 'image'

    const startRaw = item?.startDate ?? item?.start_date ?? item?.startDateFormatted ?? snap?.startDate
    const startMs = typeof startRaw === 'number' ? startRaw * 1000 : Date.parse(startRaw ?? '')
    const startDate = isFinite(startMs) ? new Date(startMs).toISOString() : new Date().toISOString()
    const isActive = item?.isActive ?? item?.is_active ?? true

    return {
      id: `apify-${externalAdId}`,
      platform: 'meta',
      externalAdId,
      pageOrShopName: pageName,
      keywords: [],
      creative: { headline, bodyText, cta, mediaUrls: mediaUrls.length ? mediaUrls : [], mediaType },
      delivery: {
        startDate,
        isActive: !!isActive,
        impressionsRange: item?.impressionsWithIndex?.impressionsText ?? item?.impressions ?? undefined,
        spendRange: item?.spend ?? undefined,
      },
      // Sourcing is a separate call (/api/sourcing) — left unmatched here so the
      // score reflects "not yet sourced" until the sourcing lookup runs.
      product: { name: headline || pageName },
      sceneCount: mediaType === 'video' ? 3 : 1,
      durationSeconds: mediaType === 'video' ? 20 : 8,
    }
  },
}

/** Submit an async actor run, poll until it finishes, return dataset items. */
async function runApifyActorAsync(actorId: string, input: Record<string, unknown>, token: string): Promise<any[]> {
  const startResp = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!startResp.ok) {
    const detail = await startResp.text().catch(() => '')
    throw new Error(`Apify run start failed (${startResp.status}): ${detail.slice(0, 200)}`)
  }
  const started = (await startResp.json()) as any
  const runId = started?.data?.id
  const datasetId = started?.data?.defaultDatasetId
  if (!runId) throw new Error('Apify did not return a run id.')

  // Poll run status. Cap well under the function timeout so we never hang the
  // request; if it's still running we bail to the demo set rather than block.
  const deadline = Date.now() + 45_000
  let finalDatasetId = datasetId
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3_000))
    const statusResp = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`)
    if (!statusResp.ok) continue
    const run = (await statusResp.json()) as any
    const status = run?.data?.status
    finalDatasetId = run?.data?.defaultDatasetId ?? finalDatasetId
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status}.`)
    }
  }
  if (!finalDatasetId) return []

  const itemsResp = await fetch(`${APIFY_BASE}/datasets/${finalDatasetId}/items?token=${encodeURIComponent(token)}&clean=true&limit=${META_ACTOR.maxResults}`)
  if (!itemsResp.ok) return []
  const items = (await itemsResp.json()) as any[]
  return Array.isArray(items) ? items : []
}

/**
 * Real scraper adapter. When APIFY_TOKEN is present and the actor is enabled,
 * runs the Meta Ad Library actor and maps its dataset into RawAd[]. Returns null
 * (→ demo-set fallback) on any failure or empty result, so the UI never breaks.
 *
 * Only Meta is wired (per the chosen actor). TikTok stays on the demo set.
 */
async function runApifyAdapter(type: string, value: string, platform: string): Promise<RawAd[] | null> {
  const token = process.env.APIFY_TOKEN
  if (!token || !META_ACTOR.enabled) return null
  if (platform === 'tiktok') return null // Meta-only actor; let TikTok use the seed set.

  try {
    const input = { startUrls: [{ url: META_ACTOR.searchUrl(type, value) }], resultsLimit: META_ACTOR.maxResults }
    const items = await runApifyActorAsync(META_ACTOR.actorId, input, token)
    const mapped = items.map(it => META_ACTOR.mapItem(it)).filter((a): a is RawAd => a !== null)
    return mapped.length ? mapped : null
  } catch (err) {
    console.error('[/api/discover] Apify adapter error — falling back to demo set:', err)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type = 'keyword', value = '', platform = 'both' } = (req.body ?? {}) as Record<string, string>

  if (type !== 'keyword' && type !== 'product_url') {
    return res.status(400).json({ error: "type must be 'keyword' or 'product_url'." })
  }
  if (!value.trim()) {
    return res.status(400).json({ error: 'Provide a keyword or product URL to search.' })
  }

  try {
    let raw: RawAd[] | null = null
    let live = false

    if (process.env.APIFY_TOKEN) {
      raw = await runApifyAdapter(type, value, platform)
      live = !!raw
    }

    if (!raw) {
      raw = SEED_ADS.filter(ad => matchesQuery(ad, type, value))
    }

    const filtered = platform === 'both' ? raw : raw.filter(ad => ad.platform === platform)
    const ads = filtered.map(finalize).sort((a, b) => b.score.total - a.score.total)

    return res.status(200).json({
      live,
      resultCount: ads.length,
      ads,
      notice: live ? undefined : 'Showing curated sample ads — connect a scraper (APIFY_TOKEN) for live results.',
    })
  } catch (err) {
    console.error('[/api/discover]', err)
    const message = err instanceof Error ? err.message : 'Discovery search failed.'
    return res.status(502).json({ error: message })
  }
}

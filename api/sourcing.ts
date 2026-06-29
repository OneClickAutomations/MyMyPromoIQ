/**
 * POST /api/sourcing
 * Body: { productName: string, productImageUrl?: string, userId?: string }
 *
 * Dropship sourcing lookup for the Discovery Engine. Answers "does this product
 * exist on a marketplace and what does it cost" — feeding the `sourceability`
 * factor of the Opportunity Score and the CJ Dropshipping fulfillment handoff.
 *
 * Two-call strategy (NOT either/or):
 *   1. Always run the keyword actor (fast, price + rating baseline).
 *   2. If an image URL is available, also run the image-search actor.
 *   3. Prefer the image match  → confidence 'high'
 *      Keyword match only      → confidence 'medium'
 *      Neither                 → return null  (UI reads this as "couldn't verify",
 *                                              NOT a wrong price)
 *
 * Caching: sourcing_lookups (keyed on normalized product name, 72h TTL) so
 * repeated lookups don't burn Apify spend. AliExpress prices drift, so this TTL
 * is deliberately shorter than the 24h ad-search cache.
 *
 * ⚠️  ACTOR FIELD NAMES ARE UNVERIFIED AND THE ACTORS ARE GATED OFF.
 *     "scraper" actors are not standardized; their input AND output field names
 *     vary by maintainer. Do NOT enable an actor until you have confirmed its
 *     real schema with GET /api/apify-schema?actor=ali-keyword (and ali-image),
 *     corrected the `input`/`mapItem` functions below, and flipped `enabled`.
 *     Until then this endpoint returns null sourcing (honest "couldn't verify")
 *     rather than a fabricated price.
 *
 * Self-contained: no src/ imports.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const APIFY_BASE = 'https://api.apify.com/v2'
const SOURCING_TTL_HOURS = 72
// Shared cache rows aren't user-specific (an AliExpress price is the same for
// everyone), so cache under a sentinel user id via the service key.
const CACHE_USER = '__cache__'

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

/** A normalized marketplace match before confidence is assigned. */
interface RawMatch {
  productUrl: string
  imageUrl?: string
  unitCost: number
  currency: string
  supplierRating?: number
  shippingEstimateDays?: number
}

// ─────────────────────────────────────────────────────────────────────────────
//  ⚠️  ACTOR ADAPTERS — VERIFY BEFORE ENABLING
//
//  Each adapter isolates everything actor-specific in ONE place: the actor id,
//  the input it's called with, and how a dataset item maps into RawMatch. The
//  field names below are PLACEHOLDERS, not verified. Run /api/apify-schema for
//  each actor, correct `input(...)` and `mapItem(...)`, then set `enabled: true`.
// ─────────────────────────────────────────────────────────────────────────────
interface ActorAdapter {
  actorId: string
  enabled: boolean
  /** Build the actor's run input. ⚠️ confirm field names via /api/apify-schema. */
  input: (args: { productName: string; productImageUrl?: string }) => Record<string, unknown>
  /** Map ONE dataset item → RawMatch, or null to skip. ⚠️ confirm output fields. */
  mapItem: (item: any) => RawMatch | null
}

const ALIEXPRESS_ACTORS: { keyword: ActorAdapter; image: ActorAdapter } = {
  // thirdwatch/aliexpress-product-scraper — keyword/title match.
  keyword: {
    actorId: 'thirdwatch~aliexpress-product-scraper',
    enabled: false, // ⚠️ flip true ONLY after verifying the schema.
    input: ({ productName }) => ({
      // ⚠️ UNVERIFIED placeholder. Could be searchTerms / keyword / query / urls.
      //    Confirm with: GET /api/apify-schema?actor=ali-keyword
      search: productName,
      maxItems: 5,
    }),
    mapItem: (item) => {
      // ⚠️ UNVERIFIED placeholder output mapping. Confirm price/currency/url field
      //    names against a real dataset item before trusting this.
      const unitCost = num(item?.price ?? item?.salePrice ?? item?.minPrice)
      const productUrl = str(item?.url ?? item?.productUrl ?? item?.link)
      if (unitCost == null || !productUrl) return null
      return {
        productUrl,
        imageUrl: str(item?.image ?? item?.imageUrl ?? item?.thumbnail) || undefined,
        unitCost,
        currency: str(item?.currency) || 'USD',
        supplierRating: num(item?.rating ?? item?.storeRating) ?? undefined,
        shippingEstimateDays: num(item?.shippingDays ?? item?.deliveryDays) ?? undefined,
      }
    },
  },
  // freecamp008/aliexpress-search-by-image-actor — reverse-image match.
  image: {
    actorId: 'freecamp008~aliexpress-search-by-image-actor',
    enabled: false, // ⚠️ flip true ONLY after verifying the schema.
    input: ({ productImageUrl }) => ({
      // ⚠️ UNVERIFIED placeholder. Could be imageUrl / image / imageUrls / url.
      //    Confirm with: GET /api/apify-schema?actor=ali-image
      imageUrl: productImageUrl,
      maxItems: 5,
    }),
    mapItem: (item) => {
      // ⚠️ UNVERIFIED placeholder output mapping.
      const unitCost = num(item?.price ?? item?.salePrice ?? item?.minPrice)
      const productUrl = str(item?.url ?? item?.productUrl ?? item?.link)
      if (unitCost == null || !productUrl) return null
      return {
        productUrl,
        imageUrl: str(item?.image ?? item?.imageUrl ?? item?.thumbnail) || undefined,
        unitCost,
        currency: str(item?.currency) || 'USD',
        supplierRating: num(item?.rating ?? item?.storeRating) ?? undefined,
        shippingEstimateDays: num(item?.shippingDays ?? item?.deliveryDays) ?? undefined,
      }
    },
  },
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return isFinite(n) ? n : null
  }
  return null
}
function str(v: unknown): string { return typeof v === 'string' ? v : '' }

/**
 * Run an actor synchronously and return its dataset items. Used for sourcing
 * because each lookup is a single fast product query that must feel responsive.
 */
async function runActorSync(adapter: ActorAdapter, args: { productName: string; productImageUrl?: string }, token: string): Promise<RawMatch | null> {
  if (!adapter.enabled) return null
  const resp = await fetch(
    `${APIFY_BASE}/acts/${adapter.actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(adapter.input(args)),
    },
  )
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`Apify actor ${adapter.actorId} failed (${resp.status}): ${detail.slice(0, 200)}`)
  }
  const items = (await resp.json()) as any[]
  if (!Array.isArray(items)) return null
  for (const item of items) {
    const match = adapter.mapItem(item)
    if (match) return match // first usable match
  }
  return null
}

// ── CJ Dropshipping fulfillment handoff ──────────────────────────────────────
// AliExpress answers "does this exist + cost"; CJ is where the user actually
// fulfills, and where the affiliate commission is captured. Separate concern —
// we just build the outbound link (with the affiliate ref if configured).
function buildCjFulfillUrl(productName: string): string {
  const base = 'https://cjdropshipping.com/list/search'
  const ref = process.env.CJ_AFFILIATE_URL
  const search = `${base}?searchText=${encodeURIComponent(productName)}`
  if (!ref) return search
  // If CJ_AFFILIATE_URL is a full referral landing URL, hand off through it; if
  // it's a bare ref code, append it.
  if (/^https?:\/\//i.test(ref)) return ref
  return `${search}&ref=${encodeURIComponent(ref)}`
}

// ── Cache (best-effort; degrades to no-cache if Supabase isn't configured) ────
function db(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

async function readCache(supabase: SupabaseClient, key: string): Promise<{ hit: boolean; result: SourcingResult | null }> {
  const { data, error } = await supabase
    .from('sourcing_lookups')
    .select('result, expires_at')
    .eq('user_id', CACHE_USER)
    .eq('normalized_name', key)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return { hit: false, result: null }
  return { hit: true, result: (data.result as SourcingResult | null) ?? null }
}

async function writeCache(supabase: SupabaseClient, key: string, result: SourcingResult | null): Promise<void> {
  const expiresAt = new Date(Date.now() + SOURCING_TTL_HOURS * 3_600_000).toISOString()
  await supabase.from('sourcing_lookups').insert({
    user_id: CACHE_USER,
    normalized_name: key,
    result,
    expires_at: expiresAt,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productName, productImageUrl } = (req.body ?? {}) as Record<string, string>
  if (!productName?.trim()) {
    return res.status(400).json({ error: 'productName is required.' })
  }

  const supabase = db()
  const cacheKey = normalizeName(productName)

  try {
    // 1. Cache first.
    if (supabase) {
      const cached = await readCache(supabase, cacheKey)
      if (cached.hit) {
        return res.status(200).json({ sourcingResult: cached.result, cached: true, fulfillUrl: buildCjFulfillUrl(productName) })
      }
    }

    const token = process.env.APIFY_TOKEN
    const actorsEnabled = ALIEXPRESS_ACTORS.keyword.enabled || ALIEXPRESS_ACTORS.image.enabled

    // 2. If sourcing isn't wired/verified yet, return null honestly (don't guess
    //    a price). The Opportunity Score reads null as low sourceability.
    if (!token || !actorsEnabled) {
      const notice = !token
        ? 'APIFY_TOKEN not set — sourcing lookup unavailable.'
        : 'Sourcing actors not yet verified/enabled. Confirm schemas via /api/apify-schema and enable them in api/sourcing.ts.'
      return res.status(200).json({ sourcingResult: null, cached: false, notice, fulfillUrl: buildCjFulfillUrl(productName) })
    }

    // 3. Two-call strategy. Keyword always; image when an image URL is available.
    const [keywordMatch, imageMatch] = await Promise.all([
      runActorSync(ALIEXPRESS_ACTORS.keyword, { productName, productImageUrl }, token).catch(() => null),
      productImageUrl
        ? runActorSync(ALIEXPRESS_ACTORS.image, { productName, productImageUrl }, token).catch(() => null)
        : Promise.resolve(null),
    ])

    // 4. Prefer image (higher confidence); fall back to keyword; else null.
    let sourcingResult: SourcingResult | null = null
    if (imageMatch) {
      sourcingResult = { provider: 'aliexpress', confidence: 'high', matchedProductUrl: imageMatch.productUrl, matchedImageUrl: imageMatch.imageUrl, unitCost: imageMatch.unitCost, currency: imageMatch.currency, supplierRating: imageMatch.supplierRating, shippingEstimateDays: imageMatch.shippingEstimateDays }
    } else if (keywordMatch) {
      sourcingResult = { provider: 'aliexpress', confidence: 'medium', matchedProductUrl: keywordMatch.productUrl, matchedImageUrl: keywordMatch.imageUrl, unitCost: keywordMatch.unitCost, currency: keywordMatch.currency, supplierRating: keywordMatch.supplierRating, shippingEstimateDays: keywordMatch.shippingEstimateDays }
    }

    // 5. Cache (including a null result — "we checked, found nothing" is worth caching).
    if (supabase) await writeCache(supabase, cacheKey, sourcingResult).catch(() => {})

    return res.status(200).json({ sourcingResult, cached: false, fulfillUrl: buildCjFulfillUrl(productName) })
  } catch (err) {
    console.error('[/api/sourcing]', err)
    const message = err instanceof Error ? err.message : 'Sourcing lookup failed.'
    return res.status(502).json({ error: message })
  }
}

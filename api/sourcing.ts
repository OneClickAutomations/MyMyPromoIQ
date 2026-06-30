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
 * Actor INPUT field names are verified against each actor's live schema and the
 * actors are enabled. OUTPUT (dataset item) field names are parsed defensively —
 * if a real run's fields differ, mapItem returns null and the endpoint reports
 * "couldn't verify" rather than a fabricated price. Requires APIFY_TOKEN.
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
//  ACTOR ADAPTERS
//
//  Each adapter isolates everything actor-specific in ONE place: the actor id,
//  the input it's called with, and how a dataset item maps into RawMatch.
//
//  INPUT field names are VERIFIED against each actor's live input schema
//  (GET /api/sourcing?schema=ali-keyword | ali-image), so the actors are enabled.
//  OUTPUT (dataset item) field names are still parsed DEFENSIVELY across the
//  common variants — if none match, mapItem returns null and the endpoint reports
//  "couldn't verify" rather than a wrong price. Tighten mapItem once a real run
//  confirms the exact output keys.
// ─────────────────────────────────────────────────────────────────────────────
interface ActorAdapter {
  actorId: string
  enabled: boolean
  /** Build the actor's run input (field names verified against the live schema). */
  input: (args: { productName: string; productImageUrl?: string }) => Record<string, unknown>
  /** Map ONE dataset item → RawMatch, or null to skip. */
  mapItem: (item: any) => RawMatch | null
}

// Residential US proxy — AliExpress geo-blocks/datacentre-blocks scrapers, so the
// keyword actor effectively requires this to return results.
const APIFY_PROXY = { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], apifyProxyCountry: 'US' }

/**
 * Defensive output mapping shared by both AliExpress actors. Pulls price + a
 * product URL (building one from a product id when no direct URL is present);
 * returns null when neither can be found so we never surface a fabricated price.
 */
function mapAliExpressItem(item: any): RawMatch | null {
  const unitCost = num(item?.price ?? item?.salePrice ?? item?.minPrice ?? item?.appSalePrice ?? item?.originalPrice)
  let productUrl = str(item?.productUrl ?? item?.detailUrl ?? item?.url ?? item?.link ?? item?.productDetailUrl)
  if (!productUrl) {
    const id = str(item?.productId ?? item?.product_id ?? item?.itemId ?? item?.id)
    if (id) productUrl = `https://www.aliexpress.com/item/${id}.html`
  }
  if (unitCost == null || !productUrl) return null
  return {
    productUrl,
    imageUrl: str(item?.imageUrl ?? item?.image ?? item?.imageURL ?? item?.thumbnail ?? item?.mainImage) || undefined,
    unitCost,
    currency: str(item?.currency ?? item?.currencyCode) || 'USD',
    supplierRating: num(item?.rating ?? item?.storeRating ?? item?.evaluateRate ?? item?.starRating) ?? undefined,
    shippingEstimateDays: num(item?.shippingDays ?? item?.deliveryDays ?? item?.deliveryTime) ?? undefined,
  }
}

const ALIEXPRESS_ACTORS: { keyword: ActorAdapter; image: ActorAdapter } = {
  // thirdwatch/aliexpress-product-scraper — keyword/title match.
  keyword: {
    actorId: 'thirdwatch~aliexpress-product-scraper',
    enabled: true,
    // Verified input schema: queries (string[]), maxResults, country, sortBy,
    // trending, proxyConfiguration.
    input: ({ productName }) => ({
      queries: [productName],
      maxResults: 5,
      country: 'US',
      sortBy: 'default',
      trending: false,
      proxyConfiguration: APIFY_PROXY,
    }),
    mapItem: mapAliExpressItem,
  },
  // freecamp008/aliexpress-search-by-image-actor — reverse-image match.
  image: {
    actorId: 'freecamp008~aliexpress-search-by-image-actor',
    enabled: true,
    // Verified input schema: a single imageUrl string.
    input: ({ productImageUrl }) => ({ imageUrl: productImageUrl }),
    mapItem: mapAliExpressItem,
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

// ── Actor schema introspection (GET /api/sourcing?schema=<alias>) ─────────────
// Verification helper, NOT part of the request path. Pulls an actor's LIVE input
// schema from Apify so the real field names can be confirmed before any call code
// is written against them. (Folded in from the old /api/apify-schema endpoint to
// stay under Vercel's 12-function Hobby limit.) Run once on a deployed env that
// can reach Apify, read inputFieldNames, then correct the adapters above.
const SCHEMA_ALIASES: Record<string, string> = {
  meta:          'apify~facebook-ads-scraper',
  'ali-keyword': 'thirdwatch~aliexpress-product-scraper',
  'ali-image':   'freecamp008~aliexpress-search-by-image-actor',
}

async function handleSchema(req: VercelRequest, res: VercelResponse) {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    return res.status(503).json({ error: 'APIFY_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.' })
  }
  const raw = (req.query.schema as string | undefined)?.trim()
  if (!raw) {
    return res.status(400).json({ error: 'Pass ?schema=<username~actor-name> or a shorthand.', shorthands: SCHEMA_ALIASES })
  }
  const actorId = (SCHEMA_ALIASES[raw] ?? raw).replace('/', '~')

  const actorResp = await fetch(`${APIFY_BASE}/acts/${actorId}?token=${encodeURIComponent(token)}`)
  if (!actorResp.ok) {
    const detail = await actorResp.text().catch(() => '')
    return res.status(actorResp.status).json({ error: `Apify returned ${actorResp.status} for actor "${actorId}".`, detail: detail.slice(0, 400) })
  }
  const actor = (await actorResp.json()) as any
  const data = actor?.data ?? actor

  let inputSchema: unknown = null
  try {
    const schemaResp = await fetch(`${APIFY_BASE}/acts/${actorId}/input-schema?token=${encodeURIComponent(token)}`)
    if (schemaResp.ok) inputSchema = await schemaResp.json()
  } catch { /* best-effort */ }

  const properties = (inputSchema as any)?.properties ?? (inputSchema as any)?.data?.properties
  const fieldNames = properties ? Object.keys(properties) : null

  return res.status(200).json({
    actorId,
    name: data?.name,
    username: data?.username,
    title: data?.title,
    inputFieldNames: fieldNames,
    inputSchema,
    exampleInput: data?.exampleRunInput?.body ?? data?.defaultRunOptions ?? null,
    note: 'Use inputFieldNames as the source of truth. Confirm output field names by running the actor once and inspecting a dataset item.',
  })
}

// ── Product page URL extraction ───────────────────────────────────────────────
// Fetches a product page (Shopify, WooCommerce, Amazon, most D2C brands) and
// pulls title, description, and hero image from Open Graph tags + JSON-LD.
// No external service required — works on any SSR-rendered product page.

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

/** Read a meta tag value regardless of attribute order. */
function metaContent(html: string, attrName: string, attrValue: string): string | null {
  const esc = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'),
  ]
  void attrName
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]?.trim()) return decodeHtmlEntities(m[1].trim())
  }
  return null
}

async function extractProductFromUrl(pageUrl: string): Promise<{ title: string | null; description: string | null; imageUrl: string | null }> {
  const resp = await fetch(pageUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`Could not fetch product page (${resp.status}).`)
  const html = await resp.text()

  // 1. Open Graph (most reliable on Shopify/D2C)
  let title = metaContent(html, 'property', 'og:title')
  let description = metaContent(html, 'property', 'og:description')
  let imageUrl = metaContent(html, 'property', 'og:image')

  // 2. Twitter card fallback
  if (!title) title = metaContent(html, 'name', 'twitter:title')
  if (!description) description = metaContent(html, 'name', 'twitter:description')
  if (!imageUrl) imageUrl = metaContent(html, 'name', 'twitter:image')

  // 3. Standard meta fallback
  if (!description) description = metaContent(html, 'name', 'description')

  // 4. Page <title> fallback (strip site suffix like " | My Store")
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    if (t) title = decodeHtmlEntities(t.split(/\s*[|\-–—]\s*/)[0].trim())
  }

  // 5. JSON-LD structured data (Shopify, WooCommerce, schema.org Product)
  const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, json] of ldMatches) {
    try {
      const parsed = JSON.parse(json.trim())
      const items: any[] = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed]
      for (const item of items) {
        if (item?.['@type'] === 'Product') {
          if (!title && item.name) title = String(item.name)
          if (!description && item.description) description = String(item.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
          if (!imageUrl) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image
            if (typeof img === 'string') imageUrl = img
            else if (img?.url) imageUrl = img.url
          }
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  }

  // Ensure imageUrl is absolute
  if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl
  if (imageUrl && !imageUrl.startsWith('http')) imageUrl = null

  return { title, description, imageUrl }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      return await handleSchema(req, res)
    } catch (err) {
      console.error('[/api/sourcing schema]', err)
      const message = err instanceof Error ? err.message : 'Schema fetch failed.'
      return res.status(502).json({ error: message })
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productName, productImageUrl, productUrl } = (req.body ?? {}) as Record<string, string>

  // URL extraction mode — returns { title, description, imageUrl }
  if (productUrl?.trim()) {
    if (!/^https?:\/\//i.test(productUrl)) {
      return res.status(400).json({ error: 'productUrl must start with https://' })
    }
    try {
      const result = await extractProductFromUrl(productUrl.trim())
      return res.status(200).json(result)
    } catch (err) {
      console.error('[/api/sourcing extract]', err)
      const message = err instanceof Error ? err.message : 'Extraction failed.'
      return res.status(502).json({ error: message })
    }
  }

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
        : 'Sourcing actors not yet verified/enabled. Confirm schemas via GET /api/sourcing?schema= and enable them in api/sourcing.ts.'
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

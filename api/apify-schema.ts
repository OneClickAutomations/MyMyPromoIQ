/**
 * GET /api/apify-schema?actor=<actorId>
 *   actorId form: "username~actor-name" (e.g. "apify~facebook-ads-scraper")
 *                 or a shorthand alias: "meta" | "ali-keyword" | "ali-image"
 *
 * Verification helper — NOT part of the request path. Its only job is to pull
 * an actor's LIVE input schema (and the actor's documented example input) from
 * Apify so the real field names can be confirmed before any call code is
 * written against them. This exists because Apify actor input fields vary
 * actor-to-actor and drift as maintainers update them; guessing them is how you
 * end up silently sending an ignored field and getting empty results.
 *
 * Run it once on a deployed environment that can reach Apify, read the field
 * names out of the response, then fill them into the adapter config in
 * api/sourcing.ts (ALIEXPRESS_ACTORS) and api/discover.ts (META_ACTOR).
 *
 * Requires APIFY_TOKEN. Self-contained (no src/ imports).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Shorthand → canonical actor id, so you can hit ?actor=meta etc.
const ACTOR_ALIASES: Record<string, string> = {
  meta:        'apify~facebook-ads-scraper',
  'ali-keyword': 'thirdwatch~aliexpress-product-scraper',
  'ali-image':   'freecamp008~aliexpress-search-by-image-actor',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.APIFY_TOKEN
  if (!token) {
    return res.status(503).json({ error: 'APIFY_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.' })
  }

  const raw = (req.query.actor as string | undefined)?.trim()
  if (!raw) {
    return res.status(400).json({
      error: 'Pass ?actor=<username~actor-name> or a shorthand.',
      shorthands: ACTOR_ALIASES,
    })
  }
  // Accept both "username/actor" and "username~actor"; Apify ids use ~ in URLs.
  const actorId = (ACTOR_ALIASES[raw] ?? raw).replace('/', '~')

  try {
    // The actor object includes defaultRunOptions, exampleRunInput, and the
    // input schema under versions[].sourceFiles or .inputSchema depending on how
    // the actor was built — fetch the actor + its build's input schema.
    const actorResp = await fetch(
      `https://api.apify.com/v2/acts/${actorId}?token=${encodeURIComponent(token)}`,
    )
    if (!actorResp.ok) {
      const detail = await actorResp.text().catch(() => '')
      return res.status(actorResp.status).json({
        error: `Apify returned ${actorResp.status} for actor "${actorId}".`,
        detail: detail.slice(0, 400),
      })
    }
    const actor = (await actorResp.json()) as any
    const data = actor?.data ?? actor

    // The dedicated input-schema endpoint returns the resolved JSON schema for
    // the default build — this is the authoritative list of field names.
    let inputSchema: unknown = null
    try {
      const schemaResp = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/input-schema?token=${encodeURIComponent(token)}`,
      )
      if (schemaResp.ok) inputSchema = await schemaResp.json()
    } catch {
      // best-effort — actor object still carries example input below
    }

    const properties = (inputSchema as any)?.properties ?? (inputSchema as any)?.data?.properties
    const fieldNames = properties ? Object.keys(properties) : null

    return res.status(200).json({
      actorId,
      name: data?.name,
      username: data?.username,
      title: data?.title,
      // The single most useful thing: the verbatim top-level input field names.
      inputFieldNames: fieldNames,
      inputSchema,
      exampleInput: data?.exampleRunInput?.body ?? data?.defaultRunOptions ?? null,
      note: 'Use inputFieldNames as the source of truth. Confirm output field names by running the actor once and inspecting a dataset item.',
    })
  } catch (err) {
    console.error('[/api/apify-schema]', err)
    const message = err instanceof Error ? err.message : 'Schema fetch failed.'
    return res.status(502).json({ error: message })
  }
}

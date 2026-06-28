/**
 * Discovery Engine — client API helpers.
 *
 * Thin wrappers over /api/discover and /api/analyze-ad. The user never sees
 * Apify, Meta's API, or a raw scrape — just scored ads and Claude's analysis.
 */
import type { AdSearchQuery, AdSearchResponse, SourceAd, AdAnalysis } from './types'

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function runDiscoverySearch(query: AdSearchQuery): Promise<AdSearchResponse> {
  const res = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function analyzeSourceAd(
  ad: SourceAd,
  userProduct?: { name?: string; description?: string },
): Promise<{ analysis: AdAnalysis }> {
  const res = await fetch('/api/analyze-ad', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ad, userProduct }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

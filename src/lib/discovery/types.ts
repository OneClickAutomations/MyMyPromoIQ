/**
 * Discovery Engine & Clone Bridge — shared types.
 *
 * The discovery flow sits IN FRONT of the Commercial Studio wizard: research a
 * winning ad → score it → let Claude analyze it → clone it into a pre-filled
 * CreativeBrief that the existing wizard opens, fully editable. Nothing in the
 * render pipeline changes.
 *
 * These types are the frontend's view. The opportunity score is computed
 * server-side (api/discover.ts) — the client only renders it.
 */

export type AdPlatform = 'meta' | 'tiktok'
export type ScoreRating = 'green' | 'yellow' | 'red'

export interface ScoreFactor {
  /** Normalized 0–100. */
  value: number
  /** Human-readable signal, e.g. "Running 23 days" or "3 suppliers, $4.20 avg". */
  rawSignal: string
  /** Relative weight in the composite, 0–1. */
  weight: number
}

export interface OpportunityScore {
  rating: ScoreRating
  /** Composite 0–100. */
  total: number
  factors: {
    longevity: ScoreFactor
    reachProxy: ScoreFactor
    sourceability: ScoreFactor
    cloneComplexity: ScoreFactor
  }
}

export interface SourcingResult {
  provider: 'aliexpress' | 'cj_dropshipping'
  matchedProductUrl: string
  matchedImageUrl?: string
  unitCost: number
  currency: string
  supplierRating?: number
  shippingEstimateDays?: number
  /** How confident the title/image match is — matters more than precision here. */
  confidence: 'high' | 'medium' | 'low'
}

export interface SourceAd {
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
  product: {
    name?: string
    sourceUrl?: string
    matchedSourcingResult?: SourcingResult
  }
  score: OpportunityScore
  fetchedAt: string
}

export interface AdSearchQuery {
  type: 'keyword' | 'product_url'
  value: string
  platform: AdPlatform | 'both'
}

export interface AdSearchResponse {
  /** True when results came from a real scrape; false for the seeded demo set. */
  live: boolean
  resultCount: number
  ads: SourceAd[]
  /** Set when discovery is not yet configured (no scraper token wired). */
  notice?: string
}

/**
 * Claude's structured read of a winning ad. Inspired-by, never copied — the
 * improvedScript is a differentiated rewrite, and differentiationNotes is shown
 * to the user so the clone is transparent, not a black box.
 */
export interface AdAnalysis {
  hookType: string
  hookText: string
  structure: string[]
  claimsAndAngles: string[]
  /** Maps to an existing STYLE_PRESETS id (Step 4). */
  suggestedCommercialStyle: string
  suggestedCreatorAttributes: {
    gender?: string
    ageRange?: string
    ethnicity?: string
    bodyType?: string
    hair?: string
    wardrobe?: string
    expression?: string
    energyLevel?: 'low' | 'medium' | 'high'
    cameraConfidence?: string
  }
  improvedScript: string
  differentiationNotes: string
  /** Intelligence-report fields (Part 2.3 Ad Analysis Panel). Optional so older
   *  cached analyses still type-check. */
  verdict?: string
  cameraStyle?: string
  swot?: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
}

/** Payload handed to the wizard via the clone bridge (sessionStorage). */
export interface ClonePrefill {
  sourceAdId: string
  sourceAdName: string
  analysis: AdAnalysis
  /**
   * Always present: carries the ad's product name/image to pre-fill forms.
   * For Quick Clone this IS the product to sell; for Studio Clone the user
   * replaces it with their own product in the wizard.
   */
  sourcedProduct?: {
    name: string
    imageUrl?: string
    sourceUrl?: string
  }
  /** The scraped ad's own creative image — always present so generation has a reference. */
  adImageUrl?: string
  /**
   * 'quick'  — no analysis; ad image & copy pre-filled; lands in Quick Generate (/forge/review)
   * 'studio' — Claude analysis; lands in 11-step wizard (/studio/new)
   */
  cloneMode?: 'quick' | 'studio'
  appliedAt: string
}

/**
 * Sourcing provider abstraction. Implement once per marketplace (AliExpress
 * affiliate, CJ Dropshipping) so the rest of the system is provider-agnostic —
 * wire whichever account clears review first.
 */
export interface SourcingProvider {
  search(query: string, imageUrl?: string): Promise<SourcingResult[]>
}

export const SCORE_THRESHOLDS = { green: 70, yellow: 40 } as const

export function ratingFromTotal(total: number): ScoreRating {
  if (total >= SCORE_THRESHOLDS.green) return 'green'
  if (total >= SCORE_THRESHOLDS.yellow) return 'yellow'
  return 'red'
}

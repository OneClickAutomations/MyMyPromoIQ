/**
 * Shared types for the video-provider abstraction.
 * Every adapter implements VideoProvider; the functions route through getProvider().
 */

export type NormalizedStatus = 'pending' | 'completed' | 'failed'

export interface JobResult {
  status: NormalizedStatus
  videoUrl: string | null
  /** Raw provider status string, for debugging. */
  raw: string
}

export interface SubmitOptions {
  prompt: string
  /** Public URL of the product image. */
  imageUrl: string
  quality: 'lite' | 'turbo' | 'standard'
}

export interface SubmitResult {
  /** Opaque job id — stored by the caller and passed to poll(). */
  requestId: string
  status: string
}

export interface ProviderCapabilities {
  /** Human-readable name shown in admin / logs. */
  name: string
  /** Quality tiers this provider supports (subset of SubmitOptions.quality). */
  qualities: Array<'lite' | 'turbo' | 'standard'>
  /** Approx max resolution in pixels (short side). */
  maxResolution: number
  /** Typical turnaround in seconds (p50). */
  p50LatencySeconds: number
  /** Credits or cents per second of rendered video (rough). */
  costPerSecond: number
}

export interface VideoProvider {
  readonly id: string
  readonly capabilities: ProviderCapabilities

  submit(opts: SubmitOptions): Promise<SubmitResult>
  poll(requestId: string): Promise<JobResult>
  /** Rough cost in USD cents for a given output duration. */
  estimateCost(durationSeconds: number, quality: SubmitOptions['quality']): number
}

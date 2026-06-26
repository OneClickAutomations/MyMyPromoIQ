/**
 * Provider registry — call getProvider() to get the active adapter.
 *
 * Switch providers via the VIDEO_PROVIDER env var:
 *   VIDEO_PROVIDER=higgsfield  (default)
 *   VIDEO_PROVIDER=arcads
 *
 * Each adapter is instantiated lazily and cached per function invocation.
 */
import { HiggsfieldAdapter } from './higgsfield'
import { ArcadsAdapter } from './arcads'
import type { VideoProvider } from './types'

export type { VideoProvider, SubmitOptions, SubmitResult, JobResult, ProviderCapabilities } from './types'

type ProviderId = 'higgsfield' | 'arcads'

const registry: Record<ProviderId, () => VideoProvider> = {
  higgsfield: () => new HiggsfieldAdapter(),
  arcads: () => new ArcadsAdapter(),
}

/** Cache so we don't rebuild the adapter on every call within the same invocation. */
const cache = new Map<ProviderId, VideoProvider>()

export function getProvider(id?: string): VideoProvider {
  const resolvedId = (id ?? process.env.VIDEO_PROVIDER ?? 'higgsfield') as ProviderId
  if (!registry[resolvedId]) {
    throw new Error(
      `Unknown video provider "${resolvedId}". Valid options: ${Object.keys(registry).join(', ')}.`,
    )
  }
  if (!cache.has(resolvedId)) {
    cache.set(resolvedId, registry[resolvedId]())
  }
  return cache.get(resolvedId)!
}

export { HiggsfieldAdapter } from './higgsfield'
export { ArcadsAdapter } from './arcads'

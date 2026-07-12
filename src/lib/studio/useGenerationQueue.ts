/**
 * useGenerationQueue — the auto-firing generation pipeline (Part 4).
 *
 * A worker-pool over a list of clips: up to `maxConcurrent` clips generate at
 * once, each is auto-retried once on failure, and the moment a worker finishes
 * it pulls the next waiting clip — no click-by-click, always something running.
 * A failure never stalls the queue; the tile just exposes a manual retry.
 *
 * Decoupled from the API: the caller passes `generateOne(clip) => Promise<url>`,
 * so the same queue drives Veo today or anything else later.
 */
import { useCallback, useRef, useState } from 'react'
import type { StoryboardClip } from './storyboard'

export type QueueStatus = 'waiting' | 'generating' | 'complete' | 'failed'

export interface QueuedClip {
  clipId: string
  order: number
  beat: string
  dialogue: string
  durationSeconds: number
  status: QueueStatus
  videoUrl?: string
  retryCount: number
  /** Last failure reason, surfaced on the tile so the user (and support) can
   *  see WHY a clip failed instead of a bare "Retry". */
  error?: string
}

export type GenerateOne = (clip: StoryboardClip) => Promise<string>

export function useGenerationQueue(maxConcurrent = 1, maxRetries = 1) {
  const [tiles, setTiles] = useState<QueuedClip[]>([])
  const [running, setRunning] = useState(false)
  const cancelRef = useRef(false)

  const patch = useCallback((clipId: string, u: Partial<QueuedClip>) => {
    setTiles(prev => prev.map(t => (t.clipId === clipId ? { ...t, ...u } : t)))
  }, [])

  const attempt = useCallback(async (clip: StoryboardClip, generateOne: GenerateOne, retries: number): Promise<void> => {
    patch(clip.id, { status: 'generating', retryCount: retries, error: undefined })
    try {
      const url = await generateOne(clip)
      if (!url) throw new Error('no url')
      patch(clip.id, { status: 'complete', videoUrl: url })
    } catch (err) {
      if (retries < maxRetries && !cancelRef.current) {
        await attempt(clip, generateOne, retries + 1)
      } else {
        patch(clip.id, { status: 'failed', error: err instanceof Error ? err.message : 'Generation failed.' })
      }
    }
  }, [maxRetries, patch])

  /** Start (or restart) the queue over `clips`. Resolves when all settle. */
  const run = useCallback(async (clips: StoryboardClip[], generateOne: GenerateOne) => {
    cancelRef.current = false
    setRunning(true)
    setTiles(clips.map(c => ({
      clipId: c.id, order: c.order, beat: c.beat, dialogue: c.dialogue,
      durationSeconds: c.durationSeconds, status: 'waiting', retryCount: 0,
    })))

    let next = 0
    const worker = async () => {
      while (!cancelRef.current) {
        const i = next++
        if (i >= clips.length) return
        await attempt(clips[i], generateOne, 0)
      }
    }
    const pool = Array.from({ length: Math.max(1, Math.min(maxConcurrent, clips.length)) }, worker)
    await Promise.all(pool)
    setRunning(false)
  }, [attempt, maxConcurrent])

  /** Manually re-run one clip (failed tile Retry, or complete tile Remix). */
  const retryOne = useCallback(async (clip: StoryboardClip, generateOne: GenerateOne) => {
    await attempt(clip, generateOne, 0)
  }, [attempt])

  const cancel = useCallback(() => { cancelRef.current = true; setRunning(false) }, [])
  const reset = useCallback(() => { cancelRef.current = true; setRunning(false); setTiles([]) }, [])

  const completedCount = tiles.filter(t => t.status === 'complete').length
  const failedCount = tiles.filter(t => t.status === 'failed').length
  const activeCount = tiles.filter(t => t.status === 'generating').length
  const allSettled = tiles.length > 0 && tiles.every(t => t.status === 'complete' || t.status === 'failed')

  return {
    tiles, running, run, retryOne, cancel, reset,
    completedCount, failedCount, activeCount, allSettled, total: tiles.length,
  }
}

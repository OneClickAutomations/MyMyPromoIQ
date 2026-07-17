/** Measure a data-URL audio track's duration in the browser (metadata only —
 *  nothing plays). Used to check an ElevenLabs read against its clip length
 *  before muxing, so a too-long take can be re-recorded faster instead of
 *  being chopped mid-word by the mux's -shortest. */
export function audioDurationSeconds(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      const d = a.duration
      if (Number.isFinite(d) && d > 0) resolve(d)
      else reject(new Error('Unreadable audio duration'))
    }
    a.onerror = () => reject(new Error('Could not read audio metadata'))
    a.src = dataUrl
  })
}

/** If the recorded read overruns the clip, the speed (0.7–1.2 on ElevenLabs)
 *  that would make it fit with a small margin — or null if it already fits. */
export function speedToFit(audioSeconds: number, clipSeconds: number, baseSpeed = 1): number | null {
  if (!audioSeconds || audioSeconds <= clipSeconds + 0.15) return null
  return Math.min(1.2, Math.round((audioSeconds / clipSeconds) * baseSpeed * 100 + 3) / 100)
}

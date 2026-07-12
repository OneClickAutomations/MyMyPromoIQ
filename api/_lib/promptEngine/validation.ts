/**
 * Prompt quality validation. Runs before any prompt is submitted — errors block
 * submission, warnings are advisory. Failures come back as plain-language fixes,
 * never a silent bad submit (Step 8).
 */
import type { ValidationResult } from './types.js'
import { BANNED_WORDS } from './buildVeoPrompt.js'

const MAX_DIALOGUE_WORDS_PER_2S = 5

export function validateVeoPrompt(prompt: string, clipDuration: number): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const lower = prompt.toLowerCase()

  // Banned words.
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) {
      errors.push(`Remove "${word}" — describe the shot physically instead of rating it.`)
    }
  }

  // Segment count matches duration (2s per segment).
  const segments = prompt.match(/\[\d{2}:\d{2}-\d{2}:\d{2}\]/g)?.length ?? 0
  const expected = Math.max(1, Math.floor(clipDuration / 2))
  if (segments !== expected) {
    errors.push(`Expected ${expected} timed segment(s) for a ${clipDuration}s clip, found ${segments}.`)
  }

  // Dialogue word count per segment.
  const dialogueMatches = prompt.matchAll(/Dialogue:\s*"([^"]+)"/g)
  for (const m of dialogueMatches) {
    const wc = m[1].trim().split(/\s+/).filter(Boolean).length
    if (wc > MAX_DIALOGUE_WORDS_PER_2S) {
      errors.push(`Dialogue "${m[1]}" is ${wc} words in a 2s segment — max ${MAX_DIALOGUE_WORDS_PER_2S}. Trim it.`)
    }
  }

  // SFX presence per segment (advisory).
  const sfxCount = (prompt.match(/SFX:/g) ?? []).length
  if (sfxCount < segments) {
    warnings.push(`${segments - sfxCount} segment(s) missing an SFX line — Veo will guess the audio. Specify it.`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Validate the Nano Banana start-frame prompt (lighter — no timed beats). */
export function validateNanaBananaPrompt(prompt: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const lower = prompt.toLowerCase()
  // Nano Banana ignores numeric lens specs — flag them so they don't dilute the prompt.
  if (/\b\d{2,3}mm\b/.test(lower) || /\bf\/\d(\.\d)?\b/.test(lower) || /\biso\s?\d{2,4}\b/.test(lower)) {
    warnings.push('Numeric lens/ISO values are ignored by Nano Banana — use "shallow depth of field" instead.')
  }
  if (!/aspect ratio|9:16|16:9|1:1/.test(lower)) {
    warnings.push('No aspect ratio stated for the start frame.')
  }
  return { valid: errors.length === 0, errors, warnings }
}

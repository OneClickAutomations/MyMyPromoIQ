/**
 * PromptPreview — expands on a storyboard clip card to show the ACTUAL prompts
 * the engine will send: the Veo timed-beat prompt, the Nano Banana start-frame
 * prompt, the negative prompt, and the validation result (blocking errors +
 * advisory warnings). Copy buttons let power users paste into Gemini AI Studio.
 *
 * Everything is computed client-side from the shared engine — the exact same
 * prompt the server runs, so what the user sees is what actually generates.
 */
import { useMemo, useState } from 'react'
import type { CreativeBrief } from '../../lib/studio/types'
import type { StoryboardClip } from '../../lib/studio/storyboard'
import { buildClipPromptPackage } from '../../lib/studio/promptEngineBridge'
import { Check, X, Info } from '../icons'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch { /* clipboard blocked — no-op */ }
      }}
      className="rounded-lg border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-fire-start/40 hover:text-ink"
    >
      {copied ? 'Copied' : `Copy ${label}`}
    </button>
  )
}

function Section({
  title,
  body,
  copyLabel,
  mono = true,
}: { title: string; body: string; copyLabel: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{title}</span>
        <CopyButton text={body} label={copyLabel} />
      </div>
      <pre className={`max-h-56 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-muted ${mono ? 'font-mono' : ''}`}>{body}</pre>
    </div>
  )
}

export default function PromptPreview({
  brief,
  clip,
}: { brief: CreativeBrief; clip: StoryboardClip }) {
  const [open, setOpen] = useState(false)

  // Recompute whenever the clip or the identity-bearing brief fields change.
  const pkg = useMemo(() => {
    try {
      return buildClipPromptPackage(brief, clip)
    } catch {
      return null
    }
  }, [brief, clip])

  if (!pkg) return null
  const { validation } = pkg
  const hasErrors = validation.errors.length > 0

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-xs font-medium text-ink-muted transition hover:border-white/[0.16] hover:text-ink"
      >
        <span>{open ? 'Hide' : 'View'} prompt</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          {hasErrors ? (
            <span className="flex items-center gap-1 rounded-full bg-fire-start/15 px-2 py-0.5 font-semibold text-fire-start">
              <X className="h-3 w-3" /> {validation.errors.length} to fix
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-400">
              <Check className="h-3 w-3" /> valid
            </span>
          )}
          {validation.warnings.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-400">
              <Info className="h-3 w-3" /> {validation.warnings.length}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasErrors && (
            <ul className="space-y-1 rounded-xl border border-fire-start/20 bg-fire-start/5 p-3 text-[12px] text-fire-start">
              {validation.errors.map((e, i) => (
                <li key={i} className="flex gap-2"><X className="mt-0.5 h-3 w-3 shrink-0" />{e}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[12px] text-amber-300/90">
              {validation.warnings.map((w, i) => (
                <li key={i} className="flex gap-2"><Info className="mt-0.5 h-3 w-3 shrink-0" />{w}</li>
              ))}
            </ul>
          )}
          <Section title={`Veo prompt — ${clip.beat} · ${clip.durationSeconds}s`} body={pkg.veoPrompt} copyLabel="Veo" />
          <Section title="Nano Banana — start frame" body={pkg.nanaBananaPrompt} copyLabel="frame" />
          <Section title="Negative prompt" body={pkg.negativePrompt} copyLabel="negatives" mono={false} />
          <p className="px-1 text-[11px] text-ink-faint">{pkg.audioNotes}</p>
        </div>
      )}
    </div>
  )
}

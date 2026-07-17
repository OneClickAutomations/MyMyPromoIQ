/**
 * WizardStepHeader — the chrome every bespoke wizard screen shares: a Back
 * link that always works, the template name so the user never forgets what
 * format they're building, and progress dots (filled = done, pulsing ring =
 * current, empty = ahead). One shared component instead of 12 one-off
 * headers — the per-template bespoke-ness lives in the STEP CONTENT
 * (TypeQuestions/HookSelector/image uploads already vary per format), not in
 * re-implementing the same chrome 12 times.
 */
export default function WizardStepHeader({
  templateName,
  stepIndex,
  stepCount,
  stepLabel,
  onBack,
  canGoBack,
}: {
  templateName: string
  stepIndex: number
  stepCount: number
  stepLabel: string
  onBack: () => void
  canGoBack: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="flex items-center gap-1 font-semibold text-ink-faint transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-0"
        >
          ← Back
        </button>
        <span className="rounded-full bg-fire-start/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-fire-start">
          {templateName}
        </span>
        <span className="text-ink-faint">Step {stepIndex + 1} of {stepCount}</span>
        <span className="ml-auto text-ink-muted">{stepLabel}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: stepCount }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < stepIndex
                ? 'bg-gradient-fire'
                : i === stepIndex
                  ? 'bg-fire-start/60 ring-2 ring-gold/40'
                  : 'bg-white/[0.08]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

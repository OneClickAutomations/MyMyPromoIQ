/**
 * TypeQuestions — the type-specific question set (spec Step 3). Reads the chosen
 * ad type's wizardQuestions from the engine template and renders them; a
 * testimonial asks "What result did you get?", an unboxing asks "First
 * impression of the packaging?", a tutorial asks "What are the 3 steps?" —
 * completely different per type, never hardcoded here. Answers are keyed by the
 * question's human label so the storyboard planner can ground dialogue in them.
 */
import { getTemplate } from '../../lib/studio/promptEngineBridge'
import type { AdTypeId } from '../../lib/studio/promptEngineBridge'

export default function TypeQuestions({
  adType,
  answers,
  onChange,
}: {
  adType: AdTypeId
  answers: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const template = getTemplate(adType)
  const set = (label: string, value: string) => onChange({ ...answers, [label]: value })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-fire-start/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fire-start">
          {template.displayName}
        </span>
        <span className="text-xs text-ink-faint">Answer what you can — skip the rest and we'll fill it in.</span>
      </div>

      {template.wizardQuestions.map((q) => {
        const value = answers[q.question] ?? ''
        return (
          <div key={q.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">{q.question}</label>
            {q.type === 'select' && q.options ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set(q.question, opt)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      value === opt
                        ? 'border-fire-start bg-fire-start/[0.08] text-ink'
                        : 'border-white/[0.10] bg-void-800 text-ink-muted hover:border-white/20'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={value}
                onChange={(e) => set(q.question, e.target.value)}
                placeholder={q.placeholder}
                rows={2}
                className="w-full resize-none rounded-xl border border-white/[0.10] bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

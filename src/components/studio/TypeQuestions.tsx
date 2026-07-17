/**
 * TypeQuestions — the type-specific question set (spec Step 3). Reads the chosen
 * ad type's wizardQuestions from the engine template and renders them; a
 * testimonial asks "What result did you get?", an unboxing asks "First
 * impression of the packaging?", a tutorial asks "What are the 3 steps?" —
 * completely different per type, never hardcoded here. Answers are keyed by the
 * question's human label so the storyboard planner can ground dialogue in them.
 *
 * 'image' questions (Unboxing's packaging photo, Before/After's before+after
 * pair) render as real upload dropzones grouped in their own grid ahead of the
 * text/select questions, so a before/after pair reads as two upload zones
 * side by side rather than being buried in a text-field list.
 */
import { useRef, useState } from 'react'
import { getTemplate } from '../../lib/studio/promptEngineBridge'
import type { AdTypeId, WizardQuestion } from '../../lib/studio/promptEngineBridge'
import { fileToResizedDataUrl } from '../../lib/studio/imageUpload'
import { Upload, X } from '../icons'

function ImageDropzone({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (dataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await fileToResizedDataUrl(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink">{label}</label>
      {value ? (
        <div className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.10] bg-void-900">
          <img src={value} alt={label} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove photo"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] bg-void-900 text-ink-faint transition-colors hover:border-fire-start/40 hover:text-ink-muted disabled:opacity-50"
        >
          <Upload className="h-5 w-5" />
          <span className="px-3 text-center text-xs">{busy ? 'Processing…' : 'Tap to upload'}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  )
}

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

  const imageQuestions = template.wizardQuestions.filter((q) => q.type === 'image')
  const otherQuestions = template.wizardQuestions.filter((q) => q.type !== 'image')

  function renderQuestion(q: WizardQuestion) {
    const value = answers[q.question] ?? ''
    // Multiselect answers are stored as a comma-joined string (answers is
    // Record<string, string> end to end) — split back out for the chip
    // row's selected state, join back on toggle.
    const selectedSet = new Set(value ? value.split(', ').map((s) => s.trim()).filter(Boolean) : [])
    function toggleMulti(opt: string) {
      const next = new Set(selectedSet)
      if (next.has(opt)) next.delete(opt)
      else next.add(opt)
      set(q.question, Array.from(next).join(', '))
    }
    return (
      <div key={q.id} className="space-y-1.5">
        <label className="block text-sm font-medium text-ink">{q.question}</label>
        {q.type === 'multiselect' && q.options ? (
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleMulti(opt)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  selectedSet.has(opt)
                    ? 'border-fire-start bg-fire-start/[0.08] text-ink'
                    : 'border-white/[0.10] bg-void-800 text-ink-muted hover:border-white/20'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : q.type === 'select' && q.options ? (
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-fire-start/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fire-start">
          {template.displayName}
        </span>
        <span className="text-xs text-ink-faint">Answer what you can — skip the rest and we'll fill it in.</span>
      </div>

      {imageQuestions.length > 0 && (
        <div className={`grid gap-3 ${imageQuestions.length > 1 ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-[220px]'}`}>
          {imageQuestions.map((q) => (
            <ImageDropzone
              key={q.id}
              label={q.question}
              value={answers[q.question] ?? ''}
              onChange={(v) => set(q.question, v)}
            />
          ))}
        </div>
      )}

      {otherQuestions.map(renderQuestion)}
    </div>
  )
}

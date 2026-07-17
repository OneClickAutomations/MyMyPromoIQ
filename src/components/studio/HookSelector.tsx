/**
 * HookSelector — five Claude-generated opening lines, one per hook pattern
 * (Pattern Interrupt, Bold Claim, Curiosity Gap, Social Proof, Demonstration).
 * The user picks the one that sounds most like them, or writes their own.
 * Selecting a hook writes it into the SAME `script` field the wizard already
 * threads to the storyboard planner as an authoritative opening line — no new
 * plumbing, it just gets a real UI in front of an existing hook-line input.
 */
import { useState } from 'react'
import { generateHooks, enhanceAnswer, type HookOption } from '../../lib/api'
import { RefreshCw, Check, Spark } from '../icons'

export default function HookSelector({
  adType,
  productName,
  description,
  answers,
  value,
  onChange,
}: {
  adType: string
  productName?: string
  description: string
  answers?: Record<string, string>
  value: string
  onChange: (hook: string) => void
}) {
  const [hooks, setHooks] = useState<HookOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [writingOwn, setWritingOwn] = useState(false)
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicError, setMagicError] = useState('')

  async function runMagic() {
    if (!value.trim()) return
    setMagicBusy(true)
    setMagicError('')
    try {
      const { enhanced } = await enhanceAnswer({
        adType,
        question: 'What\'s the opening line?',
        answer: value,
        productName,
        description,
      })
      onChange(enhanced)
    } catch (e) {
      setMagicError(e instanceof Error ? e.message : 'Enhancement failed.')
    } finally {
      setMagicBusy(false)
    }
  }

  async function load() {
    if (!description.trim() && !productName?.trim()) return
    setLoading(true)
    setError('')
    try {
      const { hooks: h } = await generateHooks({ adType, productName, description, answers })
      setHooks(h)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate hooks.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-ink">Pick your opening line</label>
          <p className="text-xs text-ink-faint">The first line decides whether anyone keeps watching.</p>
        </div>
        {hooks.length > 0 && !loading && (
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        )}
      </div>

      {!hooks.length && !loading && !error && (
        <button
          type="button"
          onClick={load}
          className="w-full rounded-xl border border-dashed border-white/[0.14] py-3 text-sm font-medium text-ink-muted transition-colors hover:border-fire-start/40 hover:text-ink"
        >
          Generate 5 hook options
        </button>
      )}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-void-800" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-ink-muted">
          {error} <button type="button" onClick={load} className="font-semibold text-fire-start">Try again</button>
        </div>
      )}

      {!loading && hooks.length > 0 && (
        <div className="space-y-1.5">
          {hooks.map(h => {
            const selected = value === h.text
            return (
              <button
                key={h.text}
                type="button"
                onClick={() => { onChange(h.text); setWritingOwn(false) }}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  selected
                    ? 'border-fire-start bg-fire-start/[0.08]'
                    : 'border-white/[0.10] bg-void-800 hover:border-white/20'
                }`}
              >
                <span className={`mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border ${selected ? 'border-fire-start bg-fire-start' : 'border-white/20'}`}>
                  {selected && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{h.pattern}</span>
                  <span className="text-sm text-ink">"{h.text}"</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {(writingOwn || (hooks.length > 0 && value && !hooks.some(h => h.text === value))) ? (
        <div className="space-y-1.5">
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={magicBusy}
            placeholder="Write your own opening line"
            rows={2}
            className="w-full resize-none rounded-xl border border-fire-start/40 bg-void-900 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            disabled={magicBusy || !value.trim()}
            onClick={runMagic}
            className="flex items-center gap-1 rounded-lg border border-white/[0.10] bg-void-700/60 px-2 py-1 text-[11px] font-semibold text-ink-muted transition-all hover:border-fire-start/30 hover:text-fire-start disabled:opacity-30"
          >
            {magicBusy
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> Enhancing…</>
              : <><Spark className="h-3 w-3" /> AI Magic</>
            }
          </button>
          {magicError && <p className="text-[11px] text-rose-400">{magicError}</p>}
        </div>
      ) : hooks.length > 0 && (
        <button
          type="button"
          onClick={() => { setWritingOwn(true); onChange('') }}
          className="text-xs font-medium text-ink-muted hover:text-ink"
        >
          Write my own hook instead
        </button>
      )}
    </div>
  )
}

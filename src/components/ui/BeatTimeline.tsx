/**
 * BeatTimeline — ad-structure visualization. Horizontal segmented bar, one
 * segment per beat, weighted by duration. Label above each segment, timing
 * below. Collapses to a stacked list on mobile.
 */
export interface Beat {
  label: string
  /** seconds this beat occupies (drives segment width) */
  seconds: number
  /** beat kind → segment color */
  kind?: 'hook' | 'problem' | 'demo' | 'proof' | 'cta' | 'other'
}

const KIND_BG: Record<NonNullable<Beat['kind']>, string> = {
  hook: 'bg-fire-start',
  problem: 'bg-fire-end',
  demo: 'bg-gold',
  proof: 'bg-gold/70',
  cta: 'bg-emerald-400',
  other: 'bg-void-500',
}

function normalizeKind(label: string): NonNullable<Beat['kind']> {
  const b = label.toLowerCase()
  if (b.includes('hook')) return 'hook'
  if (b.includes('problem') || b.includes('agitat') || b.includes('pain')) return 'problem'
  if (b.includes('demo') || b.includes('solution') || b.includes('reveal')) return 'demo'
  if (b.includes('proof') || b.includes('social')) return 'proof'
  if (b.includes('cta') || b.includes('call') || b.includes('outro')) return 'cta'
  return 'other'
}

export default function BeatTimeline({ beats }: { beats: Beat[] }) {
  let acc = 0
  const withTiming = beats.map(b => {
    const start = acc
    acc += b.seconds
    return { ...b, start, end: acc, kind: b.kind ?? normalizeKind(b.label) }
  })

  return (
    <div>
      {/* horizontal (desktop) */}
      <div className="hidden sm:block">
        <div className="flex gap-1">
          {withTiming.map((b, i) => (
            <div key={i} style={{ flex: b.seconds }} className="min-w-0">
              <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{b.label}</p>
              <div className={`h-2 rounded-full ${KIND_BG[b.kind!]}`} />
              <p className="mt-1 text-[10px] tabular-nums text-ink-faint">{b.start}–{b.end}s</p>
            </div>
          ))}
        </div>
      </div>
      {/* stacked (mobile) */}
      <div className="space-y-1.5 sm:hidden">
        {withTiming.map((b, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${KIND_BG[b.kind!]}`} />
            <span className="flex-1 text-xs font-medium text-ink">{b.label}</span>
            <span className="text-[10px] tabular-nums text-ink-faint">{b.start}–{b.end}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}

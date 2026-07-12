/**
 * WordCountBar — clip-dialogue meter. Color per fill: <80% green, 80–99% gold,
 * 100% orange ("full, not over"), over-limit red. "X / Y words" label above.
 */
export default function WordCountBar({ used, max }: { used: number; max: number }) {
  const ratio = max > 0 ? used / max : 0
  const pct = Math.min(100, ratio * 100)
  const over = used > max
  const fill =
    over ? 'bg-fire-end'
    : ratio >= 1 ? 'bg-fire-start'
    : ratio >= 0.8 ? 'bg-gold'
    : 'bg-emerald-400'
  const label =
    over ? 'over' : ratio >= 1 ? 'full' : ratio >= 0.8 ? 'tight' : 'fits'
  const labelColor =
    over ? 'text-fire-end' : ratio >= 1 ? 'text-fire-start' : ratio >= 0.8 ? 'text-gold' : 'text-emerald-300'

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] tabular-nums text-ink-muted">{used} / {max} words</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${labelColor}`}>{label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-void-600">
        <div className={`h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  )
}

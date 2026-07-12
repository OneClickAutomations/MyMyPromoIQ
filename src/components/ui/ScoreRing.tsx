/**
 * ScoreRing — opportunity-score dial. sm (cards) and lg (detail panels).
 * Ring color follows the rating: green ≥70, gold 40–69, red <40.
 */
type Size = 'sm' | 'lg'

function ratingStroke(value: number): string {
  if (value >= 70) return '#34D399'   // emerald (design-system status green)
  if (value >= 40) return '#F2B84B'   // gold token
  return '#E8341C'                     // fire-end (red)
}

export default function ScoreRing({ value, size = 'sm' }: { value: number; size?: Size }) {
  const px = size === 'lg' ? 80 : 40
  const stroke = size === 'lg' ? 6 : 4
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c * (1 - pct / 100)
  const color = ratingStroke(pct)

  return (
    <div className="relative grid place-items-center" style={{ width: px, height: px }}>
      <svg width={px} height={px} className="-rotate-90">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="rgb(var(--c-void-500))" strokeWidth={stroke} opacity={0.5} />
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className={`font-bold tabular-nums text-ink ${size === 'lg' ? 'text-xl' : 'text-xs'}`}>{Math.round(pct)}</span>
        {size === 'lg' && <span className="mt-0.5 text-[10px] text-ink-faint">/ 100</span>}
      </div>
    </div>
  )
}

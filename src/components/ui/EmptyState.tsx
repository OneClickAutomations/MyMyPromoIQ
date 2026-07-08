/**
 * EmptyState — the mandatory zero-result pattern: an icon in a soft circle, a
 * plain heading, one body line, and a direct primary action. No stock art,
 * no apology copy.
 */
import { Link } from 'react-router-dom'

export default function EmptyState({
  icon: Icon,
  heading,
  body,
  actionLabel,
  actionTo,
  onAction,
}: {
  icon: React.FC<React.SVGProps<SVGSVGElement>>
  heading: string
  body?: string
  actionLabel?: string
  /** Route to navigate to, OR provide onAction for a handler. */
  actionTo?: string
  onAction?: () => void
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
      <span className="mb-4 grid h-24 w-24 place-items-center rounded-full bg-white/[0.03]">
        <Icon className="h-9 w-9 text-ink-faint/60" />
      </span>
      <h3 className="text-lg font-bold tracking-tight text-ink">{heading}</h3>
      {body && <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-muted">{body}</p>}
      {actionLabel && (actionTo
        ? <Link to={actionTo} className="btn-fire mt-6 gap-1.5 px-5 py-2.5 text-sm">{actionLabel}</Link>
        : <button onClick={onAction} className="btn-fire mt-6 gap-1.5 px-5 py-2.5 text-sm">{actionLabel}</button>
      )}
    </div>
  )
}

/**
 * StatusDot — 8px generation-status indicator. Generating pulses; the rest are
 * static. Optional label for inline status lines.
 */
type Status = 'waiting' | 'generating' | 'complete' | 'failed'

const DOT: Record<Status, string> = {
  waiting: 'bg-ink-faint',
  generating: 'bg-fire-start animate-pulse-dot',
  complete: 'bg-emerald-400',
  failed: 'bg-fire-end',
}
const TEXT: Record<Status, string> = {
  waiting: 'text-ink-faint',
  generating: 'text-fire-start',
  complete: 'text-emerald-300',
  failed: 'text-fire-end',
}
const DEFAULT_LABEL: Record<Status, string> = {
  waiting: 'Waiting in queue',
  generating: 'Generating…',
  complete: 'Complete',
  failed: 'Failed',
}

export default function StatusDot({ status, label, showLabel = false }: { status: Status; label?: string; showLabel?: boolean }) {
  const dot = <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${DOT[status]}`} />
  if (!showLabel) return dot
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${TEXT[status]}`}>
      {dot}
      {label ?? DEFAULT_LABEL[status]}
    </span>
  )
}

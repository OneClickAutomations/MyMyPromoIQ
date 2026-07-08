/**
 * Dashboard — the home base. Bento layout: dominant create-action row, then
 * in-progress projects, recent completions, and a stats strip.
 *
 * UI-overhaul pass: renders on static placeholder data (no Supabase dependency)
 * so the visual system is verifiable without a working backend. Real data
 * wiring is reconnected in a later pass.
 */
import { Link } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import PlaceholderTile from '../components/ui/PlaceholderTile'
import StatusDot from '../components/ui/StatusDot'
import EmptyState from '../components/ui/EmptyState'
import { ArrowRight, Wand, Edit, Bolt, Film, Compass, Package, Star } from '../components/icons'
import { dashboard as copy } from '../copy'

// ── Static placeholder data (UI pass) ────────────────────────────────────────
type Mode = 'CLONE' | 'BUILD' | 'QUICK'
const IN_PROGRESS: Array<{ name: string; mode: Mode; done: number; total: number; status: 'generating' | 'complete' | 'failed'; updated: string }> = [
  { name: 'Vitamin C Serum — UGC', mode: 'CLONE', done: 3, total: 7, status: 'generating', updated: '2 min ago' },
  { name: 'Resistance Band Launch', mode: 'BUILD', done: 5, total: 5, status: 'complete', updated: '1 hr ago' },
  { name: 'Sunset Lamp Quick Ad', mode: 'QUICK', done: 1, total: 3, status: 'failed', updated: 'Yesterday' },
]
const RECENT_COUNT = 0 // empty-state demo; set >0 to show the grid
const STATS = [
  { icon: Film, label: copy.stats.videos, value: '128' },
  { icon: Compass, label: copy.stats.analyzed, value: '52' },
  { icon: Package, label: copy.stats.sourced, value: '9' },
  { icon: Star, label: copy.stats.credits, value: '240', gold: true },
]

const MODE_CHIP: Record<Mode, string> = {
  CLONE: 'text-fire-start bg-fire-start/10',
  BUILD: 'text-gold bg-gold/10',
  QUICK: 'text-emerald-300 bg-emerald-400/10',
}

function ActionCard({ to, icon: Icon, title, subtitle, cta }: { to: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; title: string; subtitle: string; cta: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-2xl bg-void-700 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-void-600 hover:ring-1 hover:ring-fire-start/30"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
        <Icon className="h-6 w-6 text-white" />
      </span>
      <div className="flex-1">
        <p className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-fire-start">
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || (user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '')

  return (
    <AppShell>
      <div className="space-y-9">
        {/* Greeting */}
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink md:text-[32px]">
            {firstName ? `${copy.greeting}, ${firstName}.` : copy.greeting + '.'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{copy.subgreeting}</p>
        </div>

        {/* Hero action row */}
        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard to="/discover" icon={Wand} title={copy.actions.clone.title} subtitle={copy.actions.clone.subtitle} cta={copy.actions.start} />
          <ActionCard to="/studio/new" icon={Edit} title={copy.actions.build.title} subtitle={copy.actions.build.subtitle} cta={copy.actions.start} />
          <ActionCard to="/forge" icon={Bolt} title={copy.actions.quick.title} subtitle={copy.actions.quick.subtitle} cta={copy.actions.start} />
        </div>

        {/* In progress */}
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{copy.inProgress}</p>
          {IN_PROGRESS.length === 0 ? (
            <EmptyState icon={Film} heading={copy.emptyProjects.heading} body={copy.emptyProjects.body} actionLabel={copy.emptyProjects.action} actionTo="/forge" />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {IN_PROGRESS.map((p, i) => (
                <div key={i} className="w-[280px] flex-shrink-0 overflow-hidden rounded-2xl bg-void-700 transition-colors hover:bg-void-600">
                  <PlaceholderTile ratio="9:16" status={p.status} className="max-h-[220px]" />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${MODE_CHIP[p.mode]}`}>{p.mode}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusDot status={p.status} showLabel label={`${p.done} / ${p.total} clips`} />
                      <span className="text-[11px] text-ink-faint">{p.updated}</span>
                    </div>
                    <Link to="/forge/generate" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-fire-start hover:text-fire-end">
                      {copy.continue} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent completions */}
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{copy.recent}</p>
          {RECENT_COUNT === 0 ? (
            <EmptyState icon={Film} heading={copy.emptyRecent.heading} body={copy.emptyRecent.body} actionLabel={copy.emptyRecent.action} actionTo="/forge" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: RECENT_COUNT }).map((_, i) => <PlaceholderTile key={i} ratio="9:16" status="complete" />)}
            </div>
          )}
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-void-700 p-4">
              <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${s.gold ? 'bg-gold/10' : 'bg-white/[0.04]'}`}>
                <s.icon className={`h-5 w-5 ${s.gold ? 'text-gold' : 'text-ink-muted'}`} />
              </span>
              <div>
                <p className={`text-2xl font-bold tracking-[-0.02em] tabular-nums ${s.gold ? 'text-gold' : 'text-ink'}`}>{s.value}</p>
                <p className="text-[11px] font-medium text-ink-faint">{s.label}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}

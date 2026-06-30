import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { adForge } from '../copy'
import { Compass, Wand, ArrowRight } from '../components/icons'

export default function AdForge() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{adForge.title}</h1>
          <p className="mt-2 text-ink-muted">{adForge.subtitle}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Clone card */}
          <Link
            to="/discover"
            className="group flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-void-800 p-7 transition-all hover:border-fire-start/40 hover:bg-fire-start/[0.04]"
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-fire-start/15 ring-1 ring-fire-start/20 transition-colors group-hover:bg-fire-start/25">
              <Compass className="h-7 w-7 text-fire-start" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-ink">{adForge.clone.title}</p>
              <p className="mt-1 text-sm font-semibold text-fire-start">{adForge.clone.subtitle}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{adForge.clone.detail}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-fire-start">
              Search ad libraries <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Build card */}
          <Link
            to="/forge/review"
            className="group flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-void-800 p-7 transition-all hover:border-white/20 hover:bg-void-700/40"
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-void-700 ring-1 ring-white/[0.08] transition-colors group-hover:bg-void-600">
              <Wand className="h-7 w-7 text-gold" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-ink">{adForge.build.title}</p>
              <p className="mt-1 text-sm font-semibold text-gold">{adForge.build.subtitle}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{adForge.build.detail}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold">
              Start from scratch <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

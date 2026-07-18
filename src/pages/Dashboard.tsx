/**
 * Dashboard — a premium AI creative studio home. The three creation-module
 * hero cards lead with full-bleed cinematic thumbnails (nano-banana generated
 * AAA concept art in public/assets/dash-*.jpg): Clone shows a winning ad
 * transforming into the user's brand ad through a particle stream, Build shows
 * a creator commanding a holographic storyboard workspace, Quick shows a hero
 * product bursting through a neon splash. Movie posters, not dashboard icons.
 *
 * NOTE: the dashboard artwork palette intentionally allows violet/magenta —
 * the no-purple rule applies to the LANDING PAGE only (user directive).
 *
 * Card chrome stays on tokens (void/ink/fire/gold); art is dark-committed.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import { listCampaigns, listBriefs, type StoredCampaign, type StoredBriefSummary } from '../lib/api'
import {
  PlayIcon, Spark, ChevronRight,
  Film, Compass, Package, Star,
} from '../components/icons'

// ── Poster cards — the user's approved full card designs (title, copy, and CTA
// are baked into the artwork itself; the whole card is the link) ──────────────
function PosterCard({ to, src, alt }: { to: string; src: string; alt: string }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-fire-start/40 hover:shadow-fire-glow"
    >
      <img src={src} alt={alt} className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]" />
    </Link>
  )
}

const STATS = [
  { icon: Film,    label: 'Videos generated', value: '128' },
  { icon: Compass, label: 'Ads analyzed',     value: '52' },
  { icon: Package, label: 'Products sourced', value: '9' },
  { icon: Star,    label: 'Credits remaining', value: '1,250', gold: true },
]

export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || (user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '')

  // Real campaigns + drafts (replaces the old mock stills). Best-effort — if
  // persistence is unavailable the sections simply show their empty prompts.
  const [realCampaigns, setRealCampaigns] = useState<StoredCampaign[]>([])
  const [realVideos, setRealVideos] = useState<Record<string, string>>({})
  const [realDrafts, setRealDrafts] = useState<StoredBriefSummary[]>([])
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const [{ campaigns, videos }, { briefs }] = await Promise.all([
          listCampaigns(user.id),
          listBriefs(user.id).catch(() => ({ briefs: [] as StoredBriefSummary[] })),
        ])
        if (cancelled) return
        setRealCampaigns(campaigns.slice(0, 6))
        setRealVideos(videos)
        setRealDrafts(briefs.filter(b => b.status === 'draft').slice(0, 4))
      } catch { /* persistence unavailable — leave empty */ }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  return (
    <AppShell>
      <div className="space-y-10">
        {/* Greeting + studio-art control */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink md:text-[34px]">
              {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Let's create another winning ad today.</p>
          </div>
        </div>

        {/* Hero row — three poster cards (art carries title, copy, and CTA) */}
        <div className="grid gap-5 md:grid-cols-3">
          <PosterCard to="/discover" src="/assets/dash-clone.jpg" alt="Clone a Winning Ad — find ads that convert, recreate them with your brand. Get started." />
          <PosterCard to="/studio/new" src="/assets/dash-build.jpg" alt="Build From Scratch — your idea, our AI, full creative control. Start building." />
          <PosterCard to="/forge/review" src="/assets/dash-quick.jpg" alt="Quick Generate — upload a product, AI creates, receive your commercial. Upload product." />
        </div>

        {/* In progress — real drafts (resume where you left off) */}
        {realDrafts.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">In Progress</p>
              <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {realDrafts.map(d => {
                const prod = d.product as Record<string, unknown>
                const name = (prod?.productName as string) || 'Untitled draft'
                const imgUrl = prod?.productImageUrl as string | undefined
                return (
                  <Link key={d.id} to={`/studio/new?brief=${d.id}`} className="group relative w-[300px] flex-shrink-0 overflow-hidden rounded-2xl bg-void-700 ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:ring-fire-start/30">
                    <div className="relative aspect-video overflow-hidden">
                      {imgUrl
                        ? <img src={imgUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        : <div className="grid h-full w-full place-items-center bg-void-800"><Film className="h-7 w-7 text-ink-faint/40" /></div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                      <span className="absolute left-2.5 top-2.5 rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted backdrop-blur-md">Draft</span>
                    </div>
                    <div className="p-3.5">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="mt-1.5 text-[11px] text-ink-faint">Resume editing →</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Recent campaigns — real finished ads */}
        {realCampaigns.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Recent Campaigns</p>
              <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {realCampaigns.map(c => {
                const videoUrl = realVideos[c.id]
                return (
                  <Link key={c.id} to={`/studio?campaign=${c.id}`} className="group block">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-void-700/60 ring-1 ring-white/[0.06] transition-all duration-300 group-hover:ring-fire-start/30">
                      {videoUrl
                        ? <video src={`${videoUrl}#t=0.1`} poster={c.product_image_url ?? undefined} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
                        : c.product_image_url
                          ? <img src={c.product_image_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          : <div className="grid h-full w-full place-items-center"><Film className="h-6 w-6 text-ink-faint/40" /></div>}
                      <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md"><PlayIcon className="ml-0.5 h-4 w-4 text-white" /></span>
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-[11px] capitalize text-ink-faint">{c.style?.replace(/[-_]/g, ' ') ?? 'custom'}</p>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Nothing yet — a single honest prompt instead of fake stills */}
        {realDrafts.length === 0 && realCampaigns.length === 0 && (
          <section className="rounded-2xl border border-dashed border-white/[0.10] px-6 py-10 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft"><Film className="h-5 w-5 text-white" /></div>
            <h3 className="text-base font-bold text-ink">No campaigns yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">Generate your first ad and it'll show up here — ready to open, download, or share.</p>
            <Link to="/studio/new" className="btn-fire mx-auto mt-5 inline-flex gap-2"><Spark className="h-4 w-4" /> Create your first ad</Link>
          </section>
        )}

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-void-700 p-4 ring-1 ring-white/[0.04]">
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

/**
 * Dashboard — a premium AI creative studio home, rebuilt around the reference
 * card language (agent-working panels, fanned UGC clusters, breakout creators,
 * bright pill CTAs). Every hero card is a distinct marketing surface — nothing
 * cookie-cutter.
 *
 * Imagery is FRESH Higgsfield Soul output: the "Generate studio art" control
 * calls /api/modelsheet (mode 'dashboard-art') one key at a time, caches the
 * hosted URLs in localStorage, and the cards upgrade live. Until seeded (or if a
 * URL 404s) each card falls back to a curated cinematic still so the layout is
 * always premium.
 *
 * Tokens only (void/ink/fire/gold). Hero cards are dark-committed (photographic).
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import { generateDashboardArt, DASHBOARD_ART_KEYS, type DashboardArtKey } from '../lib/api'
import {
  ArrowRight, Check, PlayIcon, Spark, Upload, Users, ChevronRight, RefreshCw,
  Film, Compass, Package, Star, TrendingUp,
} from '../components/icons'

// ── Curated fallback stills (shown until fresh Higgsfield art is generated) ────
const FALLBACK: Record<DashboardArtKey, string> = {
  cloneCreator: '/assets/ad-main.jpg',
  buildA:       '/assets/ugc-social.jpg',
  buildB:       '/assets/ugc-hook.jpg',
  buildC:       '/assets/ad-life.jpg',
  productHero:  '/assets/ad-splash.jpg',
}
const CAMPAIGN_STILLS = ['/assets/ugc-main.jpg', '/assets/ugc-demo.jpg', '/assets/ad-splash.jpg', '/assets/ad-life.jpg', '/assets/ad-unbox.jpg', '/assets/ugc-lifestyle.jpg']

const ART_LS_KEY = 'promoiq_dashboard_art'

// ── Studio-art state (localStorage-backed, live-generating) ────────────────────
type ArtMap = Partial<Record<DashboardArtKey, string>>

function useDashboardArt() {
  const [art, setArt] = useState<ArtMap>({})
  const [busyKey, setBusyKey] = useState<DashboardArtKey | null>(null)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ART_LS_KEY)
      if (raw) setArt(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const generateAll = useCallback(async () => {
    setError('')
    setDone(0)
    const next: ArtMap = {}
    for (const key of DASHBOARD_ART_KEYS) {
      setBusyKey(key)
      try {
        const { url } = await generateDashboardArt(key)
        next[key] = url
        setArt(prev => {
          const merged = { ...prev, [key]: url }
          try { localStorage.setItem(ART_LS_KEY, JSON.stringify(merged)) } catch { /* ignore */ }
          return merged
        })
        setDone(d => d + 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Art generation failed.')
        break
      }
    }
    setBusyKey(null)
  }, [])

  return { art, busyKey, done, error, generateAll, generating: busyKey !== null }
}

/** Card image that prefers fresh art, falls back to the curated still on miss/error. */
function ArtImg({ artKey, art, className = '', shimmer = false }: { artKey: DashboardArtKey; art: ArtMap; className?: string; shimmer?: boolean }) {
  const [src, setSrc] = useState(art[artKey] || FALLBACK[artKey])
  useEffect(() => { setSrc(art[artKey] || FALLBACK[artKey]) }, [art, artKey])
  return (
    <img
      src={src}
      alt=""
      onError={() => { if (src !== FALLBACK[artKey]) setSrc(FALLBACK[artKey]) }}
      className={`${className} ${shimmer ? 'animate-pulse' : ''}`}
    />
  )
}

// ── Card 1 — Clone a Winning Ad (agent-working panel + breakout creator) ───────
const CLONE_STEPS = ['Analyzing the winning creative', 'Extracting hook & beat structure', 'Rebuilding with your brand']

function AgentPanel({ art, generating }: { art: ArtMap; generating: boolean }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400)
    return () => clearInterval(id)
  }, [])
  const active = tick % (CLONE_STEPS.length + 1) // last phase = "done"
  const seconds = 8 + (tick % 40)

  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-fire-start/20 to-transparent" />
      {/* Working header */}
      <div className="relative flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-fire-start/20">
          <Spark className="h-3.5 w-3.5 text-fire-start" />
        </span>
        <span className="text-sm font-bold text-fire-start">
          {active >= CLONE_STEPS.length ? 'Clone ready' : 'AI is cloning'} · {seconds}s
        </span>
      </div>
      {/* Checklist */}
      <ul className="relative mt-3 space-y-2">
        {CLONE_STEPS.map((step, i) => {
          const complete = i < active
          const current = i === active
          return (
            <li key={step} className="flex items-center gap-2.5 text-[13px]">
              <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded-full ${
                complete ? 'bg-fire-start/20 text-fire-start'
                : current ? 'bg-white/10' : 'bg-white/[0.04]'
              }`}>
                {complete
                  ? <Check className="h-2.5 w-2.5" />
                  : <span className={`h-1.5 w-1.5 rounded-full ${current ? 'animate-pulse-dot bg-fire-start' : 'bg-white/25'}`} />}
              </span>
              <span className={complete || current ? 'text-white/85' : 'text-white/40'}>{step}</span>
            </li>
          )
        })}
      </ul>
      <p className="relative mt-3 text-[11px] text-white/45">
        {active >= CLONE_STEPS.length ? 'Ready to remix in your brand →' : 'Import any ad. Make it unmistakably yours.'}
      </p>

      {/* Breakout creator — bleeds out of the panel's bottom-right corner */}
      <div
        className="pointer-events-none absolute -bottom-1 right-1 h-[135px] w-[108px] rotate-[3deg] overflow-hidden rounded-xl border border-white/15 shadow-2xl"
        style={{ WebkitMaskImage: 'linear-gradient(to left, black 72%, transparent), linear-gradient(to top, black 82%, transparent)', WebkitMaskComposite: 'source-in', maskImage: 'linear-gradient(to left, black 72%, transparent)' }}
      >
        <ArtImg artKey="cloneCreator" art={art} shimmer={generating} className="h-full w-full object-cover" />
      </div>
    </div>
  )
}

// ── Card 2 — Build From Scratch (fanned UGC-creator cluster) ───────────────────
function FannedCluster({ art, generating }: { art: ArtMap; generating: boolean }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-gold/[0.10] to-transparent" />
      {/* header */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
        <Users className="h-3.5 w-3.5" /> UGC Creators
      </div>
      <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-gold backdrop-blur-md">3 ready</span>

      {/* fanned deck */}
      <div className="relative mt-4 h-[170px] w-[220px]">
        {([
          { k: 'buildB' as const, cls: 'left-0 top-6 -rotate-[10deg] z-10' },
          { k: 'buildC' as const, cls: 'right-0 top-6 rotate-[10deg] z-10' },
          { k: 'buildA' as const, cls: 'left-1/2 top-0 -translate-x-1/2 z-20 scale-110' },
        ]).map(({ k, cls }) => (
          <div key={k} className={`absolute h-[150px] w-[100px] overflow-hidden rounded-xl border border-white/20 shadow-2xl ring-1 ring-black/40 ${cls}`}>
            <ArtImg artKey={k} art={art} shimmer={generating} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>

      {/* build pill */}
      <span className="relative z-30 mb-3 mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
        <Film className="h-3.5 w-3.5 text-gold" /> Idea → Storyboard → Commercial
        <span className="grid h-4 w-4 place-items-center rounded-full bg-gold/20 text-gold"><Check className="h-2.5 w-2.5" /></span>
      </span>
    </div>
  )
}

// ── Card 3 — Quick Generate (product hero + upload glow) ───────────────────────
function ProductHero({ art, generating }: { art: ArtMap; generating: boolean }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10">
      <ArtImg artKey="productHero" art={art} shimmer={generating} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      {/* upload glow ring */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md">
          <div className="absolute inset-0 animate-pulse-dot rounded-full ring-2 ring-fire-start/50" />
          <Upload className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3 text-xs font-semibold text-white/85">
        <span className="rounded-md bg-black/50 px-2 py-1 backdrop-blur-md">Drop product</span>
        <ChevronRight className="h-3.5 w-3.5 text-white/50" />
        <span className="rounded-md bg-black/50 px-2 py-1 backdrop-blur-md">Get a commercial</span>
      </div>
    </div>
  )
}

// ── Shared hero shell (header row: title + spark subtitle · pill CTA) ───────────
type HeroTone = 'fire' | 'gold' | 'emerald'
const TONE_TEXT: Record<HeroTone, string> = { fire: 'text-fire-start', gold: 'text-gold', emerald: 'text-emerald-300' }

function HeroCard({ to, title, subtitle, cta, tone, badge, children }: {
  to: string; title: string; subtitle: string; cta: string; tone: HeroTone; badge?: string; children: React.ReactNode
}) {
  return (
    <Link to={to} className="group relative flex h-[460px] flex-col gap-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-void-800 p-4 shadow-card transition-all duration-300 hover:border-fire-start/40 hover:shadow-fire-glow">
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-fire-start/20 blur-3xl opacity-40 transition-opacity duration-500 group-hover:opacity-90" />
      {/* header row */}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-[-0.02em] text-white">{title}</h3>
          <p className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-medium ${TONE_TEXT[tone]}`}>
            <Spark className="h-3 w-3" /> {subtitle}
          </p>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gradient-fire px-3.5 py-2 text-xs font-bold text-white shadow-fire-soft transition-transform duration-200 group-hover:gap-2.5">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      {badge && (
        <span className={`absolute left-4 top-16 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur-md ${TONE_TEXT[tone]}`}>
          {tone === 'fire' && <TrendingUp className="h-3 w-3" />}{badge}
        </span>
      )}
      {children}
    </Link>
  )
}

// ── In-progress + recent (static, curated; upgrade with generated creators) ────
type Mode = 'CLONE' | 'BUILD' | 'QUICK'
const MODE_CHIP: Record<Mode, string> = { CLONE: 'text-fire-start', BUILD: 'text-gold', QUICK: 'text-emerald-300' }

const IN_PROGRESS: Array<{ name: string; mode: Mode; done: number; total: number; generating: boolean; updated: string; art: DashboardArtKey }> = [
  { name: 'Glow Serum — UGC',    mode: 'CLONE', done: 3, total: 7, generating: true,  updated: '2 min ago', art: 'cloneCreator' },
  { name: 'Daily Greens Launch', mode: 'BUILD', done: 5, total: 5, generating: false, updated: '1 hr ago',  art: 'buildA' },
  { name: 'Recovery Fuel Promo', mode: 'QUICK', done: 1, total: 3, generating: true,  updated: 'Yesterday', art: 'buildB' },
  { name: 'Morning Ritual Ad',   mode: 'QUICK', done: 2, total: 4, generating: false, updated: 'Yesterday', art: 'buildC' },
]
const RECENT = [
  { name: 'Skincare Routine',    views: '12.1K views', when: '3 days ago',  duration: '0:27' },
  { name: 'Recovery Fuel',       views: '9.2K views',  when: '5 days ago',  duration: '0:24' },
  { name: 'Serum Drop',          views: '18.7K views', when: '1 week ago',  duration: '0:21' },
  { name: 'Morning Ritual',      views: '15.3K views', when: '1 week ago',  duration: '0:29' },
  { name: 'Unboxing — Glow Kit', views: '8.7K views',  when: '1 week ago',  duration: '0:18' },
  { name: 'Pre-Workout Boost',   views: '11.4K views', when: '2 weeks ago', duration: '0:30' },
]
const STATS = [
  { icon: Film,    label: 'Videos generated', value: '128' },
  { icon: Compass, label: 'Ads analyzed',     value: '52' },
  { icon: Package, label: 'Products sourced', value: '9' },
  { icon: Star,    label: 'Credits remaining', value: '1,250', gold: true },
]

function ProgressCard({ p, art }: { p: (typeof IN_PROGRESS)[number]; art: ArtMap }) {
  const pct = Math.round((p.done / p.total) * 100)
  return (
    <Link to="/forge/generate" className="group relative w-[300px] flex-shrink-0 overflow-hidden rounded-2xl bg-void-700 ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:ring-fire-start/30">
      <div className="relative aspect-video overflow-hidden">
        <ArtImg artKey={p.art} art={art} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <span className={`absolute left-2.5 top-2.5 rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-md ${MODE_CHIP[p.mode]}`}>{p.mode}</span>
        {p.generating && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-fire-start backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" /> Rendering
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md"><PlayIcon className="ml-0.5 h-5 w-5 text-white" /></span>
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><div className="h-full bg-gradient-fire transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="p-3.5">
        <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="font-medium text-ink-muted">{p.done} / {p.total} clips</span>
          <span className="text-ink-faint">{p.updated}</span>
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || (user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '')
  const { art, done, error, generateAll, generating } = useDashboardArt()

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
          <button
            type="button"
            onClick={generateAll}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl border border-fire-start/30 bg-fire-start/[0.08] px-3.5 py-2 text-xs font-semibold text-fire-start transition-all hover:bg-fire-start/[0.14] disabled:opacity-60"
          >
            {generating
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating art {done}/{DASHBOARD_ART_KEYS.length}…</>
              : <><Spark className="h-3.5 w-3.5" /> Generate fresh studio art</>}
          </button>
        </div>
        {error && <p className="-mt-6 text-xs text-rose-400">{error}</p>}

        {/* Hero row — three distinct cinematic cards */}
        <div className="grid gap-5 md:grid-cols-3">
          <HeroCard to="/discover" title="Clone a Winning Ad" subtitle="Powered by Claude + Higgsfield" cta="Get Started" tone="fire">
            <AgentPanel art={art} generating={generating} />
          </HeroCard>
          <HeroCard to="/studio/new" title="Build From Scratch" subtitle="Full creative control" cta="Start Building" tone="gold">
            <FannedCluster art={art} generating={generating} />
          </HeroCard>
          <HeroCard to="/forge" title="Quick Generate" subtitle="Product in. Commercial out." cta="Upload Product" tone="emerald">
            <ProductHero art={art} generating={generating} />
          </HeroCard>
        </div>

        {/* In progress */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">In Progress</p>
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {IN_PROGRESS.map((p, i) => <ProgressCard key={i} p={p} art={art} />)}
          </div>
        </section>

        {/* Recent campaigns */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Recent Campaigns</p>
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {RECENT.map((c, i) => (
              <Link key={i} to="/history" className="group block">
                <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/[0.06] transition-all duration-300 group-hover:ring-fire-start/30">
                  <img src={CAMPAIGN_STILLS[i % CAMPAIGN_STILLS.length]} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">{c.duration}</span>
                  <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md"><PlayIcon className="ml-0.5 h-4 w-4 text-white" /></span>
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-ink">{c.name}</p>
                <p className="text-[11px] text-ink-faint">{c.views} · {c.when}</p>
              </Link>
            ))}
          </div>
        </section>

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

/**
 * Dashboard — the home base, rebuilt as a premium AI creative studio rather than
 * an admin panel. Every primary surface is a cinematic marketing asset (Higgsfield/
 * Apple/Arcads language): full-bleed UGC stills, glassmorphism overlays, warm
 * fire-glow accents, Netflix-style hover on projects, YouTube-style campaign cards.
 *
 * Imagery is served from the curated cinematic asset library in /public/assets
 * (photoreal UGC + product-hero stills). Swapping any `image` path below — e.g.
 * for a freshly Higgsfield-generated still — is all it takes to reskin a card.
 *
 * Tokens only (void/ink/fire/gold). Hero cards are intentionally dark-committed
 * (they're photographic) so they read cinematic in both light and dark app themes.
 */
import { Link } from 'react-router-dom'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import { ArrowRight, Check, PlayIcon, Film, Compass, Package, Star, TrendingUp, ChevronRight } from '../components/icons'

// ── Cinematic asset library (curated stills in /public/assets) ────────────────
const IMG = {
  cloneCreator: '/assets/ad-main.jpg',      // female creator + skincare serum, warm kitchen
  buildCreator: '/assets/ugc-social.jpg',   // male creator to camera, mid-gesture
  productHero:  '/assets/ad-splash.jpg',    // frosted serum bottle, water splash, warm grade
  sbHook:       '/assets/ugc-hook.jpg',     // storyboard frame — hook
  sbDemo:       '/assets/ugc-demo.jpg',     // storyboard frame — demo
  sbProof:      '/assets/ad-hook.jpg',      // storyboard frame — product macro
  ugcMain:      '/assets/ugc-main.jpg',
  ugcLife:      '/assets/ugc-lifestyle.jpg',
  adUnbox:      '/assets/ad-unbox.jpg',
  adLife:       '/assets/ad-life.jpg',
} as const

// ── Hero action cards ─────────────────────────────────────────────────────────
type Mode = 'CLONE' | 'BUILD' | 'QUICK'

const HERO = [
  {
    to: '/discover',
    image: IMG.cloneCreator,
    badge: { label: 'Trending', tone: 'fire' as const },
    title: 'Clone a Winning Ad',
    features: ['Import any ad', 'AI analyzes the creative', 'Rebuild it with your brand'],
    cta: 'Get Started',
  },
  {
    to: '/studio/new',
    image: IMG.buildCreator,
    badge: { label: 'Full Creative Control', tone: 'gold' as const },
    title: 'Build From Scratch',
    features: ['Idea to script', 'AI storyboard', 'Render & publish'],
    cta: 'Start Building',
    filmstrip: [IMG.sbHook, IMG.sbDemo, IMG.sbProof],
  },
  {
    to: '/forge',
    image: IMG.productHero,
    badge: { label: 'Fastest Way to Create', tone: 'emerald' as const },
    title: 'Quick Generate',
    features: ['Upload one product', 'AI writes the script', 'Complete commercial out'],
    cta: 'Upload Product',
  },
] as const

// ── In-progress projects (real stills, curated to the library) ────────────────
const IN_PROGRESS: Array<{ name: string; mode: Mode; done: number; total: number; status: 'generating' | 'complete' | 'failed'; updated: string; image: string }> = [
  { name: 'Glow Serum — UGC',      mode: 'CLONE', done: 3, total: 7, status: 'generating', updated: '2 min ago',  image: IMG.cloneCreator },
  { name: 'Daily Greens Launch',   mode: 'BUILD', done: 5, total: 5, status: 'complete',   updated: '1 hr ago',   image: IMG.ugcMain },
  { name: 'Recovery Fuel Promo',   mode: 'QUICK', done: 1, total: 3, status: 'generating', updated: 'Yesterday',  image: IMG.sbDemo },
  { name: 'Morning Ritual Ad',     mode: 'QUICK', done: 2, total: 4, status: 'complete',   updated: 'Yesterday',  image: IMG.adLife },
]

// ── Recent campaigns (YouTube-thumbnail style) ────────────────────────────────
const RECENT: Array<{ name: string; views: string; when: string; duration: string; image: string }> = [
  { name: 'Skincare Routine',    views: '12.1K views', when: '3 days ago', duration: '0:27', image: IMG.cloneCreator },
  { name: 'Recovery Fuel',       views: '9.2K views',  when: '5 days ago', duration: '0:24', image: IMG.sbDemo },
  { name: 'Serum Drop',          views: '18.7K views', when: '1 week ago', duration: '0:21', image: IMG.productHero },
  { name: 'Morning Ritual',      views: '15.3K views', when: '1 week ago', duration: '0:29', image: IMG.adLife },
  { name: 'Unboxing — Glow Kit', views: '8.7K views',  when: '1 week ago', duration: '0:18', image: IMG.adUnbox },
  { name: 'Pre-Workout Boost',   views: '11.4K views', when: '2 weeks ago', duration: '0:30', image: IMG.ugcLife },
]

const STATS = [
  { icon: Film,    label: 'Videos generated', value: '128' },
  { icon: Compass, label: 'Ads analyzed',     value: '52' },
  { icon: Package, label: 'Products sourced', value: '9' },
  { icon: Star,    label: 'Credits remaining', value: '1,250', gold: true },
]

const MODE_CHIP: Record<Mode, string> = {
  CLONE: 'text-fire-start',
  BUILD: 'text-gold',
  QUICK: 'text-emerald-300',
}

const BADGE_TONE = {
  fire:    'text-fire-start',
  gold:    'text-gold',
  emerald: 'text-emerald-300',
} as const

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ card }: { card: (typeof HERO)[number] }) {
  return (
    <Link
      to={card.to}
      className="group relative flex h-[440px] flex-col justify-end overflow-hidden rounded-3xl ring-1 ring-white/[0.08] shadow-card transition-all duration-300 hover:ring-fire-start/40 hover:shadow-fire-glow"
    >
      {/* Full-bleed cinematic still */}
      <img
        src={card.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out will-change-transform group-hover:scale-[1.06]"
      />
      {/* Cinematic scrim — bottom-weighted so glass content stays legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
      {/* Warm fire glow that intensifies on hover */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fire-start/25 blur-3xl opacity-40 transition-opacity duration-500 group-hover:opacity-80" />

      {/* Badge — glass pill, top-left */}
      <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur-md ${BADGE_TONE[card.badge.tone]}`}>
        {card.badge.tone === 'fire' && <TrendingUp className="h-3 w-3" />}
        {card.badge.label}
      </span>

      {/* Storyboard filmstrip (Build card only) */}
      {'filmstrip' in card && card.filmstrip && (
        <div className="absolute right-4 top-14 flex items-center gap-1.5">
          {card.filmstrip.map((src, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="block h-11 w-11 overflow-hidden rounded-lg border border-white/20 shadow-lg ring-1 ring-black/30">
                <img src={src} alt="" className="h-full w-full object-cover" />
              </span>
              {i < card.filmstrip!.length - 1 && <ChevronRight className="h-3 w-3 text-white/50" />}
            </div>
          ))}
        </div>
      )}

      {/* Glass content block */}
      <div className="relative m-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <h3 className="text-xl font-bold tracking-[-0.02em] text-white">{card.title}</h3>
        <ul className="mt-3 space-y-1.5">
          {card.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] text-white/80">
              <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-white/10 ${BADGE_TONE[card.badge.tone]}`}>
                <Check className="h-2.5 w-2.5" />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-fire px-4 py-2 text-sm font-semibold text-white shadow-fire-soft transition-transform duration-200 group-hover:gap-2.5">
          {card.cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}

// ── In-progress project card (Netflix-style hover) ────────────────────────────
function ProgressCard({ p }: { p: (typeof IN_PROGRESS)[number] }) {
  const pct = Math.round((p.done / p.total) * 100)
  const isGenerating = p.status === 'generating'
  return (
    <Link
      to="/forge/generate"
      className="group relative w-[300px] flex-shrink-0 overflow-hidden rounded-2xl bg-void-700 ring-1 ring-white/[0.06] transition-all duration-300 hover:ring-fire-start/30 hover:-translate-y-0.5"
    >
      {/* Thumbnail with real still */}
      <div className="relative aspect-video overflow-hidden">
        <img src={p.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Mode chip — glass */}
        <span className={`absolute left-2.5 top-2.5 rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-md ${MODE_CHIP[p.mode]}`}>
          {p.mode}
        </span>

        {/* Play affordance on hover */}
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md">
            <PlayIcon className="ml-0.5 h-5 w-5 text-white" />
          </span>
        </span>

        {/* Generating shimmer badge */}
        {isGenerating && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-fire-start backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" /> Rendering
          </span>
        )}

        {/* Integrated progress bar (fire gradient) at the bottom of the thumbnail */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <div className="h-full bg-gradient-fire transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Meta row */}
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

// ── Recent campaign card (YouTube-thumbnail style) ────────────────────────────
function CampaignCard({ c }: { c: (typeof RECENT)[number] }) {
  return (
    <Link to="/history" className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/[0.06] transition-all duration-300 group-hover:ring-fire-start/30">
        <img src={c.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {c.duration}
        </span>
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/40 backdrop-blur-md">
            <PlayIcon className="ml-0.5 h-4 w-4 text-white" />
          </span>
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{c.name}</p>
      <p className="text-[11px] text-ink-faint">{c.views} · {c.when}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || (user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? '')

  return (
    <AppShell>
      <div className="space-y-10">
        {/* Greeting */}
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink md:text-[34px]">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Let's create another winning ad today.</p>
        </div>

        {/* Hero action row — cinematic cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {HERO.map((card) => <HeroCard key={card.to} card={card} />)}
        </div>

        {/* In progress */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">In Progress</p>
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {IN_PROGRESS.map((p, i) => <ProgressCard key={i} p={p} />)}
          </div>
        </section>

        {/* Recent campaigns */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Recent Campaigns</p>
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors hover:text-fire-start">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {RECENT.map((c, i) => <CampaignCard key={i} c={c} />)}
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

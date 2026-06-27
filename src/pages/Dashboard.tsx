import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { ArrowRight, ArrowUp, Bolt, Film, Grid, Plus, Spark, Wand } from '../components/icons'
import { useSupabaseClient } from '../hooks/useSupabaseClient'
import type { Campaign } from '../lib/supabase'

/* ── Animated counter ─────────────────────────────────────────── */
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setCount(Math.round((1 - (1 - p) ** 3) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

function StatCard({
  label, value, sub, icon: Icon, iconBg, accent, trend,
}: {
  label: string; value: string; sub: string; icon: React.FC<React.SVGProps<SVGSVGElement>>
  iconBg: string; accent: string; trend?: string
}) {
  const numeric = parseInt(value)
  const animated = useCountUp(isNaN(numeric) ? 0 : numeric)
  const display = isNaN(numeric) ? value : String(animated)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800/60 p-3 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.14] hover:bg-void-800/80 md:p-5">
      {/* Icon */}
      <div className={`mb-3 grid h-8 w-8 place-items-center rounded-xl ${iconBg}`}>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className={`text-2xl font-extrabold tracking-tight ${accent} md:text-3xl`}>{display}</p>
      <p className="mt-0.5 text-xs font-medium text-ink-muted leading-snug md:text-sm">{label}</p>
      <div className="mt-1.5 flex items-center gap-1">
        <p className="text-[10px] text-ink-faint md:text-xs">{sub}</p>
        {trend && (
          <span className="flex items-center gap-0.5 rounded-full bg-fire-start/10 px-1.5 py-0.5 text-[9px] font-semibold text-fire-start">
            <ArrowUp className="h-2.5 w-2.5" />
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Quick-start template configs ──────────────────────────────── */
// Each format card uses an on-brand cinematic product shot (committed under
// public/assets — the same set used across the marketing pages) plus a
// subtle accent grade so the imagery ties into the dark fire-toned UI.
const QUICK_STARTS = [
  {
    label: 'Testimonial',
    desc: 'Creator to camera · warm & authentic',
    style: 'testimonial',
    duration: '20s',
    category: 'UGC',
    catClass: 'bg-fire-start/10 text-fire-start',
    img: '/assets/ad-main.jpg',
    grade: 'linear-gradient(180deg, rgba(255,107,53,0.12) 0%, transparent 45%, rgba(10,10,12,0.32) 100%)',
  },
  {
    label: 'Unboxing',
    desc: 'Tactile reveal · crisp detail shots',
    style: 'unboxing',
    duration: '15s',
    category: 'Product',
    catClass: 'bg-gold/10 text-gold',
    img: '/assets/ad-unbox.jpg',
    grade: 'linear-gradient(180deg, rgba(255,185,0,0.10) 0%, transparent 45%, rgba(10,10,12,0.32) 100%)',
  },
  {
    label: 'Day-in-the-Life',
    desc: 'Lifestyle b-roll · golden ambient light',
    style: 'day-in-life',
    duration: '45s',
    category: 'Lifestyle',
    catClass: 'bg-fire-start/10 text-fire-start',
    img: '/assets/ad-life.jpg',
    grade: 'linear-gradient(180deg, rgba(255,140,40,0.10) 0%, transparent 45%, rgba(10,10,12,0.32) 100%)',
  },
  {
    label: 'Fast-Cut Hook',
    desc: 'Kinetic · scroll-stopping opener',
    style: 'fast-cut',
    duration: '8s',
    category: 'Hook',
    catClass: 'bg-fire-end/10 text-fire-end',
    img: '/assets/ad-splash.jpg',
    grade: 'linear-gradient(180deg, rgba(255,40,20,0.14) 0%, transparent 45%, rgba(10,10,12,0.34) 100%)',
  },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-ink-faint',
  rendering: 'text-gold',
  ready: 'text-fire-start',
  published: 'text-fire-start',
}

/* ── Onboarding workflow steps ─────────────────────────────────── */
const WORKFLOW = [
  { icon: Wand,    label: 'Upload Product',     desc: 'Drop in a product image URL' },
  { icon: Spark,   label: 'Claude Directs',     desc: 'AI writes the cinematic brief' },
  { icon: Film,    label: 'Video Renders',       desc: 'Higgsfield renders your scene' },
  { icon: Bolt,    label: 'Publish',             desc: 'Export & run your commercial' },
]

/* ── Greeting helpers ──────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const stagger = (i: number) => ({ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const })

/* ── Component ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || 'there'
  const getClient = useSupabaseClient()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [totalVideos, setTotalVideos] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const db = await getClient()
        const { data } = await db
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!cancelled && data) setCampaigns(data)
        const { count } = await db
          .from('scenes')
          .select('id', { count: 'exact', head: true })
          .eq('phase', 'done')
        if (!cancelled && count != null) setTotalVideos(count)
      } catch {
        // Supabase not configured — fail silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getClient])

  return (
    <AppShell>
      {/* ── Welcome ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(0)}
        className="flex flex-row items-center justify-between gap-3"
      >
        <div>
          <p className="text-xs font-medium text-ink-faint md:text-sm">{getGreeting()},</p>
          <h1 className="text-[26px] font-black tracking-tight text-ink md:text-4xl">
            {firstName}
            <span className="ml-2 inline-block text-fire-start">·</span>
          </h1>
        </div>
        <Link
          to="/studio"
          className="btn-fire flex-shrink-0 gap-1.5 px-4 py-2.5 text-sm shadow-fire-soft md:gap-2 md:px-6 md:py-3.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New </span>Campaign
        </Link>
      </motion.div>

      {/* ── Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(1)}
        className="mt-5 grid grid-cols-3 gap-3 md:mt-7 md:gap-4"
      >
        <StatCard
          label="Videos generated"
          value={loading ? '—' : String(totalVideos)}
          sub="all time"
          trend={totalVideos > 0 ? 'active' : undefined}
          icon={Film}
          iconBg="bg-fire-start/10"
          accent="text-fire-start"
        />
        <StatCard
          label="Free credits"
          value="3"
          sub="remaining"
          icon={Spark}
          iconBg="bg-gold/10"
          accent="text-gold"
        />
        <StatCard
          label="Campaigns"
          value={loading ? '—' : String(campaigns.length)}
          sub="total"
          icon={Grid}
          iconBg="bg-void-600/60"
          accent="text-ink-muted"
        />
      </motion.div>

      {/* ── Template cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(2)}
        className="mt-8 md:mt-10"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint md:text-[11px]">
            Start with a format
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QUICK_STARTS.map((q, i) => (
            <motion.div
              key={q.style}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={stagger(i + 3)}
            >
              <Link
                to={`/studio?style=${q.style}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800/50 transition-all duration-200 hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]"
              >
                {/* Cinematic thumbnail */}
                <div className="relative aspect-square w-full overflow-hidden">
                  <img
                    src={q.img}
                    alt={`${q.label} format`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  />
                  {/* Accent color-grade — ties the photo into the fire-toned UI */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: q.grade }} />
                  {/* Cinematic vignette for depth */}
                  <div className="pointer-events-none absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse 95% 85% at 50% 35%, transparent 50%, rgba(0,0,0,0.45) 100%)' }}
                  />
                  {/* Duration badge — top right */}
                  <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm ring-1 ring-white/10">
                    ~{q.duration}
                  </span>
                </div>
                {/* Content */}
                <div className="flex flex-1 flex-col p-3 md:p-4">
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="text-sm font-semibold text-ink leading-tight">{q.label}</p>
                    <span className={`mt-0.5 flex-shrink-0 rounded-full px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wider ${q.catClass}`}>
                      {q.category}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{q.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <span>Start creating</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Recent campaigns ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stagger(7)}
        className="mt-8 md:mt-10"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint md:text-[11px]">
            Recent campaigns
          </h2>
          {campaigns.length > 0 && (
            <span className="text-[11px] text-ink-faint">{campaigns.length} total</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.06] bg-void-800/40 p-3 md:p-4">
                <div className="aspect-[9/16] rounded-xl bg-void-700/60 animate-pulse" />
                <div className="mt-3 h-3 w-2/3 rounded-full bg-void-700/60 animate-pulse" />
                <div className="mt-2 h-2 w-1/2 rounded-full bg-void-600/40 animate-pulse" />
              </div>
            ))}
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                to={`/studio?campaign=${c.id}`}
                className="group rounded-2xl border border-white/[0.08] bg-void-800/50 p-3 transition-all duration-200 hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] md:p-4"
              >
                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-void-700/60 flex items-center justify-center">
                  {c.product_image_url ? (
                    <img src={c.product_image_url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <Film className="h-7 w-7 text-ink-faint/40" />
                  )}
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-ink">{c.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] text-ink-faint capitalize">{c.style?.replace('-', ' ') ?? 'custom'}</p>
                  <span className={`text-[10px] font-bold capitalize ${STATUS_COLORS[c.status] ?? 'text-ink-faint'}`}>
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
            {/* New campaign card */}
            <Link
              to="/studio"
              className="group flex aspect-auto flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.10] p-6 text-center transition-all duration-200 hover:border-fire-start/30 hover:bg-fire-start/[0.03]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-white/10 transition-colors group-hover:border-fire-start/30">
                <Plus className="h-5 w-5 text-ink-faint group-hover:text-fire-start transition-colors" />
              </div>
              <p className="mt-2.5 text-sm font-medium text-ink-faint group-hover:text-ink transition-colors">New campaign</p>
            </Link>
          </div>
        ) : (
          /* ── Empty state — onboarding flow ── */
          <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-void-800/30">
            {/* Top gradient bar */}
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,107,53,0.4) 50%, transparent 100%)' }} />

            <div className="px-6 py-10 text-center md:py-14">
              <div className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft mx-auto mb-5">
                <Film className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-ink md:text-2xl">Your AI studio is ready.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted leading-relaxed">
                Create your first commercial in minutes. Drop a product, Claude directs the shot, Higgsfield renders the video.
              </p>

              {/* Workflow steps */}
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:mt-10 text-left">
                {WORKFLOW.map((step, i) => (
                  <div key={step.label} className="relative flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-void-700/30 p-4">
                    {/* Step connector */}
                    {i < WORKFLOW.length - 1 && (
                      <div className="absolute -right-1.5 top-1/2 hidden h-px w-3 -translate-y-1/2 bg-white/10 sm:block" />
                    )}
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire/10 ring-1 ring-fire-start/15">
                      <step.icon className="h-4 w-4 text-fire-start" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{step.label}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint leading-snug">{step.desc}</p>
                    </div>
                    <span className="absolute right-3 top-3 text-[10px] font-bold text-ink-faint/40">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>

              <Link to="/studio" className="btn-fire mx-auto mt-8 gap-2 inline-flex">
                <Bolt className="h-4 w-4" />
                Create your first campaign
              </Link>
              <p className="mt-3 text-xs text-ink-faint">First 3 videos free · No card required</p>
            </div>
          </div>
        )}
      </motion.div>
    </AppShell>
  )
}

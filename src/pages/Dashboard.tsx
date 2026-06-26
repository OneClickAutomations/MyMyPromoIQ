import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { ArrowRight, Bolt, Film, Plus, Wand } from '../components/icons'
import { useSupabaseClient } from '../hooks/useSupabaseClient'
import type { Campaign } from '../lib/supabase'

const QUICK_STARTS = [
  { label: 'Testimonial hook', desc: 'Creator to camera · warm + handheld', style: 'testimonial', color: 'from-fire-start/20 to-fire-end/10' },
  { label: 'Unboxing reveal', desc: 'Tactile reveal · crisp detail shots', style: 'unboxing', color: 'from-gold/20 to-gold/5' },
  { label: 'Day-in-the-life', desc: 'Lifestyle b-roll · golden light', style: 'day-in-life', color: 'from-fire-start/15 to-transparent' },
  { label: 'Fast-cut hook', desc: 'Kinetic · scroll-stopping opener', style: 'fast-cut', color: 'from-fire-end/20 to-transparent' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-ink-faint',
  rendering: 'text-gold',
  ready: 'text-fire-start',
  published: 'text-fire-start',
}

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

        // Count all scenes in the done state as "videos generated"
        const { count } = await db
          .from('scenes')
          .select('id', { count: 'exact', head: true })
          .eq('phase', 'done')
        if (!cancelled && count != null) setTotalVideos(count)
      } catch {
        // Supabase not configured yet — fail silently, show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getClient])

  return (
    <AppShell>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-sm text-ink-muted">Good to see you,</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{firstName}</h1>
        </div>
        <Link to="/studio" className="btn-fire gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Videos generated', value: loading ? '—' : String(totalVideos), sub: 'all time' },
          { label: 'Free credits left', value: '3', sub: 'videos remaining' },
          { label: 'Campaigns', value: loading ? '—' : String(campaigns.length), sub: 'total' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-void-900/60 p-5 backdrop-blur-sm">
            <p className="text-3xl font-bold text-ink">{s.value}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-muted">{s.label}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Quick-start cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
      >
        <h2 className="mb-4 text-base font-semibold text-ink">Start with a format</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_STARTS.map((q) => (
            <Link
              key={q.style}
              to={`/studio?style=${q.style}`}
              className={`group relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br ${q.color} p-5 transition-all duration-200 hover:border-white/20 hover:shadow-card`}
            >
              <Wand className="h-5 w-5 text-fire-start" />
              <p className="mt-3 font-semibold text-ink">{q.label}</p>
              <p className="mt-1 text-xs text-ink-muted">{q.desc}</p>
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Campaigns list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
      >
        <h2 className="mb-4 text-base font-semibold text-ink">Recent campaigns</h2>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-white/5 bg-void-900/40 p-4">
                <div className="aspect-[9/16] rounded-xl bg-void-700" />
                <div className="mt-3 h-3 w-2/3 rounded bg-void-700" />
                <div className="mt-2 h-2 w-1/2 rounded bg-void-600" />
              </div>
            ))}
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                to={`/studio?campaign=${c.id}`}
                className="group rounded-2xl border border-white/8 bg-void-900/60 p-4 transition-all hover:border-white/20 hover:shadow-card"
              >
                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-void-800 flex items-center justify-center">
                  {c.product_image_url ? (
                    <img src={c.product_image_url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <Film className="h-8 w-8 text-ink-faint" />
                  )}
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-ink">{c.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-ink-faint capitalize">{c.style?.replace('-', ' ') ?? 'custom'}</p>
                  <span className={`text-[11px] font-semibold capitalize ${STATUS_COLORS[c.status] ?? 'text-ink-faint'}`}>
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
            {/* New campaign card */}
            <Link
              to="/studio"
              className="flex aspect-auto flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center transition-all hover:border-white/20"
            >
              <Plus className="h-6 w-6 text-ink-faint" />
              <p className="mt-2 text-sm text-ink-faint">New campaign</p>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-void-900/30 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft mb-5">
              <Film className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-ink">No campaigns yet</h3>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">
              Drop in a product, pick a style, and get a complete UGC commercial in minutes.
            </p>
            <Link to="/studio" className="btn-fire mt-7 gap-2">
              <Bolt className="h-4 w-4" />
              Create your first campaign
            </Link>
            <p className="mt-3 text-xs text-ink-faint">First 3 videos free · No card required</p>
          </div>
        )}
      </motion.div>
    </AppShell>
  )
}

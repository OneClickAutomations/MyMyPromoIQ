import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { ArrowRight, Bolt, Film, Plus, Wand } from '../components/icons'

const QUICK_STARTS = [
  {
    label: 'Testimonial hook',
    desc: 'Creator to camera · warm + handheld',
    style: 'testimonial',
    color: 'from-fire-start/20 to-fire-end/10',
  },
  {
    label: 'Unboxing reveal',
    desc: 'Tactile reveal · crisp detail shots',
    style: 'unboxing',
    color: 'from-gold/20 to-gold/5',
  },
  {
    label: 'Day-in-the-life',
    desc: 'Lifestyle b-roll · golden light',
    style: 'day-in-life',
    color: 'from-fire-start/15 to-transparent',
  },
  {
    label: 'Fast-cut hook',
    desc: 'Kinetic · scroll-stopping opener',
    style: 'fast-cut',
    color: 'from-fire-end/20 to-transparent',
  },
]

export default function Dashboard() {
  const { user } = useUser()
  const firstName = user?.firstName || 'there'

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

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Videos generated', value: '0', sub: 'all time' },
          { label: 'Free credits left', value: '3', sub: 'videos remaining' },
          { label: 'Campaigns', value: '0', sub: 'total' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/8 bg-void-900/60 p-5 backdrop-blur-sm"
          >
            <p className="text-3xl font-bold text-ink">{s.value}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-muted">{s.label}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Quick-start grid */}
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
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Empty campaigns state */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
      >
        <h2 className="mb-4 text-base font-semibold text-ink">Recent campaigns</h2>
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-void-900/30 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft mb-5">
            <Film className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-ink">No campaigns yet</h3>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            Drop in a product, pick a style, and get a complete UGC commercial in minutes. Your first 3 are free.
          </p>
          <Link to="/studio" className="btn-fire mt-7 gap-2">
            <Bolt className="h-4 w-4" />
            Create your first campaign
          </Link>
          <p className="mt-3 text-xs text-ink-faint">
            First 3 videos free · No card required
          </p>
        </div>
      </motion.div>
    </AppShell>
  )
}

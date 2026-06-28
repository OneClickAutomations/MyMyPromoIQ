import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import HistoryGrid from '../components/HistoryGrid'
import { Plus } from '../components/icons'

export default function History() {
  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-row items-center justify-between gap-3"
      >
        <div>
          <p className="text-xs font-medium text-ink-faint md:text-sm">Your library</p>
          <h1 className="text-[26px] font-black tracking-tight text-ink md:text-4xl">History</h1>
          <p className="mt-1 text-sm text-ink-muted">Revisit, download, regenerate, or delete anything you've made.</p>
        </div>
        <Link
          to="/studio"
          className="btn-fire flex-shrink-0 gap-1.5 px-4 py-2.5 text-sm shadow-fire-soft md:gap-2 md:px-6 md:py-3.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New </span>Campaign
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 md:mt-8"
      >
        <HistoryGrid />
      </motion.div>
    </AppShell>
  )
}

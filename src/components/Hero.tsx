import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { hero } from '../copy'
import { ArrowRight, PlayIcon, Check } from './icons'
import DashboardMockup from './DashboardMockup'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 md:pt-36">
      {/* AI-generated cinematic glow — confined behind the dashboard, not full-bleed */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
        <img
          src="/assets/hero-glow.png"
          alt=""
          aria-hidden
          className="h-[820px] w-[1200px] max-w-none object-cover opacity-70 [mask-image:radial-gradient(60%_60%_at_50%_38%,black,transparent)]"
        />
      </div>
      {/* Top fade so navbar reads cleanly over the glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-void to-transparent" />

      <div className="container-x section-pad">
        {/* Copy block */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-fire-start" />
              {hero.eyebrow}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-6 text-balance text-4xl font-extrabold leading-[1.04] tracking-tightest text-ink sm:text-5xl md:text-6xl"
          >
            {hero.headline[0]} <span className="text-fire">{hero.headline[1]}</span> {hero.headline[2]}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-ink-muted"
          >
            {hero.subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link to="/sign-up" className="btn-fire w-full sm:w-auto">
              {hero.ctaPrimary}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="btn-ghost w-full sm:w-auto">
              <PlayIcon className="h-3.5 w-3.5 text-gold" />
              {hero.ctaSecondary}
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-faint"
          >
            <Check className="h-3.5 w-3.5 text-gold" />
            {hero.trustline}
          </motion.p>
        </div>

        {/* Floating dashboard */}
        <div className="relative mx-auto mt-16 max-w-5xl [perspective:2000px]">
          {/* orange glow pad under the card */}
          <div className="pointer-events-none absolute inset-x-10 bottom-0 top-10 -z-10 rounded-[40px] bg-fire-start/20 blur-3xl" />

          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 9 }}
            animate={{ opacity: 1, y: 0, rotateX: 4 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative will-change-transform"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="animate-float [transform:rotateX(4deg)_rotateY(-0.5deg)] shadow-fire-glow rounded-2xl">
              <DashboardMockup />
            </div>

            {/* Floating glass chips just outside the edges */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="glass-chip absolute -left-3 top-16 flex items-center gap-2 text-xs font-medium text-ink sm:-left-8 md:-left-12 animate-float-slow"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-fire text-white">
                <Check className="h-3 w-3" />
              </span>
              {hero.chips.toast}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.75 }}
              className="glass-chip absolute -right-3 top-32 flex items-center gap-2 text-xs font-medium text-ink sm:-right-8 md:-right-14 animate-float"
            >
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
              {hero.chips.rendering}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 }}
              className="glass-chip absolute -bottom-5 right-10 flex items-center gap-2 text-xs font-semibold text-gold sm:right-20 animate-float-slow"
            >
              <span className="text-gold">✦</span>
              {hero.chips.metric}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

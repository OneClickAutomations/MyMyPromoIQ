import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useUser } from '../hooks/useAuth'
import AppShell from '../components/AppShell'
import BrandVoiceSetup, { loadBrandProfile } from '../components/BrandVoiceSetup'
import { adForge } from '../copy'
import { Compass, ArrowRight, Wand, Bolt, Star, X } from '../components/icons'

const BRAND_DISMISS_KEY = 'promoiq_brand_prompt_dismissed'

type CardProps = {
  to: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
  iconBg: string
  iconColor: string
  accentBorder: string
  accentHover: string
  title: string
  subtitle: string
  detail: string
  cta: string
  ctaColor: string
  badge?: string
  badgeClass?: string
}

function PathCard({
  to, icon: Icon, iconBg, iconColor, accentBorder, accentHover,
  title, subtitle, detail, cta, ctaColor, badge, badgeClass,
}: CardProps) {
  return (
    <Link
      to={to}
      className={`group flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-void-800 p-7 transition-all duration-200 ${accentBorder} ${accentHover}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl ring-1 transition-all ${iconBg}`}>
          <Icon className={`h-7 w-7 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-xl font-bold text-ink">{title}</p>
        <p className={`mt-1 text-sm font-semibold ${ctaColor}`}>{subtitle}</p>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{detail}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${ctaColor}`}>
        {cta} <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export default function AdForge() {
  const { user } = useUser()
  const [setupOpen, setSetupOpen] = useState(false)
  // Show the one-time prompt only if the brand voice isn't configured and the
  // user hasn't dismissed it. Non-gating — it never blocks the three modes.
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let dismissed = false
    try { dismissed = localStorage.getItem(BRAND_DISMISS_KEY) === '1' } catch { /* ignore */ }
    if (dismissed) return
    loadBrandProfile(user.id).then(p => { if (!p || !p.brandVoice) setShowPrompt(true) })
  }, [user?.id])

  function dismissPrompt() {
    setShowPrompt(false)
    try { localStorage.setItem(BRAND_DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-ink">{adForge.title}</h1>
            <p className="mt-2 text-ink-muted">{adForge.subtitle}</p>
          </div>
          <button onClick={() => setSetupOpen(true)}
            className="mt-1 hidden flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-fire-start/40 hover:text-ink sm:inline-flex">
            <Star className="h-3.5 w-3.5 text-fire-start" /> Brand voice
          </button>
        </div>

        {/* One-time brand-voice prompt (non-gating, dismissible) */}
        {showPrompt && (
          <div className="flex items-center gap-3 rounded-2xl border border-fire-start/20 bg-fire-start/[0.06] p-4">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-fire-start/15"><Star className="h-4 w-4 text-fire-start" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Set your brand voice (30 seconds)</p>
              <p className="text-xs text-ink-muted">It calibrates every script's tone and CTA. You can skip and Claude uses neutral defaults.</p>
            </div>
            <button onClick={() => { setSetupOpen(true); setShowPrompt(false) }} className="btn-fire flex-shrink-0 gap-1.5 px-4 py-2 text-xs">Set up</button>
            <button onClick={dismissPrompt} className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* Three paths */}
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Clone */}
          <PathCard
            to="/discover"
            icon={Compass}
            iconBg="bg-fire-start/15 ring-fire-start/20 group-hover:bg-fire-start/25"
            iconColor="text-fire-start"
            accentBorder="hover:border-fire-start/40"
            accentHover="hover:bg-fire-start/[0.04]"
            title={adForge.clone.title}
            subtitle={adForge.clone.subtitle}
            detail={adForge.clone.detail}
            cta={adForge.clone.cta}
            ctaColor="text-fire-start"
            badge="Recommended"
            badgeClass="bg-fire-start/10 text-fire-start"
          />

          {/* Build From Scratch — 12-step wizard */}
          <PathCard
            to="/studio/new"
            icon={Bolt}
            iconBg="bg-gold/10 ring-gold/15 group-hover:bg-gold/20"
            iconColor="text-gold"
            accentBorder="hover:border-gold/30"
            accentHover="hover:bg-gold/[0.03]"
            title={adForge.build.title}
            subtitle={adForge.build.subtitle}
            detail={adForge.build.detail}
            cta={adForge.build.cta}
            ctaColor="text-gold"
          />

          {/* Quick Generate */}
          <PathCard
            to="/forge/review"
            icon={Wand}
            iconBg="bg-void-700 ring-white/[0.08] group-hover:bg-void-600"
            iconColor="text-ink-muted"
            accentBorder="hover:border-white/20"
            accentHover="hover:bg-void-700/40"
            title={adForge.quick.title}
            subtitle={adForge.quick.subtitle}
            detail={adForge.quick.detail}
            cta={adForge.quick.cta}
            ctaColor="text-ink-muted group-hover:text-ink"
          />
        </div>

        {/* Divider + explainer */}
        <div className="rounded-2xl border border-white/[0.06] bg-void-800/40 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-3">How they compare</p>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-semibold text-fire-start mb-1">Clone a Winning Ad</p>
              <p className="text-ink-faint leading-relaxed text-xs">Best when you have a niche but no creative direction. Finds proof the format works, then makes it yours.</p>
            </div>
            <div>
              <p className="font-semibold text-gold mb-1">Build From Scratch</p>
              <p className="text-ink-faint leading-relaxed text-xs">Best when you want full control. 12 guided steps — how many videos, style, product, creator, brand, scenes, and voiceover — upload your image and Veo 3 animates it.</p>
            </div>
            <div>
              <p className="font-semibold text-ink-muted mb-1">Quick Generate</p>
              <p className="text-ink-faint leading-relaxed text-xs">Best for fast iteration. Five fields, one click — upload a product photo and Veo 3 renders image-to-video in minutes.</p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {setupOpen && <BrandVoiceSetup onClose={() => setSetupOpen(false)} onSaved={() => setShowPrompt(false)} />}
      </AnimatePresence>
    </AppShell>
  )
}

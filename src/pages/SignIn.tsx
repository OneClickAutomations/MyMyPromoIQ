import { SignIn } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { Bolt, Check } from '../components/icons'
import { brand } from '../copy'

const recentActivity = [
  { initials: 'MR', action: 'Generated 12 UGC videos', time: '2 min ago', tone: 'fire' },
  { initials: 'LK', action: 'Hired 0 creators this month', time: '8 min ago', tone: 'gold' },
  { initials: 'DP', action: 'Shipped 15 ad variants today', time: '14 min ago', tone: 'fire' },
  { initials: 'PS', action: 'Saved $4,200 vs agency cost', time: '31 min ago', tone: 'gold' },
]

const features = [
  'AI director crafts every prompt',
  'Higgsfield DoP cinematic engine',
  'Campaign dashboard with history',
  'Download-ready in minutes',
]

export default function SignInPage() {
  return (
    <div className="flex min-h-screen bg-void">
      {/* ── Left panel ────────────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r border-white/5 p-12 lg:flex xl:p-16">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-1/3 h-[500px] w-[500px] rounded-full bg-fire-start/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[350px] w-[350px] rounded-full bg-gold/6 blur-[100px]" />
        </div>

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-5 w-5 text-white" />
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">{brand.name}</span>
        </Link>

        <div className="relative space-y-10">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink xl:text-4xl">
              Welcome back.{' '}
              <span className="text-fire">Your ads are waiting.</span>
            </h1>
            <p className="mt-4 text-base text-ink-muted">
              Sign in to access your campaign dashboard, continue generating, and download your videos.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-fire">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-sm text-ink-muted">{f}</span>
              </li>
            ))}
          </ul>

          {/* Live activity feed */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fire-start" />
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Live activity</span>
            </div>
            <div className="space-y-2.5">
              {recentActivity.map((item) => (
                <div
                  key={item.initials + item.time}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-void-900/60 px-4 py-3 backdrop-blur-sm"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${
                      item.tone === 'gold' ? 'bg-gold/80' : 'bg-gradient-fire'
                    }`}
                  >
                    {item.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{item.action}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-faint">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-xs text-ink-faint">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        {/* Mobile logo */}
        <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-5 w-5 text-white" />
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">{brand.name}</span>
        </Link>

        <div className="w-full max-w-[440px]">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">Sign in to {brand.name}</h2>
            <p className="mt-1.5 text-sm text-ink-muted">Pick up right where you left off.</p>
          </div>

          <SignIn
            routing="path"
            path="/sign-in"
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                colorPrimary: '#FF6B35',
                colorBackground: '#0D0D0F',
                colorText: '#F2F2F2',
                colorTextSecondary: '#8A8A96',
                colorInputBackground: '#1A1A1F',
                colorInputText: '#F2F2F2',
                borderRadius: '12px',
              },
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none p-0 border-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border border-white/10 bg-void-800 text-ink hover:bg-void-700 transition-colors rounded-xl h-11',
                formFieldInput:
                  'bg-void-800 border-void-500 text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:ring-fire-start/30 rounded-xl h-11',
                formButtonPrimary:
                  'bg-gradient-fire text-white font-semibold hover:opacity-90 transition-opacity rounded-xl h-11',
                footerActionLink: 'text-fire-start hover:text-fire-end font-semibold',
                footerAction: 'hidden',
                identityPreviewText: 'text-ink',
                formFieldLabel: 'text-ink text-sm font-medium',
                dividerLine: 'bg-white/10',
                dividerText: 'text-ink-muted',
                formResendCodeLink: 'text-fire-start',
                alertText: 'text-sm',
              },
            }}
          />

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don't have an account?{' '}
            <Link to="/sign-up" className="font-semibold text-fire-start hover:text-fire-end transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

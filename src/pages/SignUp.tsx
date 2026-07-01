import { SignUp } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { Bolt, Check } from '../components/icons'
import { brand } from '../copy'

const benefits = [
  'First 3 videos completely free — no card required',
  'AI director writes cinematic prompts for you',
  'Results in minutes, not weeks',
  'Google Veo 3 video engine built in',
  'Cancel any time, keep everything you made',
]

const stats = [
  { value: '10,000+', label: 'Videos generated' },
  { value: '340%', label: 'Avg. reply rate lift' },
  { value: '90 sec', label: 'Avg. render time' },
]

const testimonials = [
  {
    quote: 'Replaced our entire UGC agency in one afternoon.',
    name: 'Marcus R.',
    role: 'DTC brand founder',
    initials: 'MR',
  },
  {
    quote: 'Went from 2 ad variants a week to 15. Our ROAS doubled.',
    name: 'Priya S.',
    role: 'Performance marketer',
    initials: 'PS',
  },
]

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen bg-void">
      {/* ── Left panel — social proof ─────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r border-white/5 p-12 lg:flex xl:p-16">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-fire-start/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-fire-end/8 blur-[100px]" />
        </div>

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-5 w-5 text-white" />
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">{brand.name}</span>
        </Link>

        {/* Main content */}
        <div className="relative space-y-10">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink xl:text-4xl">
              Scroll-stopping video ads,{' '}
              <span className="text-fire">before your coffee gets cold.</span>
            </h1>
            <p className="mt-4 text-base text-ink-muted">
              No camera. No creators. No agency. Describe the ad you want and walk away with finished UGC videos in minutes.
            </p>
          </div>

          {/* Benefit list */}
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-fire">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-sm text-ink-muted">{b}</span>
              </li>
            ))}
          </ul>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-void-900/60 p-4 text-center">
                <div className="text-2xl font-extrabold text-fire">{s.value}</div>
                <div className="mt-1 text-[11px] text-ink-faint">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="space-y-4">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/5 bg-void-900/60 p-5 backdrop-blur-sm"
              >
                <p className="text-sm italic text-ink">"{t.quote}"</p>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-fire text-[11px] font-bold text-white">
                    {t.initials}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-ink">{t.name}</div>
                    <div className="text-[11px] text-ink-faint">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-ink-faint">
          © {new Date().getFullYear()} {brand.name}. Powered by Google Veo 3.
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
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">Create your free account</h2>
            <p className="mt-1.5 text-sm text-ink-muted">First 3 videos on us — no card required.</p>
          </div>

          <SignUp
            routing="path"
            path="/sign-up"
            fallbackRedirectUrl="/dashboard"
            signInUrl="/sign-in"
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
            Already have an account?{' '}
            <Link to="/sign-in" className="font-semibold text-fire-start hover:text-fire-end transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

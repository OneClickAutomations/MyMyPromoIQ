import { SignUp } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { Bolt } from '../components/icons'
import { brand } from '../copy'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fire-start/10 blur-[140px]" />
      </div>

      {/* Logo */}
      <Link to="/" className="mb-10 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
          <Bolt className="h-5 w-5 text-white" />
        </span>
        <span className="text-xl font-bold tracking-tight text-ink">{brand.name}</span>
      </Link>

      <SignUp
        routing="path"
        path="/sign-up"
        afterSignUpUrl="/dashboard"
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
            rootBox: 'w-full max-w-md',
            card: 'bg-void-900 border border-white/8 shadow-card rounded-2xl',
            headerTitle: 'text-ink font-bold',
            headerSubtitle: 'text-ink-muted',
            socialButtonsBlockButton:
              'border border-white/10 bg-void-800 text-ink hover:bg-void-700 transition-colors',
            formFieldInput:
              'bg-void-800 border-void-500 text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:ring-fire-start/30',
            formButtonPrimary:
              'bg-gradient-fire text-white font-semibold hover:opacity-90 transition-opacity',
            footerActionLink: 'text-fire-start hover:text-fire-end font-semibold',
            formFieldLabel: 'text-ink text-sm font-medium',
            dividerLine: 'bg-white/10',
            dividerText: 'text-ink-muted',
          },
        }}
      />

      <p className="mt-4 text-center text-xs text-ink-faint">
        First 3 videos free · No credit card required
      </p>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-semibold text-fire-start hover:text-fire-end transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}

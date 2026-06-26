import { Link, useLocation } from 'react-router-dom'
import { Bolt } from './icons'
import { brand } from '../copy'

const PAGES = [
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'Data Processing Agreement', href: '/legal/dpa' },
  { label: 'Cookie Policy', href: '/legal/cookies' },
]

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-void text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-void/90 backdrop-blur-xl">
        <div className="container-x flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
              <Bolt className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-sm font-bold tracking-tight text-ink">{brand.name}</span>
          </Link>
          <Link to="/" className="text-xs text-ink-muted transition-colors hover:text-ink">
            ← Back to site
          </Link>
        </div>
      </header>

      <div className="container-x py-12 md:py-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
          {/* Sidebar nav */}
          <aside className="shrink-0 lg:w-56">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Legal</p>
            <nav className="space-y-0.5">
              {PAGES.map((p) => (
                <Link
                  key={p.href}
                  to={p.href}
                  className={`block rounded-xl px-3 py-2.5 text-sm transition-all ${
                    pathname === p.href
                      ? 'bg-fire-start/10 font-semibold text-fire-start ring-1 ring-fire-start/20'
                      : 'text-ink-muted hover:bg-white/5 hover:text-ink'
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8 rounded-xl border border-white/5 bg-void-900/60 p-4 text-xs text-ink-faint leading-relaxed">
              <p className="font-semibold text-ink-muted">Questions?</p>
              <p className="mt-1">Email us at{' '}
                <a href="mailto:legal@promoiq.com" className="text-fire-start hover:text-fire-end transition-colors">
                  legal@promoiq.com
                </a>
              </p>
            </div>
          </aside>

          {/* Content */}
          <article className="min-w-0 flex-1">
            <header className="mb-10 border-b border-white/8 pb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
              <p className="mt-2 text-sm text-ink-faint">Last updated: {lastUpdated}</p>
            </header>
            <div className="legal-prose">{children}</div>
          </article>
        </div>
      </div>
    </div>
  )
}

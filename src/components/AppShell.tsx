import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { brand } from '../copy'
import { Bolt, Grid, Menu, Moon, Settings, Sun, Wand, Film, X } from './icons'

const NAV = [
  { label: 'Campaigns', href: '/dashboard', icon: Grid },
  { label: 'Studio',    href: '/studio',    icon: Wand },
  { label: 'Queue',     href: '/queue',     icon: Film,     soon: true },
  { label: 'Settings',  href: '/settings',  icon: Settings, soon: true },
]

function usePersistentTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('promoiq_theme') as 'dark' | 'light') || 'dark' } catch { return 'dark' }
  })
  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t)
    try { localStorage.setItem('promoiq_theme', t) } catch {}
  }, [])
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])
  return { theme, toggle }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { user } = useUser()
  const { theme, toggle } = usePersistentTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isLight = theme === 'light'

  return (
    <div className={`relative flex min-h-screen bg-void text-ink${isLight ? ' light' : ''}`}>

      {/* ── Mobile backdrop ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (desktop: always visible · mobile: slide-in drawer) ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col
          border-r border-white/5 bg-void-800
          transition-transform duration-300 ease-out will-change-transform
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        aria-label="Sidebar navigation"
      >
        {/* Logo row */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft flex-shrink-0">
            <Bolt className="h-4 w-4 text-white" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">{brand.name}</span>
          {/* Close button — mobile only */}
          <button
            onClick={() => setMenuOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink transition-colors md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Main navigation">
          {NAV.map(({ label, href, icon: Icon, soon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <div key={label}>
                {soon ? (
                  <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-ink-faint cursor-default select-none">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto rounded-full bg-void-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ink-faint">
                      soon
                    </span>
                  </div>
                ) : (
                  <Link
                    to={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-150 ${
                      active
                        ? 'bg-fire-start/10 text-fire-start ring-1 ring-fire-start/20'
                        : 'text-ink-muted hover:bg-white/5 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom — usage meter + user row */}
        <div className="border-t border-white/5 p-4 space-y-3">
          {/* Usage meter */}
          <div className="rounded-xl bg-void-700 p-3">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Videos this month</span>
              <span className="font-semibold text-ink">0 / 3 free</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-void-600">
              <div className="h-1.5 rounded-full bg-gradient-fire" style={{ width: '0%' }} />
            </div>
            <Link
              to="#pricing"
              className="mt-2 block text-center text-[11px] font-semibold text-fire-start hover:text-fire-end transition-colors"
            >
              Upgrade for more →
            </Link>
          </div>

          {/* Theme toggle + User */}
          <div className="flex items-center gap-2 rounded-xl px-1">
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8 rounded-xl' } }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[11px] text-ink-faint">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <button
              onClick={toggle}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink transition-colors"
              aria-label="Toggle light/dark mode"
              title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar (hidden on md+) ── */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/5 bg-void/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-base font-bold tracking-tight text-ink">{brand.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink transition-colors"
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex min-h-screen flex-1 flex-col overflow-auto md:ml-64">
        {/* Spacer for mobile top bar */}
        <div className="h-14 flex-shrink-0 md:hidden" aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

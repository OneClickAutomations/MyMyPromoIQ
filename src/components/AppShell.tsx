import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser, useClerk } from '../hooks/useAuth'
import { brand } from '../copy'
import { Bolt, Clock, Compass, Grid, LogOut, Menu, Moon, Package, Palette, Settings, Sun, Users, Wand, Film, X } from './icons'

type NavItem = { label: string; href: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; soon?: boolean }
type NavSection = { sectionLabel?: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Campaigns',    href: '/dashboard',  icon: Grid },
      { label: 'Discover Ads', href: '/discover',   icon: Compass },
      { label: 'New Campaign', href: '/forge',       icon: Wand },
    ],
  },
  {
    sectionLabel: 'Creative Studio',
    items: [
      { label: 'Creators', href: '/creators', icon: Users },
      { label: 'Products', href: '/products', icon: Package },
      { label: 'Brand Kit', href: '/brand',   icon: Palette },
    ],
  },
  {
    sectionLabel: 'Library',
    items: [
      { label: 'History',  href: '/history',  icon: Clock },
      { label: 'Queue',    href: '/queue',     icon: Film,     soon: true },
      { label: 'Settings', href: '/settings',  icon: Settings, soon: true },
    ],
  },
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
  const { signOut } = useClerk()
  const { theme, toggle } = usePersistentTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])
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
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col
          border-r border-white/[0.06]
          transition-transform duration-300 ease-out will-change-transform
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        style={{ background: 'linear-gradient(180deg, #0F0F11 0%, #0A0A0C 100%)' }}
        aria-label="Sidebar navigation"
      >
        {/* Subtle fire ambient at the top of sidebar */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 opacity-30"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,107,53,0.15) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative flex h-[60px] items-center gap-3 px-5">
          <div className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-[17px] w-[17px] text-white" />
          </div>
          <span className="text-[16px] font-bold tracking-tight text-ink">{brand.name}</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:text-ink transition-colors md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 pb-4 overflow-y-auto" aria-label="Main navigation">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-3' : ''}>
              {section.sectionLabel && (
                <div className="px-5 pb-1 pt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint/40">{section.sectionLabel}</span>
                </div>
              )}
              <div className="space-y-0.5 px-3">
                {section.items.map(({ label, href, icon: Icon, soon }) => {
                  const active = pathname === href ||
                    (href !== '/dashboard' && pathname.startsWith(href))
                  return (
                    <div key={label}>
                      {soon ? (
                        <div className="flex items-center gap-3 rounded-xl px-3 py-[11px] text-ink-faint/50 cursor-default select-none">
                          <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                          <span className="text-sm font-medium">{label}</span>
                          <span className="ml-auto rounded-full bg-void-700/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ink-faint/50">
                            soon
                          </span>
                        </div>
                      ) : (
                        <Link
                          to={href}
                          className={`relative flex items-center gap-3 rounded-xl px-3 py-[11px] transition-all duration-150 ${
                            active
                              ? 'bg-fire-start/[0.10] text-fire-start'
                              : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink'
                          }`}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-fire-start shadow-[0_0_8px_rgba(255,107,53,0.6)]" />
                          )}
                          <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? 'text-fire-start' : ''}`} />
                          <span className="text-sm font-semibold">{label}</span>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="relative border-t border-white/[0.06] p-4 space-y-3">
          <div className="mb-1 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint/60">Workspace</span>
          </div>

          {/* Usage */}
          <div className="rounded-xl border border-white/[0.06] bg-void-700/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-faint">Videos this month</span>
              <span className="font-bold text-ink">0 / 3</span>
            </div>
            <div className="mt-2.5 h-1 w-full rounded-full bg-void-600/60 overflow-hidden">
              <div className="h-1 rounded-full bg-gradient-fire" style={{ width: '0%' }} />
            </div>
            <Link
              to="#pricing"
              className="mt-2.5 block text-center text-[11px] font-semibold text-fire-start hover:text-fire-end transition-colors"
            >
              Upgrade for more →
            </Link>
          </div>

          {/* User row */}
          <div className="flex items-center gap-2.5 rounded-xl px-1">
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-[34px] w-[34px] rounded-xl' } }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[11px] text-ink-faint leading-tight mt-0.5">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <button
              onClick={toggle}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink transition-colors"
              aria-label={isLight ? 'Dark mode' : 'Light mode'}
            >
              {isLight ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-ink-faint hover:bg-white/[0.05] hover:text-ink transition-colors"
          >
            <LogOut className="h-[15px] w-[15px] flex-shrink-0" />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-void/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-[14px] w-[14px] text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-ink">{brand.name}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-white/[0.06] hover:text-ink transition-colors"
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-white/[0.06] hover:text-ink transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex min-h-screen flex-1 flex-col overflow-auto md:ml-64">
        <div className="h-14 flex-shrink-0 md:hidden" aria-hidden="true" />
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

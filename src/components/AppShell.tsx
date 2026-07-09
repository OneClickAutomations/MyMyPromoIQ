/**
 * AppShell — the persistent shell for every authenticated screen.
 *
 * Desktop: a collapsible left rail (240px expanded / 64px icon-only), persisted
 * to localStorage. Active item gets a left orange bar + subtle tint.
 * Mobile (<768px): the rail is replaced by a 5-item bottom tab bar.
 * All surfaces use design tokens — no hardcoded hex.
 */
import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UserButton, useClerk } from '../hooks/useAuth'
import { brand } from '../copy'
import {
  Bolt, Clock, Compass, Grid, LogOut, Moon, Package, Palette, Settings,
  Sun, Users, Star, ChevronRight,
} from './icons'

type NavItem = { label: string; href: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; soon?: boolean }

const NAV: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard', icon: Grid },
  { label: 'Discover Ads', href: '/discover',  icon: Compass },
  { label: 'Ad Forge',     href: '/forge',     icon: Bolt },
  { label: 'Projects',     href: '/history',   icon: Clock },
  { label: 'Creators',     href: '/creators',  icon: Users },
  { label: 'Products',     href: '/products',  icon: Package },
  { label: 'Brand Kit',    href: '/brand',     icon: Palette },
  { label: 'Settings',     href: '/settings',  icon: Settings, soon: true },
]

// The 5 items promoted to the mobile bottom tab bar.
const MOBILE_TABS: NavItem[] = [
  { label: 'Home',     href: '/dashboard', icon: Grid },
  { label: 'Discover', href: '/discover',  icon: Compass },
  { label: 'Forge',    href: '/forge',     icon: Bolt },
  { label: 'Projects', href: '/history',   icon: Clock },
  { label: 'Brand',    href: '/brand',     icon: Palette },
]

const CREDITS = 240 // placeholder until credits are wired

function usePersistentTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('promoiq_theme') as 'dark' | 'light') || 'dark' } catch { return 'dark' }
  })
  const toggle = useCallback(() => {
    setThemeState(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('promoiq_theme', next) } catch {}
      return next
    })
  }, [])
  return { theme, toggle }
}

function usePersistentCollapse() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('promoiq_nav_collapsed') === '1' } catch { return false }
  })
  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('promoiq_nav_collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }, [])
  return { collapsed, toggle }
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { signOut } = useClerk()
  const { theme, toggle: toggleTheme } = usePersistentTheme()
  const { collapsed, toggle: toggleCollapse } = usePersistentCollapse()
  const isLight = theme === 'light'
  const railW = collapsed ? 'md:w-16' : 'md:w-60'

  return (
    <div className={`relative flex min-h-screen bg-void text-ink${isLight ? ' light' : ''}`}>
      {/* ── Desktop rail ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.05] bg-void-900 transition-[width] duration-200 ease-out md:flex ${railW}`}
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div className="flex h-[60px] items-center gap-2.5 px-4">
          <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-[17px] w-[17px] text-white" />
          </div>
          {!collapsed && <span className="text-[16px] font-bold tracking-[-0.02em] text-ink">{brand.name}</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2" aria-label="Main navigation">
          {NAV.map(({ label, href, icon: Icon, soon }) => {
            const active = isActive(pathname, href)
            if (soon) {
              return (
                <div key={label} title={collapsed ? `${label} — soon` : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-ink-faint/50 ${collapsed ? 'justify-center' : ''}`}>
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!collapsed && <><span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto rounded-full bg-void-700/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest">soon</span></>}
                </div>
              )
            }
            return (
              <Link key={label} to={href} title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${collapsed ? 'justify-center' : ''} ${
                  active ? 'bg-fire-start/[0.10] text-fire-start' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink'
                }`}>
                {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-fire-start" />}
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span className="text-sm font-semibold">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: credits + user + collapse */}
        <div className="space-y-2 border-t border-white/[0.05] p-2.5">
          {/* Credit pill */}
          <div className={`flex items-center gap-2 rounded-xl bg-void-700 px-3 py-2 ${collapsed ? 'justify-center' : ''}`} title={collapsed ? `${CREDITS} credits` : undefined}>
            <Star className="h-4 w-4 flex-shrink-0 text-gold" />
            {!collapsed && <><span className="text-sm font-bold tabular-nums text-gold">{CREDITS}</span>
              <span className="text-[11px] text-ink-faint">credits</span></>}
          </div>

          {/* User row */}
          <div className={`flex items-center gap-2 rounded-xl px-1 ${collapsed ? 'justify-center' : ''}`}>
            <UserButton afterSignOutUrl="/" />
            {!collapsed && (
              <button onClick={() => signOut({ redirectUrl: '/' })}
                className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-ink-faint transition-colors hover:bg-white/[0.05] hover:text-ink">
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            )}
          </div>

          {/* Theme + collapse toggle */}
          <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
            <button onClick={toggleTheme} title="Toggle theme"
              className="grid h-9 flex-1 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink">
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button onClick={toggleCollapse} title={collapsed ? 'Expand' : 'Collapse'}
              className="grid h-9 flex-1 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink">
              <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.05] bg-void/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-[14px] w-[14px] text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">{brand.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-void-700 px-2.5 py-1 text-xs font-bold text-gold">
            <Star className="h-3.5 w-3.5" /> {CREDITS}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-white/[0.05] bg-void-900/95 backdrop-blur-md md:hidden" aria-label="Bottom navigation">
        {MOBILE_TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link key={label} to={href} className="flex flex-1 flex-col items-center justify-center gap-1">
              <Icon className={`h-5 w-5 ${active ? 'text-fire-start' : 'text-ink-faint'}`} />
              <span className={`text-[10px] font-medium ${active ? 'text-fire-start' : 'text-ink-faint'}`}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Main content ── */}
      <main className={`flex min-h-screen flex-1 flex-col overflow-auto transition-[margin] duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        <div className="h-14 flex-shrink-0 md:hidden" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-24 md:px-6 md:py-8 md:pb-8">
          {children}
        </div>
      </main>
    </div>
  )
}

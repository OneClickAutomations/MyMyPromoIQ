import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { brand } from '../copy'
import { Bolt, Grid, Wand, Film, Settings } from './icons'

const NAV = [
  { label: 'Campaigns', href: '/dashboard', icon: Grid },
  { label: 'Studio', href: '/studio', icon: Wand },
  { label: 'Queue', href: '/queue', icon: Film, soon: true },
  { label: 'Settings', href: '/settings', icon: Settings, soon: true },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { user } = useUser()

  return (
    <div className="flex min-h-screen bg-void text-ink">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/5 bg-void-900">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-4 w-4 text-white" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">{brand.name}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map(({ label, href, icon: Icon, soon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <div key={label}>
                {soon ? (
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-ink-faint cursor-default select-none">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto rounded-full bg-void-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-ink-faint">
                      soon
                    </span>
                  </div>
                ) : (
                  <Link
                    to={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
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

        {/* Bottom — usage + user */}
        <div className="border-t border-white/5 p-4 space-y-3">
          {/* Usage meter */}
          <div className="rounded-xl bg-void-800 p-3">
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

          {/* User row */}
          <div className="flex items-center gap-3 rounded-xl px-1">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'h-8 w-8 rounded-xl',
                },
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[11px] text-ink-faint">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="ml-60 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

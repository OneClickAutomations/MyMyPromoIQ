/**
 * Supabase Auth, exposed through a Clerk-compatible surface.
 *
 * The app was built against Clerk's hooks/components (`useUser`, `useClerk`,
 * `SignedIn`, `SignedOut`, `UserButton`, `RedirectToSignIn`). This module
 * reimplements that exact surface over Supabase Auth so the rest of the app
 * only swaps its import path — `@clerk/clerk-react` → `../hooks/useAuth` — with
 * no other change. `user.id` is now the Supabase auth uid.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Clerk-shaped user the app already reads (id, firstName, lastName, email, image). */
export interface AppUser {
  id: string
  firstName: string | null
  lastName: string | null
  primaryEmailAddress: { emailAddress: string } | null
  imageUrl: string | null
}

function toAppUser(u: SupabaseUser | null): AppUser | null {
  if (!u) return null
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const fullName = (meta.full_name || meta.name || '') as string
  const [first, ...rest] = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    id: u.id,
    firstName: (meta.first_name as string) || first || null,
    lastName: (meta.last_name as string) || (rest.length ? rest.join(' ') : null),
    primaryEmailAddress: u.email ? { emailAddress: u.email } : null,
    imageUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
  }
}

interface AuthState {
  isLoaded: boolean
  session: Session | null
  user: AppUser | null
}

const AuthContext = createContext<AuthState>({ isLoaded: false, session: null, user: null })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ isLoaded: false, session: null, user: null })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ isLoaded: true, session: data.session, user: toAppUser(data.session?.user ?? null) })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ isLoaded: true, session, user: toAppUser(session?.user ?? null) })
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

/** Clerk-compatible `useUser()`. */
export function useUser(): { isLoaded: boolean; isSignedIn: boolean; user: AppUser | null } {
  const { isLoaded, user } = useContext(AuthContext)
  return { isLoaded, isSignedIn: !!user, user }
}

/** Clerk-compatible `useClerk()` — only `signOut` is used in the app. */
export function useClerk() {
  const signOut = useCallback(async (opts?: { redirectUrl?: string }) => {
    await supabase.auth.signOut()
    window.location.href = opts?.redirectUrl ?? '/'
  }, [])
  return { signOut }
}

/** Renders children only when a session exists. */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isLoaded, session } = useContext(AuthContext)
  return isLoaded && session ? <>{children}</> : null
}

/** Renders children only when signed out (and auth has loaded). */
export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isLoaded, session } = useContext(AuthContext)
  return isLoaded && !session ? <>{children}</> : null
}

/** Navigates to /sign-in (Clerk had a component of the same name). */
export function RedirectToSignIn() {
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate('/sign-in', { replace: true })
  }, [navigate])
  return null
}

/** Minimal avatar + dropdown replacing Clerk's <UserButton/>. */
export function UserButton({ afterSignOutUrl = '/' }: { afterSignOutUrl?: string; appearance?: unknown }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const initials = useMemo(() => {
    const e = user?.primaryEmailAddress?.emailAddress ?? ''
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    return (n || e).slice(0, 2).toUpperCase() || '?'
  }, [user])
  if (!user) return null
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="grid h-8 w-8 place-items-center rounded-full bg-gradient-fire text-[11px] font-bold text-white ring-1 ring-white/15"
        aria-label="Account menu"
      >
        {user.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-white/10 bg-void-900 p-1.5 shadow-card">
            <div className="border-b border-white/[0.06] px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Account'}</p>
              {user.primaryEmailAddress && <p className="truncate text-xs text-ink-muted">{user.primaryEmailAddress.emailAddress}</p>}
            </div>
            <button
              onClick={() => signOut({ redirectUrl: afterSignOutUrl })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

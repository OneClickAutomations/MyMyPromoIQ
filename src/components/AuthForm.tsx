/**
 * Supabase email/password + Google auth form. Replaces Clerk's <SignIn>/<SignUp>
 * widgets; the surrounding marketing layout in the sign-in/up pages is unchanged.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { RefreshCw } from './icons'

export default function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })
        if (error) throw error
        // Email confirmation ON → no session yet; OFF → session created, go in.
        if (data.session) navigate('/dashboard')
        else setNotice('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={google}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-void-800 text-sm font-semibold text-ink transition-colors hover:bg-void-700"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.9 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-6.9l-6.5 5C9.1 40.3 16 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 34.9 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-ink-muted">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Email</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 w-full rounded-xl border border-void-500 bg-void-800 px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Password</label>
          <input
            type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
            className="h-11 w-full rounded-xl border border-void-500 bg-void-800 px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {notice && <p className="text-sm text-emerald-300">{notice}</p>}

        <button
          type="submit" disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-fire text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

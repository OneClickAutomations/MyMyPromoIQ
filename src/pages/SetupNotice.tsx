import { Bolt } from '../components/icons'
import { brand } from '../copy'

/**
 * Shown when VITE_CLERK_PUBLISHABLE_KEY is missing or still a placeholder.
 * Replaces the previous hard crash with actionable setup instructions.
 */
export default function SetupNotice() {
  const steps = [
    { n: 1, text: 'Create a free app at clerk.com', link: 'https://clerk.com' },
    { n: 2, text: 'Copy the Publishable key (pk_test_…) from API Keys' },
    { n: 3, text: 'Paste it into .env as VITE_CLERK_PUBLISHABLE_KEY' },
    { n: 4, text: 'In Clerk → Paths, set Sign-in=/sign-in, Sign-up=/sign-up' },
    { n: 5, text: 'Restart the dev server (npm run dev)' },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4 text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fire-start/10 blur-[140px]" />
      </div>

      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-void-900 p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-5 w-5 text-white" />
          </span>
          <span className="text-xl font-bold tracking-tight">{brand.name}</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight">Almost there — connect auth</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {brand.name} uses <span className="font-semibold text-ink">Clerk</span> for login and
          accounts (no Supabase or Netlify Identity needed). Add your Clerk publishable key to
          enable sign-in.
        </p>

        <ol className="mt-6 space-y-3">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-fire-start/15 text-xs font-bold text-fire-start ring-1 ring-fire-start/30">
                {s.n}
              </span>
              <span className="text-sm text-ink">
                {s.link ? (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-fire-start underline-offset-2 hover:underline"
                  >
                    {s.text}
                  </a>
                ) : (
                  s.text
                )}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-white/5 bg-void-800 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">.env</p>
          <pre className="mt-2 overflow-x-auto text-xs text-ink-muted">
            <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

/**
 * DashboardMockup — a hand-built, pixel-accurate mock of the app's
 * video-generation dashboard. Rendered as real DOM (not an AI image) so the
 * UI text stays crisp and on-brand at every resolution.
 *
 * NOTE: This is a static marketing mock. In the real app shell, the clip grid
 * and render queue are driven by the generation API (Anthropic "director" +
 * Seedance/Higgsfield video model). See HowItWorks.tsx for the wiring marker.
 */
import { Film, Layers, Bolt, Spark } from './icons'

const clips = [
  { tone: 'fire', label: 'Hook · 0:06', done: true },
  { tone: 'gold', label: 'Unbox · 0:12', done: true },
  { tone: 'fire', label: 'Testimonial', done: true },
  { tone: 'gold', label: 'Day-in-life', done: true },
  { tone: 'fire', label: 'Fast-cut', done: false },
  { tone: 'gold', label: 'CTA card', done: false },
]

export default function DashboardMockup() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-void-800/95 shadow-card">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-void-700/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <div className="ml-3 hidden items-center gap-2 rounded-md bg-void-600/70 px-3 py-1 text-[11px] text-ink-faint sm:flex">
          <Bolt className="h-3 w-3 text-fire-start" />
          app.promoiq.ai / studio
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-ink-muted sm:inline">Credits</span>
          <span className="rounded-md bg-gradient-fire px-2 py-0.5 text-[11px] font-semibold text-white">
            ∞ Operator
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12">
        {/* Sidebar */}
        <aside className="col-span-3 hidden flex-col gap-1 border-r border-white/5 bg-void-800/80 p-3 md:flex">
          {[
            { icon: <Spark className="h-4 w-4" />, label: 'Generate', active: true },
            { icon: <Film className="h-4 w-4" />, label: 'My Videos' },
            { icon: <Layers className="h-4 w-4" />, label: 'Styles' },
            { icon: <Bolt className="h-4 w-4" />, label: 'Ad Accounts' },
          ].map((it) => (
            <div
              key={it.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium ${
                it.active
                  ? 'bg-gradient-fire-soft text-ink ring-1 ring-fire-start/30'
                  : 'text-ink-faint'
              }`}
            >
              <span className={it.active ? 'text-fire-start' : ''}>{it.icon}</span>
              {it.label}
            </div>
          ))}
          <div className="mt-auto rounded-lg border border-white/5 bg-void-700/50 p-3">
            <div className="text-[11px] text-ink-faint">This month</div>
            <div className="mt-1 text-lg font-bold text-ink">
              87<span className="text-ink-faint text-sm font-medium"> videos</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-void-500">
              <div className="h-full w-[72%] rounded-full bg-gradient-fire" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-12 p-4 md:col-span-9 md:p-5">
          {/* Active render card */}
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-void-700/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-ink-faint">Now rendering</div>
                <div className="mt-0.5 text-sm font-semibold text-ink">
                  “Glow Serum — testimonial hook”
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-fire-start/15 px-2.5 py-1 text-[11px] font-semibold text-fire-start ring-1 ring-fire-start/30">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
                73%
              </span>
            </div>
            {/* faux video frame */}
            <div className="relative mt-3 aspect-[16/7] w-full overflow-hidden rounded-lg bg-gradient-to-br from-void-600 to-void-800">
              <div className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-fire-start/25 blur-3xl" />
              <div className="absolute right-6 top-4 h-20 w-20 rounded-full bg-gold/15 blur-2xl" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-fire shadow-fire-glow">
                  <div className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
                </div>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-void-500">
              <div className="h-full w-[73%] rounded-full bg-gradient-fire" />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-faint">
              <span className="text-gold">✦ Director:</span>
              <span className="truncate">Writing close-up beat · adding captions · matching brand palette…</span>
            </div>
          </div>

          {/* Clip grid */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-ink">Variants in this batch</div>
            <div className="text-[11px] text-ink-faint">6 generated</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {clips.map((c, i) => (
              <div
                key={i}
                className="group relative aspect-[9/12] overflow-hidden rounded-lg border border-white/5 bg-void-600/60"
              >
                <div
                  className={`absolute inset-0 ${
                    c.tone === 'fire'
                      ? 'bg-gradient-to-br from-fire-start/30 to-fire-end/10'
                      : 'bg-gradient-to-br from-gold/20 to-void-700/10'
                  }`}
                />
                <div className="absolute left-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
                  {c.label}
                </div>
                {c.done ? (
                  <div className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire text-white">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                ) : (
                  <div className="absolute bottom-1.5 right-1.5 h-5 w-5 animate-pulse-dot rounded-full border-2 border-dashed border-gold/70" />
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

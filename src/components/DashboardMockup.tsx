/**
 * DashboardMockup — a hand-built, pixel-accurate mock of the app's
 * video-generation studio. The chrome/UI is real DOM (so text stays crisp at
 * every resolution) while the preview + variant cards are real AI-generated
 * cinematic ad frames (public/assets/ad-*.jpg), so the hero reads as a studio
 * actively producing publish-ready commercials — not a wireframe.
 *
 * NOTE: static marketing mock. In the live app shell the render queue + clip
 * grid are driven by the generation API (Anthropic "director" + Higgsfield
 * video model). See HowItWorks.tsx / Generator.tsx for the real wiring.
 */
import { Film, Layers, Bolt, Spark, Check } from './icons'

const variants = [
  { label: 'Hook', dur: '0:06', img: '/assets/ad-hook.jpg', pos: 'center', done: true },
  { label: 'Unbox', dur: '0:12', img: '/assets/ad-unbox.jpg', pos: 'center', done: true },
  { label: 'Testimonial', dur: '0:09', img: '/assets/ad-main.jpg', pos: 'top', done: true },
  { label: 'Day-in-life', dur: '0:15', img: '/assets/ad-life.jpg', pos: 'center', done: true },
  { label: 'Fast-cut', dur: '0:08', img: '/assets/ad-splash.jpg', pos: 'center', done: false },
] as const

export default function DashboardMockup() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-void-800/95 shadow-card">
      <div className="grid grid-cols-12">
        {/* ───────────── Sidebar ───────────── */}
        <aside className="col-span-3 hidden flex-col gap-1.5 border-r border-white/5 bg-void-900/60 p-3.5 md:flex">
          {/* status badge */}
          <div className="mb-2 inline-flex items-center gap-2 self-start rounded-full bg-fire-start/15 px-2.5 py-1.5 text-[11px] font-semibold text-fire-start ring-1 ring-fire-start/25">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-fire text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
            12 videos generated
          </div>

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
              87<span className="text-sm font-medium text-ink-faint"> videos</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-void-500">
              <div className="h-full w-[72%] rounded-full bg-gradient-fire" />
            </div>
          </div>
        </aside>

        {/* ───────────── Main ───────────── */}
        <main className="relative col-span-12 p-4 md:col-span-9 md:p-5">
          {/* floating "rendering" pill — top right */}
          <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 rounded-full bg-void-900/85 px-3 py-1.5 text-[11px] font-medium text-ink shadow-card ring-1 ring-white/10 backdrop-blur-md sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
            Rendering ad&nbsp;#13&hellip;
          </div>

          {/* Header */}
          <div className="flex items-start justify-between pr-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Now rendering
              </div>
              <div className="mt-1 text-[15px] font-semibold text-ink">
                &ldquo;Glow Serum — testimonial hook&rdquo;
              </div>
            </div>
            <span className="mt-5 flex shrink-0 items-center gap-1.5 rounded-full bg-fire-start/15 px-2.5 py-1 text-[11px] font-bold text-fire-start ring-1 ring-fire-start/30 sm:mt-0">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
              73%
            </span>
          </div>

          {/* Cinematic preview */}
          <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
            <img
              src="/assets/ad-main.jpg"
              alt="AI-generated Glow Serum testimonial ad frame"
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* subtle cinematic vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

            {/* live REC chip */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
              4K · 9:16 master
            </div>

            {/* scrubber + progress */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                <div className="h-full w-[73%] rounded-full bg-gradient-fire shadow-fire-soft" />
              </div>
            </div>
          </div>

          {/* Director line */}
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <span className="shrink-0 font-semibold text-gold">✦ Director</span>
            <span className="truncate text-ink-muted">
              Writing close-up beat · adding captions · matching brand palette&hellip;
            </span>
          </div>

          {/* Variants */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-ink">Variants in this batch</div>
            <div className="text-[11px] text-ink-faint">6 generated</div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {variants.map((v) => (
              <figure
                key={v.label}
                className="group relative aspect-[4/5] overflow-hidden rounded-lg ring-1 ring-white/10"
              >
                <img
                  src={v.img}
                  alt={`${v.label} ad variant`}
                  className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                    v.pos === 'top' ? 'object-top' : 'object-center'
                  }`}
                  loading="lazy"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />

                {/* actively-rendering state: scanning shimmer over the materializing frame */}
                {!v.done && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-void-900/45" />
                    <div className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgba(255,107,53,0.22)_50%,transparent_65%)] bg-[length:200%_100%]" />
                  </>
                )}

                {/* label chip */}
                <figcaption className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                  {v.label}
                  <span className="text-white/55">· {v.dur}</span>
                </figcaption>

                {/* status */}
                {v.done ? (
                  <div className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire text-white shadow-fire-soft">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-gold backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-gold" />
                    61%
                  </div>
                )}
              </figure>
            ))}

            {/* CTA end-card — designed, not a photo (real ads ship an end card) */}
            <div className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-[#2a1206] via-[#3a1a08] to-[#1a0d05] p-2.5 ring-1 ring-gold/25">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fire-start/30 blur-2xl" />
              <span className="relative z-10 inline-flex w-fit items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                CTA card · 0:03
              </span>
              <div className="relative z-10">
                <div className="font-serif text-[15px] font-bold leading-tight text-white">
                  Glow starts
                  <br />
                  with you.
                </div>
                <div className="mt-2 inline-flex items-center rounded-md bg-gradient-fire px-2 py-1 text-[8.5px] font-bold uppercase tracking-wide text-white shadow-fire-soft">
                  Shop Glow Serum
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

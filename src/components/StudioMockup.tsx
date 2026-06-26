/**
 * StudioMockup — the reusable, props-driven studio window shared by every
 * showcase on the page (hero + UGC showcase). The chrome/sidebar/labels are
 * hand-built React (crisp text at any resolution); the preview + variant tiles
 * are real AI-generated cinematic ad frames passed in via props, so each
 * showcase reads as the app actively producing a publish-ready commercial for a
 * different brand — same premium visual language, different campaign.
 *
 * NOTE: static marketing mock. In the live app shell the render queue + clip
 * grid are driven by the generation API (Anthropic "director" + Higgsfield
 * video model). See Generator.tsx for the real wiring.
 */
import { Film, Layers, Bolt, Spark, Check } from './icons'

export type Variant = {
  label: string
  dur: string
  img: string
  /** object-position for the cover crop */
  pos?: 'top' | 'center'
  /** false → renders the "actively rendering" shimmer state */
  done: boolean
  /** progress shown on the rendering tile */
  percent?: number
}

export type CtaCard = {
  label: string
  /** two short lines, stacked */
  lines: [string, string]
  button: string
}

export type StudioMockupProps = {
  /** sidebar status pill, e.g. "12 videos generated" */
  statusBadge: string
  /** floating top-right pill, e.g. "Rendering ad #13…" */
  renderPill: string
  /** the project title in the header, already quoted */
  title: string
  /** overall render percent (0–100) shown in the header + scrubber */
  percent: number
  /** main cinematic preview */
  preview: { img: string; alt: string; masterChip: string; pos?: 'top' | 'center' }
  /** the AI "director" status line */
  director: string
  /** exactly five storyboard variants (sixth tile is the CTA end-card) */
  variants: Variant[]
  ctaCard: CtaCard
  /** monthly usage figure in the sidebar footer */
  monthlyCount?: number
}

export default function StudioMockup({
  statusBadge,
  renderPill,
  title,
  percent,
  preview,
  director,
  variants,
  ctaCard,
  monthlyCount = 87,
}: StudioMockupProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-void-800/95 shadow-card">
      <div className="grid grid-cols-12">
        {/* ───────────── Sidebar ───────────── */}
        <aside className="col-span-3 hidden flex-col gap-1.5 border-r border-white/5 bg-void-900/60 p-3.5 md:flex">
          <div className="mb-2 inline-flex items-center gap-2 self-start rounded-full bg-fire-start/15 px-2.5 py-1.5 text-[11px] font-semibold text-fire-start ring-1 ring-fire-start/25">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-fire text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
            {statusBadge}
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
              {monthlyCount}
              <span className="text-sm font-medium text-ink-faint"> videos</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-void-500">
              <div className="h-full w-[72%] rounded-full bg-gradient-fire" />
            </div>
          </div>
        </aside>

        {/* ───────────── Main ───────────── */}
        <main className="relative col-span-12 p-4 md:col-span-9 md:p-5">
          <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 rounded-full bg-void-900/85 px-3 py-1.5 text-[11px] font-medium text-ink shadow-card ring-1 ring-white/10 backdrop-blur-md sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
            {renderPill}
          </div>

          {/* Header */}
          <div className="flex items-start justify-between pr-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Now rendering
              </div>
              <div className="mt-1 text-[15px] font-semibold text-ink">{title}</div>
            </div>
            <span className="mt-5 flex shrink-0 items-center gap-1.5 rounded-full bg-fire-start/15 px-2.5 py-1 text-[11px] font-bold text-fire-start ring-1 ring-fire-start/30 sm:mt-0">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
              {percent}%
            </span>
          </div>

          {/* Cinematic preview */}
          <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
            <img
              src={preview.img}
              alt={preview.alt}
              className={`h-full w-full object-cover ${preview.pos === 'top' ? 'object-top' : 'object-center'}`}
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
              {preview.masterChip}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                <div
                  className="h-full rounded-full bg-gradient-fire shadow-fire-soft"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Director line */}
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <span className="shrink-0 font-semibold text-gold">✦ Director</span>
            <span className="truncate text-ink-muted">{director}</span>
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

                {!v.done && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-void-900/45" />
                    <div className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgba(255,107,53,0.22)_50%,transparent_65%)] bg-[length:200%_100%]" />
                  </>
                )}

                <figcaption className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                  {v.label}
                  <span className="text-white/55">· {v.dur}</span>
                </figcaption>

                {v.done ? (
                  <div className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire text-white shadow-fire-soft">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-gold backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-gold" />
                    {v.percent ?? 61}%
                  </div>
                )}
              </figure>
            ))}

            {/* CTA end-card — designed, not a photo */}
            <div className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-[#2a1206] via-[#3a1a08] to-[#1a0d05] p-2.5 ring-1 ring-gold/25">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fire-start/30 blur-2xl" />
              <span className="relative z-10 inline-flex w-fit items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                {ctaCard.label} · 0:03
              </span>
              <div className="relative z-10">
                <div className="font-serif text-[15px] font-bold leading-tight text-white">
                  {ctaCard.lines[0]}
                  <br />
                  {ctaCard.lines[1]}
                </div>
                <div className="mt-2 inline-flex items-center rounded-md bg-gradient-fire px-2 py-1 text-[8.5px] font-bold uppercase tracking-wide text-white shadow-fire-soft">
                  {ctaCard.button}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

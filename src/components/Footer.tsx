import { footer, brand } from '../copy'
import { Bolt, social } from './icons'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-void-800/40">
      <div className="container-x section-pad py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand */}
          <div>
            <a href="#top" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
                <Bolt className="h-4 w-4 text-white" />
              </span>
              <span className="text-[17px] font-bold tracking-tight text-ink">{brand.name}</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">{footer.tagline}</p>
            <div className="mt-5 flex items-center gap-3">
              {footer.socials.map((s) => {
                const Icon = social[s as keyof typeof social]
                return (
                  <a
                    key={s}
                    href="#"
                    aria-label={s}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/5 bg-void-700/50 text-ink-muted transition-colors duration-150 hover:border-fire-start/40 hover:text-fire-start"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Link columns */}
          {footer.columns.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                {col.title}
              </div>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-ink-faint">{footer.copyright}</p>
          <p className="text-xs text-ink-faint">Made for operators who ship.</p>
        </div>
      </div>
    </footer>
  )
}

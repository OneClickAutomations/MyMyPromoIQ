import { useEffect, useState } from 'react'
import { nav, brand } from '../copy'
import { Bolt } from './icons'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'border-b border-white/5 bg-void/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="container-x section-pad flex h-16 items-center justify-between">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
            <Bolt className="h-4 w-4 text-white" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">{brand.name}</span>
        </a>

        {/* Center links */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {nav.links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a href="#login" className="hidden text-sm font-medium text-ink-muted hover:text-ink sm:inline">
            Login
          </a>
          <a href="#generate" className="btn-fire px-5 py-2.5 text-[13px]">
            {nav.cta}
          </a>
        </div>
      </nav>
    </header>
  )
}

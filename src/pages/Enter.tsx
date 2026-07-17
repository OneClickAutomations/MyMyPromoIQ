/**
 * Enter — the cinematic front door at "/".
 *
 * Full-viewport UGC-reel video (public/assets/hero-reel.{webm,mp4}, mobile-
 * optimized source under 768px + instant poster) with a two-layer parallax:
 *   • scroll — the video is a fixed layer that drifts down at a fraction of the
 *     scroll rate while the content panel slides up OVER it, dimming as it goes
 *   • mouse — a few px of cursor-tracked float (desktop only)
 * The video's headline ("Outperform. Outcreate. Outgrow.") sits dead-center,
 * so the glass CTA lives in the lower band where it never covers the text.
 * The source has a real voiceover track — muted by default (autoplay
 * requirement), with a glass sound toggle that never restarts playback.
 *
 * Every CTA here lands on /home — the full marketing landing page.
 * prefers-reduced-motion: parallax off, video paused on its poster, grain still.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '../copy'
import { ArrowRight, Bolt, ChevronDown, Film, Layers, Zap } from '../components/icons'

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function MutedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}
function UnmutedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

export default function Enter() {
  const layerRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleCanPlay = useCallback(() => setIsLoaded(true), [])

  // Sound toggle — flips the muted flag only, never touches playback state,
  // so the loop never restarts or stutters.
  const toggleSound = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setIsMuted(next)
    setHasInteracted(true)
    if (!next && video.paused) {
      video.play().catch(() => {
        video.muted = true
        setIsMuted(true)
      })
    }
  }, [])

  useEffect(() => {
    if (REDUCED()) {
      // Respect reduced motion: hold the poster, no parallax.
      videoRef.current?.pause()
      setIsLoaded(true)
      return
    }
    let raf = 0
    let mx = 0, my = 0, sy = 0
    // Once the content panel has fully risen over the video (~1.1 viewport
    // heights of scroll), the video is completely covered — pause it there to
    // save CPU/battery, and resume the instant the user scrolls back up. A
    // classic IntersectionObserver doesn't apply here: this layer is `fixed`,
    // so its own bounding rect never leaves the viewport — what actually
    // matters is whether the sliding content panel has covered it.
    let coveredPaused = false
    const apply = () => {
      raf = 0
      const vh = window.innerHeight || 1
      if (layerRef.current) {
        // Scroll drift (0.22×) + cursor float — scale hides the moving edges.
        layerRef.current.style.transform =
          `translate3d(${mx.toFixed(1)}px, ${(sy * 0.22 + my).toFixed(1)}px, 0) scale(1.08)`
      }
      if (dimRef.current) {
        // Deepen the dim as the content panel rises over the video.
        const p = Math.min(1, sy / vh)
        dimRef.current.style.opacity = String(0.28 + p * 0.55)
      }
      const video = videoRef.current
      if (video) {
        const shouldPause = sy > vh * 0.95
        if (shouldPause && !coveredPaused) {
          video.pause()
          coveredPaused = true
        } else if (!shouldPause && coveredPaused) {
          video.play().catch(() => {})
          coveredPaused = false
        }
      }
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply) }
    const onScroll = () => { sy = window.scrollY; schedule() }
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 14
      my = (e.clientY / window.innerHeight - 0.5) * 8
      schedule()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onMouse, { passive: true })
    apply()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMouse)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="min-h-screen bg-void text-ink">
      {/* ── Fixed video layer (the parallax background) ── */}
      <div className="fixed inset-0 overflow-hidden" aria-hidden>
        {/* Poster shows instantly beneath the video layer — no flash while it fades in */}
        <div
          className="absolute inset-0 bg-cover bg-center contrast-[1.04] brightness-[1.02]"
          style={{ backgroundImage: "url('/assets/hero-poster.jpg')" }}
        />
        <div
          ref={layerRef}
          className={`absolute inset-0 will-change-transform contrast-[1.04] brightness-[1.02] transition-opacity duration-[1200ms] ease-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scale(1.08)' }}
        >
          <video
            ref={videoRef}
            poster="/assets/hero-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={handleCanPlay}
            className="h-full w-full object-cover"
          >
            <source src="/assets/hero-reel.webm" type="video/webm" media="(min-width: 769px)" />
            <source src="/assets/hero-reel-mobile.mp4" type="video/mp4" media="(max-width: 768px)" />
            <source src="/assets/hero-reel.mp4" type="video/mp4" />
          </video>
        </div>
        {/* Cinematic vignette — edges darken, center stays bright */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 140% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.16) 70%, rgba(0,0,0,0.4) 100%)' }}
        />
        {/* Legibility gradients — light at center (video text), weighted at edges */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        {/* Film grain — felt, not seen; stilled under prefers-reduced-motion */}
        <div
          className="absolute -inset-[20%] animate-grain-shift opacity-[0.028] motion-reduce:animate-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: '256px 256px',
          }}
        />
        {/* Scroll-driven dim */}
        <div ref={dimRef} className="absolute inset-0 bg-void" style={{ opacity: 0.28 }} />
      </div>

      {/* ── Sound toggle ── */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={isMuted ? 'Enable sound' : 'Mute video'}
        title={isMuted ? 'Enable sound' : 'Mute'}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-white/[0.12] bg-void/[0.52] px-4 py-2.5 text-xs font-medium text-white/75 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 hover:-translate-y-0.5 hover:border-fire-start/35 hover:bg-fire-start/15 hover:text-white sm:bottom-8 sm:right-8 ${!hasInteracted ? 'animate-sound-pulse' : ''}`}
      >
        <span className="flex flex-shrink-0 items-center opacity-90">{isMuted ? <MutedIcon /> : <UnmutedIcon />}</span>
        <span className="hidden whitespace-nowrap sm:inline">{isMuted ? 'Sound off' : 'Sound on'}</span>
      </button>

      {/* ── Hero viewport ── */}
      <section className="relative flex h-[100svh] flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/home" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-fire shadow-fire-soft">
              <Bolt className="h-4 w-4 text-white" />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-white">{brand.name}</span>
          </Link>
          <Link
            to="/sign-in"
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            Sign in
          </Link>
        </header>

        {/* CTA — lower band, clear of the video's center headline */}
        <div className="mt-auto flex flex-col items-center gap-6 pb-[9vh]">
          <Link
            to="/home"
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-fire-start/45 bg-gradient-to-r from-fire-start/30 via-fire-end/25 to-fire-start/30 px-8 py-4 text-base font-semibold text-white shadow-[0_8px_44px_rgba(232,52,44,0.38)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-fire-start/70 hover:shadow-[0_12px_64px_rgba(255,107,53,0.55)] sm:px-10 sm:py-[18px] sm:text-lg"
          >
            {/* glass highlights */}
            <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            <span className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100" />
            Enter Creator Studio
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>

          {/* Scroll cue */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 text-white/50 transition-colors hover:text-white/80"
            aria-label="Scroll to learn more"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Discover</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </button>
        </div>
      </section>

      {/* ── Content panel — slides up over the parallaxing video ── */}
      <section className="relative z-10 rounded-t-[2rem] border-t border-white/[0.08] bg-void shadow-[0_-24px_80px_rgba(0,0,0,0.6)]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-fire-start">The AI UGC ad studio</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Your product. A cast of creators. One studio.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed text-ink-muted">
            Upload a product photo and direct scroll-stopping UGC ads — scripted by Claude, cast with AI creators, shot on a cinematic video engine, and stitched into one seamless commercial.
          </p>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Layers, title: '12 ad formats', body: 'Testimonial, unboxing, POV, product reveal — each with its own beat structure, not a template skin.' },
              { icon: Film, title: 'Cinematic engine', body: 'Timed-beat prompts, character-locked creators, and last-frame chaining for seamless multi-scene ads.' },
              { icon: Zap, title: 'Script to screen in minutes', body: 'Claude writes real sales copy — hook, proof, CTA — voiced, captioned, and stitched automatically.' },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border border-white/[0.08] bg-void-800/60 p-6 transition-colors hover:border-fire-start/25">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-fire-start/12 ring-1 ring-fire-start/20">
                  <f.icon className="h-5 w-5 text-fire-start" />
                </span>
                <h3 className="mt-4 text-base font-bold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-3">
            <Link to="/home" className="btn-fire gap-2 px-8 py-4 text-base">
              Enter Creator Studio <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="text-xs text-ink-faint">Free to start · No credit card required</p>
          </div>
        </div>

        <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </footer>
      </section>
    </div>
  )
}

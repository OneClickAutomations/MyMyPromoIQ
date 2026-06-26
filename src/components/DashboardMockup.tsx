/**
 * DashboardMockup — the hero's studio window. Thin config wrapper over the
 * shared <StudioMockup>; supplies the skincare ("Glow Serum") campaign data.
 * Frames live in public/assets/ad-*.jpg (real AI-generated cinematic ad frames).
 */
import StudioMockup, { type Variant, type CtaCard } from './StudioMockup'

const variants: Variant[] = [
  { label: 'Hook', dur: '0:06', img: '/assets/ad-hook.jpg', pos: 'center', done: true },
  { label: 'Unbox', dur: '0:12', img: '/assets/ad-unbox.jpg', pos: 'center', done: true },
  { label: 'Testimonial', dur: '0:09', img: '/assets/ad-main.jpg', pos: 'top', done: true },
  { label: 'Day-in-life', dur: '0:15', img: '/assets/ad-life.jpg', pos: 'center', done: true },
  { label: 'Fast-cut', dur: '0:08', img: '/assets/ad-splash.jpg', pos: 'center', done: false, percent: 61 },
]

const ctaCard: CtaCard = {
  label: 'CTA card',
  lines: ['Glow starts', 'with you.'],
  button: 'Shop Glow Serum',
}

export default function DashboardMockup() {
  return (
    <StudioMockup
      statusBadge="12 videos generated"
      renderPill="Rendering ad #13…"
      title={'“Glow Serum — testimonial hook”'}
      percent={73}
      preview={{
        img: '/assets/ad-main.jpg',
        alt: 'AI-generated Glow Serum testimonial ad frame',
        masterChip: '4K · 9:16 master',
      }}
      director="Writing close-up beat · adding captions · matching brand palette…"
      variants={variants}
      ctaCard={ctaCard}
      monthlyCount={87}
    />
  )
}

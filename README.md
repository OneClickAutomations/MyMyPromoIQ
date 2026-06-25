# PromoIQ — "UGC on Autopilot" Landing Page

A production-ready, direct-response landing page for an AI UGC video pipeline
(Claude as the "director" writing prompts + Seedance/Higgsfield as the video
model), wrapped behind a dead-simple dashboard.

Built with **React + TypeScript + Vite + Tailwind CSS + Framer Motion**.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Design system

- **No purple / lavender / violet / indigo anywhere** — hard constraint.
- **Background:** near-black with warmth (`bg-void`, `#0A0A0B`–`#161618`).
- **Primary:** orange → red fire gradient (`bg-gradient-fire`, `#FF6B35` → `#E8341C`) on CTAs and active states.
- **Accent:** gold (`text-gold`, `#F2B84B`) — used sparingly for premium cues.
- **Motion:** subtle, fast (150–250ms), no bounce. Scroll-triggered fades via `Reveal`.

Custom tokens live in [`tailwind.config.js`](./tailwind.config.js): `bg-void`,
`bg-gradient-fire`, `text-gold`, plus `shadow-fire-glow` and float/marquee
keyframes.

## Structure

All content is separated from layout in [`src/copy.ts`](./src/copy.ts) — edit
copy there without touching components.

```
src/
  LandingPage.tsx          # composes every section in order
  copy.ts                  # ALL copy/content (single source of truth)
  components/
    Navbar.tsx             # transparent → blur-on-scroll
    Hero.tsx               # headline + floating tilted dashboard
    DashboardMockup.tsx    # hand-built product UI (crisp at any res)
    SocialProof.tsx        # infinite avatar testimonial marquee
    Problem.tsx            # Problem → Agitate → Solve copy block
    VideoSection.tsx       # demo player card (gold border)
    HowItWorks.tsx         # interactive 4-step product tour
    Testimonials.tsx       # auto-scroll testimonial cards
    Pricing.tsx            # 3 tiers, gold-highlighted middle
    FinalCta.tsx           # Kennedy-style close
    Footer.tsx
    Reveal.tsx             # scroll-reveal helper
    icons.tsx              # inline SVG icon set (no emoji as UI)
```

## Hero visual

The cinematic background glow (`public/assets/hero-glow.png`) is AI-generated —
abstract atmosphere only, no text/faces. The **floating dashboard itself is
hand-built React/SVG** (`DashboardMockup.tsx`) rather than an AI image, so the
UI text stays crisp, on-brand, and editable at every resolution.

## API wiring (next phase)

This is the landing page only. Markers in the code show where the real
generation flow plugs in once you move into the app shell:

- `src/components/HowItWorks.tsx` — the 4-step tour maps to the live flow:
  upload → style params → **Anthropic (Claude director) writes the prompt →
  Seedance/Higgsfield renders** → download / push to Meta·TikTok.
- Keys (`ANTHROPIC_API_KEY`, `SEEDANCE_API_KEY`) load **server-side only** —
  never ship them to the client.

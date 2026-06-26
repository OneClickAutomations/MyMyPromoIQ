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
    HowItWorks.tsx         # interactive 4-step product tour (explainer)
    Generator.tsx          # LIVE generation flow — calls the API, polls, plays result
    Testimonials.tsx       # auto-scroll testimonial cards
    Pricing.tsx            # 3 tiers, gold-highlighted middle
    FinalCta.tsx           # Kennedy-style close
    Footer.tsx
    Reveal.tsx             # scroll-reveal helper
    icons.tsx              # inline SVG icon set (no emoji as UI)
  lib/api.ts               # front-end client for /api/generate + /api/status

netlify/
  functions/generate.ts    # Claude directs + Higgsfield submit
  functions/status.ts      # poll render status by id
  lib/director.ts          # shared: styles, Claude director, Higgsfield calls
netlify.toml               # build, functions dir, /api/* redirects, SPA fallback
```

## Hero visual

The cinematic background glow (`public/assets/hero-glow.png`) is AI-generated —
abstract atmosphere only, no text/faces. The floating dashboard is a **hybrid**:
the chrome, sidebar, render queue and labels are **hand-built React/SVG**
(`DashboardMockup.tsx`) so UI text stays crisp at every resolution, while the
preview + variant tiles are **real AI-generated cinematic ad frames**
(`public/assets/ad-*.jpg`) so the hero reads as a studio actively producing
publish-ready commercials — not a wireframe. One tile is intentionally left in
an "actively rendering" state (fire-tinted scanning shimmer) to show a live
generation in progress.

## Live generation pipeline

The page ships with a **real, working** generation flow (`#generate`,
`src/components/Generator.tsx`) backed by Netlify Functions. Keys stay
**server-side only** — they never reach the React bundle.

```
Browser (Generator.tsx)
  │  POST /api/generate { productImageUrl, productDescription, style, quality }
  ▼
netlify/functions/generate.ts
  │  1. Claude (claude-opus-4-8) writes the cinematic motion prompt   ← ANTHROPIC_API_KEY
  │  2. Submit Higgsfield image-to-video job (non-blocking)           ← HF_API_KEY / HF_API_SECRET
  ▼  → { requestId, directorPrompt }
Browser polls  GET /api/status?id=<requestId>
  ▼
netlify/functions/status.ts → GET platform.higgsfield.ai/requests/{id}/status
  ▼  → { status, videoUrl }  →  <video> + Download
```

Why async? Renders take 1–3 minutes — far longer than a serverless function
may run — so submit and poll are split into two endpoints.

Shared provider logic (Claude director prompt, Higgsfield submit/poll, the
UGC style presets) lives in `netlify/lib/director.ts`.

### Environment variables (server-side only)

Set these in **Netlify → Site settings → Environment variables**, and in a
local `.env` (gitignored) for `netlify dev`. See [`.env.example`](./.env.example).

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude "director" that writes the video prompt |
| `HF_API_KEY` + `HF_API_SECRET` | Higgsfield image-to-video (or `HF_CREDENTIALS="id:secret"`) |

### Run with the functions locally

```bash
npm i -g netlify-cli   # once
netlify dev            # serves the SPA + /api/* functions together
```

`npm run dev` alone runs the front end only; the `/api/*` calls need
`netlify dev` (or a deploy) to reach the functions.

### Notes / next phase

- The generator takes a **public image URL**. To accept direct uploads,
  add a storage step (S3, Cloudinary, Netlify Blobs) that returns a public
  URL, then pass it as `productImageUrl`.
- `src/components/HowItWorks.tsx` is the *explainer*; `Generator.tsx` is the
  real thing. The "push to Meta/TikTok" step is left for the app-shell phase.

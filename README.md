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

api/                       # Vercel serverless functions (the production backend)
  generate.ts              # Claude directs + Veo 3 / Higgsfield submit
  status.ts                # poll render status by id
  modelsheet.ts            # Gemini image gen/edit + turnaround sheets
  voiceover.ts             # ElevenLabs voices (GET) + TTS (POST)
  discover.ts              # ad search + Meta CDN image proxy
  sourcing.ts              # AliExpress sourcing + actor schema introspection
  mux.ts · stitch.ts · presign.ts · store.ts · director.ts · analyze-ad.ts
vercel.json                # build, function config, /api/* + SPA routing
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

The app ships with a **real, working** generation flow backed by **Vercel
serverless functions** (`api/`). Keys stay **server-side only** — they never
reach the React bundle.

```
Browser
  │  POST /api/generate { productImageUrl, productDescription, style, quality }
  ▼
api/generate.ts
  │  1. Claude writes the cinematic motion prompt                     ← ANTHROPIC_API_KEY
  │  2. Submit the video job (non-blocking):
  │       VIDEO_PROVIDER=veo3 (default) → Veo 3, native audio         ← GEMINI_API_KEY
  │       VIDEO_PROVIDER=higgsfield     → Higgsfield                  ← HF_API_KEY / HF_API_SECRET
  ▼  → { requestId, directorPrompt }
Browser polls  GET /api/status?id=<requestId>
  ▼
api/status.ts → polls the provider; re-hosts the finished clip to Supabase
  ▼  → { status, videoUrl }  →  <video> + Download
```

Why async? Renders take 1–3 minutes — far longer than a serverless function
may run — so submit and poll are split into two endpoints.

### Environment variables (server-side only)

Set these in **Vercel → Settings → Environment Variables**, and in a local
`.env` (gitignored). See [`.env.example`](./.env.example).

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude "director" that writes the video prompt |
| `GEMINI_API_KEY` | Veo 3 video **and** Gemini image generation (model sheets, Creator/Product studios) |
| `ELEVENLABS_API_KEY` | AI voiceovers |
| `SUPABASE_SERVICE_KEY` | Image/video uploads + re-hosting renders |
| `APIFY_TOKEN` | Discovery (Meta Ad Library) + AliExpress sourcing |
| `HF_API_KEY` + `HF_API_SECRET` | Only if `VIDEO_PROVIDER=higgsfield` |

> Vercel Hobby caps deployments at **12 serverless functions** and **60s**
> max duration — the `api/` set is kept at exactly 12 (some endpoints fold
> multiple modes into one function) for this reason.

### Run locally

```bash
npm run dev            # front end (Vite)
npm run dev:vercel     # SPA + /api/* functions together (vercel dev)
```

`npm run dev` alone runs the front end only; the `/api/*` calls need
`vercel dev` (or a deploy) to reach the functions.
- `src/components/HowItWorks.tsx` is the *explainer*; `Generator.tsx` is the
  real thing. The "push to Meta/TikTok" step is left for the app-shell phase.

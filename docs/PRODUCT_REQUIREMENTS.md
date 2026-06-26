# MyPromoIQ — Product Requirements Document (PRD)

**Version 2.0 of the concepts demonstrated in `krusemediallc/arcads-claude-code`.**
The repository is inspiration and a starting point — not the finished product. Every
feature in it was evaluated with one question: *"Can this make MyPromoIQ better?"* If
yes, it was preserved and improved. If no, it was replaced with something superior.

> Companion docs:
> - `PRODUCT_ARCHITECTURE_ANALYSIS.md` — the subsystem-by-subsystem teardown of the
>   inspiration repo and the engineering rationale behind the choices below. Read it for
>   the *why*; read this for the *what* and the *when*.
>
> Status: **living document.** Owner: product. Last revised: 2026-06-26.

---

## 0. How to read this document

| Section | Answers |
|---|---|
| 1. Vision & positioning | What MyPromoIQ is, who it's for, why it wins |
| 2. Product principles | The non-negotiable rules every feature obeys |
| 3. Information architecture | How the app is organized; the screen map |
| 4. Screens (spec) | Every major screen, in detail |
| 5. AI workflows | Every model-driven workflow, end to end |
| 6. Generation pipelines | The technical render/compose pipelines |
| 7. Feature hierarchy | What's core vs. supporting vs. future |
| 8. User flows | The canonical journeys, step by step |
| 9. Release plan | MVP (v2.0) vs. v2.x vs. v3 |
| 10. How the pieces fit | The system diagram in prose |
| 11. Data model | The core entities |
| 12. Non-functional requirements | Security, performance, cost, accessibility |
| 13. Open questions | Decisions still to be made |

---

## 1. Vision & positioning

### 1.1 One-sentence vision
**MyPromoIQ is an AI creative studio that turns a product and a sentence into a
complete, agency-quality UGC video commercial — scripted, cast, shot, storyboarded,
editable scene-by-scene, and ready to publish — in minutes, for any niche and any
creator.**

### 1.2 The shift from the inspiration repo
The repo is a *power-user's toolkit*: Claude Code "skills" (Markdown + bash) wrapping a
hosted render API, driven from an editor by a technical operator. It has no UI, no
server, no database, no auth, no billing, no multi-tenancy. It is excellent at being an
internal tool and structurally incapable of being a product a non-technical buyer pays
for.

**MyPromoIQ inverts that.** The skill logic becomes server-side services. The operator
persona becomes an end user with a browser. We borrow their workflow *intelligence*
(prompt formulas, cost-preview discipline, asset/reference handling, multi-beat
stitching, Meta publishing) and graft it onto a true multi-tenant web app with a premium
visual language.

### 1.3 Target users
| Persona | Job to be done | Today's pain |
|---|---|---|
| **DTC founder / operator** (primary) | Ship more ad creative without hiring creators or an agency | $5K retainers, 3-week turnarounds, can only test 2 variants |
| **Performance marketer / agency** | Generate many on-brand variants per brand, fast | Creative is the bottleneck on testing velocity |
| **Solo creator / freelancer** | Offer "UGC ads" as a service without filming | Can't scale shoots; inconsistent talent |

Explicit non-goal for v2.0: the technical solo operator who is happy in a terminal —
that user is well served by the inspiration repo itself.

### 1.4 Why we win
1. **Output-first.** The user gets a finished video; we hide the wiring. (The repo
   exposes the wiring as the interface.)
2. **Premium, alive UI.** It should feel like walking into a modern AI creative studio,
   not opening SaaS software.
3. **Any creator, any niche.** Diverse, consistent AI creators across a whole
   storyboard — demonstrated on the landing page, delivered in the product.
4. **Provider-agnostic render layer.** A `VideoProvider` abstraction (Higgsfield, Arcads,
   future models) means we route to the best/cheapest model per job, never locked in.
5. **A closing data loop.** Prompt template → render → downstream ad performance, which
   becomes a defensible moat the toolkit can't build.

---

## 2. Product principles (non-negotiable)

1. **Every frame looks finished.** No placeholder thumbnails, no wireframe blocks. Every
   visible tile is a believable advertisement.
2. **Consistency across a storyboard is sacred.** The same creator, wardrobe, lighting,
   product, and branding hold across all six scenes of a campaign.
3. **The interface is the product, the chat is a copilot.** A visual project canvas is
   the primary surface; conversational direction is optional, never required.
4. **Spend is always previewed.** No expensive generation happens without a credit/cost
   estimate and an explicit confirm. (Borrowed and elevated from the repo's cost-preview
   discipline.)
5. **Keys stay server-side.** No provider key (`ANTHROPIC_API_KEY`, `HF_*`,
   `ARCADS_API_KEY`) ever reaches the React bundle. All generation is brokered by Netlify
   Functions.
6. **Design language is fixed.** Near-black canvas (bg-void), warm fire gradient
   (#FF6B35 → #E8341C), gold accent (#F2B84B), soft glows, elegant shadows, subtle
   depth. **Hard constraint: no purple, lavender, violet, or indigo anywhere.**
7. **Diversity is a first-class feature, not decoration.** The product must visibly
   generate authentic creators across demographics.

---

## 3. Information architecture

### 3.1 Top-level surfaces
```
MyPromoIQ
├── Marketing site (public)
│   ├── Landing page  ← hero showcase + UGC showcase + product/how/pricing
│   ├── Examples gallery (v2.x)
│   └── Auth (login / signup)
│
└── Application (authenticated)
    ├── Dashboard / Campaigns list        ← home after login
    ├── Campaign Studio (the canvas)       ← the core screen
    │   ├── Product & brief panel
    │   ├── Storyboard (6-scene board)
    │   ├── Scene editor (per-beat)
    │   ├── Variant tray
    │   └── Director copilot (optional chat)
    ├── Creator Library                    ← saved/generated AI creators
    ├── Asset Library                      ← products, brand kits, references
    ├── Render Queue / Activity            ← live jobs, history, cost ledger
    ├── Publish & Integrations             ← Meta/TikTok ad accounts, exports
    ├── Approvals / Review (v2.x)          ← client/teammate sign-off
    ├── Analytics (v3)                     ← creative → performance loop
    └── Settings                           ← billing, team, brand, providers
```

### 3.2 Navigation model
- **Persistent left sidebar** in the app: Campaigns, Creators, Assets, Queue, Publish,
  Analytics (v3), Settings. Status badge + monthly generation counter at the bottom (the
  StudioMockup chrome already prototypes this).
- **Campaign Studio is full-bleed**, opened from the Campaigns list. The sidebar
  collapses to maximize canvas.
- **Command-style copilot** is dockable on the right inside the Studio.

---

## 4. Screens (specification)

For each screen: *purpose · key elements · primary actions · states.*

### 4.1 Landing page (public) — **shipped, ongoing**
- **Purpose:** Make a visitor believe MyPromoIQ generates agency-quality campaigns for
  any niche/creator, before they ask.
- **Sections (in order):** Navbar · Hero (live studio window, female mixed-complexion
  creator, skincare) · SocialProof · Problem (PAS) · VideoSection · HowItWorks ·
  **ShowcaseUGC** (second live studio window, African-American male creator, hydration
  brand) · Generator (real, live generation) · Testimonials · Pricing · FinalCta ·
  Footer.
- **The two showcases share one component** (`StudioMockup`) so the visual language is
  literally identical — only the campaign data differs. This is the "another live
  example" effect, not repetition.
- **States:** the in-progress scene tile shows a fire-tinted scanning shimmer and a live
  percent; completed tiles are finished frames.

> The "Premium AI UGC Showcase" brief (diverse creator, six-scene storyboard, cinematic
> quality, `Authentic UGC. Real Creators. Unlimited Possibilities.` messaging) is
> implemented by `ShowcaseUGC.tsx` + `StudioMockup.tsx` and is the visual benchmark for
> the in-app Studio below.

### 4.2 Auth (login / signup)
- **Purpose:** Get the user into the app with the least friction; honor "first 3 videos
  free, no card."
- **Elements:** email + OAuth (Google), magic-link option; signup captures nothing more
  than email at first.
- **States:** logged-out, verifying, error, first-run (→ guided new-campaign flow).

### 4.3 Dashboard / Campaigns list — **app home**
- **Purpose:** See every campaign and start a new one in one click.
- **Elements:** "New Campaign" primary CTA; grid of campaign cards (poster frame, name,
  niche, status: draft / rendering / ready / published, scene count, last edited);
  monthly usage meter; quick filters (status, niche).
- **Primary actions:** New campaign, open campaign, duplicate, archive.
- **States:** empty (first-run hero CTA), populated, rendering-in-progress badges live.

### 4.4 Campaign Studio (the canvas) — **the core screen**
The single most important screen. Mirrors the premium `StudioMockup` aesthetic exactly.

- **Layout:** product/brief rail (left) · storyboard board (center) · scene editor +
  variant tray (right/drawer) · director copilot (dockable right).
- **Product & brief panel:** product image(s), one-sentence description, niche, chosen
  **style** (Testimonial / Unboxing / Day-in-the-life / Fast-cut), chosen **creator**
  (from Creator Library), aspect ratio, target platform, quality tier (Lite / Turbo /
  Standard). A live **cost preview** updates as choices change.
- **Storyboard board:** the six-scene storyboard as cards in order — Hook · Hold product
  to camera · Product close-up · Demonstration · Lifestyle · Testimonial/CTA. Each card
  shows its frame, label, duration, and status (done / rendering % / queued).
- **Per-scene actions:** regenerate this beat, edit prompt, swap creator/wardrobe, lock
  scene (so consistency anchors hold), reorder, add/remove beat.
- **Variant tray:** for a selected scene, a row of alternate takes to compare and promote
  the winner.
- **Global actions:** Generate all · Generate selected · Approve · Export · Publish.
- **States:** drafting, estimating cost, rendering (live progress per beat), partial
  failure (one beat failed → retry just that beat), complete, approved, published.

### 4.5 Scene editor (per-beat)
- **Purpose:** Fine control of a single scene without breaking campaign consistency.
- **Elements:** the director prompt (editable), the consistency anchors that are locked
  (creator identity, wardrobe, product, palette), camera/motion notes, duration,
  caption/overlay text, voiceover selection.
- **Primary actions:** regenerate, regenerate-with-changes, revert to previous take,
  promote a variant, lock/unlock anchors.

### 4.6 Creator Library
- **Purpose:** Browse, generate, and reuse consistent AI creators across demographics.
- **Elements:** creator cards (portrait, name/handle, demographic tags, "consistency
  seed"); "Generate new creator" with controls for ethnicity, age range, gender,
  build/style, vibe; saved creators reusable across campaigns.
- **Primary actions:** generate creator, save, tag, set as campaign lead.
- **Why it matters:** this is how "any creator, any audience" becomes a product feature
  and not just a landing-page claim. Consistency seeds are what keep the same face across
  all six storyboard frames.

### 4.7 Asset Library
- **Purpose:** Manage products, brand kits, and reference images.
- **Elements:** product entries (image, name, description, URL), brand kits (logo, color,
  tone of voice, CTA phrasing), reference images for style transfer. Handles single-use
  presigned uploads where the provider requires them (Arcads).
- **Primary actions:** upload, edit brand kit, attach to campaign.

### 4.8 Render Queue / Activity
- **Purpose:** One place to watch live jobs and audit history + spend.
- **Elements:** active jobs with live status/percent; history table; an append-only
  **cost ledger** (per render: provider, model, quality, credits/cost, duration,
  outcome). Borrowed from the repo's `logs/arcads-api.jsonl` discipline, elevated to a
  real activity view.
- **Primary actions:** retry, cancel (where supported), open the resulting scene.

### 4.9 Publish & Integrations
- **Purpose:** Get the finished campaign out — download or push to ad accounts.
- **Elements:** export (per scene or stitched master, resolution/aspect options),
  connected ad accounts (Meta, TikTok), publish targets, watermark toggle (gated by
  plan).
- **Primary actions:** download, publish to Meta/TikTok, copy share link.

### 4.10 Approvals / Review (v2.x)
- **Purpose:** Let a teammate or client sign off before publish.
- **Elements:** shareable review link, per-scene approve/request-changes, comment
  threads, approval status on the campaign.

### 4.11 Analytics (v3)
- **Purpose:** Close the loop — tie template/creator/scene choices to CTR/ROAS.
- **Elements:** per-campaign and per-variant performance, "what's converting" rollups,
  template leaderboard feeding back into the director.

### 4.12 Settings
- **Purpose:** Billing, team, brand defaults, provider configuration.
- **Elements:** plan & usage, payment, team seats/roles, default brand kit, **active
  video provider** (Higgsfield / Arcads) and model routing policy, API access (Studio
  plan).

---

## 5. AI workflows

Each workflow is model-driven and brokered server-side. The **director** is Claude Opus
(`claude-opus-4-8`, adaptive thinking); the **renderer** is whichever `VideoProvider` is
active.

### 5.1 Director: brief → cinematic motion prompt — **shipped**
Input: product description + chosen style. Output: one tight image-to-video motion
prompt. Lives in `netlify/lib/director.ts::writeDirectorPrompt`. This is the quality
multiplier the repo proved out with its validated prompt formulas — we generate the
formula per-job instead of shipping static Markdown.

### 5.2 Single-scene generation — **shipped (backbone)**
Director writes the prompt → `submitVideoJob` (active provider) → poll
`getVideoStatus` → finished clip. Already wired through the `VideoProvider` abstraction
(`submit` / `poll` / `capabilities` / `estimateCost`).

### 5.3 Storyboard generation (six consistent scenes) — **v2.0 core**
1. Director plans a six-beat storyboard from the brief (Hook → CTA), each beat with its
   own motion prompt and shared **consistency anchors** (creator seed, wardrobe, product,
   palette).
2. The system generates all six in parallel through the provider, passing the consistency
   anchors so the same creator/look holds across every frame.
3. Per-beat status streams into the storyboard board; failed beats retry independently.
- This is the in-app version of the landing-page storyboard, made real and editable.

### 5.4 Creator generation & consistency — **v2.0 core**
Generate a creator from demographic controls, store a **consistency seed/reference**, and
reuse it as the identity anchor across a campaign's scenes. This is what makes "any
creator, perfectly consistent" deliverable, not just shown.

### 5.5 Scene regeneration & variants — **v2.0 core**
Regenerate a single beat (optionally with prompt changes) without disturbing locked
anchors; collect alternates in a variant tray; promote the winner.

### 5.6 Caption / overlay & voiceover — **v2.x**
Auto-captions and optional AI voiceover per scene (vidIQ voiceover tooling is a candidate
provider). Validated dialogue before render, echoing the repo's auto-validation step.

### 5.7 Stitch & master export — **v2.x**
Compose approved beats into a single vertical master (transitions, captions, music bed).
The repo does this with FFmpeg locally; we do it server-side as a compose service.

### 5.8 Publish to Meta/TikTok — **v2.x**
Push the master or per-scene assets to connected ad accounts.

### 5.9 Performance feedback loop — **v3**
Ingest downstream CTR/ROAS, attribute to template/creator/scene, rank, and feed the
director. The defensible data moat.

---

## 6. Generation pipelines (technical)

### 6.1 Provider abstraction — **shipped**
`netlify/lib/providers/` defines a typed `VideoProvider` interface (`submit`, `poll`,
`capabilities`, `estimateCost`). Adapters: `HiggsfieldAdapter`, `ArcadsAdapter`. A
`getProvider()` registry selects the active provider via `VIDEO_PROVIDER`. Model-specific
quirks are encoded as data/behavior in the adapter (e.g. Arcads Seedance polls
`/v1/assets/{id}`, others poll `/v1/videos/{id}`) — not tribal prose. This is the single
biggest architecture lesson taken from the repo.

### 6.2 Async submit/poll split — **shipped**
`POST /api/generate` (director + submit, returns `requestId`) and `GET /api/status?id=`
(poll) keep functions inside serverless time limits. Frontend client `src/lib/api.ts`
(`startGeneration`, `checkStatus`, `pollUntilDone`).

### 6.3 Storyboard fan-out — **v2.0**
Director returns six beats → submit six jobs → track six `requestId`s on the campaign →
poll until each completes → render into the board. Consistency anchors travel with every
submit.

### 6.4 Asset upload pipeline — **v2.x**
For providers requiring presigned uploads (Arcads): request presigned URL → PUT to S3 →
pass `filePath` (single-use) into the generate call. Encapsulated in the adapter.

### 6.5 Cost estimation — **v2.0**
`estimateCost(duration, quality)` per provider powers the live cost preview before any
generation; the render queue records actuals into the ledger.

### 6.6 Compose pipeline — **v2.x**
Server-side stitch (FFmpeg-equivalent service): ordered beats + captions + music →
master MP4 (1080×1920).

---

## 7. Feature hierarchy

### 7.1 Core (the product is nothing without these)
- Campaign Studio canvas
- Director (brief → prompt)
- Storyboard generation with cross-scene consistency
- Creator generation + reusable consistency seeds
- Per-scene regenerate + variants
- Cost preview + render queue/ledger
- Provider abstraction (Higgsfield/Arcads)
- Auth, billing, multi-tenancy

### 7.2 Supporting (make it premium and sticky)
- Asset library + brand kits
- Captions/overlays + voiceover
- Stitch/master export
- Publish to Meta/TikTok
- Approvals/review

### 7.3 Future (moat & expansion)
- Performance feedback loop / analytics
- Template marketplace + A/B-tested prompt library
- More creator demographics, ages, styles; multi-creator scenes
- Static image-ad formats (iMessage/Notes/comparison templates — from the repo's 37
  templates, rebuilt as a service)
- API access, client workspaces, white-label

---

## 8. User flows

### 8.1 First-run: signup → first finished video (MVP happy path)
1. Visitor clicks a landing CTA → signup (email/OAuth), no card.
2. Guided new-campaign: upload product (image/URL/sentence) → pick style → pick or
   generate a creator → see cost preview (free credits applied).
3. Confirm → storyboard generates; beats stream in live.
4. Review the board; regenerate any weak beat; promote variants.
5. Export or download. (Publish/stitch may be v2.x.)
- **Success metric:** time-to-first-finished-scene < 3 minutes.

### 8.2 Power: many variants for testing
1. Open an existing campaign → duplicate.
2. Swap creator or style; regenerate selected beats.
3. Compare variants in the tray; promote winners.
4. Bulk export / push to ad account.

### 8.3 Agency: brand kit → consistent campaigns
1. Set up brand kit (logo, palette, voice, CTA) in Asset Library.
2. New campaign auto-applies the kit; generate storyboard.
3. Send review link → client approves per scene.
4. Publish to the client's connected ad account.

### 8.4 Provider switch (operator/admin)
1. Settings → set active provider / model routing policy.
2. New generations route accordingly; the ledger records provider+model+cost.
- No code change, no key in the bundle (`VIDEO_PROVIDER` env var).

---

## 9. Release plan

### 9.1 MVP — v2.0 (the studio is real)
- Landing page with both premium showcases ✅ (shipped/ongoing)
- Auth + multi-tenant accounts + billing (first 3 free)
- Campaign Studio canvas
- Director ✅, single-scene generation ✅, **storyboard generation with consistency**
- Creator generation + reusable seeds
- Per-scene regenerate + variants
- Cost preview + render queue/ledger
- Provider abstraction ✅ (Higgsfield + Arcads)
- Export/download

### 9.2 v2.x (premium + distribution)
- Asset library + brand kits
- Captions/overlays + voiceover
- Stitch/master export
- Publish to Meta/TikTok
- Approvals/review workflow
- Examples gallery on the marketing site

### 9.3 v3 (moat)
- Performance feedback loop + analytics
- Template marketplace / A/B-tested prompt library
- Static image-ad formats
- API access, client workspaces, white-label
- Expanded creator demographics + multi-creator scenes

---

## 10. How the pieces fit (system, in prose)

The **React/Vite/Tailwind** front end is the studio: a marketing site for acquisition and
an authenticated app whose center of gravity is the **Campaign Studio canvas**. The
canvas never talks to a model directly. It calls **Netlify Functions** (`/api/generate`,
`/api/status`, and the v2.x compose/publish endpoints), which hold all secrets.

Inside the functions, **`director.ts`** owns the Claude director (brief → prompt) and
delegates rendering to the **`VideoProvider`** selected by `getProvider()`. Swapping
Higgsfield for Arcads — or routing per-job to the cheapest capable model — is a config
change, because every provider quirk is sealed inside its adapter.

A **campaign** is the unit of work: a product + brand kit + creator + six scenes, each
scene a job with its own `requestId`, consistency anchors, prompt, and variants. The
**render queue** watches jobs and writes a **cost ledger**; the **creator** and **asset**
libraries supply the reusable consistency that makes every storyboard frame look like the
same commercial. In v3, the **analytics loop** feeds ad performance back to the director,
turning accumulated campaigns into a data advantage the original toolkit could never
build.

The result is the objective stated in the brief: it should feel less like SaaS software
and more like walking into a modern AI creative studio — where every screen silently
answers *"what kinds of commercials can this platform create?"* with the visuals alone.

---

## 11. Data model (core entities)

| Entity | Key fields | Notes |
|---|---|---|
| **Account / Org** | id, plan, credits, members | Multi-tenant root |
| **User** | id, email, role, orgId | Auth subject |
| **BrandKit** | id, logo, palette, voice, ctaPhrasing | Attaches to campaigns |
| **Product** | id, name, description, images[], url | From Asset Library |
| **Creator** | id, portrait, demographics, **consistencySeed** | Reusable identity anchor |
| **Campaign** | id, name, niche, style, productId, creatorId, brandKitId, status | The unit of work |
| **Scene** | id, campaignId, order, label, prompt, anchors, duration, status, variants[] | A storyboard beat |
| **RenderJob** | id, sceneId, provider, model, quality, requestId, status, cost | One generation |
| **LedgerEntry** | id, jobId, provider, model, credits/cost, duration, outcome, ts | Append-only audit |
| **PublishTarget** | id, type (meta/tiktok), accountRef | Integrations |

---

## 12. Non-functional requirements

- **Security:** all provider keys server-side only; never in the React bundle. Per-org
  data isolation. Presigned uploads single-use.
- **Performance:** time-to-first-finished-scene < 3 min; storyboard fan-out parallelized;
  async submit/poll to stay within serverless limits.
- **Cost control:** mandatory cost preview before generation; per-job ledger; plan-based
  quotas.
- **Reliability:** independent per-beat retry; partial-failure never blocks the rest of a
  storyboard.
- **Accessibility:** WCAG AA contrast on the dark theme; keyboard-navigable canvas.
- **Brand integrity:** the fixed palette and "no purple/violet/indigo" constraint apply
  to every screen and every generated UI surface.

---

## 13. Open questions

1. **Billing model:** credits vs. seats vs. video-count tiers (current pricing copy uses
   video-count) — reconcile with provider credit costs.
2. **Creator likeness/rights:** policy and disclosure for AI-generated creators; do we
   offer consistent "owned" creators per account?
3. **Provider routing policy:** manual selection vs. automatic cost/quality routing in
   v2.0 — start manual?
4. **Compose location:** server-side FFmpeg service vs. a provider that returns stitched
   masters.
5. **Performance data source (v3):** native pixel/ad-account integration vs. user-reported
   metrics for the feedback loop.
6. **Examples gallery:** real generated campaigns vs. curated showcase set at launch.

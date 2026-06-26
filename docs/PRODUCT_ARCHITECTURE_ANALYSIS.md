# MyPromoIQ — Architecture Analysis & Premium Roadmap

**A teardown of `krusemediallc/arcads-claude-code`, and what MyPromoIQ should learn, avoid, and out-build.**

> Source studied: public repo README + `skills/arcads-external-api/reference.md` (Arcads external API contract). This is analysis only — no code was copied. MyPromoIQ remains an original product with its own workflow.

---

## 0. The single most important insight

**Arcads-claude-code is not a product. It is a power-user's toolkit.**

It's a collection of **Claude Code / Cursor "skills"** — Markdown instruction files plus bash scripts — that wrap the hosted **Arcads external API**. The "runtime" is the operator's coding agent. There is:

- no web UI,
- no application server of its own,
- no database,
- no authentication system (it borrows the Arcads account + API key),
- no multi-tenancy,
- no billing of its own (it rides Arcads credits).

State is **files on disk**: `MASTER_CONTEXT.md` (workspace memory), `logs/arcads-api.jsonl` (append-only cost ledger), `references/` (local input images). The whole thing is a beautifully organized **single-operator, file-based, agent-native control surface** over someone else's render farm.

That framing dictates everything below. It is *excellent* at what it is (a technical solo operator or boutique agency driving Arcads from an editor) and *structurally incapable* of being a commercial SaaS without a ground-up app layer. **That gap is exactly MyPromoIQ's opportunity.** Arcads-claude-code is the world's best *internal tool*; MyPromoIQ should be the *product* a non-technical buyer pays for.

MyPromoIQ today already has the thing they deliberately don't: a real front end, a server, and a hosted generation pipeline. The strategic move is to **borrow their workflow intelligence (prompt formulas, cost-preview discipline, asset/reference handling, multi-beat stitching, Meta publishing) and graft it onto a true multi-tenant app.**

---

## 1. Subsystem-by-subsystem teardown

For each: *what problem it solves · why they built it that way · tradeoffs · what I'd improve · what I'd redesign for SaaS.*

### 1.1 Overall product architecture
- **Problem solved:** Give a Claude Code user a repeatable, expert way to drive a complex multi-model render API without memorizing its quirks.
- **Why this way:** Skills-as-Markdown means the "app" *is* the prompt context. Zero hosting, zero infra, instantly forkable, MIT-licensed. Distribution = `git clone`.
- **Tradeoffs:** No GUI → unusable by the actual ad buyer persona. No server → no scheduled jobs, webhooks, or shared state. "Install" requires Python, FFmpeg, jq, Node, Whisper, an editor, and an API key. Onboarding is a developer ritual, not a signup.
- **Improve:** Even as a toolkit, dependency sprawl (Whisper + FFmpeg + jq + npx) is brittle; containerize it.
- **Redesign for SaaS:** Invert it. The skill logic becomes **server-side services**; the operator persona becomes an **end user with a browser**. Keep the modularity (one capability = one service), drop the file-as-database model.

### 1.2 User workflow
- **Problem solved:** Turn "I want an ad" into a guided sequence: setup → product context → pick formula → validate → generate → (optionally) stitch + caption → publish to Meta.
- **Why this way:** The agent walks the user conversationally; `MASTER_CONTEXT.md` remembers defaults (product, brand voice, folder, typical costs) so repeat runs are fast.
- **Tradeoffs:** Conversational-only means no visual review, no timeline scrubbing, no side-by-side variant comparison, no "regenerate just this beat" button. Everything is a turn in a chat.
- **Improve:** Add explicit checkpoints/approvals between expensive steps (they partly do this with cost preview).
- **Redesign for SaaS:** A **project canvas**: product on the left, storyboard beats as cards, per-beat regenerate, variant trays, one-click publish. The conversation becomes an *optional* copilot, not the only interface.

### 1.3 AI pipeline (model orchestration)
- **Problem solved:** Route a creative request to the right model among ~10 (Seedance 2.0, Sora 2/Pro, Veo 3.1, Kling 3.0, Grok Video, Nano Banana 2/Pro, GPT Image 2, OmniHuman, audio-driven).
- **Why this way:** Arcads exposes a *unified* `POST /v2/videos/generate` with a `model` enum, so the skill mostly has to know per-model parameter rules and polling quirks.
- **Tradeoffs:** Model knowledge lives in prose (`reference.md`) — e.g. "Seedance returns `type: seedance_20` and must be polled at `/v1/assets/{id}`, not `/v1/videos/{id}` (404)"; "Veo/Sora/Grok have an image-input 500 regression — fall back to Kling/Seedance." That's **tribal knowledge encoded as docs**, not as a typed capability matrix. It rots silently.
- **Improve:** Encode the model matrix as **data** (duration enums, max referenceImages, startFrame support, audio support, polling route, known-outages) with a validation layer that fails *before* spending credits.
- **Redesign for SaaS:** A **provider-abstraction layer** with a `VideoProvider` interface (`submit`, `poll`, `capabilities`, `estimateCost`). Arcads becomes one adapter; Higgsfield (MyPromoIQ's current backend) another; vidIQ images another. Model selection becomes a routing policy, not hardcoded prose. This is the single biggest architecture lesson for MyPromoIQ.

### 1.4 Prompt pipeline
- **Problem solved:** Quality of output is dominated by prompt quality, so they ship **5 validated Seedance prompt formulas** (UGC selfie, premium reveal, product hero, studio lookbook, feature walkthrough) and a **37-template static image-ad library** (fake iMessage, Apple Notes, Google-search, comparison tables, magazine covers, etc.).
- **Why this way:** Vendor-aligned prompt scaffolds dramatically raise hit-rate and cut credit waste. Dialogue is auto-validated before generation.
- **Tradeoffs:** Templates are static Markdown — versioned by hand, not A/B tested, no performance feedback loop. No notion of "this hook converted, that one didn't."
- **Improve:** Treat prompts as **versioned, measurable assets** with metadata (format, model, aspect, expected cost).
- **Redesign for SaaS:** A **prompt-template service** + a "director" model (MyPromoIQ already uses Claude Opus as the director) that *composes* from templates, **plus a feedback loop** that ties template → render → downstream ad performance (CTR/ROAS). That closes the loop they left open and becomes a defensible data moat.

### 1.5 Rendering pipeline
- **Problem solved:** Turn prompts into finished multi-beat ads: GPT storyboard → per-beat image-to-video → **FFmpeg stitch** → optional **caption burn-in** (HyperFrames + Whisper transcription + chroma-key overlay).
- **Why this way:** The heavy lifting (the actual video model) is hosted by Arcads; only stitching/captioning runs locally, which is cheap and deterministic.
- **Tradeoffs:** Local FFmpeg/Whisper means renders depend on the operator's machine, aren't reproducible across users, can't be queued or parallelized, and block the chat turn. No retry/resume on a failed beat. Credits for Seedance are **charged at create-time before the content checker runs** and **not refunded on a flag** — a real money risk handled only by pre-validation.
- **Improve:** Make stitching a server job with idempotent, resumable beats.
- **Redesign for SaaS:** A **render-orchestration service** with a durable job queue (one row per beat), per-beat retry, server-side FFmpeg/caption workers, and a **pre-flight moderation pass** *before* submitting to any provider that bills on create. Surface live progress over WebSocket/SSE.

### 1.6 Asset management
- **Problem solved:** Get reference media (influencer faces, product shots, aesthetics) into the model, and finished media back out.
- **Why this way:** Inputs live in `references/`; the API uses **presigned S3 upload** (`POST /v1/file-upload/get-presigned-url` → PUT → pass `filePath`). Auto-upscales references under 1024px.
- **Tradeoffs:** Two sharp edges they document: a presigned `filePath` is **single-use** (reuse → `400 REFERENCE_FILE_NOT_FOUND`), and there's **no media library** — outputs are URLs in logs, not a browsable, searchable, reusable catalog. No versioning, tags, rights, or reuse of a creator's likeness across campaigns.
- **Improve:** Cache/track presigned paths; never reuse.
- **Redesign for SaaS:** A first-class **Asset Library**: every input and output is a DB-backed object (owner, type, tags, source prompt, model, cost, derived-from lineage, usage rights), stored in your own bucket with CDN delivery and thumbnails. A "Creators" concept (a reusable, consistent character/face) becomes a headline premium feature — note MyPromoIQ already demonstrated *creator consistency* in the UGC showcase via face-chaining; productize that.

### 1.7 State management
- **Problem solved:** Remember defaults and what was generated.
- **Why this way:** `MASTER_CONTEXT.md` (human-readable memory) + `logs/arcads-api.jsonl` (append-only cost ledger) + a SessionStart hook that pulls upstream changes.
- **Tradeoffs:** File state is single-user, single-machine, not concurrent-safe, not queryable, lost if the folder is lost. Fine for one operator; impossible for teams.
- **Redesign for SaaS:** Postgres as system of record (users, orgs, products, projects, beats, assets, jobs, credits, events). The "context memory" idea is still great — reimplement it as a per-org **Brand Profile** (voice, palette, product catalog, do/don't) injected into the director automatically.

### 1.8 Component organization / reusable services
- **Problem solved:** Keep capabilities isolated and composable (`skills/` for core, `shared/skills/` for cross-cutting like captioning and Meta building).
- **Why this way:** One skill = one capability; `sync-skill.sh` propagates edits to `.claude/` and `.cursor/`. This is genuinely good modular thinking.
- **Tradeoffs:** "Reusable service" = shared Markdown + bash, not typed libraries; no tests, no interfaces, no semver.
- **Redesign for SaaS:** Keep the **one-capability-one-module** instinct; express it as typed services with contracts and tests (`providers/`, `prompt/`, `render/`, `assets/`, `publish/`, `billing/`).

### 1.9 API integrations
- **Problem solved:** Talk to Arcads (generation), Meta Marketing API (publishing), HyperFrames (captions), Whisper (transcription).
- **Why this way:** Basic-auth (`API_KEY` as username, empty password); Meta ads always created **paused** (a smart safety default).
- **Tradeoffs:** Integrations are invoked ad hoc from skills; no central client, no shared retry/backoff/rate-limit handling, no circuit breaker, secrets in `.env`.
- **Redesign for SaaS:** Centralized typed clients with retry/backoff/idempotency keys, secrets in a managed vault, and **webhooks** where providers support them (poll only as fallback). Keep "publish paused by default."

### 1.10 Data flow
- **Problem solved:** A clear path: setup → product → prompt → submit → poll → asset → (stitch/caption) → publish.
- **Tradeoffs:** Polling-only (no webhooks), synchronous to the chat turn, cost-charged-before-validation on some models, single-use upload paths — a fragile happy path with documented landmines.
- **Redesign for SaaS:** Event-driven. Submit → job row → provider webhook/poll worker → status events over SSE → asset persisted → publish. Every transition is an event you can audit, retry, and bill against.

### 1.11 Performance
- **Today:** Local FFmpeg/Whisper bottleneck; serial beats; chat-blocking; no caching of identical prompts/assets.
- **Redesign:** Parallelize beats, cache deduplicated renders, CDN for delivery, background workers so the UI never blocks. (MyPromoIQ already split submit/poll because renders exceed serverless timeouts — keep pushing that async-first instinct.)

### 1.12 Scalability
- **Today:** Fundamentally single-tenant. Scaling = "another human with another clone." No concurrency control, no quotas, no fairness.
- **Redesign:** Multi-tenant from row one (org_id on everything), per-org rate limits and credit quotas, a queue that fairly schedules across tenants, horizontal stateless workers.

### 1.13 Developer experience
- **Strong:** Skills + `MASTER_CONTEXT` + cost preview + audit log + SessionStart sync is a *delightful* operator DX. The prompt libraries are a real knowledge asset.
- **Weak (as a product team):** No types, no tests, no CI, behavior encoded in prose that drifts from the live API (they already track dated regressions by hand).
- **Redesign:** Typed monorepo, contract tests against provider sandboxes, the model-capability matrix as the single source of truth, generated SDKs.

### 1.14 Maintainability
- **Risk:** Provider quirks live in human-readable docs with dates ("as of 2026-04-09…"). When Arcads changes, the skill silently lies until someone notices.
- **Redesign:** Capabilities as data + a nightly **capability probe** that hits each provider's `docs-json`/health and flags drift automatically.

### 1.15 Extensibility
- **Strong idea:** Adding a model or ad format ≈ adding a skill/template. Low ceremony.
- **Limit:** Extends only *within* the agent-toolkit paradigm; can't add a billing plan, a team seat, or a dashboard widget.
- **Redesign:** A plugin-style **provider + template registry** so new models/formats are config, and a real app shell so new *product* surfaces (analytics, approvals, scheduling) are first-class.

---

## 2. What Arcads-claude-code does that MyPromoIQ should steal (conceptually)

1. **Cost preview before every spend.** They read historical `creditsCharged` and show an estimate first. MyPromoIQ should show "this campaign ≈ X credits / $Y" *before* the user hits generate. Huge trust + retention lever.
2. **Validated prompt formulas + a template library.** Don't free-text every render. Ship curated, named formats; let the Claude director compose from them.
3. **Pre-flight validation** (dialogue/content) before spending on providers that bill at create-time.
4. **Multi-beat storyboard → stitch → caption** as the unit of value (a *finished ad*), not a single clip.
5. **Meta publishing, always paused.** A real "last mile" that most generators skip — and a premium feature.
6. **Persistent brand/product memory** auto-injected into generation.
7. **Append-only audit log** of every generation (model, params, cost, output) — the backbone of analytics and billing.
8. **Provider fallback** when a model is degraded.

## 3. Where MyPromoIQ already wins (and should press the advantage)

- **It's an actual app**: React/TS front end, Netlify Functions backend, server-side keys, a real generation UI with polling. They have none of this.
- **Claude Opus as a true "director"** writing cinematic prompts (`netlify/lib/director.ts`) — a stronger creative brain than static templates alone.
- **Provider-agnostic instinct already present**: Higgsfield today; the user is open to Arcads. The codebase is small enough to introduce a clean provider interface *now*, before lock-in.
- **Premium visual storytelling**: the hero + UGC showcases with consistent AI creators already demonstrate the *outcome* buyers want — productize that as "Creators" and "Campaigns."
- **Demonstrated creator consistency** (face-chaining across a 6-frame storyboard) — Arcads leans on OmniHuman/references; MyPromoIQ can make "consistent creator across the whole ad" a marquee feature.

## 4. Gaps MyPromoIQ must close to be a premium SaaS

| Capability | Arcads-cc | MyPromoIQ today | Priority |
|---|---|---|---|
| Web app / GUI | ❌ | ✅ | — |
| Multi-tenant auth + orgs | ❌ | ❌ | **P0** |
| Database / system of record | ❌ (files) | ❌ | **P0** |
| Provider abstraction (multi-model) | partial (prose) | single (Higgsfield) | **P0** |
| Async job queue + webhooks | poll only | poll, no queue | **P0** |
| Direct uploads + Asset Library | refs only, no library | URL-only, no library | **P1** |
| Cost preview + credit metering | ✅ (log-based) | ❌ | **P1** |
| Prompt/template library + director | partial | director only | **P1** |
| Multi-beat storyboard + stitch/caption | ✅ (local) | ❌ | **P1** |
| Reusable "Creators" / brand memory | partial | demo only | **P2** |
| Meta/TikTok publishing | ✅ (Meta, paused) | ❌ | **P2** |
| Performance feedback loop (CTR/ROAS) | ❌ | ❌ | **P2 (moat)** |
| Analytics dashboard | ❌ | ❌ | **P2** |
| Tests / CI / capability probes | ❌ | minimal | **P1 (ongoing)** |

---

## 5. Prioritized roadmap — turning MyPromoIQ into the premium product

### Phase 0 — Foundations (make it a real SaaS) — **2–3 weeks**
1. **Auth + multi-tenancy**: users, orgs, seats (e.g. Clerk/Auth + Postgres). `org_id` on every row.
2. **Database as system of record** (Postgres/Supabase): users, orgs, products, projects, beats, assets, jobs, credits, events.
3. **Provider abstraction layer**: define `VideoProvider`/`ImageProvider` interfaces (`submit`, `poll`, `capabilities`, `estimateCost`). Refactor the current Higgsfield calls into a `HiggsfieldAdapter`; stub an `ArcadsAdapter`. **Model capabilities as data**, not prose.
4. **Async job model**: a `jobs` table + worker (or queue) so submit/poll/stitch are durable, retryable, and decoupled from request lifetime. Stream status via SSE.

### Phase 1 — The premium generation core — **3–4 weeks**
5. **Direct uploads + Asset Library**: presigned upload to your own bucket + CDN; every input/output is a tagged, browsable, reusable object with lineage and cost.
6. **Cost preview + credit metering**: per-render and per-campaign estimates *before* spend; an append-only `events` ledger (their best idea) powering billing + analytics.
7. **Prompt/template system**: named, versioned formats (testimonial, unboxing, day-in-life, fast-cut, product hero, comparison, etc.) that the Claude director composes from. Per-format model routing.
8. **Storyboard → stitched campaign**: promote the *finished multi-beat ad* (with optional captions) to the core unit. Server-side FFmpeg/caption workers, per-beat regenerate.
9. **Pre-flight moderation** before any create-time-billing provider.

### Phase 2 — Differentiation & moat — **4–6 weeks**
10. **Creators**: reusable, consistent AI presenters (lock a face/voice/wardrobe across a whole campaign and across campaigns) — productize the consistency you already demoed. This is a top-of-funnel wow feature.
11. **Brand Profiles**: per-org voice/palette/product catalog auto-injected into the director (their `MASTER_CONTEXT`, done right and multi-tenant).
12. **Publishing last mile**: push to Meta + TikTok ad accounts, **paused by default** (steal their safety default), with UTM/naming conventions.
13. **Performance feedback loop**: ingest CTR/ROAS back from ad platforms and tie it to template + creator + hook. **This closes the loop Arcads left open and becomes your data moat** — "our AI knows which hooks convert for your audience."
14. **Analytics dashboard**: spend, render volume, winning variants, cost-per-finished-ad.

### Phase 3 — Scale & enterprise — **ongoing**
15. Multi-provider routing policy (quality/cost/latency/availability) with automatic fallback (their degraded-model workaround, automated).
16. Team workflows: approvals, comments, roles, client workspaces (your Pricing already lists "Studio" — build it).
17. Reliability: capability probes against provider `docs-json`/health, contract tests, CI, observability.
18. Quotas, fair scheduling, and caching of deduplicated renders for margin.

---

## 6. Strategic one-liner

> **Arcads-claude-code is the expert toolkit; MyPromoIQ should be the product that expertise implies.** Keep their workflow intelligence — cost preview, validated prompt formats, multi-beat finished-ad output, brand memory, paused publishing, an audit ledger — and wrap it in what they deliberately omitted: a multi-tenant app, a provider-abstracted render farm, an asset/creator library, and a performance feedback loop. Win on **polish, reusability of creators/brands, and a closed loop from prompt → render → ad performance** — none of which a file-based, single-operator toolkit can ever do.

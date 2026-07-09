# MyPromoIQ — Higgsfield/Supabase Rebuild (staged)

Tracking doc for the full-stack rebuild. **All work lands on `claude/higgsfield-rebuild`,
never `main`,** so production keeps working until each stage is verified on its
preview deploy.

## Corrections to the original rebuild prompt (verified against reality)

| Prompt said | Actual |
|---|---|
| Framework is Next.js (`@clerk/nextjs`, `@supabase/auth-helpers-nextjs`, middleware) | **Vite + React SPA.** Supabase auth uses `supabase.auth.*` directly; no Next helpers/middleware. |
| Higgsfield base URL `api.higgsfield.ai` | **`https://platform.higgsfield.ai`** |
| Auth = single `HIGGSFIELD_API_TOKEN` Bearer | **`Authorization: Key {key}:{secret}`** — two credentials |
| Model names `seedance_2_0`, `nano_banana_pro`, `soul_cinema_studio` | Real slugs are `vendor/model/variant` (e.g. `higgsfield-ai/soul/standard`, `bytedance/seedream/v4/text-to-image`). Prompt names are product labels, not API IDs. |
| Create new `api/` files | **12-function cap is full.** New server logic inlines into existing `api/*.ts` or lives in `src/lib/` pure functions. |

## Env vars to set in Vercel (rebuild branch)

- `HIGGSFIELD_API_KEY` + `HIGGSFIELD_SECRET`  (per the official skills repo; the
  client also accepts the older `HIGGSFIELD_API_SECRET` spelling), or
- `HIGGSFIELD_API_TOKEN="key:secret"`  (combined fallback)
- Keep: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `ELEVENLABS_API_KEY`, `SUPABASE_*`
- Remove when its stage lands: `GEMINI_API_KEY`, `CLERK_*`

## Verified model slugs (from higgsfield-ai/skills)

Image: `nano_banana_2`, `nano_banana_pro`, `text2image_soul_v2`,
`bytedance/seedream/v4/text-to-image`. Video: `seedance_2_0`, `kling3_0`,
`kling3_0_turbo`, `soul_cinematic`, `marketing_studio_video`. Analysis:
`brain_activity`. Marketing modes + the hook/setting gating live in
`src/lib/higgsfield.ts` (`MARKETING_MODES`, `MARKETING_MODES_WITH_HOOKS`).

**One open question for the first live call:** does `POST /{slug}` take the short
slug (`seedance_2_0`) or the vendor-path form (`higgsfield-ai/...`)? Only the
`MODELS` constants change if it's the latter.

**Workflows** (remove-background, upscale, assemble, dubbing, voice-change) are
CLI `generate workflow` commands; their REST route isn't in the public API page —
wire after confirming from the dashboard, not before.

## Stages

- [x] **0. Guardrails** — dedicated branch; production untouched.
- [x] **1. Higgsfield client** — `src/lib/higgsfield.ts`, verified contract
  (submit → poll `/requests/{id}/status` → `completed` gives `images[].url` /
  `video.url`; cancel; optional `?hf_webhook=`). Typed, server-only, `HiggsfieldError`.
- [x] **2. Model catalog** — verified slugs from higgsfield-ai/skills wired into
  `MODELS` + typed arg shapes (`SeedanceArgs`, `KlingArgs`, `NanoBananaArgs`,
  `SoulVideoArgs`, `MarketingStudioArgs`). Residual: short-slug vs vendor-path
  form confirmed on first live call.
- [x] **3. Swap image gen** — api/modelsheet.ts routes to Higgsfield
  nano_banana_pro when HF creds present (turnaround/edit/generate),
  Supabase-hosts data-URL refs, downloads output back to a data URL. Gemini kept
  as fallback until cleanup. NEEDS a live smoke test on the branch preview.
- [x] **4. Swap video gen** — `api/generate.ts` submits Seedance 2.0 (`hf:`-
  prefixed id) when HF creds present, hosting data-URL refs to Supabase; Veo
  kept as fallback. `api/status.ts` polls Higgsfield on `hf:` ids and downloads
  the (7-day) output URL to Supabase before returning it. Silent video — the
  ElevenLabs mux stays downstream. NEEDS a live smoke test on the branch preview.
- [ ] **5. Soul Characters** — onboarding + soul selector; character-consistent gen.
  **BLOCKED**: the API only documents *generating with* an existing `soul_id`
  (`SoulVideoArgs`, `soul_cinematic`/`text2image_soul_v2`) — there is no
  documented endpoint to train/create a new soul. Building onboarding would
  mean guessing that endpoint. Needs the Higgsfield docs page or dashboard
  screenshot for soul creation before this can start.
- [ ] **6. Marketing Studio ad_reference clone path** — highest-quality clone.
  **BLOCKED**: `MarketingStudioArgs` needs `product_ids`, `avatars[].id`,
  `hook_id`, `setting_id` — none of these have a documented list/create
  endpoint, so real values can't be obtained without guessing. Needs docs (or
  dashboard access) for: create/list product, list avatars, list hooks,
  list settings.
- [x] **7. Auth: Clerk → Supabase** — Clerk-compatible shim over Supabase Auth
  (`src/hooks/useAuth.tsx` exports `useUser`/`useClerk`/`SignedIn`/`SignedOut`/
  `UserButton`/`RedirectToSignIn`) so consumers only changed import path. New
  `AuthForm` (email/password + Google), `main.tsx` gates on Supabase config,
  `SetupNotice` rewritten. NEEDS the Supabase dashboard config below + a live
  sign-up test.
- [x] **8a. Cleanup — Clerk** — removed the unused `@clerk/clerk-react` package;
  de-duplicated and corrected the legal pages (Privacy/Terms/DPA/Cookies) that
  still named Clerk as the auth processor and Google/Veo as the sole renderer;
  rewrote the stale `.env.example` (was still Netlify + Clerk + an unread
  `VIDEO_PROVIDER`/`ARCADS_API_KEY` scheme) to match what the code actually
  reads. Confirmed: tsc clean, build clean, still 12 api files, no purple.
- [ ] **8b. Cleanup — Gemini/Veo fallback** — NOT yet removed. Per the note
  below, keep the Gemini/Veo fallback paths in `api/modelsheet.ts`,
  `api/generate.ts`, `api/status.ts` until Higgsfield is confirmed reliable
  across all three paths (sheet/edit/generate images, and video) on a live
  smoke test — background-removal (edit mode) is the only one verified working
  so far, and it needed two bug fixes (response-size cap, poll-timeout
  headroom) to get there.

## Supabase dashboard config (required for Stage 7 auth)

1. **Env vars** (Vercel, Preview + Production): `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (client, build-time), and keep `SUPABASE_SERVICE_KEY`
   (server). Redeploy after adding — VITE vars are baked in at build.
2. **Auth → Providers → Email**: enabled. For fast testing, turn **off** "Confirm
   email" so sign-up logs in immediately (turn on later for production).
3. **Auth → Providers → Google** (optional): add a Google OAuth client
   (Google Cloud Console) with redirect `https://<project>.supabase.co/auth/v1/callback`.
4. **Auth → URL Configuration**: Site URL = production URL; add the preview URL(s)
   to the Redirect URLs allowlist (needed for OAuth + email links).
5. Note: existing rows are keyed on old Clerk user ids, so history starts fresh
   under the new Supabase uids (expected for the rebuild).

## Notes

- Each media stage must be tested on the branch's Vercel preview with real keys —
  request/response shapes beyond the core contract (per-model args, upload
  endpoint) are confirmed empirically, not assumed.
- The design system rule (no purple/violet/indigo/lavender; skeletons; empty
  states) applies to every new component.

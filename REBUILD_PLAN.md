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
- [x] **3. Swap image gen** — api/modelsheet.ts routes to Higgsfield nano_banana_pro when HF creds present (turnaround/edit/generate), Supabase-hosts data-URL refs, downloads output back to a data URL. Gemini kept as fallback until cleanup. NEEDS a live smoke test on the branch preview.
  cutout, enhance) once the image model slugs are confirmed.
- [ ] **4. Swap video gen** — `api/generate.ts` Veo → Higgsfield; `api/status.ts`
  polls Higgsfield and downloads output to Supabase Storage (Higgsfield URLs
  expire — the download-to-storage step is mandatory).
- [ ] **5. Soul Characters** — onboarding + soul selector; character-consistent gen.
- [ ] **6. Marketing Studio ad_reference clone path** — highest-quality clone.
- [ ] **7. Auth: Clerk → Supabase** — rewritten for a Vite SPA (`supabase.auth`,
  RLS on `auth.uid()`); email/password + Google OAuth. High-blast-radius (19 files).
- [ ] **8. Cleanup** — remove Gemini/Clerk keys, imports, dead code; verify 12 api files.

## Notes

- Each media stage must be tested on the branch's Vercel preview with real keys —
  request/response shapes beyond the core contract (per-model args, upload
  endpoint) are confirmed empirically, not assumed.
- The design system rule (no purple/violet/indigo/lavender; skeletons; empty
  states) applies to every new component.

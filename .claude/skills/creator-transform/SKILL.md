---
name: creator-transform
description: Identity-preserving edits of uploaded photos of real people — wardrobe, hair, action, or setting changes that keep the person unmistakably themselves. Governs the "Transform this person" path of custom-creator upload and any person-plus-product composite.
---

# SKILL: Creator Transform (Identity-Preserving Person Edits)

## Purpose

Edit an uploaded photo of a real person — changing wardrobe, hair, action, or setting
as directed — while keeping the person unmistakably themselves. This is the narrowest
and most fragile skill in the pipeline: identity drift is invisible in code and
glaring on screen. A creator who uploads their own face and gets back "someone who
looks kind of like me" churns immediately.

## Where this lives in this codebase

- Backend: `api/modelsheet.ts` — `mode: 'edit'`, `subjectType: 'character'`; the
  identity-lock clause is enforced server-side in `buildIdentityLockedEditPrompt`
- Frontend: `CreatorInput.tsx` ("Transform this person" path, `previewTransform`)
- Consent gate: `likenessConsentAt` — collected in the UI and enforced again in
  `api/generate.ts` before any generation that uses a real person's photo
- Downstream anchor: the transformed still becomes `creator.transformedImageUrl`
  on the brief and Veo's identity conditioning image

## When this skill applies

Any edit of a photo containing a real human face: the "Transform this person" path of
the custom-creator upload, wardrobe/hair/action/setting changes, and person-plus-
product composites. (Product-only image work belongs to the Product Asset skill.)

## Core principles

1. **Identity is the invariant; everything else is negotiable.** Face geometry, skin
   tone, distinctive features (freckles, dimples, facial hair pattern, glasses if
   integral to their look) are locked. The edit instruction must say so explicitly,
   every time: "Keep this person's face, skin tone, and identity exactly as shown.
   Change ONLY [the directed attribute]."
2. **Edit, never regenerate.** Every operation is image-conditioned against the
   uploaded photo. A text description of the person, however detailed, is not a
   substitute — it produces a plausible stranger.
3. **Scope changes to the minimum.** "Change her shirt to red" means the shirt changes
   and NOTHING else — same pose, same light, same background, same expression, unless
   those were also directed. Uninstructed drift is a defect.
4. **Know the safe-transform envelope.** Some edits preserve identity reliably; some
   erode it. Counsel accordingly:
   - **Safe**: clothing color/style, background/setting swap, held object, accessory
     add/remove, minor pose adjustment.
   - **Caution** (identity risk rises): hairstyle/hair color changes (hair frames the
     face — change it and resemblance drops even when the face is untouched), strong
     lighting changes, significant expression changes.
   - **Decline & explain**: age transformation, body-shape changes, ethnicity-adjacent
     alterations, or stacked transforms ("older + beach + new hair + laughing") that
     collectively guarantee drift. Offer the nearest safe alternative instead.
5. **Real faces carry real obligations.** These operations run only behind the
   likeness-rights confirmation the product collects. Never produce edits that
   sexualize, demean, or place the person in fabricated compromising contexts —
   regardless of instruction phrasing.

## Required workflow

1. Assess the source photo: face clearly visible? Adequate resolution? Front-enough
   angle? A profile-only or heavily shadowed source limits edit quality — say so
   before generating, with capture guidance if needed.
2. Classify each requested change against the safe/caution/decline envelope. Multiple
   stacked changes: evaluate the STACK, not each item alone.
3. Construct the edit instruction: identity-lock clause first, then the single scoped
   change (or minimal set), then explicit preservation of everything undirected.
4. On result, run the resemblance check: side-by-side against the source — same
   person, immediately, no squinting? Distinctive features intact? If not, regenerate
   with tighter scoping; do not ship near-misses.
5. When the transformed still seeds video generation, hand downstream a precise
   textual identity anchor (hair, skin tone, wardrobe as NOW transformed) so the
   Video Director skill restates it consistently across clips.

## Quality standards

- Passes the instant-recognition test: someone who knows the person identifies them
  without hesitation.
- Zero uninstructed changes — background, pose, expression, and lighting hold unless
  directed.
- Edited regions blend seamlessly: matched grain, light direction, and color
  temperature at every boundary.
- Caution-tier requests shipped with a one-line heads-up ("hair changes can reduce
  resemblance — here's the result; happy to try a subtler version").

## Decision framework

Conflicts resolve in this order: (1) identity preservation, (2) the user's directed
change, (3) photographic realism, (4) aesthetic polish. If (1) and (2) genuinely
conflict — the request sits in the decline tier — explain the trade-off and offer the
nearest achievable version rather than silently shipping either failure.

## Common mistakes to avoid

- Omitting the identity-lock clause and trusting the model to infer it.
- Executing stacked transforms in one pass instead of sequencing the safest subset.
- Treating hair as a freely editable attribute like clothing — it is the highest-risk
  common request; handle with the caution-tier protocol.
- Accepting "close enough" resemblance. Near-miss identity is uncanny and worse than
  refusing.
- Letting a person edit silently alter the PRODUCT in frame (label, color) — product
  fidelity rules from the Product Asset skill still apply when both are present.

## Output expectations

The edited image, plus (when relevant) the one-line caution note and the updated
identity anchor string for downstream video prompts. Failures and declines explained
in plain language with a concrete alternative — never a bare refusal, never a raw
error.

## Success criteria

The person looks at the output and says "that's me" — wearing what the user directed,
doing what the user directed, and nothing else changed.

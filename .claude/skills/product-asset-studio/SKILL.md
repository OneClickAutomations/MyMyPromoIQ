---
name: product-asset-studio
description: Turn a user's product photo into production-grade marketing assets — clean cutouts, enhanced hero shots, 2×3 multi-angle turnaround sheets, and lifestyle composites — with the actual product's proportions, label, and color preserved exactly. Governs all image-only product work.
---

# SKILL: Product Asset Studio (Turnarounds, Cutouts, Composites)

## Purpose

Transform whatever product photo a user uploads — usually a phone snapshot — into
production-grade marketing assets: clean cutouts, enhanced hero shots, multi-angle
turnaround sheets, and lifestyle composites. These assets anchor every downstream
generation; a weak product asset degrades every video built on it.

## Where this lives in this codebase

- Backend: `api/modelsheet.ts` — `mode: 'sheet'` (turnaround), `mode: 'edit'`
  (cutout/enhance/composite), `subjectType: 'product'`
- Frontend: `ProductInput.tsx` (Remove background / Enhance photo / Generate
  turnaround), `SeedImageStudio.tsx` (Product Studio workshop)
- Downstream: the turnaround persists as `product.turnaroundImageUrl` on the brief
  and is passed to `api/generate.ts` as `productReferenceImageUrl` — Claude's
  vision reference for keeping the product faithful in every video

## When this skill applies

All image-only product work: background removal, enhancement/upscale, turnaround/model
sheets, transparent PNGs, and placing a product into a scene. (Editing photos of
PEOPLE is governed by the Creator Transform skill, not this one — route accordingly.)

## Core principles

1. **Fidelity is sacred.** The user's actual product — its exact proportions, label
   text, color, cap shape — must survive every transformation untouched. An enhanced
   image of the wrong product is worse than a raw photo of the right one. Every prompt
   to the image model states explicitly: preserve the product exactly as shown;
   change only [the specified thing].
2. **The reference image is the source of truth.** All asset operations are EDITS of
   the uploaded photo (image-conditioned), never text-only regenerations of "a serum
   bottle." Text-only regeneration invents a different product.
3. **Studio conventions are the quality bar.** Clean assets follow commercial product-
   photography grammar: seamless background (pure white for cutout work), soft even
   key light with gentle fill, subtle grounding shadow, product occupying 70–80% of
   frame height, label perfectly legible.
4. **Turnarounds are technical documents, not art.** A model sheet's job is
   consistency reference for downstream generation. Uniformity beats beauty.

## Turnaround sheet specification

When generating a multi-angle turnaround:

- **Grid**: 2×3 (six views). This codebase's canonical view order
  (`buildPrompt` in `api/modelsheet.ts`): front, left profile, three-quarter
  front, top-down, bottom, rear/back.
- **Consistency across all six cells**: identical scale, identical lighting direction,
  identical background (seamless white), identical distance from camera. The product
  is the only thing that rotates.
- **Projection**: orthographic/isometric flatness — no dramatic perspective, no lens
  distortion, no artistic angles.
- **No text, labels, watermarks, or annotations** in the image itself.
- The prompt must enumerate all six views explicitly by name — "multiple angles"
  produces four random ones.

## Composite (product-in-scene) rules

- Scale sanity first: the product must be sized believably relative to scene elements
  (a serum bottle is hand-sized, not lamp-sized).
- Light matching: the product's lighting direction and warmth must match the scene's,
  or state the mismatch to be corrected in the edit instruction.
- Contact realism: grounded objects need contact shadows; held objects need plausible
  hand occlusion.
- Scene serves product: the environment supports and frames; it never upstages.
  Backgrounds soften (depth of field) when they compete.

## Required workflow

1. Assess the upload: resolution, focus, lighting, angle coverage. Note limitations
   that will constrain output quality.
2. Choose the operation (cutout / enhance / turnaround / composite) per the request.
3. Construct the edit instruction: reference-anchored, explicit about what changes and
   what is preserved, following the conventions above.
4. On result: verify label legibility, proportion fidelity, and edge quality before
   presenting. A defective asset is regenerated, not shipped.

## Quality standards

- Label text legible and unaltered in every output.
- Cutout edges clean — no halos, no chewed edges, no background remnants (check
  around caps, handles, and transparent regions especially).
- Turnaround cells pass the squint test: at a glance, six identical products at six
  angles, nothing else varying.
- Composites pass the "was it really there?" test: shadows, scale, and light agree.

## Decision framework

When quality conflicts arise: (1) product fidelity, (2) technical cleanliness (edges,
consistency), (3) aesthetic polish, (4) speed. Never trade 1 or 2 for 3.

## Common mistakes to avoid

- Text-only regeneration of the product (invents a lookalike; the cardinal sin).
- "Enhancing" so aggressively the material reads wrong — plastic becoming glass,
  matte becoming gloss.
- Turnaround cells with inconsistent scale or drifting lighting between views.
- Compositing a studio-lit product into a golden-hour scene without addressing the
  light mismatch.
- Ignoring a low-quality source: if the upload can't support the request (e.g., a
  blurry 400px photo requested as a 6-view turnaround), say so and recommend a better
  capture — with specific guidance (fill the frame, diffuse daylight, plain
  background) — rather than shipping a bad result silently.

## Output expectations

The generated asset(s), plus a one-line note when a source-quality limitation
affected the result. Failures surface as plain-language explanations with a concrete
next step — never a raw error code.

## Success criteria

The user's phone snapshot becomes an asset they'd be proud to run in a paid ad — and
the product in that asset is unmistakably, verifiably *their* product.

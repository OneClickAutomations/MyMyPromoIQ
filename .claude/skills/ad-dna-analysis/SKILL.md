---
name: ad-dna-analysis
description: Deconstruct a scraped competitor ad (SourceAd) into hook type, beat structure, claim architecture, creator profile, SWOT, and differentiation notes — producing the structured AdAnalysis the Clone pipeline consumes. Use whenever the task is analyzing why an ad works or feeding the Storyboard Planner.
---

# SKILL: Ad DNA Analysis

## Purpose

Deconstruct a scraped competitor ad into its structural, strategic, and creative
components so a differentiated, superior version can be rebuilt around the user's
product. This skill produces intelligence, not content — its output feeds the
Storyboard Planner skill downstream.

## Where this lives in this codebase

- Input shape: `SourceAd` (`src/lib/discovery/types.ts`)
- Output shape: `AdAnalysis` (`src/lib/discovery/types.ts`) — consumed by
  `handleConfirmClone` in `src/pages/Discovery.tsx` and the Storyboard Planner
  (`api/director.ts`, `mode: 'storyboard'`)
- Surfaces: the Clone flow's analysis step, the SWOT panel, the Ad DNA breakdown
  in `DetailDrawer`, and opportunity-score reasoning

## When this skill applies

Any time a `SourceAd` (scraped creative + copy + delivery metadata) is being analyzed:
the Clone flow's analysis step, the SWOT panel, the Ad DNA breakdown, and the
opportunity-score reasoning. If the task is "understand why this ad works," this skill
governs it.

## Core principles

1. **Mechanics over content.** The value of a winning ad is its *machinery* — hook
   type, pacing structure, claim architecture, emotional sequence — never its specific
   words or visuals. Extract the machine; discard the paint.
2. **Every observation must be actionable.** "Strong hook" is worthless. "Pattern-
   interrupt hook: opens mid-action with the product already failing, resolving at
   second 3" tells the Storyboard Planner exactly what to rebuild.
3. **Differentiation is mandatory, not optional.** The output must make the user's
   version *better and legally distinct*, never a copy. Platforms penalize duplicate
   creative; a clone that performs worse than its source is a product failure.
4. **Evidence before inference.** Ground every claim in something observable in the ad
   (its text, its runtime, its visible structure). Where you infer (e.g., target
   demographic), label it as inference.

## Required workflow

1. **Classify the hook** — one of: pattern interrupt / bold claim / relatable problem /
   curiosity gap / social proof / demonstration / before-after. Quote or describe the
   actual opening beat.
2. **Map the beat structure** — a shot-by-shot (or beat-by-beat) sequence with
   estimated timing. Standard vocabulary: hook, problem, agitation, demo, proof,
   transformation, CTA, bridge, reveal. Every ad maps to some subset of these.
3. **Extract the claim architecture** — what the ad promises, in what order, and what
   evidence it offers. Note which claims are strong vs. generic.
4. **Profile the creator** — apparent gender, age range, energy level, wardrobe
   register, camera confidence (natural UGC vs. polished influencer vs. commercial).
   These become defaults for the user's version, all overridable.
5. **Read the production grammar** — camera style (handheld/tripod/selfie/orbit),
   lighting register, setting, pace of cuts. Describe in reproducible terms.
6. **Run the SWOT** — Strengths (why it works), Weaknesses (what underperforms),
   Opportunities (what the user can do better), Threats (saturation, platform risk).
   Each quadrant: 2–4 specific, evidence-grounded points.
7. **Write differentiation notes** — the explicit list of what the user's version will
   change and why. This is a required output field, surfaced to the user.

## Quality standards

- Every beat in the structure map has an estimated duration.
- Hook classification includes the *reasoning*, not just the label.
- SWOT points are specific enough that a stranger could act on them.
- Differentiation notes name at least three concrete departures from the source.
- No verbatim reproduction of the source ad's copy beyond short identifying quotes of
  the hook line.

## Decision framework

When judgments conflict, prioritize in this order: (1) what the evidence in the ad
actually shows, (2) what will help the user's version outperform, (3) what keeps the
output legally and platform-policy safe, (4) brevity.

## Common mistakes to avoid

- Describing the ad instead of decoding it ("a woman holds the product and talks" vs.
  "selfie-framed direct-address testimonial, trust-building via eye contact and
  unpolished setting").
- Copying claims into the improved script instead of building parallel-but-distinct
  claims from the user's actual product details.
- Letting admiration inflate the analysis — a long-running ad can still have weak
  beats worth improving; find them.
- Producing prose where structure is needed. The downstream consumer is code; output
  the structured fields the pipeline expects, exactly.

## Output expectations

Structured JSON matching the pipeline's `AdAnalysis` shape (hookType, hookText,
structure[], claimsAndAngles[], suggestedCommercialStyle,
suggestedCreatorAttributes, improvedScript, differentiationNotes), plus the SWOT
quadrants. Valid JSON only when called programmatically — no markdown wrappers, no
preamble.

## Success criteria

A user reading the analysis should feel they understand the ad better than its own
creator does — and should be able to see, in the differentiation notes, exactly why
their version will be different and stronger.

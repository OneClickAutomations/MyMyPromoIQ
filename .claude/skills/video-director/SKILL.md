---
name: video-director
description: Translate one storyboard clip into a Veo 3 generation prompt with maximum fidelity — correct product, consistent creator, believable performance, synced native audio, and cross-clip continuity in multi-clip commercials. Governs every video-generation prompt-construction call.
---

# SKILL: Video Director (Veo 3 Prompt Craft)

## Purpose

Translate one storyboard clip into a generation prompt that the video model executes
with maximum fidelity — correct product, consistent creator, believable performance,
synced native audio. This is model-specific prompt engineering: the difference between
output that looks like TopView-tier UGC and output that looks like a free template.

## Where this lives in this codebase

- Backend: `api/generate.ts` — `writeDirectorPrompt` is this skill's
  implementation; its system-prompt rules are this skill's rules in code
- Vision grounding: the product turnaround (`productReferenceImageUrl`) and the
  creator photo (`creatorImageUrl`) are attached to Claude as images so
  descriptions are observed, not invented — the photo wins over conflicting text
- Conditioning: Veo takes exactly ONE conditioning image per job
  (`creatorImageUrl || productImageUrl` — the creator photo wins when present)
- Continuity: `sceneIndex`/`sceneCount` drive the SEQUENCE section — clips 2..N
  of a multi-clip commercial continue the take instead of re-establishing
- Consent: generation with a real person's photo is blocked server-side unless
  `creatorConsentAt` is present

## When this skill applies

Every video generation call. One clip in, one prompt out. This skill governs the
prompt-construction function (`writeDirectorPrompt`) — its rules are the function's
spec.

## Core principles

1. **Describe the observable, never the abstract.** Video models render what is
   physically described and guess at everything else. "Confident energy" is a guess
   request. "She lifts the jar to shoulder height, label toward camera, holding eye
   contact with the lens, slight smile" is an instruction.
   - BAD: "An energetic young woman excitedly shows off the serum."
   - GOOD: "A woman in her late 20s with shoulder-length curly hair holds a small
     amber glass serum bottle at chest height, label facing camera. She unscrews the
     dropper with her right hand while looking directly into the lens. Warm window
     light from the left. Handheld selfie framing, slight natural shake."
2. **Anchor identity in every prompt.** The model has no memory between clips. Restate
   the creator's appearance (hair, skin tone, wardrobe, distinguishing details) and the
   product's exact appearance (shape, color, label) in EVERY clip's prompt, verbatim-
   consistent across the batch. Drift between clips comes from lazy restatement.
   When reference photos are attached, describe ONLY what is actually observed in
   them — never invent details the photo contradicts.
3. **When a reference image exists, the prompt describes what CHANGES, the image
   carries what stays.** With an uploaded creator photo or product composite as the
   conditioning image, don't re-describe what the image already shows — direct the
   motion, the action, the camera. Redundant description fights the reference.
4. **Audio is written into the prompt, not added after.** The model generates audio
   and video together — this is how lip sync works. Write the exact spoken line into
   the prompt with delivery direction: `She says, in a casual, unhurried tone: "I
   almost didn't buy this. Big mistake."` Never generate a silent clip planning to
   dub it later.
5. **Camera language is literal.** Use physical camera vocabulary the model responds
   to: "slow push-in," "locked-off tripod, eye level," "handheld selfie, arm's
   length," "orbit left around subject," "static wide, subject center-frame." Never
   "cinematic," "dynamic," or "professional" — those are hopes, not directions.
6. **One prompt = one continuous shot.** No cuts, no scene changes, no "then" inside a
   single clip prompt. Multi-beat sequences are multiple clips, stitched downstream.
7. **In a multi-clip commercial, only clip 1 establishes.** Identity restatement is
   NOT scene re-establishment. Clips 2..N continue the same take: no fresh product
   beauty-shot opener, no new establishing frame — the same creator is already on
   screen mid-action in the same wardrobe, lighting, and setting; begin mid-motion.
   The final clip continues seamlessly and lands the CTA. (Implemented as the
   SEQUENCE section driven by `sceneIndex`/`sceneCount`.)

## Required prompt structure

Assemble each prompt in this order (a consistent structure produces consistent
results):

1. **Subject** — who, restated fully: age range, hair, skin tone, wardrobe.
2. **Action** — what they physically do, hands and eyes explicitly, product position.
3. **Product** — exact appearance restated: container, color, label orientation.
4. **Dialogue** — exact words in quotes + tone/pace direction (only if this clip has
   dialogue).
5. **Setting & light** — location, light source and direction, time-of-day register.
6. **Camera** — framing, movement, angle, in literal vocabulary.
7. **Register** — one closing line fixing the format: "Vertical 9:16 UGC-style
   smartphone footage" or "Vertical 9:16, polished commercial look" per the brief.

## Quality standards

- Zero abstract adjectives doing load-bearing work (energetic, professional, stunning,
  cinematic, high-quality). Physical description or nothing.
- Dialogue in the prompt matches the storyboard clip's dialogue exactly — same words,
  no paraphrase. The word budget was computed upstream; respect it.
- Creator and product descriptions are string-identical across all clips in a batch.
- Every prompt names the aspect ratio and format register.
- Verify current model-specific syntax against the provider's live documentation when
  behavior seems off — prompt conventions evolve; this skill's structure is stable but
  surface syntax may need updating.

## Decision framework

When the prompt grows long, cut in this order: setting flourish → camera nuance →
action detail. NEVER cut: identity anchors, product description, dialogue, aspect/
format line, or the sequence-continuity instruction.

## Common mistakes to avoid

- Mood-board prompting ("aesthetic, viral, trending") — the model can't render vibes.
- Re-describing the reference image instead of directing motion against it.
- Stacking beats into one clip prompt ("she opens the box, then applies it, then
  smiles at the results") — that's three clips pretending to be one.
- Letting clip 3's description of the creator drift from clip 1's ("curly hair" →
  "wavy hair" = a different person on screen).
- Opening clips 2..N of a sequence on a static product hero shot — that produces a
  stitched commercial that feels like the same ad repeating instead of one story.
- Describing the product generically ("the product") when its exact appearance is
  known and must anchor.

## Output expectations

A single prompt string per clip, following the seven-part structure, ready to submit
to the generation endpoint. No markdown, no commentary, no alternatives — the
selection of approach happened upstream; this skill executes it precisely.

## Success criteria

Two clips generated from the same batch look like the same person, same product, same
world — and stitched together they play as one progressing story, not a repeat.
Dialogue lands naturally within the clip duration with synced lips. A viewer cannot
point to the moment where the prompt got vague — because it never did.

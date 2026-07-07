---
name: storyboard-planner
description: Convert a creative brief into a clip-by-clip storyboard where every clip fits the video model's duration math (2.5 words/sec, 4–8s clips) and the full sequence plays as one complete commercial at any clip count. Governs storyboard, script distribution, clip plan, and dialogue allocation work.
---

# SKILL: Storyboard Planner

## Purpose

Convert a creative brief (from ad analysis, manual input, or Quick Generate) into a
clip-by-clip storyboard where every clip is physically executable by a short-duration
video model. This skill exists because the single biggest quality failure in AI UGC is
overstuffed clips — two minutes of message crammed into six seconds of video. This
skill makes that failure impossible.

## Where this lives in this codebase

- Backend: `api/director.ts` — `planStoryboard` (`mode: 'storyboard'`); the word
  budget is HARD-ENFORCED server-side (`trimToWords`/`maxWords`), and the
  completeness-over-count compression rule lives in its system prompt
- Shared contract: `src/lib/studio/storyboard.ts` — `StoryboardPlan`,
  `StoryboardClip`, `WORDS_PER_SECOND = 2.5`, `CLIP_DURATIONS = [4,5,6,7,8]`
- Frontend: `StoryboardPlanner.tsx` (review/edit UI), consumed by both the
  Build-From-Scratch wizard (`CommercialStudio.tsx`) and the Clone flow
  (`StoryboardPage.tsx`)
- Creator context: the plan input carries `creator` (uploaded vs. generated) so
  the planner never invents a presenter — an uploaded real person is referred to
  neutrally ("the creator"), never assigned a gender or appearance

## When this skill applies

Any time a storyboard, script distribution, clip plan, scene breakdown, or dialogue
allocation is being produced. This governs the Storyboard Planner screen's content and
the server-side plan computation.

## The one unbreakable law: duration math

Natural spoken pace is ~2.5 words per second. Clip durations are fixed by the video
model (4–8 seconds per clip). Therefore:

| Clip duration | Max dialogue words |
|---|---|
| 4 sec | 10 words |
| 5 sec | 12 words |
| 6 sec | 15 words |
| 7 sec | 17 words |
| 8 sec | 20 words |

These are ceilings, not targets. A clip at 80% of its word budget breathes; a clip at
100% feels rushed; a clip over budget is a defect and must be split or cut. Compute
and record `wordCount` for every clip. If the message doesn't fit, the answer is
always MORE CLIPS or FEWER WORDS — never faster speech.

## Core principles

1. **One beat per clip — until the count forces compression.** At 5+ clips, a clip
   does exactly one job: hook, or problem, or demo, or CTA. When the clip count is
   below the five narrative elements (hook, problem, solution, proof, CTA), clips
   COMPRESS multiple elements — writing tighter lines that still cover each element,
   tagged with the DOMINANT beat — because completeness beats purity: the sequence
   must always land the full sales arc (see the compression map in
   `api/director.ts`). Never drop the arc to preserve one-beat-per-clip.
2. **The clip count serves the message, not vice versa.** Analyze the total message
   first, then derive the count. Recommend a count with reasoning ("This ad's 23
   seconds across 4 beats → 5 clips to match its pacing"). The user can override 1–10.
3. **Fewer clips = tighter message, not squeezed message.** A 1-clip request gets a
   single complete thought — one hook-and-CTA sentence that stands alone — not a
   compressed speech. A 3-clip commercial is a complete short story: hook → payoff →
   CTA. Every clip count from 1–10 must produce something that feels *finished*.
4. **Write for the ear, then the eye.** Dialogue is spoken language: contractions,
   short sentences, rhythm. Read it aloud mentally; if it stumbles, rewrite.
5. **Every clip specifies the physical.** What the creator is doing with their hands,
   where they're looking, where the product is in frame — described concretely enough
   that the Video Director skill downstream can prompt from it without guessing.
6. **Honor the creator context.** If the brief says the creator is an uploaded real
   person, refer to them only as "the creator"/"the presenter" — never invent or
   imply gender, age, or appearance; their look is fixed by their photo. If the
   creator is generated, use exactly the attributes the brief specifies.

## Required workflow

1. Ingest the brief: product, creator, style, message/claims, CTA, and (if cloning)
   the source ad's beat structure from the Ad DNA Analysis.
2. Determine total message content and natural beat sequence.
3. Compute recommended clip count from beats × the duration table. State the reasoning
   in one sentence.
4. Distribute dialogue across clips, verifying word count per clip against the table.
   Iterate until every clip is at or under budget.
5. For each clip write: beat label, duration, dialogue (exact words), visual
   description (physical/observable), creator action, camera direction.
6. Sanity-check the sequence read end-to-end: does it open with a scroll-stopping
   first 2 seconds, escalate, and land the CTA? Fix ordering if not.

## Quality standards

- Zero clips over word budget. This is checked, not hoped.
- Clip 1's first line functions as a standalone hook — it would stop a scroll even if
  nothing followed.
- The final clip contains the CTA in the brief's preferred form, verbatim where the
  user specified one.
- Beat labels come from the standard vocabulary (hook / problem / agitation / demo /
  proof / transformation / CTA / bridge / reveal).
- Dialogue across clips flows as one continuous voice — same register, no jarring
  tonal resets between clips.

## Decision framework

When trade-offs arise: (1) fit within duration math, (2) preserve the hook's power,
(3) keep one-beat-per-clip (subject to the compression rule when count < 5),
(4) protect the CTA, (5) everything else. Cut supporting claims before touching any
of the first four.

## Common mistakes to avoid

- Averaging the script across clips instead of assigning beats (produces clips that
  each contain a fragment of everything and a whole of nothing).
- Writing dialogue first and durations second. Durations are the constraint; write
  into them.
- Treating a 1-clip request as a summarization task. It's a distillation task — one
  perfect sentence, not a compressed paragraph.
- Vague visual descriptions ("she shows the product enthusiastically"). The Video
  Director skill cannot prompt from vibes.
- Inventing a presenter's gender or appearance when the brief marks the creator as an
  uploaded real person.
- Forgetting that locked clips are immutable — when regenerating a plan, locked clips
  keep their exact content and position.

## Output expectations

Structured `StoryboardPlan` JSON (totalEstimatedDurationSeconds, clipCount,
recommendedClipCount + reasoning string, clips[] with id, order, beat,
durationSeconds, visualDescription, dialogue, wordCount, cameraDirection,
creatorAction, locked). Valid JSON only when called programmatically.

## Success criteria

Any single clip, viewed alone, looks intentional and complete. The full sequence,
assembled, plays as one coherent commercial with no rushed speech, no cut-off
sentences, and a first two seconds that earns the rest.

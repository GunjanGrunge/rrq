---
name: quality-gate
description: >
  Content quality analysis and scoring skill. Use this after script and SEO
  generation, before any audio or video generation begins. Scores content
  against user's quality threshold and either approves, triggers a rewrite,
  or rejects the topic. Triggers on: "check quality", "score the script",
  "quality gate", or automatically after SEO step completes in the pipeline.
---

# Quality Gate Skill

## Purpose
Prevent wasted ElevenLabs credits, Bedrock tokens, and Lambda compute by catching weak content before any expensive operations run. All checks happen at the text stage — cheap Haiku calls and free web searches only.

## Dependencies
**Read `skills/muse/SKILL.md`** — the quality gate scores against MUSE's blueprint
as well as the script itself. A script that deviates significantly from the
MuseBlueprint's retention walls and beat structure is penalised under
Retention Structure, even if the writing is good.

**Sprint context:** Jason's current sprint goal is available via `getCurrentSprint()`.
If a video topic is a sprint-critical task (e.g. a format the sprint depends on),
the quality gate threshold for REWRITE vs REJECT is relaxed by 0.3 points —
a near-miss gets another attempt rather than immediate rejection.

## Model
Use **claude-haiku-4-5** via AWS Bedrock for all scoring — fast, cheap, accurate enough for structured scoring tasks.

---

## User Threshold Setting

User sets their minimum acceptable score once in Settings. Default is 7/10.

```
Quality Threshold: [7/10 ▼]
Options: 6, 7, 8, 9, 10
```

Store in DynamoDB against user profile. Every pipeline run checks against this threshold.

---

## Scoring Dimensions

Run all five checks in a single Haiku call. Pass the full research JSON + script JSON + SEO JSON as context.

### 1. Hook Strength (0–10)
Does the opening 30 seconds create an irresistible curiosity gap?
- 9–10: Genuinely surprising, specific, makes you need to know more
- 7–8: Strong but slightly predictable
- 5–6: Generic, could apply to any video on this topic
- Below 5: Starts with "In this video" or equivalent

### 2. Retention Structure (0–10)
Is the script engineered to keep people watching?
- Are there re-engagement hooks every 2–3 minutes?
- Does each section end with a bridge to the next?
- Is the payoff delivered late enough to justify watch time?
- Is the CTA specific and earned?

### 3. Title CTR Prediction (0–10)
Will the title make someone stop scrolling?
- Contains primary keyword in first 4 words?
- Creates curiosity gap without giving everything away?
- Specific enough to feel credible?
- Under 60 characters?

### 4. Keyword Coverage (0–10)
Are SEO keywords naturally embedded throughout?
- Primary keyword appears in title, first 100 words of description, and script intro?
- Long-tail phrases present in description?
- Tags cover exact, broad, and question-based variations?

### 5. Competitor Differentiation (0–10)
Does this video have a unique angle?
- Run web search: top 5 YouTube videos on this exact title
- Does our angle cover something they miss?
- Is our hook different from existing top videos?
- Would someone who already watched a competitor video still watch ours?

### 7. Uniqueness Score (0–10)
Does this video add something the viewer cannot get from reading the source?
This score is seeded directly from Regum's council position uniquenessScore
(0–100 scale converted to 0–10) and confirmed here against the final script.
- 9–10: Original test, framework, comparison, or perspective not found elsewhere
- 7–8: Clear angle differentiation, builds meaningfully on source material
- 5–6: Repackages existing content with minor additions
- Below 5: Could be replaced by linking to the source article — do not publish

**Minimum required: 7.0 (converts to 70 on Regum's 0–100 scale)**
**This dimension cannot be below 5.0 regardless of overall score.**
If uniquenessScore < 5.0 — automatic REJECT. No second attempt on uniqueness.
The council already failed this video. Do not proceed.

---

## Scoring Output

```json
{
  "scores": {
    "hookStrength": 8.5,
    "retentionStructure": 7.2,
    "titleCTR": 9.0,
    "keywordCoverage": 6.5,
    "competitorDiff": 8.0,
    "museBlueprintAdherence": 9.0,
    "uniquenessScore": 8.2
  },
  "overall": 8.1,
  "weakSections": ["keywordCoverage"],
  "feedback": {
    "hookStrength": "Strong curiosity gap, specific claim works well",
    "retentionStructure": "Good structure but section 3 lacks a bridge line",
    "titleCTR": "Excellent — keyword first, curiosity preserved",
    "keywordCoverage": "Long-tail phrases missing from description",
    "competitorDiff": "Unique angle on price comparison not covered by top 5",
    "museBlueprintAdherence": "All four retention walls present and correctly executed",
    "uniquenessScore": "Original benchmark test — not found in any competitor video"
  },
  "uniquenessAutoReject": false,
  "recommendation": "PROCEED | REWRITE | REJECT",
  "sprintCritical": "boolean — if true, REJECT threshold is relaxed by 0.3"
}
```

---

## Decision Logic

```
IF overall >= user threshold
  → recommendation: PROCEED
  → pipeline continues to audio automatically

IF overall < user threshold AND attempt == 1
  → recommendation: REWRITE
  → identify weakSections
  → rerun only those sections (research deeper + rewrite)
  → rescore — this is attempt 2

IF overall < user threshold AND attempt == 2
  → recommendation: REJECT
  → stop pipeline, no tokens wasted on audio/video
  → show user the rejection screen
```

Maximum two attempts. Never more. This protects token budget.

---

## Rewrite Behaviour (Attempt 2)

On a rewrite, only fix the weak sections. Do not regenerate everything.

```
keywordCoverage weak  → rerun seo-optimizer-youtube only
hookStrength weak     → rerun first section of youtube-script-writer only
titleCTR weak         → rerun title generation only (Haiku, very cheap)
retentionStructure    → rerun body sections of script only
competitorDiff weak   → rerun research with deeper web search, then hook + title
```

Each targeted rewrite costs a fraction of a full regeneration.

---

## Rejection Screen (UI)

When recommendation is REJECT after two attempts:

```
┌─────────────────────────────────────────────┐
│  ✗ Quality Standard Not Met                 │
│                                             │
│  Best score achieved: 6.8 / 10             │
│  Your threshold: 8 / 10                    │
│                                             │
│  Where it fell short:                       │
│  • Hook too generic for this topic          │
│  • Title CTR prediction low                 │
│  • Competitor videos cover same angle       │
│                                             │
│  Suggestions:                               │
│  • Try a more specific angle on this topic  │
│  • Lower your threshold to 7 for this one  │
│                                             │
│  [TRY DIFFERENT ANGLE]  [LOWER THRESHOLD]   │
└─────────────────────────────────────────────┘
```

No credits wasted. User gets actionable feedback.

---

## Quality Report Screen (UI — on PROCEED)

When score meets threshold, show the report before audio begins:

```
┌─────────────────────────────────────────────┐
│  ✓ Quality Gate Passed                      │
│                                             │
│  Hook Strength          8.5 / 10  ✅        │
│  Retention Structure    7.2 / 10  ✅        │
│  Title CTR              9.0 / 10  ✅        │
│  Keyword Coverage       6.5 / 10  ✅        │
│  Competitor Gap         8.0 / 10  ✅        │
│                                             │
│  OVERALL                7.8 / 10            │
│                                             │
│  [PROCEED TO VIDEO →]                       │
└─────────────────────────────────────────────┘
```

User sees the score and approves before ElevenLabs credits are spent.

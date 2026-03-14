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
  "compositeScore": 81,
  "scoreRange": "SHIP_WITH_NOTES",
  "recommendation": "SHIP_IMMEDIATELY | SHIP_WITH_NOTES | SHIP_WITH_WARNINGS | SPRINT_LOOP | ABORT",
  "sprintCritical": "boolean — if true, SPRINT_LOOP threshold is relaxed by 0.3"
}
```

---

## Decision Logic — Range-Based Composite Scoring

The quality gate now produces a composite confidence score (0–100), not a
binary pass/fail. This score feeds directly into the pre-production sprint
council (skills/full-rrq/SKILL.md) before any production spend is committed.

### Composite Score Calculation

Dimension scores (0–10) are converted to a 0–100 composite:

  Hook Strength          ×  weight 20%
  Retention Structure    ×  weight 20%
  Title CTR              ×  weight 15%
  Keyword Coverage       ×  weight 10%
  Competitor Diff        ×  weight 15%
  Muse Blueprint         ×  weight 10%
  Uniqueness Score       ×  weight 10%

  composite = sum(score × weight) × 10   // converts to 0–100

### Score Ranges

  90–100   SHIP_IMMEDIATELY    No notes. Proceed to production.
  75–89    SHIP_WITH_NOTES     Minor feedback attached. Proceed.
  60–74    SHIP_WITH_WARNINGS  Specific weaknesses flagged. Proceed with user visibility.
  40–59    SPRINT_LOOP         Hold. One revision cycle. Re-score after targeted rewrite.
           (replaces old REWRITE — same mechanic, new framing)
  <40      ABORT               Topic structurally weak. Rex finds next opportunity.

### Sprint Feedback Loop (score 40–59)

  On SPRINT_LOOP:
    → identify weakSections (same logic as before)
    → targeted rewrite of weak sections only (same mechanic as old REWRITE)
    → re-score — this is attempt 2
    → if score still 40–59 after attempt 2 → ABORT (no third attempt)
    → if score climbs to 60+ → continue at that range tier

### Uniqueness Hard Floor (unchanged)

  uniquenessScore < 5.0 → automatic ABORT regardless of composite score.
  No sprint loop. No second attempt. Topic rejected immediately.

### Sprint Council Integration (Full RRQ Mode only)

  In Full RRQ / Autopilot Mode:
    Quality gate score is ONE INPUT into the sprint council composite.
    Sprint council fires AFTER quality gate passes (score ≥ 60).
    Quality gate weight in sprint council: 25%.
    See: skills/full-rrq/SKILL.md → Pre-Production Sprint Council.

  In Studio Mode / Rex Mode:
    Quality gate is the sole gate. No sprint council.
    Score ≥ user threshold (0–10 setting) → PROCEED.
    Score < threshold → SPRINT_LOOP or ABORT as above.

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

## Escalation on Quality Gate Failure

Maximum two attempts are enforced. After both attempts fail, the following
escalation sequence runs before pipeline abort.

```typescript
// After 2 failed attempts:

// 1. isStuck() check
//    Compare attempt 1 score vs attempt 2 score.
//    If overall score did not improve by > 0.05 between attempts → escalate immediately
//    (do not wait for a third attempt — there is no third attempt at the gate level).
//    A stagnant score signals a structural problem with the topic, not just weak execution.

// 2. Zeus evaluates the two attempt logs
//    Zeus reads both attempt records from production-jobs DynamoDB (keyed by jobId).
//    Zeus receives: scores per dimension (both attempts), weakSections, feedback, topic.
//    Zeus makes an approve/abort judgment using Bedrock Opus.

// 3. Zeus approve path
//    If Zeus approves despite low score → pipeline continues.
//    Zeus logs the decision as a LOW_CONFIDENCE_PASS episode to S3 (rrq-memory/).
//    Episode includes: topic, both attempt scores, Zeus rationale, outcome.
//    This episode feeds future quality gate calibration via Oracle.

// 4. Zeus cannot resolve path
//    If Zeus also cannot reach a confident approve/abort decision →
//    SES email + in-app notification sent to user.
//    User options: APPROVE_ANYWAY | ABORT_JOB
//    (No SKIP_THIS_CHECK or RETRY_WITH_NEW_APPROACH — quality gate is non-skippable)

// Quality gate is the most critical gate in the pipeline.
// ABORT is the correct autoDecision — never auto-approve quality gate failures.
// Only a human or Zeus can override a failed quality gate.

// Reference: skills/escalation/SKILL.md → ESCALATION_POLICIES.QUALITY_GATE

// Score history storage:
//   All attempt scores are written to the production-jobs DynamoDB table,
//   keyed by jobId, as a scoreHistory array:
//   scoreHistory: [
//     { attempt: 1, scores: {...}, overall: number, weakSections: string[] },
//     { attempt: 2, scores: {...}, overall: number, weakSections: string[] },
//   ]
//   Zeus reads this array when evaluating the escalation.
//   Oracle's PRESENTER_PERFORMANCE_ANALYTICS domain (Domain 10) also reads
//   aggregate score history for channel-level quality trend analysis.
```

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
│              81 / 100                       │
│          SHIP_WITH_NOTES                    │
│                                             │
│  Hook Strength          8.5 / 10  ✅        │
│  Retention Structure    7.2 / 10  ✅        │
│  Title CTR              9.0 / 10  ✅        │
│  Keyword Coverage       6.5 / 10  ✅        │
│  Competitor Gap         8.0 / 10  ✅        │
│  Muse Blueprint         9.0 / 10  ✅        │
│  Uniqueness             8.2 / 10  ✅        │
│                                             │
│  [PROCEED TO VIDEO →]                       │
└─────────────────────────────────────────────┘
```

Composite score (0–100) displayed prominently. Score range label
(SHIP_IMMEDIATELY / SHIP_WITH_NOTES / SHIP_WITH_WARNINGS / SPRINT_LOOP / ABORT)
shown directly below. User sees both before ElevenLabs credits are spent.

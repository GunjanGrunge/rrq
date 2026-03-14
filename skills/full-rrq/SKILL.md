---
name: full-rrq
description: >
  Full RRQ Mode is a fully autonomous faceless animated YouTube channel system.
  No AI-generated faces. No avatars. Voice + animation only. Muse generates an
  AnimationBlueprint instead of a MuseBlueprint when faceless mode is active.
  TONY handles all visuals. Wan2.2 handles atmospheric b-roll. ElevenLabs
  handles voice. SkyReels EC2 is never launched. Three content formats:
  WHAT_IF, CONSPIRACY, and ANIME_SERIES (Coming Soon — LoRA pipeline, funded
  phase). Full RRQ is only available when the channel is niche-locked.
  SENTINEL monitors all infrastructure in autonomous mode and escalates via
  SNS + in-app on any failure. A sprint council with composite confidence
  scoring fires before any production spend is committed. A disclaimer modal
  is shown to the user before GO fires. Read this skill when building Full RRQ
  Mode, the AnimationBlueprint system, the sprint council scoring system, the
  SENTINEL integration, the faceless pipeline path, or the Full RRQ disclaimer
  modal.
---

# Full RRQ Mode — Faceless Animated Channel System

## What Full RRQ Is

```
Full RRQ = fully autonomous faceless animated channel.

No SkyReels. No avatar portraits. No EC2 GPU for talking heads.
Voice + animation only. Niche-locked channels only.

TONY handles all stills and animated visuals.
Wan2.2 handles atmospheric b-roll (environmental, cinematic, mood).
ElevenLabs handles all narration — voice cues preserved exactly as in
standard mode.

SENTINEL monitors all infrastructure in this mode. Failures are retried
automatically. If retry fails, SENTINEL escalates via SNS + in-app
notification. Nothing fails silently.

A sprint council with composite confidence scoring fires before any
production spend (before EC2 launches). No video enters production until
the sprint council clears it or the user overrides.

Oracle Domain 11 (AI detection resistance) runs pre-upload on every video.
```

---

## What Full RRQ Is Not

```
NOT Full RRQ's job:   Deciding what topic to cover           → Rex + ARIA + Regum
NOT Full RRQ's job:   Researching the topic                  → Qeon research step
NOT Full RRQ's job:   Generating the script                  → Qeon script step
NOT Full RRQ's job:   Managing upload schedule               → Regum + Theo
NOT Full RRQ's job:   QA and standards gate                  → Vera
NOT Full RRQ's job:   AI detection resistance policy         → Oracle Domain 11
NOT Full RRQ's job:   Agent stuck detection + recovery       → Universal escalation protocol
```

Full RRQ owns exactly three decisions:
1. Whether faceless mode is active for a given niche (toggled in settings, or set by GO RRQ)
2. Which content format runs (WHAT_IF / CONSPIRACY / LET RRQ DECIDE)
3. Whether the sprint council score clears the video for production spend

---

## Niche Lock Requirement

Full RRQ is only available when the channel is set to `NICHE_LOCKED` or
`MULTI_NICHE` mode in `channel-settings`. Open channels cannot run Full RRQ.

```
OPEN           Full RRQ not available. Manual mode only.
NICHE_LOCKED   Full RRQ available. All GO RRQ videos stay within the locked niche.
MULTI_NICHE    Full RRQ available. Rex selects from whichever niches are marked FACELESS.
```

The disclaimer modal checks this condition before rendering. If the channel is
OPEN, the GO RRQ button is disabled and shows: "Switch to a locked niche to
enable Full RRQ."

---

## Faceless Mode Is Not Exclusive to Full RRQ

Any user can toggle "Faceless" in the manual pipeline — not just GO RRQ.

```
Manual pipeline — Presenter Mode (default)
  Step 6: SkyReels V2 EC2 — talking head
  Step 7: Wan2.2 EC2 — b-roll
  Step 8: TONY Lambda — section cards, infographics, thumbnails

Manual pipeline — Faceless Mode (toggle)
  Step 6: SKIPPED (SkyReels EC2 never launched)
  Step 7: Wan2.2 EC2 — atmospheric b-roll only
  Step 8: TONY Lambda — ALL visual beats (no talking head beats in blueprint)
  Muse generates AnimationBlueprint instead of MuseBlueprint
```

Toggle placement: below the topic input field on the /create page.

```
Presenter  [○────]  Faceless

Sub-label (when Faceless selected):
"No avatar. TONY generates all visuals.
 Wan2.2 handles atmospheric b-roll. Voice only."
```

The manual mode faceless toggle does NOT trigger the sprint council or
SENTINEL. Those are Full RRQ (autonomous) features only.

---

## Niche + Mode Selection

Users can select multiple niches and set mode per niche independently.
Different niches can run different modes on the same channel.

```
Mode options per niche:
  FACE          Always use SkyReels presenter
  FACELESS      Always faceless — TONY + Wan2.2 only
  LET_RRQ       System evaluates per-video (Haiku decides at job start)

Example channel configuration:
  AI         → FACELESS   (TONY handles educational content perfectly alone)
  Finance    → FACELESS   (data viz dominant, infographics drive retention)
  Racing     → FACE       (reaction/commentary benefits from presenter presence)
```

This is written to `channel-settings` DynamoDB table at onboarding or in settings.

```typescript
// Appended to existing channel-settings schema
interface ChannelModeSettings {
  niches: {
    nicheId: string;
    mode: 'FACE' | 'FACELESS' | 'LET_RRQ';
  }[];
}
```

---

## Three Content Formats

```
WHAT_IF
  Standalone speculative videos.
  Premise: a specific plausible scenario + its real-world consequences.
  Examples:
    "What If China Attacked the US Power Grid Tomorrow"
    "What If OpenAI Goes Bankrupt Next Quarter"
    "What If Elon Musk Sold All His Tesla Stock in One Day"
  Structure:
    Cold open — the scenario stated as if it's happening now.
    Layer 1   — immediate consequences (first 48 hours).
    Layer 2   — cascade effects (first 30 days).
    Layer 3   — the world six months later.
    Verdict   — most likely path based on real precedents.
  Visual spine: INFOGRAPHIC + MAP_ANIMATION + STAT_CALLOUT dominant.
  Tension curve: POSSIBILITY_ESCALATION (each layer bigger than the last).

CONSPIRACY
  Investigative deep dive narratives.
  Premise: a real documented pattern + the question nobody is asking directly.
  Examples:
    "The Algorithm That Decides What You Believe"
    "Why Every Major Bank Predicted the Same Crash at the Same Time"
    "The Company That Owns the Software Inside Your Hospital"
  Structure:
    Cold open   — the anomaly. Something that doesn't add up.
    Evidence 1  — the documented facts.
    Evidence 2  — the connections most people haven't seen.
    Evidence 3  — the pattern that emerges.
    Verdict     — what this most likely means. Always delivered clearly.
  Visual spine: DOCUMENT_REVEAL + TIMELINE + INFOGRAPHIC dominant.
  Tension curve: COURTROOM (accusation → evidence → verdict).
  Rule: every claim in a CONSPIRACY video must be sourced. RRQ presents
        evidence — it does not fabricate or speculate as fact.

ANIME_SERIES
  Status: COMING SOON — LoRA pipeline not yet built.
  Parked for funded phase.
  Do not build. Do not wire. Table spec only (see Series Registry below).
  In the disclaimer modal: shown as disabled with "Coming Soon" label.
  Read skills/anime-series/SKILL.md for full future spec.
```

---

## AnimationBlueprint — Replaces MuseBlueprint in Faceless Mode

When faceless mode is active, Muse generates an `AnimationBlueprint`
instead of a `MuseBlueprint`. The pipeline reads from this blueprint
identically — it is a structural drop-in replacement. No other pipeline
step changes.

```typescript
// lib/muse/animation-blueprint.ts

export type AnimationVisualType =
  | 'TITLE_CARD'          // TONY — Remotion animated title sequence
  | 'INFOGRAPHIC'         // TONY — D3/Recharts data visualisation
  | 'TIMELINE'            // TONY — animated chronological sequence
  | 'MAP_ANIMATION'       // TONY — geographic data animation (d3-geo)
  | 'STAT_CALLOUT'        // TONY — bold statistic highlight card
  | 'QUOTE_CARD'          // TONY — styled evidence/quote overlay
  | 'TRANSITION'          // TONY — scene transition animation
  | 'DOCUMENT_REVEAL'     // TONY — document or evidence reveal animation
  | 'COMPARISON_CHART'    // TONY — side-by-side comparison layout
  | 'ATMOSPHERE';         // Wan2.2 — environmental b-roll only

export type SceneMood =
  | 'tense'
  | 'neutral'
  | 'revelatory'
  | 'urgent'
  | 'contemplative';

export interface AnimationScene {
  scene_id: string;
  duration_seconds: number;           // seconds
  narration_text: string;             // ElevenLabs script for this scene
  voice_cues: string[];               // RISE/PEAK/DROP/WARM/QUESTION/PIVOT/PAUSE/BREATH/EMPHASIS
  tony_visual_type: AnimationVisualType;
  visual_description: string;         // natural language brief for TONY or Wan2.2
  wan2_prompt?: string;               // only present if tony_visual_type = 'ATMOSPHERE'
  mood: SceneMood;
  text_overlays?: string[];           // on-screen text lines TONY renders into the visual
  data_payload?: Record<string, unknown>; // structured data for charts/infographics
}

export interface AnimationBlueprint {
  format: 'WHAT_IF' | 'CONSPIRACY' | 'ANIME_SERIES';
  title: string;
  hook: string;                  // first sentence of narration — must land before 0:30
  total_duration_seconds: number;
  scenes: AnimationScene[];

  // Metadata for downstream steps
  faceless: true;                // always true — signals pipeline to skip SkyReels
  tony_task_count: number;       // count of TONY visual scenes
  wan2_task_count: number;       // count of ATMOSPHERE scenes
  dominant_mood: SceneMood;      // overall emotional register for the video
  retention_wall_notes: {
    wall1?: string;              // 0:30 — hook + pre-commitment
    wall2?: string;              // 1:00 — first payoff
    midpoint?: string;           // midpoint re-hook
    wall4?: string;              // 2 min before end — final tease
  };
}
```

### AnimationBlueprint — Muse Prompt Rules

```
Rules Muse follows when writing visual_description:
  Always specify dimensions (1920x1080 unless noted otherwise)
  Always specify background (dark unless noted otherwise)
  Always specify animation direction (left to right, fade, count-up, etc.)
  Always specify colour for key elements (amber accents, white text)
  Never say "make it look good" — describe the exact output
  Always include data_payload keys so TONY can reference real numbers
  wan2_prompt only present on ATMOSPHERE scenes — not on TONY scenes

Rules TONY follows when receiving visual_description:
  visual_description is the design brief — execute it, do not interpret it
  If data_payload is present, use the numbers from it — not approximations
  Output: PNG for static, MP4 for animated (per beat)
  Resolution: 1920x1080 unless Muse specifies otherwise
  Max retry: 3 (Haiku regenerates code on failure, Vera QA inline)
```

---

## Pre-Production Sprint Council

The sprint council fires BEFORE any production spend is committed.
No EC2 instance launches — no ElevenLabs credits are used — until
the sprint council clears the video.

This is not a quality gate on output. It is a pre-spend confidence
evaluation on the topic, angle, and format selection. It costs
fractions of a cent (Haiku calls only) and prevents wasting $0.52
on a video that should never have been greenlit.

### Composite Confidence Score

Six dimensions are scored and weighted into a single composite score (0–100).

```
Rex confidence score           20%
  Rex's internal confidence on the topic opportunity.
  Source: rex-watchlist DynamoDB record for this topic.
  High: strong signal, low maturity, channel-fit confirmed.
  Low: weak signal, saturated window, low channel-fit.

Regum fit score                20%
  Does this topic fit the channel's content calendar and niche balance?
  Source: Regum Sonnet call with channel-settings + recent upload history.
  High: complements recent uploads, within locked niche, on-schedule.
  Low: too similar to recent video, outside niche, poor calendar slot.

Qeon producibility score       15%
  Can the pipeline produce this topic in full faceless mode?
  Source: Haiku evaluation of topic against AnimationBlueprint feasibility.
  High: data-driven topic, TONY can visualise it, strong b-roll candidates.
  Low: requires human footage, real faces, or demonstrations TONY cannot render.

Script quality score           25%
  Quality and originality of the script brief relative to existing YouTube content.
  Source: Haiku evaluation of script brief against Oracle CONTENT_TREND_SIGNALS.
  High: fresh angle, specific premise, strong hook candidate.
  Low: generic angle, indistinct from existing top-10 results, weak hook.

The Line synthesis score       10%
  Does the full brief hold together as a cohesive video?
  Source: The Line Sonnet call evaluating all inputs together.
  High: consistent narrative, format matches topic, tone consistent.
  Low: format mismatch, contradictory signals from agents, incoherent premise.

Oracle alignment score         10%
  Does this topic align with what Oracle's current knowledge base shows
  is performing in this niche?
  Source: Oracle Bedrock KB query on topic + niche + format.
  High: Oracle confirms format works in niche, topic resonates with audience.
  Low: Oracle sees no evidence this format works here, or topic is oversaturated.
```

### Score Ranges and Decisions

```
90–100   SHIP            Clear for production. No notes required.
75–89    SHIP_WITH_NOTES Clear for production. Council notes attached to job.
60–74    SHIP_WITH_WARNINGS  Production allowed. Specific warnings logged.
                            Vera QA threshold increased for this video.
40–59    SPRINT_LOOP     Sent back to Rex + Regum for topic/angle revision.
                         One revision cycle allowed. If score still < 60 —
                         escalate to user per CONFIDENCE_SCORE policy.
 0–39    ABORT           Topic and angle are not viable. Job aborted.
                         Zeus writes episode to memory. Rex updates watchlist.
                         No user notification unless user is manually watching.
```

### TypeScript Interface

```typescript
// lib/full-rrq/sprint-council.ts

export type SprintCouncilVerdict =
  | 'SHIP'
  | 'SHIP_WITH_NOTES'
  | 'SHIP_WITH_WARNINGS'
  | 'SPRINT_LOOP'
  | 'ABORT';

export interface SprintCouncilScore {
  rex_confidence: number;           // 0–20
  regum_fit: number;                // 0–20
  qeon_producibility: number;       // 0–15
  script_quality: number;           // 0–25
  the_line_synthesis: number;       // 0–10
  oracle_alignment: number;         // 0–10
  composite: number;                // 0–100 weighted total
  verdict: SprintCouncilVerdict;
  notes: string[];                  // agent-specific notes attached to job
  warnings: string[];               // specific warnings for SHIP_WITH_WARNINGS
  evaluatedAt: string;              // ISO timestamp
}

export interface SprintCouncilResult {
  jobId: string;
  score: SprintCouncilScore;
  proceedToProduction: boolean;
  abortReason?: string;
  revisionInstruction?: string;     // present when verdict = SPRINT_LOOP
}
```

### Sprint Council Flow

```
┌─────────────────────────────────────────────────────┐
│                 SPRINT COUNCIL FIRES                 │
│        (after script brief, before EC2 launch)       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │  Six scores computed  │
             │  in parallel (Haiku)  │
             └──────────┬────────────┘
                        │
                        ▼
             ┌───────────────────────┐
             │  The Line synthesises │
             │  composite score      │
             └──────────┬────────────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
    90–100 / 75–89    60–74         40–59 / 0–39
          │             │              │
          ▼             ▼              ▼
       SHIP          SHIP WITH    SPRINT_LOOP or ABORT
    production       WARNINGS     (no EC2 launched)
       begins        production
       now           begins now
                     (Vera QA
                     threshold ↑)
```

---

## SENTINEL Integration

SENTINEL is active only in autonomous Full RRQ mode. It is not active
in manual pipeline runs.

```
SENTINEL monitors:
  All Inngest workflow steps for the active Full RRQ job
  Lambda invocation failures (TONY, visual-gen, audio-gen, av-sync)
  EC2 spot instance status (Wan2.2) — spot reclaim, timeout, exit codes
  DynamoDB write failures on job state transitions
  ElevenLabs API response codes — 429, 5xx
  YouTube Data API upload errors

SENTINEL's retry policy (before escalation):
  Lambda invocation failure     Retry up to 2 times with 30s backoff
  EC2 spot reclaim              Relaunch Wan2.2 instance once (same job payload)
  ElevenLabs 429                Rotate to next account (4 accounts available)
  ElevenLabs 5xx                Fallback to Edge-TTS for this video
  YouTube upload error          Retry up to 3 times with exponential backoff

SENTINEL escalation path:
  If retry succeeds             Log to DynamoDB + Comms. No user notification.
  If retry fails                Fire SNS topic + write to notifications table.
                                User receives in-app + email per escalation policy.
                                Zeus evaluates before user is contacted.

SENTINEL does NOT:
  Override Zeus escalation decisions
  Retry quality gate failures (those are handled by universal escalation)
  Contact the user directly — always routes through Zeus + notification system
```

```typescript
// lib/full-rrq/sentinel.ts

export type SentinelEvent =
  | 'LAMBDA_FAILURE'
  | 'EC2_SPOT_RECLAIM'
  | 'ELEVENLABS_RATE_LIMIT'
  | 'ELEVENLABS_ERROR'
  | 'YOUTUBE_UPLOAD_FAILURE'
  | 'DYNAMO_WRITE_FAILURE'
  | 'INNGEST_STEP_TIMEOUT';

export interface SentinelAlert {
  alertId: string;
  jobId: string;
  event: SentinelEvent;
  component: string;            // e.g. "audio-gen", "wan2-instance", "uploader"
  errorMessage: string;
  retryAttempt: number;         // 0 = first failure, 1 = after first retry, etc.
  retrySucceeded: boolean;
  escalatedToZeus: boolean;
  escalatedAt?: string;
  resolvedAt?: string;
}

export async function sentinelRetry(
  alert: SentinelAlert,
  retryFn: () => Promise<void>,
): Promise<void> {
  try {
    await retryFn();
    alert.retrySucceeded = true;
    await logSentinelAlert({ ...alert, resolvedAt: new Date().toISOString() });
  } catch (err) {
    alert.retrySucceeded = false;
    await logSentinelAlert(alert);
    await escalate('SENTINEL_RETRY_FAILED', alert.jobId, [], {
      userId: await getUserIdFromJob(alert.jobId),
      videoTitle: await getVideoTitleFromJob(alert.jobId),
      videoId: alert.jobId,
      stepContext: { alert },
    });
  }
}
```

---

## Series State Machine (WHAT_IF + CONSPIRACY)

WHAT_IF and CONSPIRACY are not necessarily one-off videos. Rex monitors
audience signals after every video to determine whether a follow-up is
warranted. Oracle decides whether to continue, expand, or close a narrative
thread.

```
Rex monitors per video (24hr + 7-day windows):
  "what happened next?" comment volume
  Search traffic for follow-up queries on the same topic
  Retention at the 80% mark (indicates appetite for more)
  Community post engagement on related threads

Oracle arc decision types:
  CONTINUE          Strong signals — follow-up video warranted
  EXPAND            Audience engaging with a sub-topic — dedicated video on that angle
  CLOSE             Topic has resolved or audience appetite is exhausted
  SPIN_OFF_SERIES   Persistent signal across 3+ videos — elevate to recurring format

Regum executes:
  Writes nextEpisodeBrief to series-registry if CONTINUE or EXPAND
  Updates currentArc field
  Schedules follow-up in regum-schedule
  Broadcasts arc decision in Comms
```

```typescript
// lib/full-rrq/series-state.ts

export type ArcDecision =
  | 'CONTINUE'
  | 'EXPAND'
  | 'CLOSE'
  | 'SPIN_OFF_SERIES';

export interface SeriesEntry {
  seriesId: string;
  channelId: string;
  userId: string;
  format: 'WHAT_IF' | 'CONSPIRACY';
  title: string;
  premise: string;
  episodeCount: number;
  currentArc: string;
  nextEpisodeBrief: string;
  audienceSignals: {
    signal: string;
    source: 'COMMENTS' | 'RETENTION' | 'SEARCH' | 'COMMUNITY_POST';
    weight: number;
    capturedAt: string;
  }[];
  arcHistory: string[];
  status: 'ACTIVE' | 'ON_HOLD' | 'CONCLUDED' | 'COMING_SOON';
  createdAt: string;
  lastEpisodePublishedAt?: string;
}
```

### DynamoDB Table: series-registry

```
PK:  seriesId           e.g. "series_whif_001"
GSI: channelId, userId, status, format
fields:
  seriesId, channelId, userId
  format                WHAT_IF | CONSPIRACY
  title                 Series/topic title
  premise               2–3 sentence premise summary
  episodeCount          total episodes published
  currentArc            active narrative thread
  nextEpisodeBrief      what happens in the next episode (null if CONCLUDED)
  audienceSignals[]     Rex signal objects with source + weight
  arcHistory[]          past arc names for continuity reference
  status                ACTIVE | ON_HOLD | CONCLUDED | COMING_SOON
  createdAt, lastEpisodePublishedAt
```

---

## Disclaimer Modal — Before GO RRQ Launches

Shown immediately after the user clicks [GO RRQ] in the Zeus Command Center.
User must actively confirm before Full RRQ fires.

### Modal Spec

```
┌──────────────────────────────────────────────────────────────────┐
│  LAUNCHING FULL RRQ MODE                                          │
│  Review before your autonomous channel goes live                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CONTENT FORMAT                                                   │
│                                                                   │
│  ○  WHAT IF           Standalone speculative videos               │
│     "What If China Attacked the US Power Grid Tomorrow"           │
│                                                                   │
│  ○  CONSPIRACY        Investigative deep dive narratives          │
│     "The Algorithm That Decides What You Believe"                 │
│                                                                   │
│  ●  LET RRQ DECIDE    Rex + Regum pick the best format            │
│                       per topic automatically                     │
│                                                                   │
│  ░  ANIME SERIES      Coming Soon                                 │
│     LoRA pipeline in funded phase                                 │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CHANNEL CONFIGURATION                                            │
│                                                                   │
│  Locked niche:        AI · Finance                                │
│  Production mode:     Faceless (TONY + Wan2.2)                    │
│  SENTINEL:            Active (autonomous mode)                    │
│  Upload frequency:    2 videos / week (Regum scheduling)          │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  SPRINT COUNCIL SCORE                                             │
│                                                                   │
│  Evaluated per-video before production begins.                    │
│  Score below 60: topic sent back for revision.                    │
│  Score below 40: topic aborted. No spend committed.              │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  IMPORTANT                                                        │
│                                                                   │
│  This mode runs fully autonomously. RRQ will:                     │
│    · Select topics without asking you first                       │
│    · Spend ~$0.52 per video on AWS + ElevenLabs                  │
│    · Upload directly to your YouTube channel                      │
│    · Notify you only when a job fails or is stuck                 │
│                                                                   │
│  To stop: return here and click [PAUSE FULL RRQ] at any time.    │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [LAUNCH FULL RRQ]                          [Cancel]              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Modal Design Notes

```
Format radio buttons:
  WHAT_IF, CONSPIRACY, LET_RRQ_DECIDE — all selectable
  ANIME_SERIES — disabled state, strikethrough label, "Coming Soon" chip

[LAUNCH FULL RRQ] button:
  Amber, full width of right column
  GSAP cinematic sweep animation on click before firing (same as GO RRQ button)
  Disabled if channel is OPEN (shows: "Switch to a locked niche to enable")

[Cancel] — text link, no button styling, right-aligned

[PAUSE FULL RRQ] button:
  Shown in Zeus Command Center after Full RRQ is active
  Amber outline (not filled), stops autonomous job queue
  Does not abort in-progress jobs — lets current job finish, pauses queue
```

### Modal State Machine

```typescript
// components/zeus/FullRRQModal.tsx

type ModalState =
  | 'REVIEWING'          // user reading, hasn't chosen format yet
  | 'FORMAT_SELECTED'    // format radio chosen
  | 'READY'              // format selected, channel is niche-locked
  | 'LAUNCHING'          // [LAUNCH FULL RRQ] clicked, sweep animation running
  | 'LAUNCHED';          // GO RRQ event fired, modal closes

// [LAUNCH FULL RRQ] button is enabled only in state: FORMAT_SELECTED or READY
// After LAUNCHED: Zeus Command Center live feed activates
// After LAUNCHED: SENTINEL activates for the session
```

---

## Production Stack

```
TONY Lambda
  All AnimationBlueprint scenes where tony_visual_type ≠ 'ATMOSPHERE'
  Remotion / D3 / Recharts / Nivo / Chart.js
  Receives: visual_description, data_payload, text_overlays
  Outputs: PNG (static) or MP4 (animated) per scene
  Max 3 retries per scene — Haiku regenerates code on failure
  Vera QA inline after each TONY batch

Wan2.2 EC2 (g5.2xlarge spot)
  All AnimationBlueprint scenes where tony_visual_type = 'ATMOSPHERE'
  Receives: wan2_prompt, duration_seconds
  Outputs: atmospheric b-roll MP4 per scene
  SENTINEL monitors for spot reclaim — relaunches once on reclaim

ElevenLabs (4-account rotation)
  All narration_text fields from AnimationBlueprint scenes, in order
  voice_cues markers processed by audio-gen Lambda
  Edge-TTS fallback if ElevenLabs fails after account rotation exhausted

SkyReels EC2
  NEVER launched in Full RRQ mode.
```

---

## Faceless Pipeline — What Changes vs Standard Mode

Only the steps that differ are listed. All other steps run identically.

```
STANDARD MODE             FACELESS MODE (Full RRQ)
─────────────             ───────────────────────
Step 1   Research         Step 1   Research (identical)
Step 2   Script           Step 2   Script → AnimationBlueprint (not MuseBlueprint)
Step 3   SEO              Step 3   SEO (identical)
Step 4   Quality Gate     Step 4   Quality Gate (identical)
         Council                   Sprint Council (new — fires before Step 5)
Step 5   Audio            Step 5   Audio (identical — ElevenLabs unchanged)
Step 6   SkyReels EC2     Step 6   SKIPPED — not launched, not billed
Step 7   Wan2.2           Step 7   Wan2.2 — ATMOSPHERE scenes only
Step 8   TONY Lambda      Step 8   TONY Lambda — ALL visual scenes
                                   (receives AnimationBlueprint scenes)
Step 9   visual-gen       Step 9   visual-gen (Chart.js/Mermaid if any
                                   CHART/DIAGRAM beats remain)
Step 10  AV Sync          Step 10  AV Sync (identical — FFmpeg stitches what's there)
Step 11  Vera QA          Step 11  Vera QA (identical)
         Oracle D11                Oracle Domain 11 (identical)
Step 12  Shorts           Step 12  Shorts (identical)
Step 13  Upload           Step 13  Upload (identical)
```

### Qeon Faceless Mode Detection

```typescript
// lib/agents/qeon/pipeline.ts — added to job start

const isFaceless = await resolveProductionMode(
  brief.nicheId,
  brief.topicId,
  userId
);

// resolveProductionMode checks:
// 1. channel-settings mode for this niche (FACE / FACELESS / LET_RRQ)
// 2. If LET_RRQ — calls Haiku with topic + niche to decide per-video
// 3. Returns boolean

if (isFaceless) {
  // Sprint council fires before production spend
  const councilResult = await runSprintCouncil(brief, jobId);
  if (!councilResult.proceedToProduction) {
    await abortOrRevise(councilResult, brief, jobId);
    return;
  }

  // Muse generates AnimationBlueprint (not MuseBlueprint)
  const blueprint = await museFaceless(brief, research);

  // Step 6 is a no-op — SkyReels EC2 never launched
  // Step 8 maps AnimationBlueprint scenes → invokeTonyBatch() tasks
  const tonyTasks = blueprint.scenes
    .filter(s => s.tony_visual_type !== 'ATMOSPHERE')
    .map(s => buildTonyTaskFromScene(s));

  const wan2Tasks = blueprint.scenes
    .filter(s => s.tony_visual_type === 'ATMOSPHERE')
    .map(s => buildWan2TaskFromScene(s));

  // Parallel execution — same Promise.allSettled() pattern
  await Promise.allSettled([
    invokeTonyBatch(tonyTasks, jobId),
    runWan2Instance(wan2Tasks, jobId),
  ]);
}
```

---

## What Gets Skipped in Faceless Mode — Definitive List

```
SkyReels EC2 instance launch    — never started, never billed
Avatar selection                — no avatar ID on the job
Avatar profile lookup           — not read
FLUX portrait generation        — not triggered
Presenter roster matching       — not run
CharacterBrief lookup           — not read

Everything else runs identically.
```

---

## Oracle Domain 11 — Pre-Upload AI Detection Check

Runs after Vera QA is cleared, before Theo uploads. Part of the Oracle
domain spec — wired here for pipeline integration reference.

```typescript
{
  id: "AI_DETECTION_RESISTANCE",
  name: "AI Detection Resistance Check",
  triggerType: "PER_VIDEO",         // not a scheduled run — fires per video
  primaryAgent: "VERA",             // Vera triggers it
  model: "haiku",                   // fast checklist — not deep research
  checkDimensions: [
    "Visual diversity vs last 10 videos",
    "Audio cadence variation vs last 10 videos",
    "Title + description structural similarity",
    "Topic cooldown compliance (72h dedup)",
    "Upload timing variance from pattern",
  ],
  onPass: "PROCEED_TO_UPLOAD",
  onHold: "ESCALATE_PER_POLICY",
  escalationPolicy: {
    maxAttempts: 3,        // Muse revises visual layer, Qeon re-runs TONY tasks
    onMaxExceeded: "ZEUS_NOTIFICATION",
  }
}
```

---

## DynamoDB Tables

### series-registry (described in Series State Machine section above)

Full schema reference:

```
series-registry
  PK:  seriesId
  GSI: channelId, userId, status, format
  TTL: none — series records are permanent

channel-confidence (Full RRQ confidence score cache)
  PK: channelId
  fields: overall, label, perNiche[], dimensionBreakdown{},
          reasoning, risks[], suggestions[], evaluatedAt, ttl
  TTL: 24 hours — re-evaluate anytime via [Re-evaluate] button
```

---

## Environment Variables

```bash
# No new variables required for Full RRQ Mode.
# Reuses:
#   TONY_LAMBDA_ARN         — already set in Phase 4c
#   EC2_WAN2_AMI_ID         — already set
#   ELEVENLABS_KEY_1-4      — already set
#   BEDROCK_KB_ID           — already set for Oracle queries

# Optional future addition (Oracle Domain 11):
ORACLE_AI_DETECTION_CHECK=true   # enable/disable per-video check
```

---

## Build Checklist

```
[ ] Read muse/SKILL.md — AnimationBlueprint is a MUSE output
[ ] Read tony/SKILL.md — visual_description contract
[ ] Read oracle/SKILL.md — Domain 11 spec wiring
[ ] Read escalation/SKILL.md — SENTINEL escalation paths

[ ] Create lib/full-rrq/ folder
[ ] Create lib/full-rrq/sprint-council.ts      — 6-dimension composite scorer
[ ] Create lib/full-rrq/resolve-mode.ts        — FACE/FACELESS/LET_RRQ resolver
[ ] Create lib/full-rrq/sentinel.ts            — SENTINEL retry + escalation
[ ] Create lib/full-rrq/series-state.ts        — SeriesEntry type + arc decision logic
[ ] Create lib/muse/animation-blueprint.ts     — AnimationBlueprint types + Muse generator
[ ] Create lib/full-rrq/tony-from-scene.ts     — AnimationScene → TonyTask builder
[ ] Create lib/full-rrq/wan2-from-scene.ts     — AnimationScene → Wan2Task builder

[ ] Add AnimationBlueprint to shared lambda-types
[ ] Add 'faceless' flag to production-jobs DynamoDB schema
[ ] Add series-registry DynamoDB table
[ ] Add channel-confidence DynamoDB table

[ ] Update Qeon pipeline: detect faceless mode at job start
[ ] Update Qeon: fire sprint council before Step 5 when faceless = true
[ ] Update Qeon Step 6: no-op when faceless is true
[ ] Update Qeon Step 8: route AnimationBlueprint scenes to Tony + Wan2 tasks

[ ] Update Muse: check faceless flag → branch to generateAnimationBlueprint()
[ ] Update Muse: write WHAT_IF and CONSPIRACY format prompts for Opus

[ ] Wire Oracle Domain 11 per-video check after Vera QA clears
[ ] Wire Domain 11 escalation policy (max 3 attempts → Zeus notification)
[ ] Wire SENTINEL to Inngest step failures, Lambda errors, EC2 spot events

[ ] Create components/zeus/FullRRQModal.tsx    — disclaimer modal + format picker
[ ] Create components/settings/NicheModeSelector.tsx — per-niche mode toggle
[ ] Add SENTINEL status indicator in Zeus Command Center live feed
[ ] Add sprint council score display per job in Kanban

[ ] Add ANIME_SERIES disabled state + "Coming Soon" chip in modal

[ ] Test faceless pipeline end-to-end — verify SkyReels step is skipped
[ ] Test sprint council — score below 40 aborts job before EC2 launches
[ ] Test sprint council — score 40–59 triggers revision loop, not production
[ ] Test SENTINEL retry — Lambda failure retried twice before escalation fires
[ ] Test SENTINEL escalation — retry failure writes notification + routes to Zeus
[ ] Test TONY task generation from AnimationBlueprint scenes
[ ] Test LET_RRQ mode resolution — verify Haiku decides per-video
[ ] Test modal state machine — all 5 states transition correctly
[ ] Test WHAT_IF format AnimationBlueprint generation with Muse
[ ] Test CONSPIRACY format AnimationBlueprint generation with Muse
[ ] Verify Oracle context is injected into sprint council scoring
[ ] Verify 72h topic cooldown is enforced in faceless mode (same dedup as standard)
[ ] Verify Regum upload timing randomness applies in Full RRQ Mode
[ ] Verify Oracle Domain 11 fires after Vera clears (not before)
[ ] Verify niche-lock check blocks Full RRQ launch on OPEN channels
```

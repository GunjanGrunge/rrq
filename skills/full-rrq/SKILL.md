---
name: full-rrq
description: >
  Full RRQ Mode is a fully autonomous faceless animated YouTube channel system.
  No AI-generated faces. No avatars. Voice + animation only. Muse generates an
  AnimationBlueprint instead of a MuseBlueprint when faceless mode is active.
  TONY handles all visuals. Wan2.2 handles atmospheric b-roll. ElevenLabs
  handles voice. SkyReels EC2 is never launched. Three content formats:
  WHAT_IF, CONSPIRACY, and ANIME_SERIES (Coming Soon). Faceless mode is also
  available as a user toggle in the manual pipeline — not exclusive to Full RRQ.
  Read this skill when building Full RRQ Mode, the AnimationBlueprint system,
  the confidence score evaluator, the faceless pipeline path, or the Full RRQ
  disclaimer modal.
---

# Full RRQ Mode — Faceless Animated Channel System

## What Full RRQ Is

```
Full RRQ = faceless animated channel.

No SkyReels. No avatar portraits. No EC2 GPU for talking heads.
Voice + animation only.

TONY handles all stills and animated visuals.
Wan2.2 handles atmospheric b-roll (environmental, cinematic, mood).
ElevenLabs handles all narration — voice cues preserved exactly as in
standard mode.

This is not a downgrade. Faceless animated channels routinely outperform
avatar channels in niches where data visualisation and investigative
storytelling dominate. TONY's Remotion compositions are generated fresh
per video — never identical. Oracle Domain 11 runs an AI detection
resistance check before every upload.
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
```

Full RRQ owns exactly two decisions:
1. Whether faceless mode is active for a given niche (toggled in settings, or set by GO RRQ)
2. Which content format runs (WHAT_IF / CONSPIRACY / LET RRQ DECIDE)

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

export type SceneMood = 'tense' | 'neutral' | 'revelatory' | 'urgent' | 'contemplative';

export interface AnimationScene {
  sceneId: string;
  duration: number;              // seconds
  narration: string;             // ElevenLabs script for this scene
  voiceCues: string[];           // RISE/PEAK/DROP/WARM/QUESTION/PIVOT/PAUSE/BREATH/EMPHASIS
  visualType: AnimationVisualType;
  tonyPrompt?: string;           // if TONY visual — natural language task description
  wan2Prompt?: string;           // if ATMOSPHERE — Wan2.2 generation prompt
  mood: SceneMood;
  textOverlays?: string[];       // on-screen text lines TONY renders into the visual
  dataPayload?: Record<string, unknown>; // structured data for charts/infographics
}

export interface AnimationBlueprint {
  format: 'WHAT_IF' | 'CONSPIRACY' | 'ANIME_SERIES';
  title: string;
  hook: string;                  // first sentence of narration — must land before 0:30
  totalDuration: number;         // seconds
  scenes: AnimationScene[];

  // Metadata for downstream steps
  faceless: true;                // always true — signals pipeline to skip SkyReels
  tonyTaskCount: number;         // count of TONY visual scenes
  wan2TaskCount: number;         // count of ATMOSPHERE scenes
  dominantMood: SceneMood;       // overall emotional register for the video
  retentionWallNotes: {
    wall1?: string;              // 0:30 — hook + pre-commitment
    wall2?: string;              // 1:00 — first payoff
    midpoint?: string;           // midpoint re-hook
    wall4?: string;              // 2 min before end — final tease
  };
}
```

### AnimationBlueprint — Example Output

WHAT_IF format, 10-minute video, 8 scenes illustrated:

```json
{
  "format": "WHAT_IF",
  "title": "What If China Attacked the US Power Grid Tomorrow",
  "hook": "At 3:47am Eastern, the lights go out. Not in one city. In all of them.",
  "totalDuration": 612,
  "faceless": true,
  "tonyTaskCount": 6,
  "wan2TaskCount": 2,
  "dominantMood": "tense",
  "retentionWallNotes": {
    "wall1": "Hook lands at 0:18 — dark cityscape atmosphere + title card. Pre-commitment: 'We ran this scenario through real infrastructure data.'",
    "wall2": "First payoff at 0:55 — INFOGRAPHIC showing actual grid interdependency map.",
    "midpoint": "Re-hook at 5:10 — 'But here's what the models missed.' PIVOT cue + new MAP_ANIMATION.",
    "wall4": "Final tease at 8:30 — 'One country has already run a live test of this. It wasn't China.'"
  },
  "scenes": [
    {
      "sceneId": "scene_01",
      "duration": 28,
      "narration": "At 3:47am Eastern, the lights go out. Not in one city. In all of them. [PAUSE — 1.8s] Power grids in 14 states drop simultaneously. Every hospital on backup. Every traffic system dark. [RISE] And it takes the US government six minutes to confirm what happened.",
      "voiceCues": ["PAUSE — 1.8s", "RISE"],
      "visualType": "TITLE_CARD",
      "tonyPrompt": "Animated title sequence. Dark background, deep charcoal to black gradient. Bold white text fades in: 'WHAT IF CHINA ATTACKED THE US POWER GRID TOMORROW'. Amber amber accent lines animate in from left. Subtle pulse effect on text. Cinematic, urgent. 1920x1080.",
      "mood": "tense",
      "textOverlays": ["WHAT IF CHINA ATTACKED THE US POWER GRID TOMORROW"]
    },
    {
      "sceneId": "scene_02",
      "duration": 45,
      "narration": "[PEAK] Here is what the US power grid actually looks like. [DROP] Three interconnected regions. 3,000 utilities. 200,000 miles of high-voltage transmission lines — and 9 critical substations that, if taken offline, would affect 80% of all electricity delivery in the continental United States.",
      "voiceCues": ["PEAK", "DROP"],
      "visualType": "MAP_ANIMATION",
      "tonyPrompt": "Animated US map using d3-geo. Show three grid regions: Western Interconnection, Eastern Interconnection, ERCOT. Animate transmission lines appearing as amber threads. Pulse 9 critical substations as red dots with concentric rings. Dark background. Legend bottom left. Data-driven, not decorative.",
      "mood": "tense",
      "dataPayload": {
        "regions": ["Western Interconnection", "Eastern Interconnection", "ERCOT"],
        "criticalNodes": 9,
        "transmissionMiles": 200000,
        "utilities": 3000
      }
    },
    {
      "sceneId": "scene_03",
      "duration": 18,
      "narration": "[RISE] That is the vulnerability map. [PAUSE — 1.0s] And Chinese state hackers have had access to US grid networks since at least 2023. That is not speculation. That is the FBI.",
      "voiceCues": ["RISE", "PAUSE — 1.0s"],
      "visualType": "QUOTE_CARD",
      "tonyPrompt": "Styled quote card. Dark background. Large amber quotation marks top left. Source: 'FBI Director Christopher Wray, Congressional Testimony, 2024'. Bold white quote text. Subtle paper texture. Reveal animation — text appears word by word, left to right.",
      "mood": "revelatory",
      "textOverlays": ["\"Chinese hackers are pre-positioning on American infrastructure.\"", "— FBI Director Christopher Wray, 2024"]
    },
    {
      "sceneId": "scene_04",
      "duration": 72,
      "narration": "[PIVOT] So what actually happens in the first 48 hours? [BREATH] First six hours: hospitals exhaust generator fuel. Most hospital backup systems are designed for 72 hours — but generator fuel delivery is a road transport problem, and road transport depends on traffic lights, fuel pumps, and communication networks. All of which require electricity.",
      "voiceCues": ["PIVOT", "BREATH"],
      "visualType": "TIMELINE",
      "tonyPrompt": "Animated timeline. Horizontal axis: 0 hours to 48 hours. Each time marker appears with a connecting line and event card. Events: 0h — Grid down. 1h — Emergency generators activate nationwide. 6h — Fuel supply chain breaks. 12h — Hospital critical patients at risk. 24h — Water treatment halts (electric pumps). 48h — Civil unrest signals. Dark background, amber timeline line, white text cards. Animate each event card appearing sequentially.",
      "mood": "urgent",
      "dataPayload": {
        "timelineEvents": [
          { "hour": 0, "event": "Grid down — 14 states" },
          { "hour": 1, "event": "Emergency generators activate" },
          { "hour": 6, "event": "Fuel supply chain breaks" },
          { "hour": 12, "event": "Hospital critical patients at risk" },
          { "hour": 24, "event": "Water treatment halts" },
          { "hour": 48, "event": "Civil unrest signals emerge" }
        ]
      }
    },
    {
      "sceneId": "scene_05",
      "duration": 30,
      "narration": "The economic cost models are stark. [PEAK] A 24-hour nationwide outage costs the US economy between 243 and 480 billion dollars. That is one day. The record longest blackout in US history lasted 11 days.",
      "voiceCues": ["PEAK"],
      "visualType": "STAT_CALLOUT",
      "tonyPrompt": "Bold stat callout card. Large number '$243B–$480B' in amber, animated counting up from zero. Sub-label: 'Cost of a single 24-hour nationwide outage'. Below: secondary stat 'Record US blackout: 11 days' in smaller white text. Dark card background, subtle grid lines. Cinematic card shadow.",
      "mood": "urgent",
      "dataPayload": {
        "costLow": 243000000000,
        "costHigh": 480000000000,
        "recordBlackoutDays": 11
      }
    },
    {
      "sceneId": "scene_06",
      "duration": 40,
      "narration": "[WARM] Here is the part that gets genuinely complicated. The US has the ability to retaliate against Chinese digital infrastructure immediately. But a retaliatory cyberattack on Chinese grid systems would affect 1.4 billion people — most of them civilians. [QUESTION] How do you calibrate a proportional response to an invisible attack?",
      "voiceCues": ["WARM", "QUESTION"],
      "visualType": "COMPARISON_CHART",
      "tonyPrompt": "Side-by-side comparison. Left panel: US grid — population affected 330M, recovery time estimate 11-21 days, backup infrastructure rating 'partial'. Right panel: China grid — population affected 1.4B, recovery time estimate unknown, backup infrastructure rating 'hardened regional'. Amber dividing line. Both panels animate in from centre. Bold headers, clean data rows.",
      "mood": "contemplative",
      "dataPayload": {
        "usPopulation": 330000000,
        "chinaPopulation": 1400000000
      }
    },
    {
      "sceneId": "scene_07",
      "duration": 55,
      "narration": "[ATMOSPHERE] The reality of a long-term blackout is not cinematic. It is quiet, slow, and deeply ordinary — people managing without refrigeration, without heat in winter, without the infrastructure that makes modern cities function.",
      "voiceCues": [],
      "visualType": "ATMOSPHERE",
      "wan2Prompt": "Dark city at night with no lights. Streets empty. Candles visible in apartment windows. Overcast sky, cold blue moonlight. Cinematic wide shot. No people visible. Still, quiet, eerie. 720p.",
      "mood": "contemplative"
    },
    {
      "sceneId": "scene_08",
      "duration": 62,
      "narration": "[RISE] The most likely outcome, based on the Volt Typhoon precedent and current US infrastructure hardening timelines: a targeted attack on 3-4 key substations. [PEAK] Not a total blackout — a demonstration. A message. [DROP] The question is whether the US response treats it as an act of war or an intelligence operation. [PAUSE — 2.0s] [WARM] That distinction determines the next decade.",
      "voiceCues": ["RISE", "PEAK", "DROP", "PAUSE — 2.0s", "WARM"],
      "visualType": "INFOGRAPHIC",
      "tonyPrompt": "Scenario probability infographic. Three horizontal bars labelled: 'Full nationwide attack', 'Targeted substation strike (3-4 nodes)', 'Intelligence positioning only'. Probability bars animate left to right: 8%, 67%, 25%. Amber bars on dark background. Title: 'Most Likely Scenario'. Source note bottom: 'Based on Volt Typhoon infrastructure access patterns, 2023-2025'. Clean, data-driven.",
      "mood": "neutral",
      "dataPayload": {
        "scenarios": [
          { "label": "Full nationwide attack", "probability": 0.08 },
          { "label": "Targeted substation strike (3-4 nodes)", "probability": 0.67 },
          { "label": "Intelligence positioning only", "probability": 0.25 }
        ]
      }
    }
  ]
}
```

---

## TONY Prompt Contract for AnimationBlueprint

TONY receives `tonyPrompt` from each scene's blueprint entry exactly as written.
Muse owns the prompt. TONY does not improvise on it.

```
Rules Muse follows when writing tonyPrompt:
  Always specify dimensions (1920x1080 unless noted otherwise)
  Always specify background (dark unless noted otherwise)
  Always specify animation direction (left to right, fade, count-up, etc.)
  Always specify colour for key elements (amber accents, white text)
  Never say "make it look good" — describe the exact output
  Always include dataPayload keys so TONY can reference real numbers

Rules TONY follows when receiving tonyPrompt:
  tonyPrompt is the design brief — execute it, do not interpret it
  If dataPayload is present, use the numbers from it — not approximations
  Output: PNG for static, MP4 for animated (per beat)
  Resolution: 1920x1080 unless Muse specifies otherwise
  Max retry: 3 (Haiku regenerates code on failure, Vera QA inline)
```

---

## Confidence Score System

Before a user commits to a niche + mode combination, the system calls
Bedrock Haiku to evaluate and return a confidence score (0–100).

This is NOT hardcoded. Haiku genuinely evaluates the specific combination
against seven dimensions. The same niche can score differently depending
on which other niches it is paired with and what mode is selected.

### Seven Evaluation Dimensions

```
1. Content producibility (0–20 pts)
   Can TONY + Wan2.2 handle this niche's visual requirements?
   Is the content data-driven or does it require faces/reactions?
   High score: AI, Finance, Science (data-heavy, animation-native)
   Low score:  Beauty (requires human demonstration), Gaming (gameplay footage)

2. Niche-mode fit (0–20 pts)
   Does faceless actually work for this content type?
   Investigative, educational, and speculative content: high fit
   Reaction, commentary, and personality-driven content: low fit

3. Market saturation (0–15 pts)
   How crowded is this niche right now on YouTube?
   Checked against Oracle CONTENT_TREND_SIGNALS knowledge base
   Low saturation = higher score

4. Cross-niche coherence (0–15 pts)
   Do the selected niches make sense on one channel?
   Shared audience, overlapping CPM advertisers, consistent editorial voice
   AI + Finance = high coherence
   Beauty + Gaming = low coherence

5. AI detection risk (0–15 pts)
   How likely is YouTube to flag this niche + mode combo?
   Channels with high data visualisation diversity score well
   Channels with repetitive templates or low content variation score poorly
   Higher score = lower risk

6. Revenue potential (0–10 pts)
   CPM estimates per niche (from Oracle GEO_MARKET_INTELLIGENCE)
   Finance and Tech: high CPM, high score
   Entertainment and Gaming: lower CPM, lower score

7. Audience overlap (0–5 pts)
   Do the selected audiences overlap or fragment?
   High overlap = more efficient subscriber compounding
   Low overlap = fragmented channel, lower retention
```

### Confidence Score API Call

```typescript
// lib/full-rrq/confidence-score.ts

export interface NicheModeSelection {
  niches: { nicheId: string; label: string; mode: 'FACE' | 'FACELESS' | 'LET_RRQ' }[];
  channelId: string;
  userId: string;
}

export interface ConfidenceScoreResult {
  overall: number;                    // 0–100 composite
  label: 'STRONG' | 'SOLID' | 'CAUTION' | 'RETHINK';
  perNiche: {
    nicheId: string;
    score: number;
    modeNote: string;                 // one sentence on mode fit for this niche
  }[];
  dimensionBreakdown: {
    contentProducibility: number;
    nicheModefit: number;
    marketSaturation: number;
    crossNicheCoherence: number;
    aiDetectionRisk: number;
    revenuePotential: number;
    audienceOverlap: number;
  };
  reasoning: string;                  // 2-3 sentences — Haiku's plain English assessment
  risks: string[];                    // specific risks flagged
  suggestions: string[];              // specific improvement suggestions
  evaluatedAt: string;                // ISO timestamp
  ttl: number;                        // unix seconds — 24h from evaluation
}

export async function evaluateConfidenceScore(
  selection: NicheModeSelection,
): Promise<ConfidenceScoreResult> {

  // Query Oracle for current niche signal context
  const nicheContext = await queryOracleKnowledge(
    `Current market saturation, CPM, and growth velocity for:
     ${selection.niches.map(n => n.label).join(", ")}`,
    "CONTENT_TREND_SIGNALS"
  );

  const cpmContext = await queryOracleKnowledge(
    `CPM ranges for ${selection.niches.map(n => n.label).join(", ")}
     in US market`,
    "GEO_MARKET_INTELLIGENCE"
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic.claude-haiku-4-5-20251001",  // Haiku — fast structured evaluation
      max_tokens: 800,
      system: `You are the RRQ confidence scoring engine. A user is selecting
               niches and production modes for an autonomous YouTube channel.
               Your job: evaluate their combination across 7 specific dimensions
               and return a precise confidence score. Be honest — if something
               is a bad combination, say so. Use the Oracle context provided
               for real current data. Do not fabricate market signals.
               Oracle niche context: ${nicheContext}
               Oracle CPM context: ${cpmContext}`,
      messages: [{
        role: "user",
        content: `Evaluate this niche and mode selection for a faceless
                  animated YouTube channel:

Niches + modes: ${JSON.stringify(selection.niches)}

Score each dimension (max points in parentheses):
1. Content producibility (0-20): Can TONY + Wan2.2 handle these niches?
2. Niche-mode fit (0-20): Does faceless work for these content types?
3. Market saturation (0-15): How crowded is this space right now?
4. Cross-niche coherence (0-15): Do these niches make sense together?
5. AI detection risk (0-15): Risk of YouTube flagging — higher score = lower risk.
6. Revenue potential (0-10): CPM estimates.
7. Audience overlap (0-5): Do the audiences compound or fragment?

Return JSON exactly:
{
  "overall": number,
  "label": "STRONG|SOLID|CAUTION|RETHINK",
  "perNiche": [{ "nicheId": string, "score": number, "modeNote": string }],
  "dimensionBreakdown": {
    "contentProducibility": number,
    "nicheModefit": number,
    "marketSaturation": number,
    "crossNicheCoherence": number,
    "aiDetectionRisk": number,
    "revenuePotential": number,
    "audienceOverlap": number
  },
  "reasoning": string,
  "risks": string[],
  "suggestions": string[]
}`
      }]
    })
  });

  const data = await response.json();
  const result = JSON.parse(
    data.content[0].text.replace(/```json|```/g, "").trim()
  );

  const now = Math.floor(Date.now() / 1000);
  const scored: ConfidenceScoreResult = {
    ...result,
    evaluatedAt: new Date().toISOString(),
    ttl: now + 60 * 60 * 24,   // 24h TTL
  };

  // Cache result per channel
  await cacheConfidenceScore(selection.channelId, scored);

  return scored;
}
```

### Confidence Score Labels

```
STRONG    85–100    Excellent combination. Faceless mode is well-suited.
                    Go ahead.

SOLID     65–84     Good combination with manageable trade-offs.
                    Minor risks noted below.

CAUTION   45–64     This will work but has real weaknesses.
                    Read the risks before committing.

RETHINK   0–44      Significant problems with this combination.
                    Strong recommendation to adjust before launching.
```

### DynamoDB Cache Table

```
channel-confidence
  PK: channelId
  fields: overall, label, perNiche[], dimensionBreakdown{},
          reasoning, risks[], suggestions[], evaluatedAt, ttl
  TTL: 24 hours (re-evaluate anytime via [Re-evaluate] button)
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
│  Upload frequency:    2 videos / week (Regum scheduling)          │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CONFIDENCE SCORE                           Last evaluated: 3h ago│
│                                                                   │
│  87 / 100 — STRONG                                                │
│  ██████████████████████████████████████████████████████░░░░      │
│                                                                   │
│  "AI + Finance in faceless mode is a well-matched combination.    │
│   Data-heavy content plays to TONY's strengths. CPM is strong     │
│   across both niches. No coherence issues."                       │
│                                                                   │
│  [Re-evaluate]                                                    │
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

Confidence score display:
  Score bar animates in left to right when modal opens (300ms GSAP)
  Colour: green 75+, amber 50-74, red below 50
  "Re-evaluate" triggers a new Haiku evaluation call (spinner during load)
  Score cached 24h — shown freshness timestamp

[LAUNCH FULL RRQ] button:
  Amber, full width of the right column
  GSAP cinematic sweep animation on click before firing (same as GO RRQ button)
  Disabled if confidence score is loading

[Cancel] — text link, no button styling, right-aligned
```

### Modal State Machine

```typescript
// components/zeus/FullRRQModal.tsx

type ModalState =
  | 'REVIEWING'          // user reading, hasn't chosen format yet
  | 'FORMAT_SELECTED'    // format radio chosen
  | 'EVALUATING'         // re-evaluate confidence score in progress
  | 'READY'              // confidence score loaded, format selected
  | 'LAUNCHING'          // [LAUNCH FULL RRQ] clicked, sweep animation running
  | 'LAUNCHED';          // GO RRQ event fired, modal closes

// [LAUNCH FULL RRQ] button is enabled only in state: FORMAT_SELECTED or READY
// After LAUNCHED: Zeus Command Center live feed activates
```

---

## Faceless Pipeline — What Changes vs Standard Mode

Only the steps that differ are listed. All other steps run identically.

```
STANDARD MODE             FACELESS MODE
─────────────             ─────────────
Step 1   Research         Step 1   Research (identical)
Step 2   Script           Step 2   Script (identical)
Step 3   SEO              Step 3   SEO (identical)
Step 4   Quality Gate     Step 4   Quality Gate (identical)
         Council                   Council (identical)
Step 5   Audio            Step 5   Audio (identical — ElevenLabs unchanged)
Step 6   SkyReels EC2     Step 6   SKIPPED — not launched, not billed
Step 7   Wan2.2           Step 7   Wan2.2 — ATMOSPHERE beats only
Step 8   TONY Lambda      Step 8   TONY Lambda — ALL visual beats
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
  // Muse generates AnimationBlueprint (not MuseBlueprint)
  const blueprint = await museFaceless(brief, research);

  // Step 6 is a no-op — SkyReels EC2 never launched
  // Step 8 maps AnimationBlueprint scenes → invokeTonyBatch() tasks
  const tonyTasks = blueprint.scenes
    .filter(s => s.visualType !== 'ATMOSPHERE')
    .map(s => buildTonyTaskFromScene(s));

  const wan2Tasks = blueprint.scenes
    .filter(s => s.visualType === 'ATMOSPHERE')
    .map(s => buildWan2TaskFromScene(s));

  // Parallel execution — same Promise.allSettled() pattern
  await Promise.allSettled([
    invokeTonyBatch(tonyTasks, jobId),
    runWan2Instance(wan2Tasks, jobId),
  ]);
}
```

---

## YouTube AI Detection Resistance

Five signals YouTube monitors and how faceless mode addresses each.

```
1. Visual fingerprinting
   What YouTube checks: identical composition, same template repeated across videos.
   How we beat it:      TONY generates compositions from data + Haiku code-gen.
                        Every video has a different data payload, different colour
                        weight, different layout structure.
                        No two videos share a visual template — they share code
                        primitives that produce novel outputs.

2. Audio fingerprinting
   What YouTube checks: identical cadence, unnaturally uniform pacing.
   How we beat it:      ElevenLabs voice cue markers (RISE/PEAK/DROP/WARM/PAUSE)
                        create natural variation across videos.
                        Muse writes different cue sequences per script.
                        Voice is not robotic — it is directed.

3. Metadata patterns
   What YouTube checks: upload timing regularity, identical description structure.
   How we beat it:      Regum scheduler uses controlled randomness on upload timing.
                        ±3 hours from target slot, never on the exact minute.
                        SEO metadata generated fresh per video by Haiku —
                        never from a template.

4. Content fingerprinting
   What YouTube checks: semantic repetition — same topic structure video after video.
   How we beat it:      Opus generates scripts from different research inputs.
                        WHAT_IF and CONSPIRACY formats have structurally different
                        tension curves (POSSIBILITY_ESCALATION vs COURTROOM).
                        Rex enforces 72h topic cooldown to prevent same-topic repeats.

5. Engagement velocity
   What YouTube checks: artificially boosted early engagement signals.
   How we beat it:      Organic growth only. RRQ never buys engagement.
                        This is a channel quality problem — not our problem to solve
                        technically. Build great content. Let it compound.
```

### Oracle Domain 11 — Pre-Upload AI Detection Check

Runs after Vera QA is cleared, before Theo uploads.

```typescript
// Part of Oracle domain spec — not built yet, referenced here for pipeline wiring

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
    onMaxExceeded: "ZEUS_NOTIFICATION",   // Zeus → human notification
  }
}
```

---

## Series Registry (ANIME_SERIES — Coming Soon)

Table spec only. Do not build. Status: COMING_SOON.

```
DynamoDB table: series-registry
  PK: seriesId           e.g. "series_001"
  fields:
    title                 Series title
    premise               2-sentence series premise
    episodeCount          total episodes planned
    currentArc            current story arc name
    nextEpisodeBrief      what happens in the next episode
    audienceSignals       [] — comments/signals from previous episodes
    status                "COMING_SOON" — only valid status until LoRA pipeline is built
    loraModelKey          null until funded phase
    createdAt             ISO timestamp
```

The LoRA pipeline requires:
- Fine-tuned LoRA weights per character (requires GPU training budget)
- Consistent character reference images per episode
- Wan2.2 or a dedicated video model for animated sequences
- Story arc memory (Zeus episodic memory extended to series continuity)

This is parked until funded phase. Do not wire it. Do not reference it
outside the disclaimer modal "Coming Soon" display.

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

## Build Order

```
[ ] Read muse/SKILL.md — AnimationBlueprint is a MUSE output
[ ] Read tony/SKILL.md — tonyPrompt contract
[ ] Read oracle/SKILL.md — Domain 11 spec wiring

[ ] Create lib/full-rrq/ folder
[ ] Create lib/full-rrq/confidence-score.ts     — Haiku 7-dimension evaluator
[ ] Create lib/full-rrq/resolve-mode.ts         — FACE/FACELESS/LET_RRQ resolver
[ ] Create lib/muse/animation-blueprint.ts      — AnimationBlueprint types + Muse generator
[ ] Create lib/full-rrq/tony-from-scene.ts      — AnimationScene → TonyTask builder
[ ] Create lib/full-rrq/wan2-from-scene.ts      — AnimationScene → Wan2Task builder

[ ] Add AnimationBlueprint to shared lambda-types
[ ] Add 'faceless' flag to production-jobs DynamoDB schema
[ ] Add channel-confidence DynamoDB table
[ ] Add series-registry DynamoDB table (status: COMING_SOON — no logic wired)

[ ] Update Qeon pipeline: detect faceless mode at job start
[ ] Update Qeon Step 6: no-op when faceless is true
[ ] Update Qeon Step 8: route AnimationBlueprint scenes to Tony + Wan2 tasks

[ ] Update Muse: check faceless flag → branch to generateAnimationBlueprint()
[ ] Update Muse: write WHAT_IF and CONSPIRACY format prompts for Opus

[ ] Wire Oracle Domain 11 per-video check after Vera QA clears
[ ] Wire Domain 11 escalation policy (max 3 attempts → Zeus notification)

[ ] Create components/zeus/FullRRQModal.tsx     — disclaimer modal + format picker
[ ] Create components/settings/NicheModeSelector.tsx — per-niche mode toggle
[ ] Add confidence score display to FullRRQModal
[ ] Add confidence score re-evaluate call with loading state
[ ] Add ANIME_SERIES disabled state + "Coming Soon" chip in modal

[ ] Test faceless pipeline end-to-end — verify SkyReels step is skipped
[ ] Test TONY task generation from AnimationBlueprint scenes
[ ] Test confidence score evaluation — verify 7 dimensions score correctly
[ ] Test LET_RRQ mode resolution — verify Haiku decides per-video
[ ] Test modal state machine — all 6 states transition correctly
[ ] Test WHAT_IF format AnimationBlueprint generation with Muse
[ ] Test CONSPIRACY format AnimationBlueprint generation with Muse
[ ] Verify Oracle context is injected into confidence score evaluation
[ ] Verify 72h topic cooldown is enforced in faceless mode (same dedup as standard)
[ ] Verify Regum upload timing randomness applies in Full RRQ Mode
[ ] Verify Oracle Domain 11 fires after Vera clears (not before)
```

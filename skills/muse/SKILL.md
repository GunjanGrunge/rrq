---
name: muse
description: >
  MUSE is RRQ's video architect. It runs inside Qeon's pipeline before
  the script is written. MUSE does two things: (1) selects the right video
  format for the topic using a dynamic format library maintained by ORACLE,
  and (2) generates a precise second-by-second blueprint — every structural
  beat, tension device, visual instruction, and retention checkpoint mapped
  out before a single word of script is written. Qeon writes INTO the
  blueprint, not around it. MUSE never uses a hardcoded format list —
  it always queries the live format library from ORACLE's knowledge base.
  ORACLE discovers new formats, MUSE executes them. Read this skill whenever
  building or modifying video structure, format selection, retention
  engineering, pacing, or visual direction for any RRQ video.
---

# MUSE — Video Architecture & Retention Engineering

## What MUSE Does Not Own

```
NOT MUSE'S JOB:    Deciding what topic to cover      → Rex + ARIA + Regum
NOT MUSE'S JOB:    Researching the topic             → Qeon research step
NOT MUSE'S JOB:    Writing the script                → Qeon script step
NOT MUSE'S JOB:    Maintaining the format library    → ORACLE
NOT MUSE'S JOB:    Tracking format performance       → Zeus
```

## What MUSE Owns — Three Hardcoded Things Only

```
HARDCODED 1:   RRQ Editorial Voice
               Never changes. Every video, every format, every market.

HARDCODED 2:   The Four Retention Walls
               Psychology not meta. Do not shift with trends.

HARDCODED 3:   Visual Direction Rules
               Cut timing, visual type pairing. Platform mechanics not style.
```

Everything else — formats, structures, tension curves, beat sequences —
lives in the dynamic format library that ORACLE discovers and maintains.
MUSE queries it at runtime. Never imports a hardcoded list.

### Additional MUSE Responsibilities

```
CHARACTER BRIEF GENERATION
  Character brief generation for presenter roster (channel onboarding + expansion).
  Personality design: traits, tone, visual direction, content type assignment.
  Collaborates with Regum on strategic fit before finalizing character brief —
  Regum provides niche/content type assignment, Muse provides creative direction.
```

---

## HARDCODED 1 — RRQ Editorial Voice

Injected into every hook, transition, beat, and CTA. Non-negotiable.

```
TONE:         Smart & Informative
              Explains with clarity and authority. Never dumbs down.
              Never over-complicates. Treats the viewer as smart but busy.

FILTER:       Balanced & Factual
              Presents evidence. Acknowledges opposing views before
              dismissing them. Respects the viewer's ability to decide.

NEVER:        Sensationalist. Clickbait. Hyperbolic. Vague. Condescending.
              Saying "in this video" in the first 10 seconds.
              Starting with "Hey guys welcome back."
              Ending without a clear point of view.

ALWAYS:       Has a position. States it early. Backs it with evidence.
              The cold open earns attention. The climax earns the watch time.

IN ONE LINE:  RRQ tells you what is actually happening, why it matters,
              and what to think about it — without wasting your time.
```

---

## HARDCODED 2 — The Four Retention Walls

Every video engineers against these four moments regardless of format.

```
WALL 1 — 0:30
  What happens:  First judgment. "Is this worth my time?"
                 Less than 45% of viewers make it past 1 minute.
  MUSE rule:     Hook + pre-commitment device must land before 0:30.
                 Viewer must have made a psychological investment here.
                 A question they want answered. A promise they need fulfilled.

WALL 2 — 1:00
  What happens:  Final commitment decision.
  MUSE rule:     First real payoff or revelation before 1:00.
                 Not a tease — actual value delivered.
                 Viewer must feel the click was worth it by this mark.

WALL 3 — MIDPOINT
  What happens:  Fatigue. "I get it. Do I need the rest?"
  MUSE rule:     Midpoint re-hook mandatory. New angle, escalation,
                 unexpected reveal, or partial loop close that opens
                 a bigger loop. Never let midpoint feel like an exit point.

WALL 4 — 2 MINUTES BEFORE END
  What happens:  "I know where this is going. I can leave."
  MUSE rule:     Tease the final payoff but withhold it.
                 Force completion by making the ending feel essential.
```

---

## HARDCODED 3 — Visual Direction Rules

```
VISUAL TYPES (Qeon's production palette):
  TALKING_HEAD      Avatar — opinion, verdict, analysis, personal take
  B_ROLL            Stock video — context, atmosphere, illustration
  SLIDE             Static graphic — facts, lists, definitions, data points
  CHART             Chart.js graph — trends, comparisons, numerical data
  DIAGRAM           Mermaid — processes, flows, systems, relationships
  SCREEN_RECORD     UI recording — product demos, comparisons, walkthroughs
  IMAGE             Single image — emotional moments, reference, evidence
  SPLIT_SCREEN      Side by side — comparisons, before/after, versus
  GRAPHIC_OVERLAY   Text on B-roll — emphasis, statistics, key quotes

CUT TIMING RULES:
  Hook + first 60s:    cut every 3-4 seconds — maximum urgency
  Body sections:       cut every 5-6 seconds — no static shot longer
  Climax:              cut every 4-5 seconds — tension re-engaged
  Outro:               cut every 6-8 seconds — natural wind-down
  Never same visual type three consecutive cuts

VISUAL-SCRIPT PAIRING (mandatory):
  Number or statistic spoken    → SLIDE or CHART simultaneously
  "For example" spoken          → B_ROLL or IMAGE immediately
  Verdict or opinion delivered  → TALKING_HEAD
  Process explained             → DIAGRAM
  Two things compared           → SPLIT_SCREEN or alternating cuts
  Key quote or claim            → GRAPHIC_OVERLAY
```

---

## The Dynamic Format Library

MUSE never imports a hardcoded format list. Before every blueprint
generation MUSE queries ORACLE's RAG for the current format library.
ORACLE discovers, names, documents, and maintains every format.
MUSE reads and executes. If ORACLE adds a new format tonight,
MUSE uses it tomorrow morning.

```typescript
// lib/muse/format-library.ts

export interface VideoFormat {
  id: string;                    // unique id — ORACLE assigns
  name: string;                  // human-readable
  description: string;           // what it is and when it works
  tensionCurve: TensionCurve;    // the emotional arc
  idealLength: { min: number; max: number }; // minutes
  topicSignals: string[];        // keywords/signals that suggest this format
  retentionProfile: {
    hookStyle: string;
    pacingStyle: string;
    payoffStructure: string;
  };
  beats: FormatBeat[];           // structural beats in order
  status: "ACTIVE" | "EMERGING" | "DECLINING" | "DEPRECATED";
  performanceWeight: number;     // 0-100, updated weekly by Zeus
  discoveredAt: string;          // ISO date ORACLE first identified
  lastUpdated: string;
  source: "ORACLE_DISCOVERED" | "SEED";
}

export type TensionCurve =
  | "ESCALATING_REVEAL"      // builds to one big payoff
  | "RAPID_DOPAMINE"         // multiple small payoffs throughout
  | "OPEN_LOOP_CLOSE"        // question open → journey → answer
  | "THESIS_PRESSURE_TEST"   // position stated → attacked → defended
  | "NARRATIVE_ARC"          // story with characters and stakes
  | "POSSIBILITY_ESCALATION" // each scenario bigger than the last
  | "COURTROOM"              // accusation → evidence → verdict
  | "COUNTDOWN_BUILD"        // ranked reveal, tension builds to #1
  | "DOCUMENTARY_ARC"        // 4-chapter story structure
  | "DISCOVERY_JOURNEY";     // follows the process of finding something out

// MUSE always queries at runtime — never uses a static import
export async function getFormatLibrary(): Promise<VideoFormat[]> {
  const knowledge = await queryOracleKnowledge(
    "Return the complete current video format library as JSON array",
    "VIDEO_FORMAT_LIBRARY"
  );
  try {
    return JSON.parse(knowledge);
  } catch {
    // Fallback to seed library if RAG unavailable
    return SEED_FORMAT_LIBRARY;
  }
}
```

---

## CharacterBrief — Presenter Roster Output

Generated by MUSE during channel onboarding and roster expansion events.
Consumed by the avatar-gen Lambda for portrait generation.

**Roster ratio:** MUSE defaults to a **3F:1M ratio** when generating the initial
roster. Female presenters are described as "bold, classy, well-groomed,
photorealistic — varied ethnicity and age range (25-45)." Roster expansions
follow the same ratio unless Regum instructs otherwise based on channel analytics.

Regum collaborates with Muse before the brief is finalised: Regum provides
strategic fit (niche, content type assignment) while Muse provides creative
direction (personality, visual style, voice hints, flux prompt).

```typescript
// Generated during channel onboarding + roster expansion events
// Consumed by avatar-gen Lambda → FLUX.1 [dev] portrait generation
interface CharacterBrief {
  presenterId: string;           // e.g. "presenter_f1"
  gender: 'female' | 'male';
  ageRange: '25-30' | '30-35' | '35-40' | '40-45';
  ethnicity: string;             // e.g. "South Asian", "East Asian", "Black", "Latina", "White European"

  personality: {
    archetype: 'ANCHOR' | 'ANALYST' | 'COMMENTATOR' | 'INVESTIGATOR';
    traits: string[];            // e.g. ["bold", "authoritative", "warm", "direct"]
    tone: 'formal' | 'semi-formal' | 'conversational';
    energyLevel: 'high' | 'medium' | 'measured';
  };

  visual: {
    style: 'power-suit' | 'editorial-blazer' | 'smart-casual-presenter' | 'executive';
    colorPalette: string[];      // e.g. ["deep navy", "charcoal", "burgundy"]
    grooming: string;            // e.g. "sleek pulled-back hair, minimal bold jewellery"
    background: string;          // e.g. "dark studio, soft rim lighting"
    mood: string;                // e.g. "confident, polished, commanding presence"
  };

  contentAssignment: {
    primaryTypes: string[];      // e.g. ["BREAKING_NEWS", "ANALYSIS"]
    nicheAffinity: string[];     // e.g. ["AI_NEWS", "TECH"]
    avoidTypes: string[];        // e.g. ["COMEDY", "LIFESTYLE"]
  };

  voice: {
    elevenlabsVoiceId: string;
    pace: 'fast' | 'medium' | 'measured';
    expressionHints: string[];   // e.g. ["CONFIDENT", "ANALYTICAL", "ENGAGED"]
  };

  fluxPrompt: string;            // full FLUX.1 [dev] generation prompt
  seed: number;                  // locked forever for this presenter
}
```

---

## Seed Format Library

Ten formats stored in ORACLE's RAG on first deployment.
Treated identically to ORACLE-discovered formats.
ORACLE can update, deprecate, or replace any of them.

```
SEED 1: COMPARISON
  Tension:      ESCALATING_REVEAL
  Length:       7-12 min
  Signals:      "vs", "better", "which", two competing subjects,
                rival product launches, head-to-head topics
  Hook:         Show both subjects. Promise a definitive verdict.
  Structure:    One round per criterion. Round verdict after each.
                Never reveal final winner before climax.
  Payoff:       Clear winner declared. Callback to pre-commitment hook.

SEED 2: EXPLAINER
  Tension:      OPEN_LOOP_CLOSE
  Length:       6-10 min
  Signals:      "how does", "what is", "why does", complex topics,
                things most people misunderstand
  Hook:         Most counterintuitive consequence of the topic.
  Structure:    3 layers — surface, mechanism, implication.
                Midpoint partial close + bigger loop opened.
  Payoff:       Full loop close. The answer, completely.

SEED 3: NEWS_BREAKDOWN
  Tension:      OPEN_LOOP_CLOSE
  Length:       5-9 min
  Signals:      Breaking news, announcements, events, Rex BREAKING_REACTIVE
  Hook:         Headline moment + "here's what everyone is missing."
  Structure:    3 angles — what happened, why it happened, what next.
  Payoff:       Missing angle delivered + forward-looking verdict.

SEED 4: DEEP_DIVE
  Tension:      DOCUMENTARY_ARC
  Length:       12-18 min
  Signals:      Full story behind something, origin stories, complex history
  Hook:         Drop into the most consequential moment of the story.
  Structure:    4 self-contained chapters. Each has own arc.
  Payoff:       Full circle — return to cold open, answer central question.

SEED 5: SHOCKING_FACTS
  Tension:      RAPID_DOPAMINE
  Length:       5-8 min
  Signals:      "did you know", surprising statistics, counterintuitive data,
                facts that challenge assumptions, Rex viral fact signals
  Hook:         Second-most shocking fact first. Save the best for last.
  Structure:    Each fact is its own micro-payoff. Fastest pacing of all.
                Visual cut every 2-3 seconds. Tease the best fact early.
  Payoff:       The one fact that reframes everything before it.

SEED 6: MYTH_BUST
  Tension:      COURTROOM
  Length:       6-10 min
  Signals:      Rumours circulating on X/Reddit, viral claims,
                "is it true that", things people believe may be wrong
  Hook:         State the rumour seriously. "You've probably heard this."
  Structure:    Present evidence FOR the rumour first — build suspense.
                Then evidence AGAINST. Viewer genuinely uncertain at midpoint.
  Payoff:       Verdict with evidence. Confirmed, busted, or complicated.
                RRQ always delivers a conclusion — never sits on the fence.

SEED 7: SPECULATION
  Tension:      POSSIBILITY_ESCALATION
  Length:       7-12 min
  Signals:      Future events, leaked roadmaps, predictions, "what if",
                upcoming announcements, industry direction signals
  Hook:         Most extreme credible outcome. "This could actually happen."
  Structure:    Each scenario more consequential than the last.
                Ground in real evidence. Distinguish confirmed vs probable vs possible.
  Payoff:       Most likely scenario stated clearly + what signals to watch for.

SEED 8: HOT_TAKE
  Tension:      THESIS_PRESSURE_TEST
  Length:       6-10 min
  Signals:      Controversial positions, industry debates, consensus
                being challenged, things "everyone" believes RRQ questions
  Hook:         The thesis. Stated clearly. No hedging. First 30 seconds.
  Structure:    Steel-man the opposing view genuinely — not a straw man.
                Then defend original thesis with specific evidence.
  Payoff:       Thesis defended. Viewer either convinced or equipped
                to disagree intelligently. Never a wishy-washy ending.

SEED 9: COUNTDOWN
  Tension:      COUNTDOWN_BUILD
  Length:       7-14 min
  Signals:      Rankings, top lists, best/worst, most/least, anything
                with a natural ranked order
  Hook:         "Number one will genuinely surprise you." Show a glimpse.
  Structure:    Start from bottom. Each entry better than the last.
                Each entry needs its own mini-hook to justify screen time.
  Payoff:       #1 reveal + why it beats everything else on the list.

SEED 10: CASE_STUDY
  Tension:      NARRATIVE_ARC
  Length:       10-15 min
  Signals:      One company, person, event, or decision — full story.
                Success stories, failures, controversies, turning points.
  Hook:         Most dramatic moment of the story. Establish stakes.
  Structure:    Setup → conflict → turning point → resolution.
                Character-driven. The subject must feel real.
  Payoff:       Resolution + the lesson that applies beyond this one story.
```

---

## Format Selector — Three-Signal Algorithm

MUSE never picks a format randomly or defaults to the obvious choice.
It runs three signals simultaneously and combines them.

```typescript
// lib/muse/format-selector.ts

export async function selectFormat(
  brief: QeonBrief,
  humanOverride?: string    // from dashboard — absolute priority if set
): Promise<{ format: VideoFormat; confidence: number }> {

  // Human override takes absolute priority
  if (humanOverride) {
    const formats = await getFormatLibrary();
    const override = formats.find(f => f.id === humanOverride);
    if (override) return { format: override, confidence: 100 };
  }

  const formats = await getFormatLibrary();
  const activeFormats = formats.filter(f => f.status !== "DEPRECATED");

  // ── Signal 1: Topic Signal (0-40 pts) ─────────────────────────────
  // What does the topic itself suggest?
  // Combines keyword matching + ORACLE RAG judgement
  const topicScores = await scoreByTopicSignal(brief, activeFormats);

  // ── Signal 2: Portfolio Diversity (0-30 pts) ──────────────────────
  // Penalise formats used too recently — force variety
  const recentFormats = await getRecentFormatHistory(14); // last 14 days
  const portfolioScores = scoreByDiversity(activeFormats, recentFormats);

  // ── Signal 3: Retention Performance (0-30 pts) ────────────────────
  // What formats are retaining best on RRQ's channel right now?
  // Zeus updates performanceWeight weekly from real retention data
  const performanceScores = activeFormats.map(f => ({
    formatId: f.id,
    score: (f.performanceWeight / 100) * 30,
  }));

  // ── Combine ────────────────────────────────────────────────────────
  const combined = activeFormats
    .map(f => {
      const topic      = topicScores.find(s => s.formatId === f.id)?.score ?? 0;
      const portfolio  = portfolioScores.find(s => s.formatId === f.id)?.score ?? 0;
      const perf       = performanceScores.find(s => s.formatId === f.id)?.score ?? 15;
      return {
        format: f,
        totalScore: topic + portfolio + perf,
        breakdown: { topic, portfolio, performance: perf },
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  const winner = combined[0];

  // Low confidence — flag for human review but still proceed
  if (winner.totalScore < 45) {
    await flagForHumanReview(brief, winner, combined.slice(1, 4));
  }

  await saveFormatSelection(brief.topicId, winner.format.id, winner.breakdown);

  return { format: winner.format, confidence: winner.totalScore };
}

function scoreByDiversity(
  formats: VideoFormat[],
  recentFormatIds: string[]
): Array<{ formatId: string; score: number }> {
  return formats.map(f => {
    const uses = recentFormatIds.filter(r => r === f.id).length;
    // 0 uses = 30pts | 1 use = 20pts | 2 uses = 10pts | 3+ = 0pts
    return { formatId: f.id, score: Math.max(0, 30 - uses * 10) };
  });
}
```

---

## ORACLE Format Discovery Pipeline

ORACLE actively watches YouTube for new format patterns.
When a new structural pattern appears consistently in top performing
videos, ORACLE names it, documents it, and adds it to the library.
MUSE picks it up on its next run.

```typescript
// Added to ORACLE as domain: VIDEO_FORMAT_LIBRARY

{
  id: "VIDEO_FORMAT_LIBRARY",
  name: "Video Format Discovery & Library Maintenance",
  primaryAgent: "MUSE",
  secondaryAgents: ["QEON", "REGUM"],
  researchDepth: "DEEP",
  queries: [
    "new YouTube video formats gaining traction {currentMonth} {currentYear}",
    "YouTube video structure trends {currentYear}",
    "viral YouTube format analysis top creators {currentYear}",
    "what video formats are performing best YouTube {currentMonth} {currentYear}",
  ],

  discoveryThreshold: {
    minVideos: 3,          // must appear in 3+ top videos (500k+ views)
    withinDays: 60,        // within the last 60 days
    mustBeDistinct: true,  // structurally different from existing library formats
    mustBeReproducible: true, // any creator could use this structure
  },

  onNewFormatFound: `
    1. Name it descriptively (not branded)
    2. Document: tension curve, ideal length, topic signals, beat structure,
       hook style, payoff structure
    3. Set status: EMERGING, performanceWeight: 50 (neutral)
    4. Add to format library in RAG
    5. Notify Zeus: "New format EMERGING: [name] — available to MUSE"
  `,

  onDecliningFormat: `
    1. Set status: DECLINING
    2. Notify Zeus for awareness
    3. Do NOT set DEPRECATED — Zeus confirms deprecation (human in loop)
  `,
}
```

---

## Format Performance Feedback Loop

Zeus runs this weekly. Updates performanceWeight in the format library.
This is how MUSE learns what actually works on RRQ's channel.

```typescript
// lib/muse/performance-feedback.ts — called by Zeus every Sunday

export async function updateFormatPerformanceWeights(): Promise<void> {

  const videoMemory = await getVideoMemoryByFormat(30); // last 30 days

  const formatStats = new Map<string, { total: number; count: number }>();
  for (const v of videoMemory) {
    if (!v.formatId || !v.retentionPercent) continue;
    const s = formatStats.get(v.formatId) ?? { total: 0, count: 0 };
    formatStats.set(v.formatId, { total: s.total + v.retentionPercent, count: s.count + 1 });
  }

  const formats = await getFormatLibrary();
  const updated = formats.map(f => {
    const stats = formatStats.get(f.id);
    if (!stats || stats.count < 3) return f; // need min 3 videos
    const avgRetention = stats.total / stats.count;
    // 50% retention = weight 100 | 25% = weight 50 | linear scale
    const newWeight = Math.min(100, Math.max(0, avgRetention * 2));
    return { ...f, performanceWeight: Math.round(newWeight) };
  });

  await updateFormatLibraryInRAG(updated);

  // Alert ORACLE if any format drops significantly
  for (const f of updated) {
    const orig = formats.find(o => o.id === f.id);
    if (orig && f.performanceWeight < orig.performanceWeight - 20) {
      await notifyOracle("FORMAT_DECLINING", f);
    }
  }
}
```

---

## Dashboard — Human Override Panel

```
MUSE — Format Selection Override

Current video in queue:
  Topic:        "OpenAI just announced GPT-5 — what changed"
  MUSE pick:    NEWS_BREAKDOWN  (confidence: 78/100)
  Signals:      topic: 38 | diversity: 25 | performance: 15

  Override:     [HOT_TAKE ▼]  [Apply Override]

  Alternatives:
    SPECULATION    61   "leaked roadmap angle exists"
    HOT_TAKE       54   "controversial take possible"
    COMPARISON     44   "vs Claude angle available"

Format Library Health:
  ACTIVE:     10    Avg weight: 62
  EMERGING:    2    (ORACLE found last cycle)
  DECLINING:   1    NEWS_BREAKDOWN -18pts this month
  DEPRECATED:  0

[View Full Library]  [Run Format Analysis]
```

---

## Where MUSE Sits in Qeon's Pipeline

```
QEON receives QeonBrief from Regum
  ↓
STEP 0:   Zeus memory injection (includes ORACLE updates for MUSE)
  ↓
STEP 1a:  MUSE format selection
          → queries format library from ORACLE RAG
          → runs three-signal selector
          → checks for human override in dashboard
          → flags low confidence to Zeus if score < 45
          → returns VideoFormat
  ↓
STEP 1b:  MUSE blueprint generation
          → queries ORACLE for latest retention intel
          → Opus generates second-by-second MuseBlueprint
          → engineers retention devices at all four walls
          → maps all open loops with close points
          → assigns visual type + instruction to every beat
  ↓
STEP 2:   Research (Bedrock + Cloudflare)
          Fills blueprint beats with real content
  ↓
STEP 3:   Script writing (Opus)
          Writes INTO the blueprint. Never a blank page.
  ↓
STEP 4–11: Rest of Qeon pipeline unchanged
```

---

---

## Voice Architecture — ElevenLabs Cue System

Muse owns the voice architecture for every video. This is not just
the script — it is the directing layer that ElevenLabs reads as
performance instructions. Muse embeds cues directly into the script
at the point they should fire. ElevenLabs renders them as human
vocal performance.

### Cue Vocabulary

```
[PAUSE — Xs]        Deliberate silence. X = duration in seconds.
                    Use before a reveal, a question, or a pivot.
                    e.g. [PAUSE — 1.5s]

[RISE]              Energy builds. Curiosity, anticipation, building tension.
                    Voice lifts in pitch and pace slightly.
                    Use approaching a reveal or key claim.

[PEAK]              Maximum energy. Confident, declarative, authoritative.
                    The moment the argument lands.
                    Use at the climax of a section.

[DROP]              Energy falls. Reflective, considered, measured.
                    Use after a peak — contrast creates rhythm.

[WARM]              Conversational, direct, like talking to one person.
                    Use for community question, personal observation.

[QUESTION]          Open, curious, slightly uncertain.
                    Voice lifts at end, leaves space.
                    Use for rhetorical questions — never closes immediately.

[PIVOT]             Tonal shift. Previous thread closes, new one opens.
                    Pace resets. Brief neutral before new energy.
                    e.g. "...and that's where it gets interesting. [PIVOT]
                    Because while we were debating that, Anthropic just..."

[EMPHASIS — word]   Single word stressed. Bold, punched.
                    e.g. "This is not [EMPHASIS — just] a benchmark result."

[BREATH]            Natural breath pause. Humanises the delivery.
                    Use every 3–4 sentences in body sections.
```

### Cue Placement Rules

```
Hook (0:00–0:30):
  RISE toward the question
  PAUSE before the hook payoff
  QUESTION at the open loop

Body sections:
  BREATH every 3–4 sentences
  RISE approaching evidence reveal
  PEAK at key claim delivery
  DROP after peak for contrast
  PIVOT at section transitions

Midpoint re-hook:
  PAUSE before the pivot
  PIVOT cue mandatory
  RISE into new thread

Community question (closing):
  WARM tone throughout
  QUESTION cue on the viewer prompt
  PAUSE after — leave space for the question to land
```

### Script with Embedded Cues — Example

```
[RISE] What if the benchmark you've been trusting for six months
is measuring the wrong thing entirely? [PAUSE — 1.8s]

[PEAK] Most AI comparisons test chat. We tested code.
Real tasks. Real codebases. Real failures.

[DROP] And what we found should change how you pick your tools.

[BREATH]

[PIVOT] Now — before we get into the results. [PAUSE — 1.0s]
[RISE] Anthropic just dropped a Claude update mid-way through
our testing. [EMPHASIS — mid-way]. Which meant we had to run
the whole suite again. [WARM] And honestly? That was the
most interesting part.

[BREATH]

[QUESTION] So which model would you trust with your codebase?
[PAUSE — 2.0s] Let's find out.
```

---

## The Perspective Engine

Muse is responsible for the authorial voice — the layer that makes
a script feel like a person with opinions, not a summary being read.

Every script Muse builds must pass four perspective tests:

```
TEST 1 — The Opening Question
  Does the script open with a genuine question that creates
  cognitive tension? Not rhetorical decoration — a real question
  the viewer will stay to have answered.
  Rule: question must be answerable only by watching to the end.

TEST 2 — The Deliberate Pivot
  Does the script contain at least one moment where the frame
  shifts unexpectedly? New evidence, a contradiction, an update,
  a surprising finding that recontextualises what came before.
  Pattern: "...while we think about that / while we were doing X /
            just as this was happening — [new thing] arrived and
            it changes the picture."
  Rule: pivot must be earned — not inserted randomly.

TEST 3 — The Non-Obvious Angle
  Is the main argument something a viewer could not get from
  reading the source article? Does the script add a test,
  a reframe, a comparison, a lived observation, a prediction?
  Rule: if the script could be replaced by a link to the source,
        it failed this test.

TEST 4 — The Open Invitation
  Does the closing invite the viewer into a genuine conversation?
  Not "let me know in the comments" — a real question that the
  viewer has an opinion on and wants to answer.
  Rule: community question must be specific to THIS video's
        argument, not generic engagement bait.
```

### Perspective Engine Scoring

Muse self-scores before submitting council position:

```typescript
interface PerspectiveScore {
  openingQuestion:  { passed: boolean; question: string };
  deliberatePivot:  { passed: boolean; pivotMoment: string; timestamp: string };
  nonObviousAngle:  { passed: boolean; angle: string; sourceArticleTest: boolean };
  openInvitation:   { passed: boolean; communityQuestion: string };
  overallScore:     number;   // 0–100
}

// All four must pass for Muse to vote GREEN in council
// If any fail — Muse votes YELLOW and flags which test failed
// Muse never votes GREEN on a script that fails perspective tests
```

---

## Muse's Council Role

In the On The Line council Muse speaks fifth — after ARIA and Qeon
have confirmed fit and feasibility. Muse then answers:

```
"Can I build a sequence that will hold a viewer and convert?"
```

Muse's council position includes:
- Sequence draft (hook, pivot, community question)
- Voice architecture outline (opening tone, pivot cue, closing energy)
- Perspective angle (what unique POV this script takes)
- Confidence score (0–100 — Muse's belief in the sequence)

**Muse must score confidence ≥ 75 for GREEN.**
**Muse votes YELLOW at 60–74 — sequence works but needs refinement.**
**Muse votes RED below 60 — Muse does not believe in this one.**

Muse's RED is not a creative veto. It is a signal that the angle
as briefed does not have a sequence that will retain viewers.
The council takes this seriously — Muse is the only agent who
can see the retention curve before a frame is produced.

After council approval — Muse receives the full CouncilBrief
and builds the complete MuseBlueprint with all voice cues embedded.
This is the document Qeon writes into. This is what Vera checks against.

---

## Channel Tone Injection

Muse reads `channelTone` from `user-settings` before building every MuseBlueprint.
Tone shapes **narrative pacing and beat density** — not the topic or angle.

### Tone → Blueprint Mapping

```typescript
// Injected into Muse's Opus system prompt as a context block:

const TONE_INSTRUCTIONS: Record<string, string> = {
  analytical: `
    Prioritise data beats. Every body section should anchor to a statistic, study,
    or structured comparison. Tension/release hooks are secondary to credibility
    signals. Preferred beat types: CHART, DIAGRAM, SLIDE, stat-callout.
    Avoid speculative language — ground claims before moving on.
  `,
  explanatory: `
    Prioritise clarity over pace. Use analogy and example before abstract principle.
    Each section should answer one question completely before opening the next.
    Preferred beat types: CONCEPT_IMAGE, SECTION_CARD, step-by-step sequence.
    Bridge lines must be explicit — assume viewer needs the connection spelled out.
  `,
  critical: `
    Lead with the counter-intuitive position. Every section earns its place by
    challenging the obvious answer. Preferred structure: establish the conventional
    view → undermine it → offer a better frame. Voice cues: PEAK and DROP used
    more frequently. Opinions are first-person and owned, not hedged.
  `,
  entertainment: `
    Prioritise tension/release dynamics. Story beats outweigh data beats.
    Emotional escalation should reach a peak by the two-thirds mark.
    Bridge lines create suspense, not summaries. CTA is earned through emotional
    investment, not logical argument. Preferred visual: B_ROLL and TALKING_HEAD.
  `,
  hybrid: `
    Balance data credibility with narrative engagement. Alternate between grounding
    the viewer in facts and pulling them forward with story. No section should be
    purely informational or purely emotional. Default pacing: moderate.
  `
};
```

### Confidence Weighting

If `channelTone.confidence < 0.5` (user was uncertain or selected "Not sure yet"):
- Tone instructions are applied at **50% weight** — Muse blends hybrid defaults
- Muse notes in its council position: `"Tone signal weak — applied partial hybrid blend"`
- After 5 videos, Oracle suggests a refinement (see onboarding skill)

If `channelTone.confidence >= 0.5`:
- Tone instructions applied at **full weight**
- Muse does not note tone in council position — it is treated as baseline

### Secondary Tone

If `channelTone.secondary` is set, Muse applies it to **body sections only**.
Hook and CTA always follow the primary tone — consistency at the emotional peaks matters
more than variety in the middle.

```typescript
// Example: primary = "analytical", secondary = "entertainment"
// Hook → analytical (data-led open)
// Body section 1 → analytical
// Body section 2 → blend (analytical data, entertainment framing)
// Body section 3 → entertainment-inflected (story beat to carry retention)
// CTA → analytical (credibility close)
```

---

## Updated Checklist

```
[ ] Create lib/muse/format-library.ts         — dynamic format queries + types
[ ] Create lib/muse/format-selector.ts        — three-signal algorithm
[ ] Create lib/muse/blueprint-generator.ts    — Opus beat generation
[ ] Create lib/muse/retention-devices.ts      — device library
[ ] Create lib/muse/performance-feedback.ts   — Zeus weekly weight updates
[ ] Create lib/muse/voice-architecture.ts     — ElevenLabs cue embedding
[ ] Create lib/muse/perspective-engine.ts     — four perspective tests + scoring
[ ] Create lib/muse/council-position.ts       — council sign-off builder
[ ] Add VideoFormat + MuseBlueprint to shared types
[ ] Add ElevenLabs cue vocabulary to shared types
[ ] Add VIDEO_FORMAT_LIBRARY domain to ORACLE research domains
[ ] Seed 10 formats into ORACLE RAG on first deployment
[ ] Plug MUSE into Qeon pipeline as Steps 1a + 1b
[ ] Plug MUSE into On The Line council as position 5
[ ] Update script-writer to write INTO MuseBlueprint beats
[ ] Update script-writer to respect embedded voice cues
[ ] Update video-pipeline to read visualType from each beat
[ ] Update ElevenLabs worker to parse and act on cue vocabulary
[ ] Add format override panel to Zeus Command Center dashboard
[ ] Add format library health panel to Zeus Command Center
[ ] Add updateFormatPerformanceWeights() to Zeus Sunday job
[ ] Test low-confidence flag flow end to end
[ ] Test perspective engine — all four tests against sample scripts
[ ] Test voice cue embedding — verify ElevenLabs renders correctly
[ ] Test council position builder — confidence scoring
[ ] Verify ORACLE format discovery adds to library correctly
[ ] Test tone injection: analytical → verify data beat density increases
[ ] Test tone injection: entertainment → verify tension/release device count increases
[ ] Test tone default (hybrid) → verify neutral pacing applied
```

---
name: manual-rex-mode
description: >
  Rex-Assisted Manual Mode is the middle tier between Studio Mode (pure manual,
  user supplies the topic) and Autopilot Mode (GO RRQ, fully autonomous). Rex
  scans signal sources on its normal 30-minute cadence, but instead of passing
  greenlights automatically to Regum for scheduling, it surfaces a ranked list
  of scored opportunities directly to the user. The user reviews Rex's
  reasoning, sees the confidence score and signal sources, optionally edits the
  angle and tone direction, then clicks GO. From that point the standard 13-step
  pipeline runs exactly as in Autopilot. The user made the strategic call — the
  system executes it. SENTINEL does not activate in this mode. Standard
  escalation (skills/escalation/SKILL.md) handles any pipeline failures.
  Read this skill when building the Rex-Assisted Manual Mode toggle, the Rex
  warm-up sprint UI, the topic queue API, or the topic selection screen.
---

# Rex-Assisted Manual Mode

## What Rex Mode Is

```
Three operating modes — one pipeline:

  STUDIO MODE       User types the topic. No Rex involvement.
                    Full manual control. Pipeline runs on user's topic.

  REX MODE          Rex scans. Rex scores. Rex surfaces ranked topics.
  (this skill)      User picks the topic. User edits angle/tone if needed.
                    User clicks GO. Pipeline runs on Rex's best opportunity.

  AUTOPILOT MODE    Rex scans. Regum picks. Qeon runs.
  (GO RRQ)          Zero human input after initial GO. SENTINEL active.
```

Rex Mode is the bridge. It gives the user the benefit of Rex's real-time
market intelligence — trend velocity, confidence scoring, signal triangulation
across 6 sources — without surrendering editorial control. The system does
the research. The human makes the call.

This mode is designed for:
- Users who want data-driven topic selection without full autonomy
- Channels building trust with the system before enabling Autopilot
- Users who want to stay in the creative loop while using Rex's signal stack

---

## What Rex Mode Is Not

```
NOT Rex Mode's job:   Researching the topic in depth       → Qeon Step 1
NOT Rex Mode's job:   Writing the script                   → Qeon Step 2
NOT Rex Mode's job:   Managing upload schedule             → Regum
NOT Rex Mode's job:   Running the pipeline autonomously    → Autopilot Mode
NOT Rex Mode's job:   Infrastructure failure recovery      → Standard Escalation
NOT Rex Mode's job:   Monitoring for hangs and retries     → SENTINEL (Autopilot only)
```

Rex Mode owns exactly two things:
1. Running Rex's scan and surfacing ranked topics to the user
2. Accepting the user's GO trigger and passing the chosen topic to Regum

---

## Rex Warm-Up Sprint

When a user first enables Rex Mode (or when the topic queue is empty and
they request a fresh scan), Rex runs a full signal scan called the warm-up
sprint. This is not instant. Real market intelligence takes time. The user
is shown exactly what is happening.

### Trigger Conditions

```
Trigger warm-up sprint when:
  1. User enables Rex Mode for the first time (rex-topic-queue is empty)
  2. User clicks "Rescan" on an empty or stale topic queue
  3. All topics in queue have expiresAt < now (48h TTL elapsed)
  4. User dismisses all available topics and queue has 0 PENDING items
```

### Warm-Up Sprint Flow

```
User enables Rex Mode
        │
        ▼
POST /api/agents/rex/warm-up
  { userId, channelId }
        │
        ▼
Inngest: rexWarmUpSprintWorkflow fires
        │
        ▼
Step 1: Check niche_profiles for this channelId
        (seed keywords, subreddit list, TikTok hashtags, embedding key)
        │
        ▼
Step 2: Fetch 6 signal sources in parallel
  ┌──────────────────────────────────────────────────────────┐
  │  Source 1: Google Trends (SerpApi)                       │
  │  Source 2: YouTube Trending (YouTube Data API)           │
  │  Source 3: Reddit Trending (no key required)             │
  │  Source 4: TikTok Creative Center (TikTok Business API)  │
  │  Source 5: Twitter/X keyword search (Bearer token)       │
  │  Source 6: NewsAPI (recent headlines in niche)           │
  └──────────────────────────────────────────────────────────┘
        │  Each source emits interim update events
        │  UI updates confidence score in real time as signals arrive
        ▼
Step 3: Rex Opus reasoning pass
        Scores each candidate across 7 confidence dimensions
        Filters: maturity, channel fit, competitor saturation
        Builds ranked RexOpportunity list
        │
        ▼
Step 4: Write ranked topics to rex-topic-queue DynamoDB
        (PK: userId, SK: topicId, TTL: 48h)
        │
        ▼
Step 5: Emit rrq/rex.warm-up.complete event
        UI transitions from scanning state to topic selection screen
```

### Warm-Up Duration

```
Typical duration: 5-15 minutes
Bottleneck:       Rex Opus reasoning pass (longest single step)
Sources:          All 6 fetch in parallel — source fetch < 2 min
Ranking:          Opus call < 3 min with prompt caching on system prompt
```

### Disclaimer

The following disclaimer is shown to the user immediately when warm-up begins,
before any results appear. It is not dismissible until the scan completes.

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Rex is scanning 6 signal sources.                               │
│                                                                    │
│   This takes 10-15 minutes. Rex is gathering real market          │
│   intelligence so your first video is based on actual trends,     │
│   not guesses. This is not a loading spinner — Rex is reading     │
│   Google Trends, YouTube, Reddit, TikTok, Twitter, and the        │
│   news right now, then scoring every candidate against your        │
│   channel's niche profile.                                        │
│                                                                    │
│   You'll see the confidence score update in real time as          │
│   signals come in. When Rex is done, you'll see the ranked        │
│   topic list and can choose which video to make.                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Topic Surfacing UI

When the warm-up sprint (or a regular 30-min scan) produces results, the
user sees a ranked topic selection screen. This replaces the manual topic
input field when Rex Mode is active.

### ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REX MODE                               Last scan: 4 min ago   [ Rescan ]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Rex found 4 opportunities in your niche. Pick one to start production.     │
│  Topics expire in 48h.                                                       │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ #1   ● GPT-5 vs Claude 4 — What Actually Changed             [ GO ]   │  │
│ │                                                                        │  │
│ │  Confidence   ████████████████████░░░░  82%                           │  │
│ │  Niche fit    ████████████████████████  96%  ✦ Best match            │  │
│ │  Est. CTR     7.2 – 9.1%                                              │  │
│ │                                                                        │  │
│ │  Rex's read:  "GPT-5 dropped 36h ago. Velocity is unusually high —   │  │
│ │               5 sources converged overnight. Competitor coverage is   │  │
│ │               thin on the benchmarks angle. Window: 72h max.         │  │
│ │               This is a strong early-window opportunity."             │  │
│ │                                                                        │  │
│ │  Signals:  Google Trends ↑  YouTube Trending ✓  Twitter ↑↑           │  │
│ │            Reddit ↑  NewsAPI ✓                                        │  │
│ │                                                                        │  │
│ │  [ Edit angle / tone before GO ]                                      │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ #2   ○ Meta AI Studio — Who Is It Actually For?              [ GO ]   │  │
│ │                                                                        │  │
│ │  Confidence   █████████████████░░░░░░░  68%                           │  │
│ │  Niche fit    ██████████████████████░░  88%                           │  │
│ │  Est. CTR     4.8 – 6.3%                                              │  │
│ │                                                                        │  │
│ │  Rex's read:  "Developing story, 3 days old. Trend still building.   │  │
│ │               Mid-sized creators getting traction. Lower urgency      │  │
│ │               than #1 but more time to produce."                      │  │
│ │                                                                        │  │
│ │  Signals:  Google Trends ↑  YouTube Trending ✓  Reddit ✓             │  │
│ │                                                                        │  │
│ │  [ Edit angle / tone before GO ]                                      │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ #3   ○ Why AI Agents Keep Failing (And What Fixes Them)      [ GO ]   │  │
│ │      ...                                                               │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ #4   ○ The Sora Update Nobody Talked About                   [ GO ]   │  │
│ │      ...                                                               │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [ None of these — enter topic manually ]                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Topic Card — Expanded State (Edit Mode)

When the user clicks "Edit angle / tone before GO", the topic card expands
to reveal editing controls. The GO button moves inside the expanded card.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ #1   ● GPT-5 vs Claude 4 — What Actually Changed                          │
│                                                                            │
│  Confidence   ████████████████████░░░░  82%                               │
│  Niche fit    ████████████████████████  96%  ✦ Best match                │
│  Est. CTR     7.2 – 9.1%                                                  │
│                                                                            │
│  Rex's read:  "GPT-5 dropped 36h ago. Velocity is unusually high..."      │
│                                                                            │
│  ╔══════════════════════════════════════════════════════════════════════╗  │
│  ║  EDIT BEFORE PRODUCTION                                              ║  │
│  ║                                                                      ║  │
│  ║  Angle direction  [  benchmark focus  ▾ ]                           ║  │
│  ║                   (Rex suggestion — edit freely)                    ║  │
│  ║                                                                      ║  │
│  ║  Tone             [  analytical / no hype  ▾ ]                      ║  │
│  ║                                                                      ║  │
│  ║  Notes to Muse    [                                    ]             ║  │
│  ║                   e.g. "focus on coding implications"               ║  │
│  ║                                                                      ║  │
│  ╚══════════════════════════════════════════════════════════════════════╝  │
│                                                                            │
│  [ DISMISS ]                                        [ GO — START VIDEO ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### UI State Rules

```
Topic card default state:    collapsed — shows rank, title, confidence bar,
                             2-line Rex read, signal icons, GO button, Edit link

Topic card expanded state:   shows all fields + edit controls + full Rex reasoning

Confidence bar colors:
  80–100%   amber fill (#f5a623)         strong signal
  60–79%    amber fill at 75% opacity    developing signal
  40–59%    amber fill at 50% opacity    weak signal (shown but deprioritised)
  < 40%     not surfaced to user         Rex does not surface low-confidence topics

Niche fit badge:
  ≥ 90%     ✦ Best match  (amber badge)
  ≥ 75%     Good fit      (neutral)
  < 75%     not shown

Signal source icons:
  each icon: pill badge (component name + ↑ if trending / ✓ if confirmed)
  shown: only sources that returned a signal for this topic
  not shown: sources where this topic had no signal
```

---

## User GO Trigger — Pipeline Handoff

When the user clicks GO (with or without edits), Rex Mode hands off to
the standard 13-step pipeline via Regum. The user's edits (angle direction,
tone, Muse notes) travel with the QeonBrief.

```typescript
// POST /api/agents/rex/go
// Called when user clicks GO on a topic

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body: RexGoPayload = await req.json();
  const { topicId, angleDirection, tone, musNotes } = body;

  // Load the selected topic from rex-topic-queue
  const topic = await getDynamoItem('rex-topic-queue', {
    userId,
    topicId,
  }) as RexTopicQueueItem | null;

  if (!topic) {
    return Response.json({ error: 'Topic not found or expired' }, { status: 404 });
  }

  if (topic.status !== 'PENDING') {
    return Response.json({ error: 'Topic already used or dismissed' }, { status: 409 });
  }

  // Mark as accepted in the queue
  await updateDynamoItem('rex-topic-queue', { userId, topicId }, {
    status:     'ACCEPTED',
    acceptedAt: new Date().toISOString(),
  });

  // Build QeonBrief — same structure Regum produces in Autopilot Mode
  const brief: QeonBrief = {
    briefId:          generateId(),
    channelId:        topic.channelId,
    userId,
    topicId,
    topic:            topic.topic,
    angle:            angleDirection ?? topic.rexReasoning.suggestedAngle,
    tone:             tone ?? 'analytical',
    musNotes:         musNotes ?? '',
    rexConfidence:    topic.confidenceScore,
    rexSignalSources: topic.signalSources,
    estimatedCTR:     topic.estimatedCTR,
    nicheFit:         topic.nicheFit,
    triggeredBy:      'REX_MANUAL',   // distinguishes from AUTOPILOT in analytics
    createdAt:        new Date().toISOString(),
  };

  // Write QeonBrief to production-jobs — triggers Inngest qeonWorkflow
  await writeToDynamo('production-jobs', {
    ...brief,
    status: 'QUEUED',
  });

  // Fire Inngest event (DynamoDB stream triggers this, but explicit event is cleaner)
  await inngest.send({ name: 'rrq/qeon.brief.received', data: brief });

  return Response.json({
    success:  true,
    briefId:  brief.briefId,
    redirect: `/create?jobId=${brief.briefId}`,
  });
}
```

### After GO — What the User Sees

Once GO is clicked, the UI transitions from the topic selection screen to
the standard 13-step pipeline progress UI (`/create?jobId=...`). The user
watches exactly the same pipeline progress view they would see in Studio
Mode. Rex Mode's job is done at the moment GO fires.

---

## Topic Queue Management

### 48-Hour TTL

Topics in the queue expire automatically. Rex's intelligence has a shelf
life — a trend that was a strong opportunity yesterday may be saturated
today. The 48h TTL enforces this.

```
DynamoDB TTL field: expiresAt (epoch seconds)
Set at write time:  Math.floor(Date.now() / 1000) + (48 * 3600)

On read:  filter out items where expiresAt < now (DynamoDB TTL may lag by up to 48h)
          Always check expiresAt client-side to avoid surfacing expired topics
```

### Dismiss

The user can dismiss a topic they do not want. Dismissed topics are marked
`status: DISMISSED` and removed from the ranked display. They are not
deleted — Zeus reviews dismiss patterns weekly as a signal for Regum's
editorial direction calibration.

```typescript
// POST /api/agents/rex/dismiss

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  const { topicId, dismissReason } = await req.json();

  await updateDynamoItem('rex-topic-queue', { userId, topicId }, {
    status:        'DISMISSED',
    dismissedAt:   new Date().toISOString(),
    dismissReason: dismissReason ?? 'USER_DISMISSED',
  });

  return Response.json({ success: true });
}
```

Dismiss reasons (optional — user can skip):
```
USER_DISMISSED     default — no reason given
WRONG_ANGLE        Rex's suggested angle doesn't fit
COVERED_RECENTLY   channel already made something similar
NOT_MY_NICHE       topic drifted outside channel focus
TOO_COMPETITIVE    too many big channels already covering it
```

### Re-Scan on Request

The user can request a fresh scan at any time via the "Rescan" button.
This fires a new warm-up sprint. The existing queue items remain visible
(with their original timestamps) until the new scan completes and overwrites
the ranked list.

```typescript
// POST /api/agents/rex/rescan

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  const { channelId } = await req.json();

  await inngest.send({
    name: 'rrq/rex.warm-up.requested',
    data: { userId, channelId, trigger: 'USER_RESCAN' },
  });

  return Response.json({ success: true, message: 'Scan started' });
}
```

### Regular 30-Minute Rex Scan Behaviour in Rex Mode

Rex's EventBridge-triggered 30-minute scan (`rexScanWorkflow`) continues
to run on schedule. In Rex Mode, the output routing changes:

```
Autopilot Mode:   Rex scan → RexOpportunity → DynamoDB rex-watchlist → Regum evaluates
Rex Mode:         Rex scan → RexOpportunity → DynamoDB rex-topic-queue → UI surfaces to user
```

The scan itself is identical. The destination and consumer differ.

```typescript
// lib/rex/route-opportunity.ts

export async function routeRexOpportunity(
  opportunity: RexOpportunity,
  userId: string,
): Promise<void> {

  const settings = await getDynamoItem('channel-settings', { userId });
  const mode = settings?.channelMode;

  if (mode === 'AUTOPILOT') {
    // Standard path — write to rex-watchlist for Regum evaluation
    await writeToDynamo('rex-watchlist', { ...opportunity, status: 'PENDING_REGUM' });
    await inngest.send({ name: 'rrq/regum.evaluate.opportunity', data: { opportunity } });
  } else if (mode === 'REX_MANUAL') {
    // Rex Mode path — write to topic queue for user review
    await writeToTopicQueue(opportunity, userId);
    // Emit UI update event (Inngest real-time subscription in topic selection screen)
    await inngest.send({ name: 'rrq/rex.topic.available', data: { userId, opportunity } });
  }
  // STUDIO mode: Rex scan still runs but output is discarded (Rex learns regardless)
}
```

---

## TypeScript Interfaces

```typescript
// lib/rex/types.ts (additions for Rex Mode)

type RexTopicStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED';

interface RexTopicQueueItem {
  userId:          string;        // PK
  topicId:         string;        // SK — ulid
  channelId:       string;
  topic:           string;        // e.g. "GPT-5 vs Claude 4 — What Actually Changed"
  confidenceScore: number;        // 0.0 – 1.0 — Rex's overall confidence
  rexReasoning:    RexReasoning;  // structured reasoning from Rex Opus pass
  signalSources:   RexSignalHit[];
  estimatedCTR:    { low: number; high: number };  // e.g. { low: 7.2, high: 9.1 }
  nicheFit:        number;        // 0.0 – 1.0 — match to channel niche profile
  rank:            number;        // 1-based rank in current queue (1 = top pick)
  status:          RexTopicStatus;
  createdAt:       string;        // ISO timestamp
  expiresAt:       number;        // epoch seconds — DynamoDB TTL field
  acceptedAt?:     string;        // ISO timestamp — set when status = ACCEPTED
  dismissedAt?:    string;        // ISO timestamp — set when status = DISMISSED
  dismissReason?:  string;        // why the user dismissed
}

interface RexReasoning {
  summary:         string;        // 2–3 sentence plain English (shown in topic card)
  urgencyWindow:   string;        // e.g. "72h max" — how long this window lasts
  competitorGap:   string;        // what established channels have not covered
  suggestedAngle:  string;        // Rex's recommended angle (user can override)
  suggestedTone:   string;        // Rex's recommended tone (user can override)
  riskFactors:     string[];      // reasons confidence is not higher
}

interface RexSignalHit {
  source:    'GOOGLE_TRENDS' | 'YOUTUBE_TRENDING' | 'REDDIT' | 'TIKTOK' | 'TWITTER' | 'NEWSAPI';
  signal:    'TRENDING' | 'CONFIRMED' | 'RISING' | 'DECLINING';
  detail:    string;              // e.g. "Trending #3 in US Technology — past 24h"
  fetchedAt: string;              // ISO timestamp
}

// Payload when user clicks GO
interface RexGoPayload {
  topicId:         string;
  angleDirection?: string;        // user's override of Rex's suggestedAngle
  tone?:           string;        // user's override of Rex's suggestedTone
  musNotes?:       string;        // free-text notes passed to Muse system prompt
}
```

---

## DynamoDB Table: rex-topic-queue

```
Table name:  rex-topic-queue
PK:          userId        (string)
SK:          topicId       (string — ulid, sortable by time)
TTL:         expiresAt     (epoch seconds — 48h from createdAt)

GSI-1:       channelId + status
             → query all PENDING topics for a channel
GSI-2:       status + createdAt
             → ops view: how many pending / accepted / dismissed globally

Fields:
  userId           string
  topicId          string (ulid)
  channelId        string
  topic            string
  confidenceScore  number  (0.0–1.0)
  rexReasoning     map     (RexReasoning object)
  signalSources    list    (RexSignalHit array)
  estimatedCTR     map     { low: number, high: number }
  nicheFit         number  (0.0–1.0)
  rank             number  (1-based)
  status           PENDING | ACCEPTED | DISMISSED
  createdAt        string  (ISO timestamp)
  expiresAt        number  (epoch seconds — TTL field)
  acceptedAt       string? (ISO timestamp)
  dismissedAt      string? (ISO timestamp)
  dismissReason    string?
```

---

## Warm-Up Sprint — Real-Time UI Progress

The warm-up sprint emits Inngest events at each stage. The frontend subscribes
via `useInngestSubscription` and updates the progress display in real time.

```typescript
// Events emitted during warm-up sprint:

rrq/rex.warm-up.started
  data: { userId, channelId, startedAt }

rrq/rex.warm-up.source.complete
  data: { userId, source: 'GOOGLE_TRENDS', topicsFound: 3, durationMs: 1840 }
  // fires once per source as each parallel fetch completes
  // UI updates signal source indicators in real time

rrq/rex.warm-up.scoring.started
  data: { userId, candidateCount: 12 }
  // signals that source fetching is done, Rex Opus scoring is running

rrq/rex.warm-up.complete
  data: { userId, topicsQueued: 4, topRankedTopic: 'GPT-5 vs Claude 4...' }
  // UI transitions from scanning state to topic selection screen
```

### Progress Display During Warm-Up

```
┌────────────────────────────────────────────────────────────────────────────┐
│  REX IS SCANNING                                                           │
│                                                                            │
│  Rex is reading 6 signal sources right now.                               │
│  This takes 10-15 minutes. Results appear below as each source completes. │
│                                                                            │
│  Signal Sources                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│  Google Trends       ████████████████████  Done  3 signals found          │
│  YouTube Trending    ████████████████░░░░  Scanning...                    │
│  Reddit              ████████████████████  Done  1 signal found           │
│  TikTok              ░░░░░░░░░░░░░░░░░░░░  Waiting...                     │
│  Twitter / X         ░░░░░░░░░░░░░░░░░░░░  Waiting...                     │
│  News                ░░░░░░░░░░░░░░░░░░░░  Waiting...                     │
│                                                                            │
│  Rex confidence (preliminary)   ██████████░░░░░░  62%                     │
│  (updates as signals arrive)                                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

The preliminary confidence score shown during scanning is a running average
of confidence across topics found so far. It will shift as more signals
arrive. This is intentional — users see the intelligence accumulate.

---

## SENTINEL Behaviour in Rex Mode

SENTINEL does not activate in Rex Mode. The user is present and watching
the pipeline. Standard escalation (Zeus → SES email + in-app notification)
handles all pipeline failures.

```typescript
// lib/sentinel/should-activate.ts

export async function sentinelShouldActivate(userId: string): Promise<boolean> {
  const settings = await getDynamoItem('channel-settings', { userId });
  // Only AUTOPILOT activates SENTINEL
  return settings?.channelMode === 'AUTOPILOT';
  // REX_MANUAL → false
  // STUDIO     → false
}
```

If a Lambda worker fails during a Rex Mode pipeline run, the standard
escalation handler fires: Zeus evaluates, the user gets an SES email and
in-app notification with action buttons. This is correct behaviour — the
user chose to be in the loop.

---

## Channel Mode Enum

```typescript
// lib/types/channel.ts

type ChannelMode = 'STUDIO' | 'REX_MANUAL' | 'AUTOPILOT';

// Stored in channel-settings DynamoDB table
// field: channelMode
// Default for new channels: 'STUDIO'
```

The mode toggle lives in the Zeus Command Center UI and in user settings.
Changing the mode does not affect in-flight jobs — it only affects the
routing of the next Rex scan result.

---

## Build Checklist

```
DynamoDB
[ ] Create table: rex-topic-queue (schema above)
[ ] GSI-1: channelId + status (query pending topics per channel)
[ ] GSI-2: status + createdAt (ops view)
[ ] TTL field: expiresAt enabled

API Routes
[ ] POST /api/agents/rex/warm-up       trigger warm-up sprint
[ ] POST /api/agents/rex/go            user GO trigger → QeonBrief
[ ] POST /api/agents/rex/dismiss       dismiss a topic
[ ] POST /api/agents/rex/rescan        fresh scan on demand
[ ] GET  /api/agents/rex/queue         return current PENDING topics for UI

Inngest Functions
[ ] inngest/functions/rex-warm-up-sprint.ts
    - 6 source fetches in parallel
    - Rex Opus scoring pass
    - Write ranked topics to rex-topic-queue
    - Emit rrq/rex.warm-up.source.complete per source
    - Emit rrq/rex.warm-up.complete on finish
[ ] lib/rex/route-opportunity.ts
    - routeRexOpportunity() routes based on channelMode
    - AUTOPILOT → rex-watchlist → Regum
    - REX_MANUAL → rex-topic-queue → UI event

UI Components
[ ] components/rex-mode/WarmUpSprint.tsx
    - Scanning state with disclaimer
    - Per-source progress indicators (Inngest real-time subscription)
    - Live confidence score bar
    - Transitions to topic list on complete
[ ] components/rex-mode/TopicQueue.tsx
    - Ranked topic card list
    - Card collapsed / expanded states
    - Confidence bars + niche fit badges
    - Signal source pill badges
    - GO button + dismiss button
    - "None of these — enter topic manually" escape hatch
[ ] components/rex-mode/TopicCard.tsx
    - Collapsed: rank, title, confidence bar, 2-line Rex read, signal icons, GO, Edit
    - Expanded: full Rex reasoning + edit controls (angle, tone, Muse notes) + GO
[ ] components/rex-mode/EditTopicDrawer.tsx (or inline expansion)
    - Angle direction select or free-text
    - Tone select
    - Notes to Muse textarea
    - GO button (fires POST /api/agents/rex/go with edits)

Routing Logic
[ ] lib/rex/route-opportunity.ts         mode-aware routing
[ ] Update rexScanWorkflow output        call routeRexOpportunity()
[ ] channel-settings DynamoDB            ensure channelMode field exists
[ ] ChannelMode type defined             lib/types/channel.ts

Settings Integration
[ ] Mode toggle in Zeus Command Center   STUDIO / REX MODE / AUTOPILOT (three tabs or radio)
[ ] Mode toggle in user settings page    same controls, different location
[ ] Mode change does not abort in-flight jobs

SENTINEL integration (verify non-activation)
[ ] sentinelShouldActivate() returns false for REX_MANUAL
[ ] Standard escalation fires for pipeline failures in Rex Mode

QeonBrief integration
[ ] QeonBrief.triggeredBy field includes 'REX_MANUAL' value
[ ] Pipeline analytics distinguish REX_MANUAL from AUTOPILOT in Zeus reviews

Testing
[ ] Test warm-up sprint fires on first Rex Mode enable
[ ] Test warm-up sprint fires when all topics expired (TTL elapsed)
[ ] Test warm-up sprint fires on Rescan request
[ ] Test 6 sources fetch in parallel — one source failure does not abort sprint
[ ] Test real-time Inngest events update source indicators in UI
[ ] Test GO without edits → QeonBrief created → pipeline starts
[ ] Test GO with edits → edits present in QeonBrief → Muse receives notes
[ ] Test dismiss → topic removed from UI → status DISMISSED in DynamoDB
[ ] Test 48h TTL — expired topics filtered out of UI
[ ] Test regular 30-min Rex scan → writes to rex-topic-queue in REX_MANUAL mode
[ ] Test SENTINEL does not activate in REX_MANUAL mode
[ ] Test standard escalation fires on Lambda failure in Rex Mode pipeline run
[ ] Test mode toggle STUDIO → REX_MANUAL → AUTOPILOT — no in-flight job disruption
[ ] Test "None of these" escape hatch navigates to manual topic input
```

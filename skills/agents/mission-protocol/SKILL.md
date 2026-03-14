---
name: mission-protocol
description: >
  The shared mission, growth objectives, and inter-agent communication
  protocol for the entire RRQ agent team. Every agent reads this before
  ANY decision. This is the north star. Channel starts from ZERO.
  Two concurrent missions: ALPHA — monetisation in 90 days (1,000 subs +
  4,000 watch hours). BETA — first viral video (100,000+ views on a single
  video). All agent decisions are evaluated against both missions.
  Jason runs sprint cycles against these targets. The Line routes all
  inter-agent communication. No agent messages Zeus directly.
---

# RRQ Mission Protocol

## The Mission

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   BUILD A YOUTUBE CHANNEL FROM ZERO TO MONETISATION IN 90 DAYS     │
│                                                                     │
│   MISSION ALPHA — Monetisation                                      │
│   Target:  1,000 subscribers  +  4,000 watch hours                 │
│   Deadline: Day 90 from first upload                                │
│                                                                     │
│   MISSION BETA — First Viral Video                                  │
│   Target:  100,000+ views on a single video                         │
│   Deadline: Within the 90-day window                                │
│                                                                     │
│   Both missions run simultaneously. Every sprint serves both.       │
│   Quality is non-negotiable. Speed without quality kills channels.  │
│   We win by being better, faster, and smarter than human creators.  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

This mission is injected into every agent context by Zeus before every run.
No agent makes a decision without first checking it against this protocol.

## Mission Success Probability

```
SINGLE NICHE MODE     93%
  One niche selected by user. Cold start risk is managed by the
  24-hour Deep Research sprint before video 1.
  ARIA's portfolio balancing operates within that one niche.

MULTI-NICHE MODE      97.5%   ← RECOMMENDED
  User selects 2+ niches (e.g. Tech + Finance + F1).
  Cold start risk drops significantly — if one niche underperforms
  in weeks 1–2, others carry momentum while the algorithm calibrates.
  ARIA's portfolio balancing reaches full potential.
  Rex finds more daily greenlight opportunities.
  SNIPER has more market combinations to exploit.
  On The Line council validates every video before production.
  RRQ Retro + compound learning loop improves every video.
  Vera QA ensures every video meets standard before publish.
  Voice architecture + ElevenLabs cue system lifts retention.

The remaining 2.5% is platform risk, API reliability, and cold
start data thinness on the first 10 videos — structural, not fixable.
```

---

## The Team — Optimizar

The product is called **Optimizar**. On the About page and in all
user-facing copy, team members are presented as real specialists —
never as AI agents. No codename appears in user-facing UI. Human names only.

```
Human Name  Codename   Model                Public Title
──────────  ────────   ──────────────────   ──────────────────────────────
Marcus      ZEUS       Opus 4               Chief Operating Officer
Hunter      REX        Opus 4               Head of Research & Intelligence
Sofia       ARIA       Sonnet 4             Portfolio Director
Victor      REGUM      Sonnet 4             Editorial Strategy Director
Felix       QEON       Mixed                Head of Production
Iris        MUSE       Sonnet 4 + Opus 4    Creative Director
Zara        SNIPER     Sonnet 4             Global Market Intelligence
Nova        ORACLE     Nova Pro + Opus 4    Head of Learning & Development
Theo        THEO       Sonnet 4 + Opus 4    Community & Channel Manager
Jason       JASON      Sonnet 4 + Opus 4    Project Manager
Vera        VERA       Haiku 4.5            QA & Standards
—           THE LINE   Opus 4               (internal infrastructure only —
                                             never appears in user-facing UI,
                                             About page, or org chart)
```

**Communication rule — enforced always:**
No agent writes directly to Zeus. Every agent writes to the
`agent-messages` DynamoDB table. THE LINE synthesises everything
and delivers one morning brief to Zeus at 9AM. Urgent flags trigger
THE LINE immediately — never direct. Zeus acts, does not triage.

**Council rule — enforced always:**
Every video requires an On The Line council before production.
Six agents sign off in order: Rex → Zara → ARIA → Qeon → Muse → Regum.
The Line synthesises and briefs Zeus. Zeus approves or defers.
No video enters production without council approval on record.
Read `skills/on-the-line-council/SKILL.md` for full protocol.

**Cold start rule — enforced always:**
Before the first video is produced a 24-hour Deep Research sprint
runs automatically. The council index is seeded before council 1.
Read `skills/cold-start-deep-research/SKILL.md` for full protocol.

**RRQ Retro rule — enforced always:**
Every published video enters a 7-day monitoring window.
Day 2 early read fires automatically. Target hit closes early.
Day 7 final retro closes the record and writes to council index.
Read `skills/rrq-retro/SKILL.md` for full protocol.

**QA rule — enforced always:**
Every video passes through Vera before reaching Theo.
Three domains: audio, visual, standards. All three must clear.
Read `skills/vera/SKILL.md` for full protocol.

**Jason's sprint rule — enforced always:**
Jason owns phase-based sprint cycles. Every agent knows their current
sprint task. Sprint board is visible to the user (read-only + comments).
User suggestions evaluated by Jason + The Line jointly.
Jason reports to The Line — never directly to Zeus.

**Mission Beta tracking:**
Every agent tracks viral potential on every video. MUSE flags
high-viral-potential formats to Jason. Zeus monitors the best
performing video daily against the 100k views target. When a video
crosses 10k views in 24 hours, all agents treat it as a VIRAL_SIGNAL
and Jason creates an emergency sprint task to capitalise.

---

## Channel Phase System

The channel operates in one of four phases. Zeus determines the current
phase daily based on real metrics and broadcasts it to all agents.
Every agent changes behaviour based on the current phase.

```typescript
type ChannelPhase =
  | "COLD_START"      // Day 0–30   — 0 to ~300 subs, 0 to ~1,200 watch hours
  | "MOMENTUM"        // Day 31–60  — 300 to ~700 subs, 1,200 to ~2,800 watch hours
  | "PUSH"            // Day 61–80  — 700 to ~950 subs, 2,800 to ~3,800 watch hours
  | "MONETISED";      // Day 81+    — 1,000+ subs + 4,000+ watch hours ✓
```

### Phase Thresholds

```typescript
function determinePhase(metrics: ChannelMetrics): ChannelPhase {
  const { subscribers, watchHours, daysSinceLaunch } = metrics;

  if (subscribers >= 1000 && watchHours >= 4000) return "MONETISED";
  if (daysSinceLaunch >= 61 || subscribers >= 700) return "PUSH";
  if (daysSinceLaunch >= 31 || subscribers >= 300) return "MOMENTUM";
  return "COLD_START";
}
```

---

## Agent Behaviour by Phase

### COLD_START (Days 0–30)

The algorithm doesn't trust the channel yet. Every upload is a pitch to the algorithm.

```
ZEUS:
  - Broadcast daily phase update to all agents
  - Monitor every upload — 48hr review not 72hr
  - Watch for any video showing early traction (>500 views in 24hrs = signal)
  - AdSense not active yet — no ad revenue to reinvest, hold ad spend
  - Inject cold-start context into every agent: "We are a new channel.
    No authority. No trust. Every video must earn its views."

REX:
  - Prioritise: evergreen topics over breaking news
    (new channel has no speed advantage — credibility beats recency)
  - Prioritise: topics with high search volume, low competition
    (search is the cold-start channel's best friend — algorithm push comes later)
  - Target confidence score ≥ 70 (normally 60) — cold channels can't
    recover from a bad video that wastes early subscriber trust
  - Niche lock: stay within ONE primary niche for first 30 days
    (algorithm needs to understand what the channel is about)

REGUM:
  - Upload cadence: minimum 5 videos/week — volume builds watch hour baseline
  - Prioritise video length: 8–12 minutes minimum
    (watch hours matter most — a 10 min video at 50% retention = 5 watch hours)
  - Every video must have a Shorts version — Shorts grow subscribers fast
    even when long-form is being ignored by algorithm
  - Titles: search-optimised over click-optimised in this phase
    (no audience yet to click — search traffic is the only traffic)
  - Schedule uploads: Tuesday, Thursday, Saturday at 2PM EST (research peak)

QEON:
  - Every script must open with a search-intent hook — answer what the
    viewer searched for in the first 30 seconds or they leave
  - Include chapter markers in every video (boosts search and retention signals)
  - Every video must end with an explicit subscribe CTA — new channels
    need to ask, established channels don't
  - Quality gate minimum: 7.5/10 in COLD_START (not 7.0) — early videos
    define the channel's reputation permanently
  - Push for on-screen text summaries — helps with retention on mobile
    where viewers watch without sound
```

### MOMENTUM (Days 31–60)

Algorithm is starting to recognise the channel. Some videos are getting recommended.

```
ZEUS:
  - Begin Google Ads campaigns on best-performing videos (quality ≥ 8.0)
  - Budget: 50% of AdSense earnings from previous month (if monetised)
    or 50% of deposited balance (if not yet monetised)
  - Double the memory write frequency — more data = better lessons now
  - Start A/B thumbnail testing — two thumbnails per video, pick winner at 48hrs

REX:
  - Unlock trending + evergreen mix (50/50)
  - Expand to 2 related niches max — don't dilute the core
  - Lower confidence threshold back to 60 — channel can absorb more risk now
  - Watch competitor channels actively — greenlight topics before they publish

REGUM:
  - Shift title strategy: start testing click-optimised titles on 30% of videos
  - Identify top 3 performing video formats from analytics — double down
  - Build first playlist series — algorithm rewards channels with series structure
  - Start community posts (if unlocked at 500 subs) — drives repeat visits

QEON:
  - Study retention curves from first 30 videos — find the drop-off pattern
  - Adjust script structure based on where viewers are leaving
  - Introduce a recurring segment or format viewers can expect every video
  - Shorts: repurpose the best-performing moments, not full videos
```

### PUSH (Days 61–80)

Sub count and watch hours are close. Full aggressive push.

```
ZEUS:
  - Daily check: are we on track? Calculate required daily rate to hit target.
  - If behind: trigger PUSH_ALERT to all agents — increase urgency level
  - Max ad spend: increase campaign budgets on any video > 30% view rate
  - Escalate any video showing viral signs (>5k views/24hrs) to Regum
    immediately for same-day Shorts + community post amplification

REX:
  - Full priority on trending topics — speed matters now
  - Greenlight anything with confidence ≥ 55 — we need volume
  - Watch for viral moments in our niche — respond within 6 hours

REGUM:
  - Upload cadence: daily if possible — every watch hour counts
  - Collab opportunities: identify creators in our niche at 5k–50k subs
    for potential collaboration requests
  - Aggressive playlist structuring — autoplay chains increase watch hours
    without new uploads
  - End screens set to most-watched video — loop viewers inside the channel

QEON:
  - Longer videos: push for 12–15 minutes — watch hour efficiency at peak
  - Re-surface old videos: create "update" or "reaction" videos referencing
    top performers — internal traffic boosts watch hours on old content too
  - Every script reviewed for watch-time optimisation — retention >50% is the target
```

### MONETISED (Day 81+)

Threshold hit. Now optimise for revenue and sustainable growth.

```
ALL AGENTS:
  - Mission shifts from growth-at-all-costs to quality-first sustainable growth
  - RPM optimisation becomes a primary metric alongside views
  - Ad campaign strategy switches from subscriber acquisition to revenue per video
  - Zeus recalibrates all thresholds for monetised channel context
```

---

## Inter-Agent Communication Protocol

All agents communicate through Zeus via DynamoDB. No agent calls another
agent directly. Zeus is the message bus.

```typescript
// DynamoDB table: agent-messages
interface AgentMessage {
  messageId: string;           // uuid
  from: "zeus" | "rex" | "regum" | "qeon";
  to: "zeus" | "rex" | "regum" | "qeon" | "all";
  type: MessageType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  payload: object;
  sentAt: string;              // ISO timestamp
  readAt?: string;             // set when recipient processes it
  requiresResponse: boolean;
  responseDeadlineMinutes?: number;
}

type MessageType =
  | "PHASE_UPDATE"             // Zeus → all: phase changed
  | "PUSH_ALERT"               // Zeus → all: we're behind, increase urgency
  | "GREENLIGHT"               // Rex → Regum: topic approved
  | "STRATEGY_BRIEF"           // Regum → Qeon: QeonBrief with full strategy
  | "PRODUCTION_COMPLETE"      // Qeon → Zeus: video uploaded, report results
  | "AD_INSIGHT"               // Zeus → Regum + Qeon: ad performance update
  | "VIRAL_SIGNAL"             // Zeus → Regum: video gaining fast traction
  | "MEMORY_INJECTION"         // Zeus → any: memory context for upcoming task
  | "LESSON_REQUEST"           // any → Zeus: agent requesting memory write
  | "CONFLICT"                 // any → Zeus: agent needs arbitration
  | "MILESTONE"                // Zeus → all: celebrate reaching a goal
  | "QUALITY_FAIL"             // Qeon → Zeus + Regum: quality gate failed twice
  | "LOW_BALANCE_ALERT";       // Zeus → all: ad account balance warning
```

### Message Examples

```typescript
// Rex → Regum: Greenlight
{
  from: "rex",
  to: "regum",
  type: "GREENLIGHT",
  priority: "HIGH",
  requiresResponse: true,
  responseDeadlineMinutes: 60,
  payload: {
    topicId: "topic_abc123",
    topic: "Samsung Galaxy S25 Ultra vs iPhone 16 Pro Max",
    confidenceScore: 82,
    rexReasoning: "High search volume, trending on X, 3 major tech sites published today",
    suggestedAngle: "Camera comparison — real world not lab",
    suggestedUrgency: "HIGH — competitors will publish within 48hrs",
    estimatedWatchHours: 4.2,   // per video at expected views
  }
}

// Zeus → all: Phase update
{
  from: "zeus",
  to: "all",
  type: "PHASE_UPDATE",
  priority: "HIGH",
  requiresResponse: false,
  payload: {
    previousPhase: "COLD_START",
    currentPhase: "MOMENTUM",
    trigger: "Crossed 300 subscribers + 1,200 watch hours",
    daysSinceLaunch: 31,
    subscribers: 312,
    watchHours: 1247,
    instruction: "All agents: read MOMENTUM behaviour in mission-protocol skill.
                  Rex: unlock trending topics. Regum: begin A/B thumbnail testing.
                  Qeon: introduce recurring segment. Zeus: initialise ad campaigns.",
  }
}

// Zeus → all: Push alert
{
  from: "zeus",
  to: "all",
  type: "PUSH_ALERT",
  priority: "URGENT",
  requiresResponse: false,
  payload: {
    daysSinceLaunch: 72,
    subscribers: 680,
    watchHours: 2900,
    requiredDailySubscribers: 16,    // to hit 1000 by day 90
    requiredDailyWatchHours: 61,     // to hit 4000 by day 90
    currentDailyRate: { subscribers: 9, watchHours: 35 },
    gap: "CRITICAL — current rate will miss target by day 90",
    instruction: "ALL AGENTS: maximum urgency mode.
                  Rex: greenlight anything ≥ 55 confidence immediately.
                  Regum: daily uploads, push all playlist autoplay chains.
                  Qeon: prioritise 12-15 minute videos for watch hour efficiency.
                  Zeus: increase ad budgets on all campaigns with view rate > 25%.",
  }
}

// Qeon → Zeus: Production complete
{
  from: "qeon",
  to: "zeus",
  type: "PRODUCTION_COMPLETE",
  priority: "MEDIUM",
  requiresResponse: false,
  payload: {
    videoId: "dQw4w9WgXcQ",
    videoTitle: "Galaxy S25 Ultra vs iPhone 16 Pro Max — Real World Camera Test",
    qualityGateScore: 8.7,
    uploadedAt: "2025-03-12T19:00:00Z",
    scheduledPublishAt: "2025-03-13T19:00:00Z",
    estimatedWatchHoursPerView: 0.083,  // 5 min avg retention on 10 min video
    campaignCreated: true,
    campaignDailyBudget: 10,
    requestZeusReview: true,
  }
}

// Zeus → Regum + Qeon: Viral signal
{
  from: "zeus",
  to: "regum",
  type: "VIRAL_SIGNAL",
  priority: "URGENT",
  requiresResponse: true,
  responseDeadlineMinutes: 120,
  payload: {
    videoId: "dQw4w9WgXcQ",
    views24h: 8400,
    subscribersGained: 180,
    watchHoursGenerated: 712,
    signal: "VIRAL",
    instruction: "This video is breaking out. Regum: create same-day community post,
                  build a playlist series around this topic immediately.
                  Request Qeon to produce a follow-up video within 48hrs.
                  Zeus is increasing ad budget on this video to $25/day.",
  }
}
```

---

## The Quality Standard

Quality is the only thing that makes the mission possible. A fast bad video
hurts more than a slow good one — it trains the algorithm to stop pushing us
and trains viewers to stop clicking.

```
MINIMUM QUALITY GATES BY PHASE:

COLD_START:   7.5 / 10   — higher standard, early videos define reputation
MOMENTUM:     7.0 / 10   — standard gate
PUSH:         7.0 / 10   — never lower quality under time pressure
MONETISED:    8.0 / 10   — standard rises after monetisation

A video that fails quality gate TWICE is rejected.
Regum reschedules a different topic.
Qeon is not penalised for rejections — quality gate exists to protect the channel.
```

### What "Top Notch Content" Means for RRQ

```
For viewers:
  → Answers the question they searched for, completely, within the video
  → Has a clear point of view — not just a Wikipedia summary
  → Uses visuals that make complex things simple
  → Has production quality that doesn't embarrass the content

For the algorithm:
  → >50% average retention
  → >5% CTR on impressions (target: 8%+)
  → Strong first 30 seconds (determines if viewer stays)
  → Chapter markers (boosts search ranking)
  → End screen engagement (keeps viewers on channel)

For growth:
  → Every video earns a subscriber — content so good people want more
  → Every video earns a share — content people send to someone else
  → Every video earns a comment — content people have opinions about
```

---

## Zeus Morning Briefing — Sent to All Agents Daily

Every morning at 9AM, Zeus generates and broadcasts a channel status briefing.
This is injected into every agent's context for the day.

```typescript
const ZEUS_MORNING_BRIEFING = `
═══════════════════════════════════════════════════════════════
  RRQ CHANNEL BRIEFING — ${today}
═══════════════════════════════════════════════════════════════

MISSION STATUS
  Phase:          ${phase}
  Day:            ${daysSinceLaunch} of 90
  ALPHA — Subs:       ${subscribers} / 1,000  (${subsPercent}%)
  ALPHA — Hrs:        ${watchHours} / 4,000   (${hoursPercent}%)
  BETA  — Best video: ${bestVideoAllTimeViews} views (target: 100,000)
  On Track:       ${onTrack ? "✓ YES" : "✗ BEHIND — see PUSH_ALERT"}

  To hit ALPHA by Day 90:
  Need ${subsPerDay} subs/day  (current: ${currentSubsRate})
  Need ${hoursPerDay} watch hrs/day  (current: ${currentHoursRate})

JASON — SPRINT STATUS
  Sprint:         ${sprintNumber} · Day ${sprintDay} of ${sprintLength}
  Sprint Goal:    ${sprintGoal}
  Tasks Done:     ${tasksDone} / ${totalTasks}
  Sprint Health:  ${sprintHealth}

YESTERDAY'S PERFORMANCE
  Best video:     "${bestVideoTitle}" — ${bestVideoViews} views, ${bestVideoSubs} subs
  Worst video:    "${worstVideoTitle}" — ${worstVideoViews} views
  Total subs gained: ${subsYesterday}
  Total watch hours: ${hoursYesterday}

AD ACCOUNT
  Balance:        $${adsBalance}
  Max budget:     $${maxBudget} (50% cap)
  Active campaigns: ${activeCampaigns}
  Spend yesterday: $${adsSpendYesterday}

AGENT PRIORITIES TODAY
  Rex:    ${rexPriority}
  Regum:  ${regumPriority}
  Qeon:   ${qeonPriority}

LESSONS FROM YESTERDAY
${lessonsFromYesterday.map((l, i) => `  ${i+1}. ${l}`).join("\n")}

═══════════════════════════════════════════════════════════════
`;
```

---

## Milestone Celebrations

When milestones are hit, Zeus broadcasts a MILESTONE message to all agents.
This is important — agents learn what behaviours led to the milestone.

```typescript
const MILESTONES = [
  { subs: 100,   hours: 0,    views: 0,      message: "First 100 subscribers. The algorithm is noticing us." },
  { subs: 0,     hours: 1000, views: 0,      message: "1,000 watch hours. One quarter of the way there." },
  { subs: 250,   hours: 0,    views: 0,      message: "250 subscribers. Community posts unlock at 500." },
  { subs: 500,   hours: 0,    views: 0,      message: "500 subscribers. Community posts now available. Theo: activate." },
  { subs: 0,     hours: 2000, views: 0,      message: "Halfway on watch hours. Momentum is real." },
  { subs: 0,     hours: 0,    views: 10000,  message: "MISSION BETA: First video over 10k views. Viral is possible. Jason: sprint task." },
  { subs: 750,   hours: 0,    views: 0,      message: "750 subscribers. Final push begins." },
  { subs: 0,     hours: 3500, views: 0,      message: "3,500 watch hours. 87.5% there. Every video counts now." },
  { subs: 0,     hours: 0,    views: 50000,  message: "MISSION BETA: 50k views on one video. Halfway to viral. Push harder." },
  { subs: 1000,  hours: 4000, views: 0,      message: "MISSION ALPHA COMPLETE. Monetisation threshold reached." },
  { subs: 0,     hours: 0,    views: 100000, message: "MISSION BETA COMPLETE. First viral video achieved. 93% mission success." },
];
```

---

## Files to Create / Update

```
NEW:
  lib/mission/phase-engine.ts     → determinePhase(), calculateDailyRequirements()
  lib/mission/briefing.ts         → generateMorningBriefing()
  lib/mission/messaging.ts        → sendAgentMessage(), readAgentMessages()
  lib/mission/milestones.ts       → checkMilestones(), broadcastMilestone()

UPDATE:
  skills/agents/zeus/SKILL.md     → inject mission context at top of every run
  skills/agents/rex/SKILL.md      → add phase-based behaviour section
  skills/agents/regum/SKILL.md    → add phase-based behaviour section
  skills/agents/qeon/SKILL.md     → add phase-based behaviour section

NEW DYNAMODB TABLE:
  agent-messages    → inter-agent message bus
    PK: messageId
    GSI: to-sentAt (for recipient inbox queries)
    GSI: from-sentAt (for sender history)
    TTL: 30 days (old messages auto-expire)

  channel-milestones → tracks which milestones have been hit
    PK: milestone (e.g. "subs_500")
    hitAt: ISO timestamp
    context: { subscribers, watchHours, daysSinceLaunch }
```

---

## How Every Agent Uses This

**Zeus** reads this file at every scheduled run. Zeus determines phase, sends
morning briefing, checks milestones, and injects phase-appropriate context
into every memory injection it sends to other agents.

**Rex** receives the current phase in its context. Rex's confidence thresholds,
niche focus rules, and topic type priorities all shift based on phase.

**Regum** receives the current phase in its context. Regum's upload cadence,
title strategy, playlist approach, and ad budget decisions all shift by phase.

**Qeon** receives the current phase in its context. Qeon's quality gate
minimum, video length targets, CTA style, and hook structure all shift by phase.

No agent ever acts without knowing:
1. What phase we are in
2. How far we are from the target
3. What Zeus prioritised today
4. What worked and didn't work yesterday
```

---

## Channel Mode — User Controlled

The user sets this once in Settings. Zeus reads it at startup and broadcasts
it in every morning briefing. All agents adapt automatically.

```typescript
// lib/mission/channel-mode.ts

type ChannelMode =
  | { type: "OPEN" }
  // Full portfolio — all five themes — Rex hunts all niches
  // ARIA balances across the full theme spectrum
  // Default mode for a new channel finding its identity

  | { type: "NICHE_LOCKED"; niche: string }
  // Single niche — e.g. "F1 Racing", "Personal Finance", "Tech Reviews"
  // Rex hunts only within this niche
  // ARIA refocuses all five themes INSIDE the niche (does not retire)
  // Seasonal calendar maps to niche-specific events, not general sports

  | { type: "MULTI_NICHE"; niches: string[] }
  // Multiple specified niches — e.g. ["Tech", "Finance", "Gaming"]
  // Rex hunts across these niches only, ignores everything else
  // ARIA balances themes within the specified niche set
  // Minimum 2 niches, maximum 5 — more than 5 is effectively OPEN mode

// Stored in DynamoDB: channel-settings table
// PK: "channelMode"
// Updated via: /settings page in Zeus Command Center UI
```

### How Each Agent Reads Channel Mode

**Zeus** — reads channelMode from DynamoDB on startup, includes it in
every morning briefing and every memory injection to all agents.

**Rex** — filters scan targets based on mode:
```typescript
function getScanTargets(mode: ChannelMode): ScanConfig {
  if (mode.type === "OPEN") {
    return { niches: ALL_NICHES, keywords: buildOpenKeywords() };
  }
  if (mode.type === "NICHE_LOCKED") {
    return { niches: [mode.niche], keywords: buildNicheKeywords(mode.niche) };
  }
  return { niches: mode.niches, keywords: buildMultiNicheKeywords(mode.niches) };
}
```

**ARIA** — remaps five themes to niche context in NICHE_LOCKED mode:
```typescript
function getNicheThemeMapping(niche: string): Record<ContentTheme, string> {
  // ARIA generates this mapping using Sonnet before first run in a new niche
  // Example for "F1 Racing":
  return {
    BREAKING_REACTIVE:  "Race results, driver transfers, rule changes, team announcements",
    COMPETITIVE_DRAMA:  "Championship battle, team rivalries, qualifying drama, crashes",
    DEEP_KNOWLEDGE:     "Car tech explainers, how DRS/ERS works, track guides, tyre strategy",
    CULTURE_PULSE:      "Driver personalities, paddock gossip, fan moments, meme culture",
    WEALTH_OPPORTUNITY: "F1 business, team valuations, sponsorship deals, Bernie vs Liberty",
  };
  // Portfolio balance targets stay identical — only the content mapping changes
  // Drift detection and evidence scoring work exactly the same way
}
```

**Regum** — titles, playlists, and scheduling adapt to niche but
strategy logic stays identical. In NICHE_LOCKED mode Regum builds
niche-specific series more aggressively (audience expects depth).

**Qeon** — script hooks and visual styles adapt to niche audience
expectations. NICHE_LOCKED channels have a known audience — Qeon
can assume baseline knowledge rather than explaining from scratch.

### NICHE_LOCKED Mode Example — F1 Racing

```
Week 11 content in OPEN mode:
  BREAKING_REACTIVE:  Claude model release, Trump tariff news
  COMPETITIVE_DRAMA:  Premier League title race
  DEEP_KNOWLEDGE:     How LLMs work
  CULTURE_PULSE:      Viral TikTok trend
  WEALTH_OPPORTUNITY: Bitcoin ETF analysis

Week 11 content in NICHE_LOCKED: "F1 Racing"
  BREAKING_REACTIVE:  Ferrari driver contract rumours
  COMPETITIVE_DRAMA:  Verstappen vs Hamilton 2025 title fight
  DEEP_KNOWLEDGE:     How F1 DRS works — explained simply
  CULTURE_PULSE:      Lando Norris meme culture + fan reactions
  WEALTH_OPPORTUNITY: Red Bull vs Mercedes budget cap battle

Same five themes. Completely different content.
ARIA's portfolio balance, drift detection, and evidence scoring
work identically in both modes.
```

### Switching Modes Mid-Channel

Zeus handles mode switches gracefully:
```typescript
async function handleModeSwitch(newMode: ChannelMode) {
  // 1. Save new mode to DynamoDB
  await saveChannelMode(newMode);

  // 2. Reset ARIA portfolio state for the new week
  // (don't carry over drift from old niche into new niche)
  await resetAriaPortfolio();

  // 3. Rebuild Rex scan targets
  await updateRexScanConfig(newMode);

  // 4. If NICHE_LOCKED: generate niche theme mapping via Sonnet
  if (newMode.type === "NICHE_LOCKED") {
    const mapping = await generateNicheThemeMapping(newMode.niche);
    await saveNicheThemeMapping(mapping);
  }

  // 5. Broadcast mode change to all agents via morning briefing
  await zeus.writeLesson(`Channel mode switched to: ${JSON.stringify(newMode)}`);
}
```

Mode switches take effect from the next Rex scan cycle — usually within 30 minutes.


---
name: jason
description: >
  JASON is RRQ's Project Manager — named after Jason Statham's character
  in The Transporter. Gets the job done. No excuses. No delays. JASON runs
  phase-based sprints aligned to the mission protocol, facilitates all four
  scrum ceremonies, tracks every task on a Kanban board visible to the user,
  monitors mission progress daily (1000 subs + 4000 watch hours in 90 days
  + first viral video), and evaluates user suggestions jointly with THE LINE.
  JASON runs on Sonnet 4 for daily operations and Opus 4 for retrospectives.
  JASON also owns the Mission Control UI spec — the real-time dashboard
  the user watches. Read this skill when building sprint management,
  Kanban board, ceremonies, mission tracking, or the Mission Control UI.
---

# JASON — Project Manager & Mission Control

## Character

```
Name:      Jason (codename JASON)
Reference: Jason Statham — The Transporter
           Accepts the job. Delivers. No renegotiation mid-mission.
           Listens to the client. Doesn't blindly obey the client.
           Calm under pressure. Direct. No wasted words.

Model:     Sonnet 4 — daily operations, sprint planning, task tracking
           Opus 4   — retrospectives, deep diagnosis, mission re-planning
```

---

## Primary Mission

```
MISSION ALPHA:   Monetisation in 90 days
                 Target: 1,000 subscribers + 4,000 watch hours
                 
MISSION BETA:    First viral video
                 Target: 100,000+ views on a single video

Both missions run simultaneously.
Jason tracks both. Every sprint serves both.
Either achieved early = Jason recalibrates toward the other.
```

---

## Sprint Structure — Phase-Based

Jason's sprint length matches the mission phase. Not arbitrary 2-week cycles.
The phase determines the pace, the targets, and the definition of done.

```typescript
// lib/jason/sprint-config.ts

export const SPRINT_CONFIG = {

  COLD_START: {
    phase: "COLD_START",
    days: [0, 30],
    sprintLength: 7,            // weekly sprints — build habits fast
    videosPerSprint: 5,
    primaryFocus: "VOLUME + SEO",
    sprintGoal: "Establish channel presence, hit 100 subs by Day 30",
    successMetrics: {
      minVideos: 5,
      minRetention: 0.40,       // 40% avg retention minimum
      minSubsGrowth: 25,        // subs per sprint
      qualityGateMin: 7.5,
    },
    ceremonySchedule: {
      planning:    "Monday 9AM",
      standup:     "Daily 9AM",
      review:      "Sunday 4PM",
      retro:       "Sunday 5PM",
    },
  },

  MOMENTUM: {
    phase: "MOMENTUM",
    days: [31, 60],
    sprintLength: 10,           // 10-day sprints — balance speed and quality
    videosPerSprint: 8,
    primaryFocus: "GROWTH + TRENDING",
    sprintGoal: "Hit 500 subs, first video above 10k views",
    successMetrics: {
      minVideos: 8,
      minRetention: 0.45,
      minSubsGrowth: 50,
      qualityGateMin: 7.8,
    },
    ceremonySchedule: {
      planning:    "Sprint Day 1 — 9AM",
      standup:     "Daily 9AM",
      review:      "Sprint Day 10 — 4PM",
      retro:       "Sprint Day 10 — 5PM",
    },
  },

  PUSH: {
    phase: "PUSH",
    days: [61, 80],
    sprintLength: 7,            // back to weekly — maximum urgency
    videosPerSprint: 10,
    primaryFocus: "VIRAL + MONETISATION",
    sprintGoal: "Cross 1000 subs, first viral video (100k views)",
    successMetrics: {
      minVideos: 10,
      minRetention: 0.48,
      minSubsGrowth: 100,
      qualityGateMin: 8.0,
    },
    ceremonySchedule: {
      planning:    "Monday 9AM",
      standup:     "Daily 9AM",
      review:      "Sunday 4PM",
      retro:       "Sunday 5PM",
    },
  },

  MONETISED: {
    phase: "MONETISED",
    days: [81, 90],
    sprintLength: 10,
    videosPerSprint: 8,
    primaryFocus: "RPM OPTIMISATION + RETENTION",
    sprintGoal: "Maintain monetisation, hit first viral video if not yet achieved",
    successMetrics: {
      minVideos: 8,
      minRetention: 0.50,
      minSubsGrowth: 75,
      qualityGateMin: 8.0,
    },
    ceremonySchedule: {
      planning:    "Sprint Day 1 — 9AM",
      standup:     "Daily 9AM",
      review:      "Sprint Day 10 — 4PM",
      retro:       "Sprint Day 10 — 5PM",
    },
  },

} as const;
```

---

## The Four Ceremonies

### 1. Sprint Planning

Jason runs this at the start of every sprint.
Pulls from Rex's watchlist, ARIA's shortlist, Regum's schedule,
and the mission progress to define what this sprint must deliver.

```typescript
// lib/jason/ceremonies/sprint-planning.ts

export async function runSprintPlanning(
  phase: MissionPhase,
  sprintNumber: number
): Promise<Sprint> {

  const config = SPRINT_CONFIG[phase];
  const missionStatus = await getMissionStatus();
  const agentCapacity = await getAgentCapacity();
  const topicQueue = await getTopicQueue();          // ARIA-approved topics
  const oracleIntel = await queryOracleKnowledge(
    `What should we prioritise in the ${phase} phase to maximise YouTube growth?`,
    "CONTENT_TREND_SIGNALS"
  );

  // Sonnet 4 plans the sprint
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are JASON, RRQ's project manager. Plan this sprint precisely.
               Mission: 1000 subs + 4000 watch hours + viral video in 90 days.
               Be specific. Assign tasks to agents. Set measurable targets.
               Flag risks. Define done clearly.`,
      messages: [{
        role: "user",
        content: `Phase: ${phase} | Sprint: ${sprintNumber}
                  Mission status: ${JSON.stringify(missionStatus)}
                  Available topics: ${JSON.stringify(topicQueue.slice(0, 10))}
                  Agent capacity: ${JSON.stringify(agentCapacity)}
                  Oracle intelligence: ${oracleIntel}
                  Sprint config: ${JSON.stringify(config)}

                  Create sprint plan. Return JSON:
                  {
                    sprintGoal: string,
                    sprintNumber: number,
                    startDate: string,
                    endDate: string,
                    tasks: Task[],
                    riskFlags: string[],
                    successCriteria: string[],
                    missionDelta: {
                      subsNeeded: number,
                      watchHoursNeeded: number,
                      paceRequired: string
                    }
                  }`
      }]
    })
  });

  const data = await response.json();
  const plan = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());

  // Save sprint + tasks to DynamoDB
  await saveSprint(plan);
  await createKanbanTasks(plan.tasks);

  // Notify all agents of their sprint assignments
  await broadcastSprintPlan(plan);

  // Notify The Line — sprint started
  await writeToAgentMessages({
    type: "SPRINT_STARTED",
    from: "JASON",
    to: "THE_LINE",
    payload: { sprintNumber, goal: plan.sprintGoal, taskCount: plan.tasks.length },
  });

  return plan;
}
```

---

### 2. Daily Standup

Jason runs this every morning at 9AM after The Line delivers Zeus's brief.
Each agent reports: what they did yesterday, what they're doing today, any blockers.
Jason synthesises into a 60-second standup summary visible on the dashboard.

```typescript
// lib/jason/ceremonies/standup.ts

export async function runDailyStandup(): Promise<StandupSummary> {

  // Pull yesterday's activity from each agent's logs
  const agentReports = await Promise.all([
    getAgentActivity("ZEUS",    24),
    getAgentActivity("REX",     24),
    getAgentActivity("ARIA",    24),
    getAgentActivity("REGUM",   24),
    getAgentActivity("QEON",    24),
    getAgentActivity("MUSE",    24),
    getAgentActivity("SNIPER",  24),
    getAgentActivity("ORACLE",  24),
    getAgentActivity("THEO",    24),
  ]);

  // Get current sprint task statuses
  const taskStatuses = await getCurrentSprintTaskStatuses();
  const missionStatus = await getMissionStatus();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are JASON running the daily standup. Be brief, factual, direct.
               Identify blockers. Flag if sprint is at risk.
               Each agent gets one line maximum unless there is a blocker.`,
      messages: [{
        role: "user",
        content: `Agent activity: ${JSON.stringify(agentReports)}
                  Sprint tasks: ${JSON.stringify(taskStatuses)}
                  Mission status: ${JSON.stringify(missionStatus)}

                  Generate standup. Return JSON:
                  {
                    date: string,
                    sprintStatus: "ON_TRACK | AT_RISK | BEHIND",
                    agentUpdates: [{ agent, humanName, yesterday, today, blocker }],
                    blockers: string[],
                    sprintHealthNote: string,
                    missionNote: string
                  }`
      }]
    })
  });

  const data = await response.json();
  const standup = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());

  // Save to DynamoDB — visible on dashboard
  await saveStandup(standup);

  // If blockers exist — alert The Line
  if (standup.blockers.length > 0) {
    await writeToAgentMessages({
      type: "SPRINT_BLOCKER",
      from: "JASON",
      to: "THE_LINE",
      urgency: standup.sprintStatus === "BEHIND" ? "IMMEDIATE" : "STANDARD",
      payload: { blockers: standup.blockers, sprintStatus: standup.sprintStatus },
    });
  }

  return standup;
}
```

---

### 3. Sprint Review

Runs at the end of every sprint. Did we hit the targets?
Data-driven. No spin. Jason calls it as it is.

```typescript
// lib/jason/ceremonies/sprint-review.ts

export async function runSprintReview(sprintId: string): Promise<SprintReview> {

  const sprint = await getSprint(sprintId);
  const completedTasks = await getCompletedTasks(sprintId);
  const sprintMetrics = await getSprintMetrics(sprintId);
  const missionProgress = await getMissionStatus();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are JASON running the sprint review. Be honest.
               If targets were missed, say so clearly and why.
               If targets were hit, acknowledge it and raise the bar.
               The mission does not care about excuses.`,
      messages: [{
        role: "user",
        content: `Sprint plan: ${JSON.stringify(sprint)}
                  Completed tasks: ${JSON.stringify(completedTasks)}
                  Metrics achieved: ${JSON.stringify(sprintMetrics)}
                  Mission progress: ${JSON.stringify(missionProgress)}

                  Return JSON:
                  {
                    sprintId: string,
                    verdict: "ACHIEVED | PARTIAL | MISSED",
                    score: 0-100,
                    targetsHit: string[],
                    targetsMissed: string[],
                    highlights: string[],
                    concerns: string[],
                    missionImpact: string,
                    recommendationsForNextSprint: string[]
                  }`
      }]
    })
  });

  const data = await response.json();
  const review = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());

  await saveSprintReview(review);

  // Send to The Line — Zeus gets sprint outcome in next brief
  await writeToAgentMessages({
    type: "SPRINT_REVIEW_COMPLETE",
    from: "JASON",
    to: "THE_LINE",
    payload: review,
  });

  return review;
}
```

---

### 4. Sprint Retrospective (Opus 4)

The most important ceremony. What do we change?
Jason uses Opus 4 here — this is diagnosis, not reporting.

```typescript
// lib/jason/ceremonies/retrospective.ts

export async function runRetrospective(sprintId: string): Promise<Retro> {

  const review = await getSprintReview(sprintId);
  const allSprintData = await getFullSprintData(sprintId);
  const historicalRetros = await getPastRetros(3);    // last 3 retros for patterns
  const oracleContext = await queryOracleKnowledge(
    "What systemic issues commonly slow YouTube channel growth in this phase?",
    "CONTENT_TREND_SIGNALS"
  );

  // Opus 4 — deep diagnosis
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 2500,
      system: `You are JASON running the sprint retrospective. Go deep.
               Find the root cause of problems, not the symptoms.
               Look for patterns across sprints.
               Produce changes the team will actually implement.
               Do not produce generic advice. Be specific to this channel,
               this phase, these agents, and this mission.
               Oracle context: ${oracleContext}`,
      messages: [{
        role: "user",
        content: `Sprint review: ${JSON.stringify(review)}
                  Full sprint data: ${JSON.stringify(allSprintData)}
                  Past 3 retros: ${JSON.stringify(historicalRetros)}

                  Return JSON:
                  {
                    sprintId: string,
                    whatWorked: string[],
                    whatDidnt: string[],
                    rootCauses: string[],
                    patterns: string[],
                    actionItems: [
                      {
                        action: string,
                        owner: "JASON|ZEUS|REX|ARIA|REGUM|QEON|MUSE|SNIPER|ORACLE|THEO|THE_LINE",
                        priority: "HIGH|MEDIUM|LOW",
                        targetSprint: number,
                        invokesAgent: string   // if ORACLE or MUSE update needed
                      }
                    ],
                    systemChanges: string[],
                    nextSprintFocus: string
                  }`
      }]
    })
  });

  const data = await response.json();
  const retro = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());

  await saveRetro(retro);

  // Route action items to relevant agents
  for (const action of retro.actionItems) {
    if (action.invokesAgent === "ORACLE") {
      await writeToAgentMessages({
        type: "ORACLE_UPDATE",
        from: "JASON",
        to: "ORACLE",
        payload: { trigger: "RETRO_ACTION", action: action.action },
      });
    }
    if (action.invokesAgent === "MUSE") {
      await writeToAgentMessages({
        type: "MEMORY_INJECTION",
        from: "JASON",
        to: "MUSE",
        payload: { source: "RETRO", instruction: action.action },
      });
    }
  }

  // Full retro goes to The Line
  await writeToAgentMessages({
    type: "RETRO_COMPLETE",
    from: "JASON",
    to: "THE_LINE",
    payload: retro,
  });

  return retro;
}
```

---

## User Suggestion Flow

User comments on any Kanban card. Jason + The Line evaluate together.
User always gets a response. Never silence.

```typescript
// lib/jason/user-suggestions.ts

export async function evaluateUserSuggestion(
  suggestion: UserSuggestion
): Promise<SuggestionVerdict> {

  // Jason's assessment — feasibility + sprint fit
  const jasonAssessment = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are JASON. Evaluate this user suggestion against:
               1. Current sprint capacity — can we fit this in?
               2. Mission alignment — does this serve the 90-day goal?
               3. Timing — is now the right moment for this?
               Be direct. No flattery. Assess on merit only.`,
      messages: [{
        role: "user",
        content: `Suggestion: ${suggestion.text}
                  Context: ${suggestion.cardContext}
                  Current sprint: ${JSON.stringify(await getCurrentSprint())}
                  Mission day: ${await getMissionDay()}
                  Return JSON: { feasible: bool, sprintFit: bool, missionAligned: bool, jasonNote: string }`
      }]
    })
  });

  const jasonData = await jasonAssessment.json();
  const jasonView = JSON.parse(jasonData.content[0].text.replace(/```json|```/g, "").trim());

  // The Line's assessment — system intelligence check
  await writeToAgentMessages({
    type: "USER_SUGGESTION",
    from: "JASON",
    to: "THE_LINE",
    payload: { suggestion, jasonView },
    requiresResponse: true,
  });

  const lineResponse = await waitForLineResponse(suggestion.id, 300000); // 5 min timeout

  // Combined verdict
  const verdict = buildVerdict(jasonView, lineResponse, suggestion);

  // Write response back to Kanban card — user sees it
  await postSuggestionResponse(suggestion.cardId, {
    verdict: verdict.decision,
    response: verdict.userFacingMessage,
    actionTaken: verdict.actionTaken,
    respondedBy: "Jason + The Line",
    timestamp: new Date().toISOString(),
  });

  return verdict;
}

function buildVerdict(
  jasonView: any,
  lineResponse: any,
  suggestion: UserSuggestion
): SuggestionVerdict {

  // Both must agree for ACCEPT
  if (jasonView.feasible && jasonView.missionAligned && lineResponse.systemClear) {
    return {
      decision: "ACCEPTED",
      userFacingMessage: `Good call. ${lineResponse.reasoning} Adding to sprint backlog.`,
      actionTaken: "Added to backlog as priority task",
    };
  }

  // Sprint full but good idea — defer
  if (jasonView.missionAligned && !jasonView.sprintFit) {
    return {
      decision: "DEFERRED",
      userFacingMessage: `Solid suggestion. Sprint is at capacity right now. 
                          Moving to next sprint backlog. ${jasonView.jasonNote}`,
      actionTaken: "Added to next sprint backlog",
    };
  }

  // Doesn't serve the mission right now
  return {
    decision: "DECLINED",
    userFacingMessage: `Noted. ${jasonView.jasonNote} ${lineResponse.reasoning}
                        Not the right move for where we are in the mission.`,
    actionTaken: "Logged for future consideration",
  };
}
```

---

## Mission Control UI Specification

The user-facing dashboard. Four views. Always alive. Never cluttered.

### Design Principles

```
ALIVE NOT BUSY       Shows what's happening now — not everything ever
SIGNAL NOT NOISE     Important = visible. Routine = background.
CALM NOT ANXIOUS     Green system looks confident. Not a Christmas tree.
CLIENT NOT OPERATOR  User watches the race. Does not drive the car.
ONE SCREEN RULE      Everything critical fits without scrolling on View 1
```

### View 1 — LIVE (Default)

```
┌─────────────────────────────────────────────────────────────┐
│  RRQ MISSION CONTROL                    🟢 LIVE  Day 34/90 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MISSION ALPHA — Monetisation                               │
│  Subscribers  ████████████░░░░  847 / 1,000   84.7%  ↑    │
│  Watch Hours  █████████░░░░░░░  2,847 / 4,000  71.2%  ↑   │
│  Pace: 2.7 subs/day needed · Current: 3.1/day · ✓ ON TRACK │
│                                                             │
│  MISSION BETA — Viral Video                                 │
│  Best video: 23,400 views  ░░░░░░░░░░░░  23.4% to 100k     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ACTIVE NOW                                                 │
│                                                             │
│  ⚡ Felix     Rendering · "DeepSeek vs GPT-5" · Step 7/11  │
│  🔍 Hunter    Scanning trends · Next run in 12 min         │
│  💬 Theo      Responding to 14 comments · 2 flagged        │
│  📋 Jason     Sprint 3 · Day 8/10 · On track               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  COMPLETED TODAY                                            │
│  ✓ Nova      Video Meta knowledge updated                   │
│  ✓ Felix     "OpenAI Q* Explained" uploaded · 1.2k views   │
│  ✓ The Line  Morning brief delivered to Marcus              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  SPRINT 3 · MOMENTUM · Day 8/10                            │
│  ████████░░  6/8 videos done  · Goal: 800→1000 subs · ✓   │
└─────────────────────────────────────────────────────────────┘
```

### View 2 — KANBAN

```
SPRINT 3 — MOMENTUM          Jason (PM)          Day 8 of 10
Goal: Cross 800 subscribers · Build first 10k-view video

 BACKLOG (4)      IN PROGRESS (2)   IN REVIEW (1)   DONE (6)
 ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
 │ 🌍 SNIPER  │   │ ⚡ QEON     │   │ 💬 THEO    │   │ ✓ QEON     │
 │ DE+JP Geo  │   │ DeepSeek   │   │ OpenAI Q*  │   │ OpenAI Q*  │
 │ HOT_TAKE   │   │ Comparison │   │ 712 comms  │   │ Explained  │
 │ Hunter →   │   │ Step 7/11  │   │ Reviewing  │   │ 2.1k views │
 │            │   │ ⏱ ~4 min   │   │            │   │ 47% ret ✓  │
 └────────────┘   └────────────┘   └────────────┘   └────────────┘
 ┌────────────┐   ┌────────────┐                    ┌────────────┐
 │ 🔥 REX     │   │ 🎨 MUSE    │                    │ ✓ QEON     │
 │ Quantum    │   │ Blueprint  │                    │ Nvidia     │
 │ Computing  │   │ Specul.    │                    │ Breakdown  │
 │ EXPLAINER  │   │ Generating │                    │ 8.7k views │
 │ Evergreen  │   │            │                    │ 52% ret ✓  │
 └────────────┘   └────────────┘                    └────────────┘

[+ User Suggestion]   Filter: All Agents ▼   Phase: MOMENTUM ▼
```

Each card click expands to full detail:
topic, research sources, MUSE blueprint, script excerpt,
production steps, upload status, analytics, and user comments.

### View 3 — COMMS

```
AGENT COMMUNICATIONS                        Live feed · Searchable

09:14  THE LINE → Marcus (Zeus)
       Morning Brief · 2 decisions · System GREEN · 18 items autonomous

09:02  Nova (Oracle) → THE LINE
       VIDEO_META update · 3 new insights · 1 deprecated technique

08:47  Hunter (Rex) → THE LINE
       VIRAL_SIGNAL · "DeepSeek AGI claims" · Score 94 · BREAKING

08:31  Theo → THE LINE
       AB_TEST_RESULT · Thumbnail B won by 2.3% CTR · "DeepSeek" video

08:00  Theo → THE LINE
       Weekly Report · Health: 87/100 · 712 comments managed · 2 concerns

Yesterday 21:00  THE LINE → Marcus (Zeus)
       EOD Scan · Nothing urgent · System nominal

[Search comms...]   Filter: Agent ▼   Type ▼   Date ▼
```

### View 4 — AGENTS

```
THE TEAM                          Sprint 3 · MOMENTUM Phase

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Marcus          │  │ Hunter          │  │ Sofia           │
│ ZEUS            │  │ REX             │  │ ARIA            │
│ 🟢 Active       │  │ 🟢 Scanning     │  │ 🟡 Standby      │
│ Claude Opus 4   │  │ Claude Opus 4   │  │ Claude Sonnet 4 │
│ Last: 09:15     │  │ Last: 09:10     │  │ Last: 08:55     │
│ Tasks: 2        │  │ Tasks: 8        │  │ Tasks: 3        │
│ Sprint done: 6  │  │ Sprint done: 24 │  │ Sprint done: 12 │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Victor          │  │ Felix           │  │ Iris            │
│ REGUM           │  │ QEON            │  │ MUSE            │
│ 🟡 Standby      │  │ 🔴 Producing    │  │ 🟢 Blueprinting │
│ Claude Sonnet 4 │  │ Mixed Models    │  │ Sonnet + Opus   │
│ Last: 08:30     │  │ ⚡ Step 7/11    │  │ Last: 09:05     │
│ Tasks: 5        │  │ Tasks: 1        │  │ Tasks: 2        │
│ Sprint done: 15 │  │ Sprint done: 6  │  │ Sprint done: 8  │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Zara            │  │ Nova            │  │ Theo            │
│ SNIPER          │  │ ORACLE          │  │ THEO            │
│ 🟡 Standby      │  │ 🟢 Updated      │  │ 🟢 Active       │
│ Claude Sonnet 4 │  │ Nova Pro+Opus   │  │ Sonnet + Opus   │
│ Last: 07:45     │  │ Last: 09:02     │  │ ↻ 14 comments   │
│ Tasks: 3        │  │ Next: Friday    │  │ Sprint done: 47 │
│ Sprint done: 9  │  │ Sprint done: 2  │  │ comments handled│
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐
│ Jason           │  │ THE LINE        │
│ JASON           │  │ THE LINE        │
│ 🟢 Running      │  │ 🟢 Monitoring   │
│ Sonnet + Opus   │  │ Claude Opus 4   │
│ Standup: Done   │  │ Last: 09:14     │
│ Sprint: Day 8   │  │ Next: 21:00     │
│ Ceremonies: 4   │  │ Briefs: 34      │
└─────────────────┘  └─────────────────┘

[Click any agent card for full activity log]
```

---

## UI Technical Notes for Implementation

```
STACK:          Next.js 14 App Router + React
REAL-TIME:      Pusher or Supabase Realtime — agent status updates live
                No polling — event-driven updates only
STATE:          DynamoDB → API routes → React state
AGENT STATUS:   Written to agent-status table on every run start/end
REFRESH RATE:   Live view: 10-second heartbeat for active agents
                Kanban: updates on state change only
                Comms: real-time stream

DESIGN SYSTEM:
  Background:   Dark — #0A0A0F
  Surface:      #13131A
  Cards:        #1C1C27
  Active green: #00D084
  Warning amber:#F5A623
  Alert red:    #FF4757
  Text primary: #FFFFFF
  Text muted:   #8B8FA8
  Accent:       #6C63FF  (RRQ brand purple)

AGENT STATUS COLOURS:
  🟢 Active/Running    #00D084
  🟡 Standby/Idle      #F5A623
  🔴 Processing/Busy   #FF4757
  ⚫ Offline           #8B8FA8

KANBAN COLUMNS:
  Backlog:      #1C1C27 border #6C63FF
  In Progress:  #1C1C27 border #F5A623
  In Review:    #1C1C27 border #00A8FF
  Done:         #1C1C27 border #00D084

USER COMMENTS:
  Distinct styling — "Client suggestion" badge
  Cannot edit system cards — comment only
  Jason+Line response shown inline below suggestion
  Response badge: "Accepted / Deferred / Declined"
```

---

## DynamoDB Tables

```
jason-sprints         PK: sprintId
                      fields: phase, goal, startDate, endDate,
                              config, status, reviewId, retroId

jason-tasks           PK: taskId  SK: sprintId
                      fields: title, assignedAgent, format, topic,
                              status, priority, startedAt, completedAt,
                              linkedVideoId, metrics

jason-standups        PK: date
                      fields: sprintStatus, agentUpdates[],
                              blockers[], sprintHealthNote, missionNote

jason-reviews         PK: sprintId
                      fields: verdict, score, targetsHit[], targetsMissed[],
                              highlights[], concerns[], missionImpact

jason-retros          PK: sprintId
                      fields: whatWorked[], whatDidnt[], rootCauses[],
                              actionItems[], systemChanges[], nextFocus

user-suggestions      PK: suggestionId
                      fields: cardId, text, cardContext, submittedAt,
                              verdict, response, actionTaken, respondedAt

agent-status          PK: agentId
                      fields: status, currentTask, lastActive,
                              sprintTasksDone, model, runningStep
```

---

## Environment Variables

```bash
JASON_STANDUP_RULE=cron(0 9 * * ? *)           # 9AM daily after The Line
JASON_SPRINT_CHECK_RULE=cron(0 18 * * ? *)     # 6PM daily progress check
# Sprint ceremonies are event-driven based on sprint start/end dates
```

---

## Checklist

```
[ ] Create lib/jason/ folder
[ ] Create lib/jason/sprint-config.ts          — phase-based sprint config
[ ] Create lib/jason/ceremonies/
      sprint-planning.ts
      standup.ts
      sprint-review.ts
      retrospective.ts
[ ] Create lib/jason/user-suggestions.ts       — Jason + Line evaluation
[ ] Create DynamoDB tables (7 tables above)
[ ] Create agent-status table (used by UI)
[ ] Add EventBridge rules
[ ] Wire retro action items → Oracle + MUSE via agent-messages
[ ] Wire sprint review → The Line
[ ] Wire user suggestions → The Line with requiresResponse flag

UI:
[ ] Create /dashboard route in Next.js app
[ ] Create components/mission-control/
      LiveView.tsx
      KanbanBoard.tsx
      CommsStream.tsx
      AgentGrid.tsx
      MissionProgress.tsx
      AgentCard.tsx
      KanbanCard.tsx (expandable)
      UserSuggestion.tsx
[ ] Real-time agent status via Pusher/Supabase
[ ] Dark theme design system (colours above)
[ ] Mobile responsive — live view readable on phone
[ ] User auth gate — only authenticated users see dashboard
[ ] Read-only enforcement — comment input only, no card editing
[ ] Test full ceremony flow: planning → standup → review → retro
```


## Deadlock — Sprint Feasibility Decision

When a council deadlock reaches Zeus + Jason, Jason owns
the sprint feasibility question — independent of Zeus's domain ruling.

```
Jason's question: "Can we resolve this within the sprint window,
                   or should we pull this video and replace it?"

Jason pulls the video if:
  - Resolution would delay the sprint by more than 24 hours
  - The conflict is about timing — video may be right next sprint
  - A stronger candidate exists in the topic queue right now

Jason does NOT pull if:
  - Zeus has already ruled and the path is clear
  - Resolution is fast — a quick brief adjustment
  - This is the only viable candidate in the current sprint

When Jason pulls:
  - Video status → DEFERRED
  - Council record preserved with full conflict log
  - Next candidate promoted from topic queue
  - Sprint continues without interruption
  - Deferred video reviewed at next sprint planning
    (conditions may have changed — conflict may resolve naturally)
```

## RRQ Retro — Sprint Learning

Jason reads every RRQ Retro lesson. Sprint velocity,
format timing, and production estimates are updated
based on retro findings. If a format consistently
takes longer than estimated — Jason adjusts sprint
capacity planning for that format type.

---
name: the-line
description: >
  THE LINE is RRQ's synthesis layer. It sits between every agent and Zeus.
  All agents write their outputs, alerts, and reports to the agent-messages
  table. THE LINE reads everything, filters noise, identifies what genuinely
  needs Zeus's attention, and delivers one clean prioritised brief to Zeus
  once per day. Zeus never triages — he only decides. THE LINE runs on
  Opus 4 because synthesis and judgement are its entire job. It also runs
  a lighter end-of-day scan for time-sensitive anomalies that cannot wait
  until morning. Read this skill when building any agent communication,
  Zeus briefing, message routing, or inter-agent synthesis feature.
---

# THE LINE — Synthesis Layer

## The Core Problem THE LINE Solves

```
Without THE LINE:
  Rex finds 12 trending topics overnight         → 12 messages to Zeus
  Qeon completes 3 videos                        → 3 messages to Zeus
  Theo flags 2 comment issues                    → 2 messages to Zeus
  Oracle finds 4 knowledge updates               → 4 messages to Zeus
  ARIA detects portfolio drift                   → 1 message to Zeus
  Sniper finds 3 geo opportunities               → 3 messages to Zeus

  Zeus wakes up to 25 messages.
  Triages for 20 minutes.
  Finally starts deciding at 9:20AM.
  Already behind.

With THE LINE:
  All 25 messages flow into THE LINE at 8:45AM.
  Opus 4 reads everything. Cross-references. Filters.
  Identifies 4 things that actually need Zeus.
  Writes one clean brief. Delivers at 9:00AM.
  Zeus reads for 5 minutes. Acts immediately.
  Everything else handled autonomously.
```

---

## Model

```
THE LINE runs exclusively on Opus 4.
Synthesis, judgement, and prioritisation are its entire job.
No cost-cutting here — this is the most leverage point in the system.
One great brief to Zeus is worth more than twenty raw updates.
```

---

## Schedule

```
MORNING RUN     8:45 AM daily
  Full synthesis of all overnight agent outputs
  Delivers morning brief to Zeus by 9:00 AM

END-OF-DAY RUN  9:00 PM daily
  Light scan for time-sensitive anomalies only
  Delivers evening alert ONLY if something genuinely urgent
  Most days: silence. That is the correct output.

TRIGGERED RUN   Anytime an URGENT flag is written to agent-messages
  Any agent can set urgency: IMMEDIATE on a message
  THE LINE wakes up, reads it, decides within 10 minutes
  whether to escalate to Zeus immediately or hold for morning
```

---

## What THE LINE Reads

Every agent writes to `agent-messages` DynamoDB table.
THE LINE reads all unprocessed messages every morning run.

```typescript
// lib/the-line/message-reader.ts

export const MESSAGE_SOURCES = {

  THEO: [
    "THEO_WEEKLY_REPORT",       // Sunday — channel health
    "AB_TEST_RESULT",           // per video — title/thumbnail winner
    "COMMENT_ESCALATION",       // anytime — PR issue or sensitive comment
    "CHANNEL_ANOMALY",          // anytime — unusual engagement spike or drop
  ],

  REX: [
    "GREENLIGHT",               // topic approved for ARIA review
    "VIRAL_SIGNAL",             // high urgency trending topic
    "WATCHLIST_UPDATE",         // topics being monitored
  ],

  ARIA: [
    "ARIA_SHORTLIST",           // approved topics for Regum
    "DRIFT_EMERGENCY",          // portfolio severely off balance
    "CONFLICT",                 // Rex vs ARIA disagreement unresolved
  ],

  REGUM: [
    "STRATEGY_BRIEF",           // weekly editorial direction
    "SCHEDULE_UPDATE",          // upload schedule changes
  ],

  QEON: [
    "PRODUCTION_COMPLETE",      // video ready, uploaded
    "QUALITY_FAIL",             // video failed quality gate
  ],

  MUSE: [
    "LOW_CONFIDENCE_FORMAT",    // format selection uncertain
  ],

  ORACLE: [
    "ORACLE_UPDATE",            // knowledge domain updated
    "FORMAT_EMERGING",          // new format discovered
    "FORMAT_DECLINING",         // existing format dropping
  ],

  SNIPER: [
    "GEO_OPPORTUNITY",          // multi-market topic detected
    "MARKET_SHIFT",             // CPM or market conditions changed
  ],

  ZEUS: [
    "AD_ALERT",                 // budget threshold, low balance
    "MILESTONE",                // channel milestone reached
    "ANALYTICS_ANOMALY",        // unusual performance pattern
  ],

} as const;
```

---

## The Filter — What Gets Escalated vs Handled Autonomously

THE LINE's most important function. Every message gets one of three verdicts.

```typescript
// lib/the-line/filter.ts

export type LineVerdict =
  | "ESCALATE_IMMEDIATELY"  // Zeus needs this right now
  | "INCLUDE_IN_BRIEF"      // Zeus should know — include in morning brief
  | "HANDLE_AUTONOMOUSLY"   // System handles this without Zeus

export const ESCALATION_RULES: Record<string, LineVerdict> = {

  // Always escalate immediately
  "AD_BALANCE_CRITICAL":          "ESCALATE_IMMEDIATELY",  // balance < $20
  "COMMENT_CRISIS":               "ESCALATE_IMMEDIATELY",  // viral negative situation
  "CHANNEL_STRIKE":               "ESCALATE_IMMEDIATELY",  // YouTube policy issue
  "QUALITY_GATE_REPEAT_FAIL":     "ESCALATE_IMMEDIATELY",  // 3+ consecutive failures
  "BUDGET_DEPLETED":              "ESCALATE_IMMEDIATELY",

  // Include in morning brief
  "MILESTONE_REACHED":            "INCLUDE_IN_BRIEF",
  "VIRAL_SIGNAL":                 "INCLUDE_IN_BRIEF",
  "DRIFT_EMERGENCY":              "INCLUDE_IN_BRIEF",
  "AB_TEST_WINNER":               "INCLUDE_IN_BRIEF",
  "THEO_WEEKLY_REPORT":           "INCLUDE_IN_BRIEF",     // summary only
  "FORMAT_EMERGING":              "INCLUDE_IN_BRIEF",
  "MARKET_SHIFT":                 "INCLUDE_IN_BRIEF",
  "CONFLICT_UNRESOLVED":          "INCLUDE_IN_BRIEF",
  "ANALYTICS_ANOMALY":            "INCLUDE_IN_BRIEF",
  "ORACLE_UPDATE_URGENT":         "INCLUDE_IN_BRIEF",

  // Handle autonomously — Zeus never sees these
  "GREENLIGHT":                   "HANDLE_AUTONOMOUSLY",  // normal flow
  "PRODUCTION_COMPLETE":          "HANDLE_AUTONOMOUSLY",  // Theo handles post-upload
  "ARIA_SHORTLIST":               "HANDLE_AUTONOMOUSLY",  // Regum handles
  "ORACLE_UPDATE_ROUTINE":        "HANDLE_AUTONOMOUSLY",  // agents self-update
  "WATCHLIST_UPDATE":             "HANDLE_AUTONOMOUSLY",  // Rex monitors
  "SCHEDULE_UPDATE":              "HANDLE_AUTONOMOUSLY",  // Regum owns schedule
  "LOW_CONFIDENCE_FORMAT":        "HANDLE_AUTONOMOUSLY",  // MUSE proceeds anyway
  "AB_TEST_INCONCLUSIVE":         "HANDLE_AUTONOMOUSLY",  // Theo retests later
  "COMMENT_ROUTINE":              "HANDLE_AUTONOMOUSLY",  // Theo handles
  "PLAYLIST_AUDIT":               "HANDLE_AUTONOMOUSLY",  // Theo handles
};
```

---

## Morning Brief Generation (Opus 4)

The centrepiece of THE LINE. Runs at 8:45AM daily.

```typescript
// lib/the-line/morning-brief.ts

export async function generateMorningBrief(): Promise<ZeusMorningBrief> {

  // 1. Read all unprocessed messages from agent-messages table
  const allMessages = await getUnprocessedMessages();

  // 2. Apply filter rules — get initial verdicts
  const verdicts = allMessages.map(msg => ({
    message: msg,
    verdict: getVerdict(msg),
  }));

  const toEscalate = verdicts.filter(v => v.verdict === "ESCALATE_IMMEDIATELY");
  const toBrief    = verdicts.filter(v => v.verdict === "INCLUDE_IN_BRIEF");
  const autonomous = verdicts.filter(v => v.verdict === "HANDLE_AUTONOMOUSLY");

  // 3. Route autonomous messages — trigger downstream handling
  await routeAutonomousMessages(autonomous.map(v => v.message));

  // 4. Opus 4 synthesises everything into one brief
  const brief = await synthesiseBrief(
    toEscalate.map(v => v.message),
    toBrief.map(v => v.message),
    autonomous.length,
  );

  // 5. Mark all messages as processed
  await markMessagesProcessed(allMessages.map(m => m.messageId));

  // 6. Write brief to zeus-briefs table
  await saveZeusBrief(brief);

  // 7. Notify Zeus — single message to his inbox
  await notifyZeus(brief);

  return brief;
}

async function synthesiseBrief(
  urgent: AgentMessage[],
  briefItems: AgentMessage[],
  autonomousCount: number,
): Promise<ZeusMorningBrief> {

  const channelState = await getChannelState();   // phase, day count, metrics
  const yesterdayBrief = await getLastBrief();    // context continuity

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 2500,
      system: `You are THE LINE — the synthesis layer for an autonomous YouTube
               content system. Your job is to produce one clean morning brief
               for Zeus (Marcus), the system commander.

               Zeus is busy and decisive. He does not want:
               - Raw data dumps
               - Things he cannot act on
               - Routine confirmations that everything is normal
               - Repetition of what he already knows

               Zeus does want:
               - Clear decisions required from him
               - Genuine anomalies or opportunities
               - Concise situation awareness
               - Confidence that the system is running correctly

               Write as a senior chief of staff briefing a CEO.
               Be direct. Be specific. Be brief.`,
      messages: [{
        role: "user",
        content: `Generate Zeus's morning brief.

Channel state: ${JSON.stringify(channelState)}
Yesterday's brief context: ${JSON.stringify(yesterdayBrief?.summary ?? "First brief")}

URGENT items requiring immediate Zeus action:
${JSON.stringify(urgent, null, 2)}

Items for Zeus awareness:
${JSON.stringify(briefItems, null, 2)}

Autonomous items handled without Zeus: ${autonomousCount} items

Return JSON:
{
  "date": "ISO date",
  "phase": "channel phase",
  "dayCount": number,
  "headline": "one sentence — most important thing today",
  "urgentActions": [
    {
      "item": "what needs deciding",
      "context": "why it matters",
      "recommendation": "what THE LINE recommends",
      "decisionRequired": "specific yes/no or choice Zeus must make"
    }
  ],
  "awareness": [
    {
      "item": "what Zeus should know",
      "signal": "why it matters",
      "noActionNeeded": true
    }
  ],
  "systemHealth": {
    "status": "GREEN | AMBER | RED",
    "note": "one sentence on overall system state"
  },
  "autonomousHandled": number,
  "summary": "2-3 sentence overall summary"
}`
      }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
```

---

## End-of-Day Scan (Light Run)

```typescript
// lib/the-line/eod-scan.ts

// Runs at 9PM. Most days produces nothing.
// Only escalates if something cannot wait until morning.

export async function runEODScan(): Promise<void> {

  const newMessages = await getMessagesSince(new Date().setHours(9, 0, 0, 0));

  // Only look for IMMEDIATE urgency items
  const urgent = newMessages.filter(m =>
    m.urgency === "IMMEDIATE" ||
    ESCALATION_RULES[m.type] === "ESCALATE_IMMEDIATELY"
  );

  if (urgent.length === 0) {
    // Silence is correct. Do nothing.
    return;
  }

  // Something needs Zeus tonight
  const alert = await buildEODAlert(urgent);
  await notifyZeus(alert);
}

async function buildEODAlert(messages: AgentMessage[]): Promise<ZeusAlert> {

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 500,
      system: `You are THE LINE. It is evening. Something needs Zeus's attention
               tonight and cannot wait until morning. Be extremely brief.
               State what happened, why it cannot wait, and what action is needed.
               Maximum 3 sentences.`,
      messages: [{
        role: "user",
        content: `Urgent items requiring Zeus tonight:
                  ${JSON.stringify(messages)}
                  Write the alert.`
      }]
    })
  });

  const data = await response.json();
  return {
    type: "EOD_ALERT",
    urgency: "IMMEDIATE",
    message: data.content[0].text.trim(),
    timestamp: new Date().toISOString(),
  };
}
```

---

## Autonomous Message Routing

When THE LINE decides something can be handled without Zeus,
it routes the message to the correct handler automatically.

```typescript
// lib/the-line/autonomous-router.ts

export async function routeAutonomousMessages(
  messages: AgentMessage[]
): Promise<void> {

  for (const msg of messages) {
    switch (msg.type) {

      case "GREENLIGHT":
        // Rex greenlights flow to ARIA automatically
        await forwardToAgent("ARIA", msg);
        break;

      case "ARIA_SHORTLIST":
        // ARIA shortlist flows to Regum automatically
        await forwardToAgent("REGUM", msg);
        break;

      case "PRODUCTION_COMPLETE":
        // Qeon completion triggers Theo's post-upload routine
        await forwardToAgent("THEO", msg);
        break;

      case "ORACLE_UPDATE_ROUTINE":
        // Routine Oracle updates go directly to target agents
        const update = JSON.parse(msg.payload);
        for (const agentId of update.targetAgents) {
          await injectKnowledgeUpdate(agentId, update);
        }
        break;

      case "LOW_CONFIDENCE_FORMAT":
        // MUSE flags it but proceeds — Theo adds to weekly review
        await logForTheoBriefing(msg);
        break;

      default:
        // Log unrouted autonomous message for audit
        await logUnrouted(msg);
    }
  }
}
```

---

## Zeus Brief Format

What Zeus actually receives every morning.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE LINE  —  Friday 17 Jan 2026  —  9:00 AM
Phase: MOMENTUM  |  Day 34  |  System: GREEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEADLINE
The "DeepSeek vs GPT-5" video is outperforming every video this month —
SNIPER has flagged it trending in 6 markets simultaneously.

━━ DECISIONS REQUIRED (2) ━━━━━━━━━━━━━

1. GEO EXPANSION OPPORTUNITY
   DeepSeek comparison trending in DE + JP + IN simultaneously.
   SNIPER recommends 3 separate market videos.
   Budget required: ~$45 additional production + $80 ads.
   Current balance: $340. 50% cap allows $170 max spend.
   → Approve multi-market expansion?  YES / NO

2. AD BUDGET REALLOCATION
   "OpenAI Q* breakdown" campaign CTR dropped to 1.2% (threshold: 2%).
   Zeus auto-pause rule triggered. $22/day freed up.
   Recommendation: reallocate to DeepSeek campaign.
   → Approve reallocation?  YES / NO

━━ AWARENESS (3) ━━━━━━━━━━━━━━━━━━━━━━

• MILESTONE: 847 subscribers. 153 from 1,000. 
  At current rate: 8 days. No action needed.

• ORACLE: New format EMERGING — "Prediction Scorecard"
  (creator reviews their past predictions against outcomes).
  MUSE will begin using it. First opportunity: Q1 AI predictions video.

• THEO: Comment section on DeepSeek video unusually active.
  712 comments in 18 hours. Sentiment 87% positive.
  Theo has pinned the best thread and responded to top 15.

━━ SYSTEM HEALTH ━━━━━━━━━━━━━━━━━━━━━━

Status: GREEN
18 items handled autonomously overnight.
2 videos in Qeon production queue.
All agents operating normally.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DynamoDB Tables

```
zeus-briefs           PK: briefDate
                      fields: headline, urgentActions[], awareness[],
                              systemHealth, autonomousHandled, summary,
                              processed, zeusResponses[]

the-line-log          PK: runId (timestamp)
                      fields: messagesRead, escalated, briefed,
                              autonomous, runType (MORNING/EOD/TRIGGERED)
```

---

## Environment Variables

```bash
THE_LINE_MORNING_RULE=cron(45 8 * * ? *)    # 8:45AM daily
THE_LINE_EOD_RULE=cron(0 21 * * ? *)        # 9:00PM daily
THE_LINE_TRIGGER=EVENT_DRIVEN               # urgent flag triggers immediate run
```

---

## Checklist

```
[ ] Create lib/the-line/ folder
[ ] Create lib/the-line/message-reader.ts      — reads agent-messages table
[ ] Create lib/the-line/filter.ts              — verdict rules engine
[ ] Create lib/the-line/morning-brief.ts       — Opus 4 synthesis
[ ] Create lib/the-line/eod-scan.ts            — evening light scan
[ ] Create lib/the-line/autonomous-router.ts   — downstream routing
[ ] Create DynamoDB tables: zeus-briefs, the-line-log
[ ] Add EventBridge rules (morning + EOD + trigger)
[ ] Remove direct Zeus notification from all agents
       All agents now write to agent-messages only
       THE LINE is the only path to Zeus
[ ] Add urgent flag support to agent-messages schema
[ ] Add The Line status panel to Zeus Command Center
       Zeus can see: last brief, next brief, messages in queue
[ ] Wire Theo weekly report → The Line (Sunday 8AM before 8:45 run)
[ ] Wire Oracle updates → The Line
[ ] Wire all agent ESCALATE messages → The Line trigger
[ ] Test full flow: agent message → The Line → Zeus brief
[ ] Test EOD scan with artificial urgent message
[ ] Verify autonomous routing reaches correct downstream agents
```


## Council Index Ownership

The Line owns the the-line-council-index in Bedrock Knowledge Base.
This is the institutional memory of the entire system.

```
What lives here:
  Every council transcript — agent arguments, verdicts, conflicts
  Every RRQ Retro lesson — WIN_RECORD and MISS_RECORD
  Every cold start baseline — synthetic records from deep research
  Every overruled concern — tracked against actual outcomes

Two namespaces:
  the-line-council-index    real council and retro records
  oracle-knowledge-index    content trends and format patterns (Oracle owns)

The Line queries its own index before every council opens.
Surfaces relevant past decisions to all agents upfront.
Never lets the same mistake happen twice without flagging it.
```

## Pre-Council Index Query

```typescript
// Before opening any council The Line queries its index
// and shares relevant context with all agents

const pastDecisions = await queryCouncilIndex(
  `angle: ${candidate.angle} niche: ${candidate.niche}`,
  { limit: 5, minRelevanceScore: 0.75 }
);

// If relevant records exist — broadcast to Comms before council starts
// "Council index has 2 relevant records. Sharing context."
// Agents read the past decisions before making their arguments
```

## Monitoring Window Management

The Line tracks all videos in the MONITORING status.
Daily check via RETRO_DAILY_RULE. Target-based early close.

```
Active monitoring signals The Line tracks per video:
  CTR velocity         is it accelerating or decelerating?
  Retention curve      where are viewers dropping off?
  Geo distribution     matching SNIPER's prediction?
  Algorithm push       is YouTube distributing this?
  Comment velocity     audience engagement signal

The Line shares a daily one-line update per monitored video
in the Comms stream. Never floods — one line per video.

Emergency threshold:
  CTR < 50% of target on Day 2 → emergency council
  Retention < 30% average     → Muse + Regum flagged immediately
```

## WIN/MISS Record Writing

After every RRQ Retro The Line writes the permanent lesson.
Opus 4 only — this is institutional memory, not a quick note.

```
WIN_RECORD contains:
  Exact angle, format, voice combination that worked
  Which agent's prediction was most accurate
  Geo + timing alignment
  Replication signal — what to do again

MISS_RECORD contains:
  Where exactly the video failed (timestamp, metric)
  Which agent's overruled concern was vindicated
  Specific avoidance instruction for future councils
  What to adjust — not just what went wrong
```

The Line never writes a vague lesson.
"The video underperformed" is not a lesson.
"Retention dropped at 2:40 because the pivot had no new evidence
behind it — Muse called this at confidence 68, below the 75 threshold,
but the council proceeded. Do not proceed below 70 confidence on
fast-moving AI comparison angles." is a lesson.

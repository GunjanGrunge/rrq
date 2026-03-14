---
name: on-the-line-council
description: >
  The pre-production standup council that runs before every single video
  enters production. Every agent with a stake in the video convenes On
  The Line — argues from their domain, signs off or raises a flag, and
  only when all six domain sign-offs are green does Zeus approve and
  production begin. The Line facilitates, records every argument, and
  owns the council transcript. If deadlock occurs Zeus and Jason resolve
  jointly. No video skips the council. No exceptions.
---

# On The Line Council

## Philosophy

A real team validates before it ships. The council is not a formality —
it is the moment where six domain experts look at the same video idea
from six different angles and collectively decide it is worth making.
Every argument made is recorded. Every sign-off is logged. Every concern
— even overruled ones — is preserved. The council transcript becomes the
first entry in the video's council index record, completed later by the
RRQ Retro when performance data comes in.

"On The Line" — the place where decisions are made before anything
is committed to production.

---

## Council Participants

```
THE LINE    Facilitator — runs the meeting, records everything,
            surfaces conflicts, briefs Zeus
REX         Trend & narrative signal owner
ZARA        Geo-market intelligence owner
ARIA        Portfolio fit owner
QEON        Production feasibility owner
MUSE        Creative sequence and voice owner
REGUM       Editorial angle and uniqueness owner
ZEUS        Final operational sign-off
JASON       Sprint feasibility — called only on deadlock
ORACLE      Called by The Line if historical pattern is disputed
```

---

## Trigger

Council is triggered automatically when a video candidate reaches
the top of the topic queue. Jason's sprint plan surfaces the candidate
→ The Line opens the council → agents called in sequence.

```typescript
export async function triggerCouncil(
  videoCandidate: TopicQueueItem,
  userId: string
): Promise<CouncilSession> {

  const sessionId = generateCouncilId();

  await createCouncilSession({
    councilId: sessionId,
    videoId: videoCandidate.topicId,
    userId,
    niche: videoCandidate.niche,
    topicAngle: videoCandidate.proposedAngle,
    status: "COUNCIL_OPEN",
    openedAt: new Date().toISOString(),
  });

  await broadcastToComms({
    from: "THE_LINE",
    sessionId,
    message: `Council open. Video candidate: "${videoCandidate.proposedAngle}".
              Niche: ${videoCandidate.niche}. Calling agents.`,
  });

  // Query council index before calling agents
  // The Line surfaces relevant past decisions to all agents upfront
  const pastDecisions = await queryCouncilIndex(
    `angle: ${videoCandidate.proposedAngle} niche: ${videoCandidate.niche}`
  );

  if (pastDecisions.length > 0) {
    await broadcastToComms({
      from: "THE_LINE",
      sessionId,
      message: `Council index has ${pastDecisions.length} relevant past record(s).
                Sharing context before we begin.`,
    });
  }

  return runCouncilSequence(sessionId, videoCandidate, pastDecisions, userId);
}
```

---

## Council Sequence

Agents speak in this exact order. Each domain speaks once.
The Line listens and records. Does not summarise between agents.

```
1. REX        Narrative window — is the angle current and open?
2. ZARA       Geo signal — which markets are ready for this?
3. ARIA       Portfolio fit — is this the right video right now?
4. QEON       Production feasibility — can we execute this cleanly?
5. MUSE       Creative sequence — does the structure work, voice ready?
6. REGUM      Editorial uniqueness — does this add something real?
```

Each agent returns a structured domain verdict:

```typescript
export interface DomainVerdict {
  agentId: string;
  domain: string;
  verdict: "APPROVED" | "FLAG" | "REJECT";
  confidence: number;        // 0–100
  statement: string;         // plain English — shown in Comms
  concerns: string[];        // empty if APPROVED
  conditions: string[];      // conditions if any
  councilId: string;
  timestamp: string;
}
```

---

## Agent Domain Briefs

### REX — Narrative Window
```
Speaks to:   is the angle current? is the window open?
             search velocity, saturation check, timing
Does NOT:    comment on production, format, portfolio, voice

APPROVED     trending up or stable, window open, not yet saturated
FLAG         window closing fast — suggest pivot to related angle
REJECT       angle already saturated, window closed
```

### ZARA — Geo Signal
```
Speaks to:   which markets will respond? CPM range? geo framing?
Does NOT:    comment on trend timing, production, editorial

APPROVED     2+ high-CPM markets showing strong signal
FLAG         strong in one market only — suggest geo framing
REJECT       no geo showing meaningful signal for this angle
```

### ARIA — Portfolio Fit
```
Speaks to:   does this serve the portfolio right now?
             content distribution, duplication check, mission fit
Does NOT:    comment on trend data, production, editorial voice

APPROVED     fits sprint mix, no duplicate in last 14 days
FLAG         similar angle published recently — suggest differentiation
REJECT       direct duplicate, conflicts with higher-priority video
```

### QEON — Production Feasibility
```
Speaks to:   can we make this to standard? format, render time, blockers
Does NOT:    comment on trend, geo, portfolio, editorial

APPROVED     format achievable in sprint, all assets producible
FLAG         extended render time — flag to Jason for sprint planning
REJECT       technically not feasible this sprint
```

### MUSE — Creative Sequence & Voice
```
Speaks to:   does the sequence work? opening hook? perspective?
             voice architecture, ElevenLabs cue mapping, cognitive tension
Does NOT:    comment on trend timing, geo, portfolio, production cost

APPROVED     clear opening question, deliberate pivot, non-obvious angle,
             voice architecture ready with PAUSE/RISE/PIVOT/QUESTION cues
FLAG         structure works but opening hook needs sharpening
REJECT       no perspective — would just summarise a source
             no natural voice architecture — would sound flat
```

### REGUM — Editorial Uniqueness
```
Speaks to:   does this add something the viewer cannot get elsewhere?
             council index check, competitor check, uniqueness score
Does NOT:    comment on trend data, production, geo performance

APPROVED     editorially original, no MISS_RECORD for this framing,
             uniqueness score passes quality gate threshold
FLAG         angle done before but our specific data/test/perspective is new
REJECT       repackages a source with no added perspective
             recent MISS_RECORD for this exact angle
             major competitor published this framing in last 7 days
```

---

## Sign-Off States

```
Six APPROVED         → The Line briefs Zeus → Zeus approves → production
One or more FLAG     → The Line surfaces flags to Zeus → Zeus rules
                       flags acknowledged and logged → production proceeds
Any REJECT           → deadlock protocol triggered
Two+ REJECT          → immediate deadlock → Zeus + Jason called
```

---

## Deadlock Protocol

```typescript
export async function handleDeadlock(
  sessionId: string,
  rejections: DomainVerdict[],
): Promise<DeadlockResolution> {

  await broadcastToComms({
    from: "THE_LINE",
    sessionId,
    message: `Council deadlock. Rejection(s) from: ${
      rejections.map(r => r.agentId).join(", ")
    }. Calling Zeus and Jason.`,
  });

  const resolution = await presentToManagement({
    sessionId, rejections,
    pastDecisions: await queryCouncilIndex(`deadlock similar angle`),
  });

  if (resolution.outcome === "RESOLVED") {
    // Zeus overrules — reasoning logged
    // Overruled concern preserved — not erased
    await broadcastToComms({ from: "ZEUS", sessionId,
      message: resolution.zeusRuling });
    return { action: "PROCEED", resolution };
  }

  if (resolution.outcome === "PULLED") {
    // Jason pulls — deferred to next sprint
    await updateCouncilStatus(sessionId, "DEFERRED");
    await broadcastToComms({ from: "JASON", sessionId,
      message: `Video pulled. Council record preserved. Promoting next candidate.` });
    await promoteNextCandidate(resolution.userId);
    return { action: "DEFERRED", resolution };
  }
}
```

Overruled agent concerns are never erased. They live in the council
record and are evaluated during the RRQ Retro. If the video performs
badly in exactly the way the overruled agent predicted — the lesson
is written and that agent's domain weight increases in future councils.

---

## Comms Stream Format

Every verdict broadcast to the Comms tab in real time.
User sees the full debate as it happens.

```
Example council thread in Comms:

09:14  THE LINE   Council open. Video #47. "Claude 4 vs GPT-5 — which
                  one actually codes better?" Niche: Tech & AI.
                  Council index: 2 relevant past records found.

09:14  Hunter     Narrative window is open. Search volume +34% this week.
       (Rex)      US, UK, India all trending. Window estimate: 5 days.
                  ✓ APPROVED

09:15  Zara       India showing 6.8% CTR on head-to-head AI comparisons.
                  US CPM at $24. Two strong geos confirmed.
                  ✓ APPROVED

09:15  Sofia      Portfolio fit confirmed. Last 3 videos were tutorials.
       (ARIA)     Comparison piece balances the mix. Sprint timing clean.
                  ✓ APPROVED

09:16  Felix      Format achievable. Talking head + code overlay +
       (Qeon)     benchmark visuals. Render estimate: 2.1 hours.
                  ✓ APPROVED

09:17  Iris       Sequence drafted. Opening with the question, pivot at
       (Muse)     2:40 on benchmark results. Voice architecture ready.
                  PAUSE at 0:18, RISE at 1:45, PIVOT at 2:40.
                  ✓ APPROVED

09:18  Victor     Angle is ours. No major channel has framed this around
       (Regum)    real coding tasks. We are not summarising — we are
                  testing. Uniqueness score: 84/100.
                  ✓ APPROVED

09:19  THE LINE   Six green lights. Briefing Zeus.

09:19  Marcus     Approved. Ship it to production.
       (Zeus)

09:19  THE LINE   Council closed. Brief delivered to Felix (Qeon).
                  Production begins.
```

Comms groups all messages under collapsible
"Council — Video #47" header. User can expand to read
full debate or collapse to see just the outcome.

---

## Council Brief to Muse

After Zeus approves, The Line delivers a structured brief to Muse.
Not a summary — a production instruction.

```typescript
export interface CouncilBrief {
  councilId: string;
  videoId: string;
  narrativeAngle: string;       // from Rex
  trendWindow: string;          // "open — 5 day estimate"
  primaryGeo: string[];         // from Zara
  cpmRange: { min: number; max: number };
  geoFramingNote: string;
  portfolioRole: string;        // from ARIA
  missionTarget: string;        // subs or watch hours
  approvedFormat: string;       // from Qeon
  estimatedRenderTime: number;
  uniquenessAngle: string;      // from Regum — what makes this ours
  sourcesMayNotReplace: string[]; // what NOT to just summarise
  voiceArchitectureRequired: true;
  elevenLabsCuesRequired: true;
  perspectiveEngineRequired: true;
  openingQuestionRequired: true;
  pastDecisionsContext: string; // from council index — what to avoid
}
```

---

## DynamoDB Table

```
council-sessions
  PK:  councilId
  GSI: videoId, userId, niche, status, openedAt
  TTL: none — permanent record

  fields:
    councilId, videoId, userId, niche, topicAngle
    agentVerdicts[], conflictsRaised[], deadlockOccurred
    deadlockResolution?, finalBrief, zeusApproval
    openedAt, closedAt
    status: COUNCIL_OPEN → APPROVED → DEFERRED →
            IN_PRODUCTION → PUBLISHED → MONITORING →
            EVALUATED → LESSON_WRITTEN → ARCHIVED

  Completed by RRQ Retro:
    publishedAt, setTarget, monitoringWindowDays: 7
    earlyClose?, finalPerformance?, outcomeType?
    lesson?, writtenBackAt?
```

---

## Checklist

```
[ ] lib/council/trigger.ts          council open + index pre-query
[ ] lib/council/sequence.ts         agent call order + verdict collection
[ ] lib/council/deadlock.ts         Zeus + Jason resolution
[ ] lib/council/broadcast.ts        Comms stream integration
[ ] lib/council/brief.ts            council brief builder for Muse
[ ] DynamoDB table: council-sessions
[ ] Wire topic-queue → council trigger
[ ] Wire council approval → Qeon production start
[ ] Wire council brief → Muse
[ ] Wire all verdicts → Comms stream real time
[ ] Wire deadlock → Zeus + Jason
[ ] Wire deferred → next candidate promotion
[ ] Test happy path — 6 APPROVED → Zeus → production
[ ] Test FLAG path — Zeus acknowledges → production proceeds
[ ] Test deadlock RESOLVED — overruled concern logged
[ ] Test deadlock PULLED — next candidate promoted
[ ] Test Comms grouping — council thread collapse/expand
[ ] Test council index pre-query — past decisions surfaced
```

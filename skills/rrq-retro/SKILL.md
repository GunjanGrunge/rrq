---
name: rrq-retro
description: >
  The post-publish performance council. Triggered automatically 48 hours
  after a video is published. Runs for a maximum of 7 days — one full
  weekly cycle to validate trend, geo, retention, and algorithm factors.
  Closes early if the set target is hit before Day 7. On Day 7 the full
  council reconvenes, the lesson is written, embeddings are updated, and
  the video record is archived. The team moves forward. Past videos are
  never revisited operationally — their lessons live in the council index
  forever.
---

# RRQ Retro

## Philosophy

A team that does not study its own work does not improve. The RRQ Retro
is the closing ceremony of every video's lifecycle. It is not a post-mortem
— it is a learning session. The goal is not to assign blame but to extract
the signal: what combination of angle, format, voice, timing, and geo
produced this result, and what does that tell us about the next video?

Every lesson written here makes the council smarter. Every WIN_RECORD
tells the system what to replicate. Every MISS_RECORD tells the system
what to avoid, what to adjust, and who called it right before it went live.

---

## Retro Lifecycle

```
PUBLISH
   │
   ├── +2 hours        Theo confirms upload live, Comms notified
   │
   ├── +48 hours       Day 2 Early Read — first retro signal check
   │                   Rex + Zara pull CTR, impressions, click velocity
   │                   The Line assesses: on track / concern / emergency
   │
   ├── Day 2–7         Active monitoring window
   │                   Rex + Zara daily signal check (automated)
   │                   The Line tracks against SET TARGET
   │                   No council convened unless emergency signal
   │
   ├── TARGET HIT      Early Close Retro
   │   (before Day 7)  Full council called immediately
   │                   WIN_RECORD written to council index
   │                   Lesson: what worked — bottle it
   │                   Status → LESSON_WRITTEN → ARCHIVED
   │
   └── Day 7           Final Retro — mandatory regardless of performance
       (no target)     Full council reconvenes
                       Each agent reviews their domain
                       The Line synthesises → MISS_RECORD written
                       Embeddings updated in the-line-council-index
                       Status → LESSON_WRITTEN → ARCHIVED
                       Team attention shifts 100% to next video
```

---

## Day 2 Early Read

Automated. No council. The Line + Rex + Zara only.

```typescript
export async function runDay2EarlyRead(
  councilId: string,
  videoId: string,
): Promise<EarlyReadSignal> {

  const [youtubeData, geoData] = await Promise.all([
    getVideoAnalytics(videoId, { hours: 48 }),
    getSniperGeoSignal(videoId),
  ]);

  const signal = assessEarlySignal(youtubeData, geoData);

  // Three possible states
  if (signal.state === "ON_TRACK") {
    await broadcastToComms({
      from: "THE_LINE",
      message: `Day 2 read on Video #${videoId}: CTR ${signal.ctr}% —
                on track. Monitoring continues.`,
    });
  }

  if (signal.state === "CONCERN") {
    await broadcastToComms({
      from: "THE_LINE",
      message: `Day 2 read on Video #${videoId}: CTR below target.
                ${signal.concernNote}. Watching closely. No action yet.`,
    });
  }

  if (signal.state === "EMERGENCY") {
    // Immediate council — something is significantly wrong
    await broadcastToComms({
      from: "THE_LINE",
      message: `Day 2 emergency signal on Video #${videoId}.
                CTR ${signal.ctr}% — significantly below threshold.
                Calling emergency council.`,
    });
    await triggerEmergencyRetro(councilId, videoId, signal);
  }

  return signal;
}
```

---

## Daily Monitoring (Day 2–7)

```typescript
// Runs daily at 9AM via EventBridge
// RETRO_DAILY_RULE=cron(0 9 * * ? *)

export async function runDailyMonitoring(userId: string): Promise<void> {

  const activeVideos = await getVideosInMonitoring(userId);

  for (const video of activeVideos) {
    const analytics = await getVideoAnalytics(video.videoId, { days: 1 });
    const daysSincePublish = getDaysSince(video.publishedAt);

    // Check if target hit
    if (isTargetHit(analytics, video.setTarget)) {
      await triggerEarlyCloseRetro(video.councilId, video.videoId);
      continue;
    }

    // Check if Day 7 reached
    if (daysSincePublish >= 7) {
      await triggerFinalRetro(video.councilId, video.videoId);
      continue;
    }

    // Log daily signal to council record
    await appendDailySignal(video.councilId, {
      day: daysSincePublish,
      ctr: analytics.ctr,
      views: analytics.views,
      watchTime: analytics.watchTime,
      retention: analytics.avgRetention,
      subsGained: analytics.subsGained,
    });

    // The Line shares brief daily update in Comms
    await broadcastToComms({
      from: "THE_LINE",
      message: `Video #${video.videoId} — Day ${daysSincePublish}:
                ${analytics.views} views · ${analytics.ctr}% CTR ·
                ${analytics.avgRetention}% retention.
                Target: ${formatTarget(video.setTarget)}.`,
    });
  }
}
```

---

## Full Retro Council — Agent Domain Reviews

When the full retro convenes (early close or Day 7) each agent
reviews their domain call from the original council.

### REGUM — Was the editorial angle validated?
```
Reviews:    watch time distribution — did viewers stay through the angle?
            comment sentiment — did the perspective land?
            did the uniqueness score translate to real differentiation?

Writes:     "The angle worked because..." or
            "The angle failed because..." with specifics
```

### MUSE — Did the sequence hold retention at pivot points?
```
Reviews:    retention curve — where did viewers drop off?
            did the opening question hook in the first 30 seconds?
            did the pivot at the planned timestamp work?
            did the ElevenLabs voice cues land as intended?

Writes:     specific timestamps where sequence succeeded or failed
            voice cue adjustments for future videos
```

### REX — Was the narrative window as wide as predicted?
```
Reviews:    search impressions vs prediction
            did the trend accelerate, hold, or close faster than estimated?
            competitor videos published during the window?

Writes:     calibration note for future window estimates in this niche
```

### ZARA — Did the geo signal match actual geo performance?
```
Reviews:    actual geo distribution of views vs predicted markets
            CPM realised vs predicted range
            which geo over/underperformed

Writes:     geo calibration note — update market performance table
```

### ARIA — Did this video serve the portfolio as intended?
```
Reviews:    subs gained from this video vs portfolio average
            watch hours contributed
            did it balance the content mix as planned?

Writes:     portfolio impact note — adjust future distribution weights
```

### QEON — Were there any production issues that affected performance?
```
Reviews:    audio quality flags from Vera's QA log
            visual rendering issues reported post-publish
            ElevenLabs consistency — did the voice perform?
            thumbnail A/B test result from Theo

Writes:     production quality note — specific improvements for next run
```

### THE LINE — Synthesis

```typescript
export async function synthesiseRetro(
  councilId: string,
  agentReviews: AgentRetroReview[],
  finalPerformance: VideoPerformance,
  originalCouncil: CouncilRecord,
): Promise<RetroSynthesis> {

  // Opus 4 writes the synthesis — this is the permanent lesson
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 1000,
      system: `You are The Line — the institutional memory of the Optimizar
               system. You are writing a permanent lesson record for a video
               that has completed its 7-day monitoring window.
               This lesson will be stored in the council index and retrieved
               by future councils facing similar decisions.
               Be specific. Use real numbers. Name which agents called it
               right and which called it wrong. The lesson must be actionable
               — a future council should be able to read this and make a
               better decision because of it.`,
      messages: [{
        role: "user",
        content: `Original council verdict: ${JSON.stringify(originalCouncil.agentVerdicts)}
                  Final performance: ${JSON.stringify(finalPerformance)}
                  Set target: ${JSON.stringify(originalCouncil.setTarget)}
                  Target hit: ${isTargetHit(finalPerformance, originalCouncil.setTarget)}
                  Agent reviews: ${JSON.stringify(agentReviews)}
                  Any overruled concerns from original council: ${
                    JSON.stringify(originalCouncil.conflictsRaised)
                  }

                  Write the lesson. Structure:
                  1. OUTCOME — one sentence, numbers
                  2. WHAT WORKED — specific, cite the agent who called it
                  3. WHAT FAILED — specific, cite the agent who called it
                  4. OVERRULED CONCERNS — were any vindicated by performance?
                  5. ACTIONABLE LESSON — what should future councils do differently?
                  6. REPLICATION NOTE — if WIN, what combination to replicate?
                     AVOIDANCE NOTE — if MISS, what to avoid or adjust?`
      }]
    })
  });

  const lesson = response.json().content[0].text;
  const outcomeType = isTargetHit(finalPerformance, originalCouncil.setTarget)
    ? "WIN_RECORD" : "MISS_RECORD";

  return { lesson, outcomeType };
}
```

---

## Writing Back to Council Index

```typescript
export async function writeToCouncilIndex(
  councilId: string,
  synthesis: RetroSynthesis,
  originalCouncil: CouncilRecord,
): Promise<void> {

  // Write structured document to Bedrock Knowledge Base
  // the-line-council-index namespace
  await ingestToBedrockIndex({
    namespace: "the-line-council-index",
    documentId: councilId,
    content: {
      councilId,
      videoId: originalCouncil.videoId,
      niche: originalCouncil.niche,
      topicAngle: originalCouncil.topicAngle,
      format: originalCouncil.approvedFormat,
      outcomeType: synthesis.outcomeType,
      lesson: synthesis.lesson,
      agentCallAccuracy: calculateAgentAccuracy(
        originalCouncil.agentVerdicts,
        synthesis
      ),
      performance: {
        ctr: originalCouncil.finalPerformance.ctr,
        retention: originalCouncil.finalPerformance.avgRetention,
        views: originalCouncil.finalPerformance.views,
        targetHit: synthesis.outcomeType === "WIN_RECORD",
        earlyClose: originalCouncil.earlyClose ?? false,
      },
      tags: extractTags(originalCouncil), // niche, format, angle-type, geo
      createdAt: new Date().toISOString(),
    }
  });

  // Update DynamoDB record
  await updateCouncilRecord(councilId, {
    outcomeType: synthesis.outcomeType,
    lesson: synthesis.lesson,
    writtenBackAt: new Date().toISOString(),
    status: "LESSON_WRITTEN",
  });

  // Broadcast to Comms — the team sees the lesson
  await broadcastToComms({
    from: "THE_LINE",
    message: `RRQ Retro complete for Video #${originalCouncil.videoId}.
              Outcome: ${synthesis.outcomeType}.
              Lesson written to council index.
              Archiving record. Moving forward.`,
  });

  // Archive
  await updateCouncilStatus(councilId, "ARCHIVED");
}
```

---

## WIN vs MISS Record Structure

### WIN_RECORD
```
What to capture:
- Exact angle framing that worked
- Format + voice cue combination
- Geo + timing that aligned
- Which agent's prediction was most accurate
- Replication signal — what to do again

Future council use:
- The Line surfaces this when a similar angle is proposed
- "Video #31 tried this framing — won in 3 days.
   Rex called the window at 5 days — it closed in 4.
   Zara's India prediction was accurate to within 0.3% CTR."
```

### MISS_RECORD
```
What to capture:
- Where exactly the video lost viewers (timestamp)
- Which agent's concern was vindicated
- What the council got wrong and why
- Specific avoidance instruction for future councils

Future council use:
- The Line surfaces this as a warning
- "Video #28 tried a similar framing — MISS.
   Regum flagged uniqueness at the council — was overruled.
   Retention dropped at 2:40 — exactly where Muse predicted
   the pivot needed strengthening. Do not repeat."
```

---

## Comms — Retro Thread Example

```
Day 7 — MISS scenario:

14:00  THE LINE   RRQ Retro opening for Video #47.
                  7-day window complete. Target not hit.
                  Views: 1,240 · CTR: 2.1% · Retention: 38%.
                  Target was: 5,000 views · 4.5% CTR.
                  Calling agents for domain review.

14:01  Victor     Retention dropped at 2:38 — exactly at the pivot.
       (Regum)    The angle was right but the framing went generic
                  in the second act. We summarised instead of tested.
                  I should have caught this at the council.

14:02  Iris       Confirmed. The PIVOT cue at 2:40 was correct but
       (Muse)     the script content behind the cue was weak. The
                  voice carried it but the words didn't. Noted for
                  next sequence build.

14:03  Hunter     Window was accurate — 5 days. But competitor
       (Rex)      published the same framing on Day 2. We were 18
                  hours too slow. Earlier council trigger needed
                  for fast-moving angles.

14:04  Zara       India performed. US underperformed. CPM lower
                  than predicted — $16 vs $24. The geo was right
                  but the audience skewed younger than expected.

14:06  THE LINE   Synthesis complete. MISS_RECORD written.
                  Lesson: fast-moving angles need same-day council.
                  Second act must test, not summarise.
                  Archiving Video #47. Moving forward.
```

---

## Environment Variables

```bash
RETRO_DAILY_RULE=cron(0 9 * * ? *)
RETRO_DAY2_DELAY=172800000   # 48 hours in ms
RETRO_MAX_WINDOW_DAYS=7
```

---

## Checklist

```
[ ] lib/retro/trigger.ts          48hr auto-trigger post-publish
[ ] lib/retro/day2-read.ts        early signal assessment
[ ] lib/retro/daily-monitor.ts    daily check + target evaluation
[ ] lib/retro/full-retro.ts       council reconvene + domain reviews
[ ] lib/retro/synthesise.ts       Opus 4 lesson synthesis
[ ] lib/retro/write-back.ts       Bedrock index + DynamoDB update
[ ] EventBridge rule: RETRO_DAILY_RULE
[ ] Wire publish → 48hr retro trigger
[ ] Wire target hit → early close retro
[ ] Wire Day 7 → final retro
[ ] Wire retro complete → ARCHIVED status
[ ] Wire lesson → Bedrock council index
[ ] Wire all retro messages → Comms stream
[ ] Test WIN path — early close, WIN_RECORD written
[ ] Test MISS path — Day 7, MISS_RECORD written, overruled concern flagged
[ ] Test emergency Day 2 signal — council reconvenes
[ ] Test Bedrock ingestion — lesson retrievable by future council
```

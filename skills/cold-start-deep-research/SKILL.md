---
name: cold-start-deep-research
description: >
  The 24-hour deep research sprint that runs automatically when a user
  selects their channel mode — Full RRQ, Multi-Niche, or Single Niche —
  for a brand new channel starting from scratch. Rex, SNIPER, Oracle,
  and The Line run a comprehensive market audit before the first council
  ever convenes. Competitor channels are studied, content gaps are mapped,
  trend velocity is charted, and the council index is pre-populated with
  synthetic baseline records so the first video is not published blind.
  The first video is a smart test — not a banger.
---

# Cold Start Deep Research

## Philosophy

A new channel has no data. No past councils. No WIN or MISS records.
Without intervention the first 10–15 videos are flying blind — the
council index is empty, Oracle has no channel-specific patterns, and
every decision is a guess.

The Cold Start Deep Research sprint eliminates the blind launch.
In 24 hours the system learns everything publicly available about the
niche, the competitors, the gaps, and the opportunity. By the time
the first council convenes the agents are informed, the index has
baseline context, and the first video is a calculated test — not a
random shot.

Starting with a test is correct YouTube strategy. The algorithm rewards
consistency and learning. One lucky banger followed by silence is worse
than ten solid, improving videos in a row.

---

## Trigger

```typescript
// Fires immediately when user completes onboarding
// and channel mode is confirmed

export async function triggerColdStart(
  userId: string,
  channelMode: "FULL_RRQ" | "MULTI_NICHE" | "SINGLE_NICHE",
  selectedNiches: string[],
): Promise<void> {

  await broadcastToComms({
    from: "THE_LINE",
    message: `Cold start research sprint initiated.
              Mode: ${channelMode}. Niches: ${selectedNiches.join(", ")}.
              The team is going deep. First video brief ready in 24 hours.`,
  });

  await runDeepResearchSprint({
    userId, channelMode, selectedNiches,
    sprintStartedAt: new Date().toISOString(),
  });
}
```

---

## Sprint Structure — 24 Hours

```
Hour 0–4     REX — Trend & Narrative Mapping
Hour 0–4     SNIPER — Competitor & Market Intelligence (parallel)
Hour 4–8     ORACLE — Historical Pattern Analysis
Hour 8–16    THE LINE — Synthesis + Content Gap Map
Hour 16–20   FIRST VIDEO SHORTLIST — 3 candidates ranked
Hour 20–24   COUNCIL INDEX SEEDING — synthetic baseline records
Hour 24      SPRINT COMPLETE — first council ready to convene
```

---

## Phase 1 — Rex: Trend & Narrative Mapping (Hours 0–4)

```typescript
export async function rexDeepScan(
  niches: string[],
  channelMode: string,
): Promise<RexDeepScanResult> {

  const results = await Promise.all(niches.map(async (niche) => {

    // Current trending topics in niche
    const trending = await scanNicheTrends(niche, { depth: "DEEP", days: 30 });

    // Narrative layer analysis — what angles are people actually watching
    const narrativeLayers = await analyseNarrativeLayers(niche, {
      topVideos: 50,
      timeWindow: "30_DAYS",
    });

    // Topic velocity — what is rising vs peaking vs declining
    const velocity = await mapTopicVelocity(niche, {
      topics: trending.topics,
      granularity: "DAILY",
    });

    // Narrative drift signals — how has the conversation shifted
    const driftSignals = await detectNarrativeDrift(niche, {
      compareWindows: ["7_DAYS", "30_DAYS", "90_DAYS"],
    });

    return {
      niche,
      trendingTopics: trending.topics,
      narrativeLayers,
      velocityMap: velocity,
      driftSignals,
      openWindows: trending.topics.filter(t => t.saturation === "LOW"),
      closingWindows: trending.topics.filter(t => t.saturation === "HIGH"),
    };
  }));

  await broadcastToComms({
    from: "THE_LINE",
    message: `Rex deep scan complete.
              ${results.flatMap(r => r.openWindows).length} open narrative
              windows found across ${niches.length} niche(s).`,
  });

  return { nicheResults: results };
}
```

---

## Phase 1 (Parallel) — SNIPER: Competitor & Market Intelligence

```typescript
export async function sniperCompetitorAudit(
  niches: string[],
): Promise<SniperAuditResult> {

  const auditResults = await Promise.all(niches.map(async (niche) => {

    // Top 20 channels in niche
    const topChannels = await getTopChannelsInNiche(niche, { limit: 20 });

    // For each channel — analyse content patterns
    const channelProfiles = await Promise.all(
      topChannels.map(async (channel) => ({
        channelId: channel.id,
        name: channel.name,
        subscribers: channel.subscribers,
        avgViews: channel.avgViews30Days,
        topFormats: await analyseChannelFormats(channel.id),
        topAngles: await analyseChannelAngles(channel.id, { videos: 20 }),
        uploadFrequency: channel.uploadsPerWeek,
        avgCTR: channel.avgCTR,
        avgRetention: channel.avgRetention,
        contentGaps: [],  // filled in synthesis phase
      }))
    );

    // CPM and market data per niche
    const marketData = await getSniperNicheData(niche);

    // Geo opportunity — which markets are underserved in this niche
    const geoOpportunity = await mapGeoOpportunity(niche, topChannels);

    return {
      niche,
      topChannels: channelProfiles,
      marketData,
      geoOpportunity,
      dominantFormats: extractDominantFormats(channelProfiles),
      oversaturatedAngles: extractOversaturatedAngles(channelProfiles),
    };
  }));

  await broadcastToComms({
    from: "THE_LINE",
    message: `SNIPER competitor audit complete.
              ${auditResults.flatMap(r => r.topChannels).length} channels
              profiled. Content gaps being mapped.`,
  });

  return { auditResults };
}
```

---

## Phase 2 — Oracle: Historical Pattern Analysis (Hours 4–8)

```typescript
export async function oraclePatternAnalysis(
  niches: string[],
  rexScan: RexDeepScanResult,
  sniperAudit: SniperAuditResult,
): Promise<OraclePatternResult> {

  // Query Oracle's existing knowledge base for each niche
  const patterns = await Promise.all(niches.map(async (niche) => {

    const historicalFormats = await queryOracleKnowledge(
      `What video formats have historically performed best in ${niche}?
       What retention patterns are associated with new channels in this niche?
       What mistakes do new channels most commonly make?`,
      "CONTENT_TREND_SIGNALS"
    );

    const coldStartPatterns = await queryOracleKnowledge(
      `What does the growth curve of a successful new ${niche} channel
       look like in the first 90 days? What types of videos tend to
       be the first to gain traction?`,
      "CHANNEL_GROWTH_PATTERNS"
    );

    return { niche, historicalFormats, coldStartPatterns };
  }));

  return { patterns };
}
```

---

## Phase 3 — The Line: Synthesis + Content Gap Map (Hours 8–16)

```typescript
export async function theLinesynthesiseSprint(
  rexScan: RexDeepScanResult,
  sniperAudit: SniperAuditResult,
  oraclePatterns: OraclePatternResult,
  niches: string[],
): Promise<SprintSynthesis> {

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 4000,
      system: `You are The Line — synthesising a 24-hour deep research
               sprint for a brand new YouTube channel. Your job is to
               produce an actionable content gap map and first video
               shortlist. Be specific. Use real data from the scan.
               The first video is a smart test, not a banger.
               Think like a studio head on day one.`,
      messages: [{
        role: "user",
        content: `Niche(s): ${niches.join(", ")}
                  Rex scan: ${JSON.stringify(rexScan)}
                  Competitor audit: ${JSON.stringify(sniperAudit)}
                  Oracle patterns: ${JSON.stringify(oraclePatterns)}

                  Return JSON:
                  {
                    "contentGapMap": [
                      {
                        "gap": string,
                        "why": string,
                        "opportunity": "HIGH|MEDIUM|LOW",
                        "competitors": string[]   // who is missing this
                      }
                    ],
                    "oversaturatedAngles": string[],  // avoid these
                    "firstVideoShortlist": [
                      {
                        "rank": number,
                        "angle": string,
                        "format": string,
                        "whyThisFirst": string,
                        "estimatedCTR": string,
                        "riskLevel": "LOW|MEDIUM|HIGH",
                        "testHypothesis": string   // what we are testing
                      }
                    ],
                    "coldStartStrategy": string,  // overall first 30 days
                    "nicheInsights": object
                  }`
      }]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
}
```

---

## Phase 4 — Council Index Seeding (Hours 20–24)

Synthetic baseline records are written to the council index before
the first real council. These are not invented — they are derived
from the competitor audit and Oracle's historical patterns.

```typescript
export async function seedCouncilIndex(
  synthesis: SprintSynthesis,
  sniperAudit: SniperAuditResult,
  niches: string[],
): Promise<void> {

  const syntheticRecords = [];

  // For each oversaturated angle — create a synthetic MISS baseline
  for (const angle of synthesis.oversaturatedAngles) {
    syntheticRecords.push({
      type: "SYNTHETIC_MISS_BASELINE",
      niche: niches[0],
      topicAngle: angle,
      lesson: `This angle is oversaturated in the niche as of channel launch.
               Competitor analysis shows ${sniperAudit.auditResults[0]
               .topChannels.length}+ channels have covered this.
               Avoid until we have established authority or a unique angle.`,
      source: "COLD_START_RESEARCH",
      confidence: "RESEARCH_BASED",
    });
  }

  // For each content gap — create a synthetic WIN opportunity baseline
  for (const gap of synthesis.contentGapMap.filter(g =>
    g.opportunity === "HIGH"
  )) {
    syntheticRecords.push({
      type: "SYNTHETIC_WIN_OPPORTUNITY",
      niche: niches[0],
      topicAngle: gap.gap,
      lesson: `Content gap identified at launch. No major channel covering:
               ${gap.why}. High opportunity. First mover advantage available.`,
      source: "COLD_START_RESEARCH",
      confidence: "RESEARCH_BASED",
    });
  }

  // Ingest all synthetic records to Bedrock council index
  await Promise.all(syntheticRecords.map(record =>
    ingestToBedrockIndex({
      namespace: "the-line-council-index",
      documentId: `synthetic-${generateId()}`,
      content: record,
    })
  ));

  await broadcastToComms({
    from: "THE_LINE",
    message: `Council index seeded with ${syntheticRecords.length} baseline
              records from cold start research.
              First council can now convene with full context.`,
  });
}
```

---

## Sprint Complete — First Council Brief

After 24 hours The Line delivers the sprint summary to Mission Control
and queues the top-ranked video candidate for the first council.

```
Sprint Summary delivered to user in Mission Control:

┌─────────────────────────────────────────────────────┐
│  COLD START RESEARCH COMPLETE                        │
│  24-hour sprint · Tech & AI niche                    │
├─────────────────────────────────────────────────────┤
│  Competitors analysed    20 channels                 │
│  Content gaps found      7 high-opportunity gaps     │
│  Oversaturated angles    12 — flagged to avoid       │
│  Council index seeded    31 baseline records         │
├─────────────────────────────────────────────────────┤
│  FIRST VIDEO CANDIDATE                               │
│  "Claude 4 vs GPT-5 — real coding tasks, real data" │
│  Format: Comparison + live test                      │
│  Why first: gap in practical benchmarks, low risk    │
│  Testing: whether technical depth retains our        │
│           specific audience                          │
├─────────────────────────────────────────────────────┤
│  First council convenes now →                        │
└─────────────────────────────────────────────────────┘
```

---

## DynamoDB Record

```
cold-start-sprints
  PK:  userId
  fields:
    channelMode, selectedNiches
    sprintStartedAt, sprintCompletedAt
    rexScanSummary, sniperAuditSummary
    contentGapMap[], oversaturatedAngles[]
    firstVideoShortlist[]
    syntheticRecordsSeeded: number
    status: RUNNING → COMPLETE
```

---

## Checklist

```
[ ] lib/cold-start/trigger.ts         fires on onboarding complete
[ ] lib/cold-start/rex-scan.ts        deep trend + narrative scan
[ ] lib/cold-start/sniper-audit.ts    competitor + market audit
[ ] lib/cold-start/oracle-patterns.ts historical pattern query
[ ] lib/cold-start/synthesise.ts      Opus 4 gap map + shortlist
[ ] lib/cold-start/seed-index.ts      synthetic record ingestion
[ ] lib/cold-start/complete.ts        sprint summary + first candidate
[ ] DynamoDB table: cold-start-sprints
[ ] Wire onboarding complete → cold start trigger
[ ] Wire sprint complete → first council trigger
[ ] Wire sprint summary → Mission Control display
[ ] Wire synthetic records → Bedrock council index
[ ] Test Full RRQ mode — all niches scanned
[ ] Test Single Niche mode — deep single niche audit
[ ] Test Multi-Niche mode — parallel scans, combined gap map
[ ] Test council index seeding — synthetic records retrievable
[ ] Test 24hr completion — sprint finishes on time
```

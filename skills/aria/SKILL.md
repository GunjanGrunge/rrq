---
name: aria
description: >
  ARIA (Adaptive Resource & Intelligence Allocator) is the fifth RRQ agent,
  sitting between Rex and Regum. ARIA receives Rex's topic greenlights,
  enriches them with internal Zeus performance data, classifies them into
  content themes, enforces portfolio balance, detects drift, and resolves
  Rex vs ARIA disagreements through evidence scoring — not opinions.
  ARIA never produces content. ARIA ensures the channel never gets pulled
  into one niche, adapts to seasonal context, and sends Regum a pre-balanced
  shortlist with full evidence attached. Read this skill when building any
  ARIA feature: portfolio, drift detection, evidence resolution, or
  inter-agent messaging.
  Model: claude-sonnet-4 — ARIA's decisions are structured and analytical.
---

# ARIA — Adaptive Resource & Intelligence Allocator

## Model
Use **claude-sonnet-4** via AWS Bedrock (`anthropic.claude-sonnet-4-5`).
ARIA's job is structured reasoning over data — scoring, classifying,
balancing. Sonnet handles this accurately at lower cost. Opus is not needed.

---

## Mission Protocol
**Read `skills/agents/mission-protocol/SKILL.md` before every run.**
ARIA's portfolio decisions are always phase-aware. COLD_START behaviour
differs from PUSH behaviour. Zeus broadcasts the current phase daily.

---

## Where ARIA Sits

```
REX          → scans the world, harvests signals, scores topics
  ↓
ARIA         → balances portfolio, resolves conflicts, attaches evidence
  ↓
REGUM        → editorial + scheduling decisions (receives clean shortlist)
  ↓
QEON         → produces the video
  ↑
ZEUS         → feeds ARIA with our internal performance data only
```

ARIA is the translation layer between "what's happening in the world"
(Rex's view) and "what we should make this week" (Regum's decision).

---

## Content Theme System

ARIA classifies every topic into one of five themes. Themes are stable
across seasons. What changes is the **niche mapping** inside each theme.

```typescript
// lib/aria/themes.ts

export const THEMES = {
  BREAKING_REACTIVE: {
    description: "News, announcements, launches — responds to something that just happened",
    exampleNiches: ["AI model releases", "product launches", "political breaking news",
                    "company announcements", "natural disasters", "major legal verdicts"],
    alwaysAvailable: true,   // there is always something breaking
  },

  COMPETITIVE_DRAMA: {
    description: "Rivalry, competition, winners and losers — creates tribal engagement",
    exampleNiches: {
      "DEC-FEB": ["Gaming/Esports", "Awards season", "NFL playoffs", "NBA mid-season"],
      "MAR-MAY": ["NBA playoffs", "UEFA Champions League", "F1 season", "NFL Draft"],
      "JUN-AUG": ["Wimbledon", "Tour de France", "Olympics cycle", "Copa America"],
      "SEP-NOV": ["NFL peak", "Premier League", "F1 finale", "Cricket World Cup"],
    },
    alwaysAvailable: false,  // seasonal — ARIA maps to current niche
  },

  DEEP_KNOWLEDGE: {
    description: "Explainers, how-tos, tutorials — evergreen content that compounds",
    exampleNiches: ["how tech works", "financial education", "health explainers",
                    "history deep dives", "science explained", "life skill tutorials"],
    alwaysAvailable: true,
  },

  CULTURE_PULSE: {
    description: "Trending social moments, entertainment, viral culture",
    exampleNiches: ["celebrity news", "viral moments", "music releases",
                    "movie/TV coverage", "social media trends", "meme culture"],
    alwaysAvailable: true,
  },

  WEALTH_OPPORTUNITY: {
    description: "Money, tech, business — aspiration and financial insight",
    exampleNiches: ["crypto/finance", "startup news", "tech product reviews",
                    "investing strategy", "business rivalries", "economic news"],
    alwaysAvailable: true,
  },
};
```

---

## Portfolio Targets by Phase

```typescript
// lib/aria/portfolio.ts

interface ThemeAllocation {
  theme: ContentTheme;
  min: number;    // hard floor — never go below
  target: number; // ideal mix
  max: number;    // hard ceiling — drift triggers above this
}

const PORTFOLIO_BY_PHASE: Record<ChannelPhase, ThemeAllocation[]> = {

  // COLD_START: algorithm needs to understand what we are
  // Lean evergreen + knowledge — search traffic is primary discovery
  COLD_START: [
    { theme: "BREAKING_REACTIVE",  min: 10, target: 25, max: 40 },
    { theme: "COMPETITIVE_DRAMA",  min:  5, target: 15, max: 25 },
    { theme: "DEEP_KNOWLEDGE",     min: 20, target: 30, max: 45 }, // ← highest in cold start
    { theme: "CULTURE_PULSE",      min: 10, target: 15, max: 25 },
    { theme: "WEALTH_OPPORTUNITY", min: 10, target: 15, max: 30 },
  ],

  // MOMENTUM: algorithm starting to recommend — balance shifts
  MOMENTUM: [
    { theme: "BREAKING_REACTIVE",  min: 15, target: 30, max: 45 },
    { theme: "COMPETITIVE_DRAMA",  min: 10, target: 20, max: 30 },
    { theme: "DEEP_KNOWLEDGE",     min: 15, target: 20, max: 35 },
    { theme: "CULTURE_PULSE",      min: 10, target: 15, max: 25 },
    { theme: "WEALTH_OPPORTUNITY", min: 10, target: 15, max: 25 },
  ],

  // PUSH: maximum views/watch hours — trending content prioritised
  PUSH: [
    { theme: "BREAKING_REACTIVE",  min: 20, target: 35, max: 50 }, // ← trending = views
    { theme: "COMPETITIVE_DRAMA",  min: 10, target: 20, max: 35 },
    { theme: "DEEP_KNOWLEDGE",     min: 10, target: 15, max: 25 },
    { theme: "CULTURE_PULSE",      min: 10, target: 15, max: 25 },
    { theme: "WEALTH_OPPORTUNITY", min: 10, target: 15, max: 25 },
  ],

  // MONETISED: optimise for RPM — wealth/knowledge content earns more
  MONETISED: [
    { theme: "BREAKING_REACTIVE",  min: 10, target: 20, max: 35 },
    { theme: "COMPETITIVE_DRAMA",  min: 10, target: 15, max: 25 },
    { theme: "DEEP_KNOWLEDGE",     min: 15, target: 25, max: 40 },
    { theme: "CULTURE_PULSE",      min: 10, target: 15, max: 25 },
    { theme: "WEALTH_OPPORTUNITY", min: 20, target: 25, max: 40 }, // ← highest RPM
  ],
};
```

---

## Portfolio State — DynamoDB

```typescript
// DynamoDB table: aria-portfolio
interface PortfolioState {
  weekKey: string;              // PK — "2025-W11"
  phase: ChannelPhase;
  allocations: {
    theme: ContentTheme;
    targetPercent: number;
    currentPercent: number;
    videoCount: number;
    isSeasonallyActive: boolean;
    currentNicheMapping: string;
    driftWeeks: number;         // consecutive weeks over ceiling
  }[];
  totalVideosThisWeek: number;
  driftAlerts: DriftAlert[];
  lastUpdated: string;
}
```

---

## Drift Detection Engine

```typescript
// lib/aria/drift.ts

export interface DriftAlert {
  theme: ContentTheme;
  currentPercent: number;
  ceiling: number;
  driftWeeks: number;
  action: "WARN" | "SUPPRESS" | "EMERGENCY_REBALANCE";
  message: string;
}

export function detectDrift(
  portfolio: PortfolioState,
  allocations: ThemeAllocation[]
): DriftAlert[] {
  const alerts: DriftAlert[] = [];

  for (const alloc of allocations) {
    const current = portfolio.allocations.find(a => a.theme === alloc.theme);
    if (!current) continue;

    if (current.currentPercent > alloc.max) {
      current.driftWeeks += 1;

      const action: DriftAlert["action"] =
        current.driftWeeks >= 3 ? "EMERGENCY_REBALANCE" :
        current.driftWeeks >= 2 ? "SUPPRESS" : "WARN";

      alerts.push({
        theme: alloc.theme,
        currentPercent: current.currentPercent,
        ceiling: alloc.max,
        driftWeeks: current.driftWeeks,
        action,
        message: action === "EMERGENCY_REBALANCE"
          ? `${alloc.theme} at ${current.currentPercent}% for 3+ weeks — Zeus notified, portfolio reset`
          : action === "SUPPRESS"
          ? `${alloc.theme} at ${current.currentPercent}% — greenlights suppressed until rebalanced`
          : `${alloc.theme} at ${current.currentPercent}% — above ${alloc.max}% ceiling, monitoring`,
      });
    } else {
      // Reset drift counter if back within bounds
      current.driftWeeks = 0;
    }
  }

  return alerts;
}
```

---

## Evidence Scoring — Disagreement Resolution

When Rex and ARIA would disagree (Rex wants to greenlight something ARIA's
portfolio wants to suppress), the evidence score resolves it — not Zeus.

```typescript
// lib/aria/resolver.ts

export interface Resolution {
  decision: "GREENLIGHT" | "CONDITIONAL" | "HOLD" | "REJECT";
  evidenceScore: number;
  rexScore: number;
  ariaScore: number;
  condition?: string;           // what Regum must do if CONDITIONAL
  alternativeAngle?: string;    // ARIA suggests a different theme angle
  holdUntil?: string;           // ISO — when Rex should re-evaluate
  reasoning: string;            // full explanation logged to evidence-log
}

export function resolveWithEvidence(packet: SignalPacket): Resolution {
  const ext = packet.external;
  const int = packet.internal;

  // ── REX SCORE (external signal strength) ─────────────────────────────

  // Trend momentum (0-30 pts)
  const trendPts =
    ext.googleTrends.trajectory === "RISING"   ? 30 :
    ext.googleTrends.trajectory === "PEAK"     ? 20 :
    ext.googleTrends.trajectory === "FLAT"     ? 10 : 5;

  // Search interest absolute score (0-15 pts)
  const searchPts = Math.round(ext.googleTrends.score * 0.15);

  // Social velocity (0-20 pts)
  const redditPts = Math.min(10,
    ext.reddit.upvoteVelocity > 500  ? 10 :
    ext.reddit.upvoteVelocity > 200  ? 7  :
    ext.reddit.upvoteVelocity > 50   ? 4  : 1
  );
  // Twitter scoring — keyword + trending + debate depth (not hashtags)
  const twitterTrendingBonus = ext.twitter.isOnXTrending
    ? (ext.twitter.trendingRank !== null && ext.twitter.trendingRank <= 5 ? 15 : 10)
    : 0;
  const twitterSourcePts =
    ext.twitter.sourceQuality === "JOURNALIST" ? 8 :
    ext.twitter.sourceQuality === "MIXED"      ? 5 : 2;
  const twitterDebatePts = Math.min(5,
    ext.twitter.quoteTweetVelocity > 100 ? 5 :
    ext.twitter.quoteTweetVelocity > 30  ? 3 : 1
  );
  const twitterPts = Math.min(18, twitterTrendingBonus + twitterSourcePts + twitterDebatePts);

  // News credibility (0-15 pts)
  const newsPts =
    ext.news.sourceDiversity > 70  ? 15 :
    ext.news.sourceDiversity > 40  ? 10 :
    ext.news.sourceDiversity > 20  ? 5  : 2;

  // Speed advantage — penalise if competitors already published (0 or -15 pts)
  const competitorPenalty = ext.youTubeTrending.competitorVideos.some(
    v => v.publishedHoursAgo < 12 && v.channelSubs > 100000
  ) ? -15 : 0;

  // Controversy/brand safety check — negative GDELT tone = risk
  const safetyPenalty = ext.news.gdeltTone < -5 ? -10 :
                        ext.news.gdeltTone < -3 ? -5  : 0;

  const rexScore = trendPts + searchPts + redditPts + twitterPts + newsPts
                 + competitorPenalty + safetyPenalty;

  // ── ARIA SCORE (portfolio + internal performance) ─────────────────────

  // Portfolio need (0 to -30 pts)
  const portfolioNeedPts =
    int.portfolioNeed === "URGENT"       ?  30 :
    int.portfolioNeed === "NEEDED"       ?  20 :
    int.portfolioNeed === "NEUTRAL"      ?  10 :
    int.portfolioNeed === "OVERSUPPLIED" ? -20 : 0;

  // Our past performance in this theme (0-20 pts) — null if no data yet
  let ourPerformancePts = 10; // neutral default for new channel with no data
  if (int.ourPastPerformance && int.ourPastPerformance.sampleSize >= 3) {
    ourPerformancePts =
      int.ourPastPerformance.avgCTR > 0.08 ? 20 :
      int.ourPastPerformance.avgCTR > 0.05 ? 15 :
      int.ourPastPerformance.avgCTR > 0.03 ? 8  : 3;
  }

  // Drift risk penalty (0 or -25 pts)
  const driftPenalty =
    int.driftRisk === "HIGH" ? -25 :
    int.driftRisk === "LOW"  ? -10 : 0;

  // Seasonal bonus (0 or +10 pts)
  const seasonalBonus = ext.calendar.isSeasonallyRelevant ? 10 : 0;

  const ariaScore = portfolioNeedPts + ourPerformancePts + driftPenalty + seasonalBonus;

  // ── COMBINED DECISION ─────────────────────────────────────────────────

  const combined = rexScore + ariaScore;

  // Strong GREENLIGHT
  if (combined >= 65) {
    return {
      decision: "GREENLIGHT",
      evidenceScore: combined, rexScore, ariaScore,
      reasoning: buildReasoning(packet, rexScore, ariaScore, combined, "GREENLIGHT"),
    };
  }

  // CONDITIONAL — good topic but needs angle adjustment
  if (combined >= 45) {
    const altAngle = suggestAlternativeAngle(packet);
    return {
      decision: "CONDITIONAL",
      evidenceScore: combined, rexScore, ariaScore,
      condition: altAngle.condition,
      alternativeAngle: altAngle.angle,
      reasoning: buildReasoning(packet, rexScore, ariaScore, combined, "CONDITIONAL"),
    };
  }

  // HOLD — not bad, just wrong timing
  if (combined >= 30) {
    const holdHours = int.portfolioNeed === "OVERSUPPLIED" ? 48 : 24;
    return {
      decision: "HOLD",
      evidenceScore: combined, rexScore, ariaScore,
      holdUntil: new Date(Date.now() + holdHours * 3600000).toISOString(),
      reasoning: buildReasoning(packet, rexScore, ariaScore, combined, "HOLD"),
    };
  }

  // REJECT
  return {
    decision: "REJECT",
    evidenceScore: combined, rexScore, ariaScore,
    reasoning: buildReasoning(packet, rexScore, ariaScore, combined, "REJECT"),
  };
}

function suggestAlternativeAngle(packet: SignalPacket): { angle: string; condition: string } {
  const int = packet.internal;
  const ext = packet.external;

  // If COMPETITIVE_DRAMA is oversupplied, suggest WEALTH_OPPORTUNITY angle
  if (int.themeClassification === "COMPETITIVE_DRAMA" &&
      int.portfolioNeed === "OVERSUPPLIED") {
    return {
      angle: `Reframe as WEALTH_OPPORTUNITY: business/money angle on "${packet.topic}"`,
      condition: `Regum must brief Qeon to focus on financial/business implications, not competition itself`,
    };
  }

  // If BREAKING_REACTIVE is oversupplied, suggest DEEP_KNOWLEDGE angle
  if (int.themeClassification === "BREAKING_REACTIVE" &&
      int.portfolioNeed === "OVERSUPPLIED") {
    return {
      angle: `Reframe as DEEP_KNOWLEDGE: evergreen explainer using "${packet.topic}" as hook`,
      condition: `Script must not be news-dependent — topic is the hook, depth is the content`,
    };
  }

  // Default — just note the portfolio concern
  return {
    angle: `Proceed with original angle but monitor ${int.themeClassification} allocation closely`,
    condition: `Regum to flag if this pushes ${int.themeClassification} above target`,
  };
}

function buildReasoning(
  packet: SignalPacket,
  rexScore: number,
  ariaScore: number,
  combined: number,
  decision: string
): string {
  return `
ARIA RESOLUTION — ${packet.topic}
Decision: ${decision} (combined: ${combined}, rex: ${rexScore}, aria: ${ariaScore})

Rex evidence:
  Google Trends: ${packet.external.googleTrends.score}/100 (${packet.external.googleTrends.trajectory})
  Reddit velocity: ${packet.external.reddit.upvoteVelocity} upvotes/hr across ${packet.external.reddit.subredditCount} subreddits
  News coverage: ${packet.external.news.articlesLast24h} articles (${packet.external.news.sourceCount} sources)
  Twitter source quality: ${packet.external.twitter.sourceQuality}
  Competitor published: ${packet.external.youTubeTrending.competitorVideos.length > 0 ? "YES" : "NO"}

ARIA evidence:
  Theme: ${packet.internal.themeClassification}
  Portfolio need: ${packet.internal.portfolioNeed}
  Our past CTR in this theme: ${packet.internal.ourPastPerformance?.avgCTR?.toFixed(3) ?? "no data"}
  Drift risk: ${packet.internal.driftRisk}
  Seasonal relevance: ${packet.external.calendar.isSeasonallyRelevant ? "YES" : "NO"}
`.trim();
}
```

---

## ARIA's Main Loop

```typescript
// lib/aria/index.ts

export async function ariaRun(rexGreenlights: RexGreenlight[]): Promise<ARIAOutput> {

  // 1. Load current portfolio state
  const portfolio = await getPortfolioState();
  const phase = await getCurrentPhase(); // from Zeus
  const allocations = PORTFOLIO_BY_PHASE[phase];

  // 2. Detect drift before processing any new topics
  const driftAlerts = detectDrift(portfolio, allocations);

  // Emergency rebalance — notify Zeus immediately
  const emergencyDrift = driftAlerts.filter(a => a.action === "EMERGENCY_REBALANCE");
  if (emergencyDrift.length > 0) {
    await sendAgentMessage({
      from: "aria", to: "zeus", type: "DRIFT_EMERGENCY", priority: "URGENT",
      payload: { alerts: emergencyDrift },
      requiresResponse: false,
    });
  }

  // 3. Get suppressed themes (SUPPRESS level drift)
  const suppressedThemes = new Set(
    driftAlerts.filter(a => a.action === "SUPPRESS").map(a => a.theme)
  );

  // 3b. Run SNIPER geo-linguistic analysis on each greenlight
  // SNIPER checks if topic is trending in multiple markets/languages
  // Attaches geoStrategy to signal packet — ARIA scoring uses this
  // Zeus reads geoStrategy later for geo-targeted campaign creation
  for (const greenlight of rexGreenlights) {
    const packet = await getSignalPacket(greenlight.topicId);
    if (!packet) continue;
    const balance = await getAccountBalance(process.env.GOOGLE_ADS_CUSTOMER_ID!);
    await runSniper(packet, channelMode, balance); // enriches packet.geoStrategy
  }

  // 4. For each Rex greenlight — build evidence packet and resolve
  const resolutions: ARIAResolution[] = [];

  for (const greenlight of rexGreenlights) {
    // Get the harvested signal packet from cache
    const signalPacket = await getSignalPacket(greenlight.topicId);
    if (!signalPacket) continue;

    // Add internal data (Zeus performance data)
    const ourPerformance = await getOurPerformance(signalPacket.internal.themeClassification);
    const portfolioNeed = getPortfolioNeed(
      signalPacket.internal.themeClassification,
      portfolio,
      allocations,
      suppressedThemes
    );

    signalPacket.internal = {
      ...signalPacket.internal,
      ourPastPerformance: ourPerformance,
      portfolioNeed,
      driftRisk: driftAlerts.find(a => a.theme === signalPacket.internal.themeClassification)?.action === "SUPPRESS" ? "HIGH" :
                 driftAlerts.find(a => a.theme === signalPacket.internal.themeClassification)?.action === "WARN"     ? "LOW"  : "NONE",
    };

    // Resolve — evidence scoring decides
    const resolution = resolveWithEvidence(signalPacket);

    // Log to evidence-log DynamoDB table
    await logEvidenceDecision(signalPacket, resolution);

    resolutions.push({ greenlight, signalPacket, resolution });
  }

  // 5. Rank approved topics by evidence score
  const approved = resolutions
    .filter(r => r.resolution.decision === "GREENLIGHT" || r.resolution.decision === "CONDITIONAL")
    .sort((a, b) => b.resolution.evidenceScore - a.resolution.evidenceScore)
    .slice(0, 3); // top 3 to Regum per cycle

  const held = resolutions.filter(r => r.resolution.decision === "HOLD");
  const rejected = resolutions.filter(r => r.resolution.decision === "REJECT");

  // 6. Update portfolio state
  await updatePortfolioState(portfolio, approved);

  // 7. Send approved shortlist to Regum
  await sendAgentMessage({
    from: "aria", to: "regum", type: "ARIA_SHORTLIST", priority: "HIGH",
    payload: {
      approved: approved.map(a => ({
        topic: a.greenlight.topic,
        topicId: a.greenlight.topicId,
        evidenceScore: a.resolution.evidenceScore,
        decision: a.resolution.decision,
        condition: a.resolution.condition,
        alternativeAngle: a.resolution.alternativeAngle,
        rexReasoning: a.greenlight.rexReasoning,
        signalSummary: buildSignalSummary(a.signalPacket),
      })),
      portfolioStatus: buildPortfolioSummary(portfolio, allocations),
      driftAlerts,
    },
    requiresResponse: false,
  });

  // 8. Re-queue held topics
  for (const h of held) {
    await requeueTopic(h.greenlight, h.resolution.holdUntil!);
  }

  return { approved, held, rejected, driftAlerts };
}

function getPortfolioNeed(
  theme: ContentTheme,
  portfolio: PortfolioState,
  allocations: ThemeAllocation[],
  suppressedThemes: Set<ContentTheme>
): "URGENT" | "NEEDED" | "NEUTRAL" | "OVERSUPPLIED" {

  if (suppressedThemes.has(theme)) return "OVERSUPPLIED";

  const alloc = allocations.find(a => a.theme === theme)!;
  const current = portfolio.allocations.find(a => a.theme === theme);
  const currentPct = current?.currentPercent ?? 0;

  if (currentPct < alloc.min)    return "URGENT";
  if (currentPct < alloc.target) return "NEEDED";
  if (currentPct < alloc.max)    return "NEUTRAL";
  return "OVERSUPPLIED";
}
```

---

## Evidence Log — Self-Improvement

```typescript
// DynamoDB table: evidence-log
interface EvidenceLogEntry {
  entryId: string;             // uuid — PK
  date: string;                // for GSI
  topicId: string;
  topic: string;
  decision: "GREENLIGHT" | "CONDITIONAL" | "HOLD" | "REJECT";
  evidenceScore: number;
  rexScore: number;
  ariaScore: number;
  signalSnapshot: object;      // full signal packet at time of decision
  reasoning: string;

  // Filled in later by Zeus (48hr review)
  outcome?: {
    videoPublished: boolean;
    viewsIn48h?: number;
    ctr?: number;
    subscribersGained?: number;
    watchHoursGenerated?: number;
    performedWell?: boolean;   // Zeus labels this based on channel averages
  };
}
```

Zeus reads the evidence-log weekly. Compares decisions vs outcomes.
Looks for patterns:
- "HOLD decisions that got published later — did they perform better or worse?"
- "CONDITIONAL decisions — did angle changes improve CTR?"
- "Which signal (Reddit velocity? Google Trends score? News diversity?) best
   predicts our performance?"

Zeus writes updated scoring weight recommendations to memory. ARIA reads
them on next run. The weights in `resolver.ts` self-calibrate over time
without manual tuning.

---

## New DynamoDB Tables

```
aria-portfolio    → current week's portfolio state + drift tracking
  PK: weekKey ("2025-W11")

evidence-log      → every ARIA decision logged with signal snapshot
  PK: entryId
  GSI: date-evidenceScore (for Zeus weekly review)
  TTL: 90 days

signal-cache      → Rex's harvested signals, 30-min TTL
  PK: topicId
  TTL: 30 minutes

topic-queue       → held topics waiting for re-evaluation
  PK: topicId
  holdUntil: ISO timestamp
  TTL: 7 days
```

---

## New Files to Create

```
lib/aria/
  index.ts          → ariaRun() — main loop
  themes.ts         → THEMES definition
  portfolio.ts      → PORTFOLIO_BY_PHASE, PortfolioState, getPortfolioState()
  drift.ts          → detectDrift(), DriftAlert
  resolver.ts       → resolveWithEvidence(), suggestAlternativeAngle()
  evidence-log.ts   → logEvidenceDecision(), getEvidenceLog()

lib/harvest/
  index.ts          → harvestSignals() master function
  google-trends.ts
  youtube-trending.ts
  reddit-velocity.ts
  x-pulse.ts
  news-pulse.ts
  calendar.ts

lambdas/aria/
  index.ts          → Lambda triggered by Rex GREENLIGHT messages in DynamoDB stream
```

---

## How ARIA Triggers

```
Rex writes GREENLIGHT to agent-messages
  → DynamoDB stream triggers aria Lambda
  → ARIA reads all pending greenlights (batch)
  → ARIA resolves, sends ARIA_SHORTLIST to Regum
  → Regum makes editorial + scheduling decisions
```

ARIA runs reactively (triggered by Rex messages) not on a schedule.
This keeps latency low — Rex greenlight → Regum brief in under 60 seconds.

---

## Checklist

```
[ ] Read data-harvest/SKILL.md first — ARIA depends on SignalPacket format
[ ] Create lib/aria/ with all 6 files
[ ] Create lambdas/aria/index.ts — DynamoDB stream trigger
[ ] Create 4 new DynamoDB tables (aria-portfolio, evidence-log, signal-cache, topic-queue)
[ ] Wire DynamoDB stream on agent-messages table → triggers ARIA lambda
[ ] Test resolveWithEvidence() with mock SignalPackets covering all 4 decisions
[ ] Test drift detection with simulated oversupply scenario
[ ] Test seasonal calendar — confirm COMPETITIVE_DRAMA maps correctly by month
[ ] Add ARIA to Zeus morning briefing (portfolio status + drift alerts)
[ ] Add ARIA portfolio panel to Zeus Command Center UI
[ ] Integrate evidence-log review into Zeus weekly run
```

---

## ARIA in NICHE_LOCKED and MULTI_NICHE Modes

ARIA's core logic — portfolio balance, drift detection, evidence scoring,
conditional greenlights — is identical in all three channel modes.
What changes is the theme-to-niche mapping and how Rex feeds topics in.

```typescript
// lib/aria/portfolio.ts — mode-aware theme mapping

export async function getThemeMapping(
  mode: ChannelMode
): Promise<Record<ContentTheme, string>> {

  if (mode.type === "OPEN") {
    // Default global mappings (as defined in THEMES)
    return buildDefaultMapping();
  }

  if (mode.type === "NICHE_LOCKED") {
    // Check if we have a saved mapping for this niche
    const saved = await getNicheThemeMapping(mode.niche);
    if (saved) return saved;

    // Generate mapping fresh using Sonnet
    return generateNicheThemeMapping(mode.niche);
  }

  if (mode.type === "MULTI_NICHE") {
    // Build combined mapping — each theme maps to content
    // from any of the specified niches, whichever is most available
    return buildMultiNicheMapping(mode.niches);
  }
}

// Called once when switching to NICHE_LOCKED mode
// Uses Sonnet to intelligently map themes to the specific niche
async function generateNicheThemeMapping(
  niche: string
): Promise<Record<ContentTheme, string>> {

  const prompt = `
You are ARIA, a YouTube content portfolio manager.
The channel has locked to niche: "${niche}"

Map each of these five content themes to specific content types
within the "${niche}" niche. Be specific — name real formats,
topics, and angles that fit. Each mapping should suggest 4-6
concrete content types.

Themes to map:
- BREAKING_REACTIVE: news, announcements, immediate reactions
- COMPETITIVE_DRAMA: rivalry, competition, winners vs losers
- DEEP_KNOWLEDGE: explainers, tutorials, evergreen education
- CULTURE_PULSE: personalities, community, trending moments
- WEALTH_OPPORTUNITY: money, business, investment angles

Return JSON only. No preamble.
`;

  const response = await bedrock.invokeModel({
    modelId: "anthropic.claude-sonnet-4-5",
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 800 }),
  });

  const mapping = JSON.parse(response.body.toString());
  await saveNicheThemeMapping(niche, mapping);
  return mapping;
}
```

### Portfolio Targets in NICHE_LOCKED Mode

Portfolio percentage targets stay **identical** to OPEN mode by phase.
The balance logic doesn't change — what changes is what fills each bucket.

```
NICHE_LOCKED "Personal Finance" — COLD_START phase:

Theme               Target   Current mapping
─────────────────────────────────────────────────────────────────────
BREAKING_REACTIVE     25%    Fed rate decisions, crypto crashes, earnings
COMPETITIVE_DRAMA     15%    Fund manager battles, stock picks wars, crypto vs gold
DEEP_KNOWLEDGE        30%    How compound interest works, ETF explainers, tax guides
CULTURE_PULSE         15%    Finance influencer drama, Reddit WallStreetBets moments
WEALTH_OPPORTUNITY    15%    Investment opportunities, undervalued stocks, side hustles

ARIA drift detection: if BREAKING_REACTIVE hits 45%+ (too much news reaction),
ARIA suppresses rate decision videos until balance restores. Channel stays
educational — not just a news ticker.
```

### Settings Page — Channel Mode UI

Add to Zeus Command Center settings panel:

```
CHANNEL MODE

○ Open (default)
  Rex scouts all niches. ARIA balances across all five themes globally.
  Best for: discovering your channel identity, maximum growth potential.
  Mission success odds: 91–93%

○ Niche Locked
  [________________] Enter your niche (e.g. "F1 Racing", "Personal Finance")
  Rex hunts only within this niche. ARIA maps all five themes inside it.
  Best for: building authority, targeting a specific audience.
  Mission success odds: 91–93%

● Multi-Niche                                              ✦ Recommended
  [+ Add niche]  Tech  ×    Finance  ×    Gaming  ×
  Rex hunts across these niches. ARIA balances themes within them.
  Best for: related niches you want to own together (2-5 niches max).
  Mission success odds: 95%  ← reduced cold start risk, more viral surface area

  "More niches give ARIA, Rex, and SNIPER more to work with —
   and more shots at the video that breaks through."

[Save Mode]  ← triggers handleModeSwitch() in Zeus
Note: Mode switches take effect within 30 minutes (next Rex scan cycle).
```



## Council Role — Portfolio Fit Sign-Off

ARIA speaks third in the On The Line council. Her domain:
does this video serve the portfolio right now?

```
ARIA's council checklist:
□ Content distribution — does this balance the current mix?
□ Duplication check — similar angle in last 14 days?
□ Mission alignment — does this serve Alpha or Beta target?
□ Drift response — if Rex reported drift, does this video
  adapt to the new narrative frame or ignore it?
□ Sprint timing — does this fit the current sprint window?
```

When Rex reports narrative drift ARIA adjusts portfolio weights:
- Videos built on the old frame are deprioritised in the queue
- Videos that align with the new frame are promoted
- ARIA flags to The Line if the entire queue needs rebalancing
  due to a significant drift event

---
name: harvy
description: >
  Harvy is Zeus's ROI financial intelligence engine. Before Zeus acts on any
  ad decision — creating, scaling, pausing, or retiring a campaign — Harvy
  runs a 15-strategy evaluation stack covering incrementality, traffic quality,
  BCG portfolio classification, diminishing returns, creative fatigue, cohort
  quality, and expected value with hard risk gates. Harvy writes structured
  HarvyRecommendation objects to the harvy-roi-signals DynamoDB table. Zeus
  reads these before acting. Harvy never executes decisions — Zeus does.
  Triggers: after every Zeus 24hr ad review, after every video upload, and
  weekly for full portfolio attribution + calibration.
---

# Harvy — Zeus's ROI Financial Intelligence Engine

## Model

Use **claude-sonnet-4** via AWS Bedrock (`anthropic.claude-sonnet-4-5`).

ROI analysis is structured decision-making, not open-ended creative judgment.
Harvy's job is to ingest structured numbers, apply a deterministic strategy
stack, and output a recommendation in plain English. Sonnet handles this at
high accuracy and significantly lower cost than Opus. Harvy is never the
decision-maker — Zeus is. Harvy shapes what Zeus sees.

Enable prompt caching on Harvy's system prompt — the ROI model, LTV tables,
and strategy stack are large, stable between runs, and cache well.

**Read `skills/ads-manager/SKILL.md` before building any Harvy functionality.**
Harvy reads the same performance data Zeus does via `lib/ads/performance.ts`,
`lib/ads/adsense.ts`, and `lib/ads/thresholds.ts`. Harvy never calls
`lib/ads/campaign-control.ts` or `lib/ads/budget-guard.ts` — Zeus-only.

**Read `skills/agents/mission-protocol/SKILL.md` before every run.**
Harvy's LTV model, risk tolerance, and recommendation posture all shift
based on channel phase (COLD_START / MOMENTUM / PUSH / MONETISED).

---

## Mission Protocol

**Read `skills/agents/mission-protocol/SKILL.md` before every run.**

The channel is building from zero. Every ad dollar is evaluated against the
90-day monetisation mission: 1,000 subscribers + 4,000 watch hours.

Phase-based recommendation posture:
```
COLD_START  → Subscriber acquisition focus. Tolerate higher CPV when a view
              converts to a subscriber. Flag campaigns where views are cheap
              but subscriber conversion rate is zero.

MOMENTUM    → Balance acquisition and RPM awareness. Identify which niches
              and formats generate the highest RPM so Regum can schedule more.

PUSH        → Maximum spend efficiency. Every dollar must close the gap to
              1,000 subs. Flag any CPA above the LTV model's break-even point.

MONETISED   → Revenue-first. RPM optimisation is primary. Subscriber
              acquisition assessed against LTV only.
```

---

## Design Principles

Zeus is the command and execution authority. Harvy is the financial intelligence
engine that improves Zeus's calls. The combined system is designed for:

- **Sustainable ROI** — not just cheap views, but capital efficiency over time
- **Controlled risk** — hard gates before any spend decision
- **Faster learning** — calibration loop improves confidence accuracy every week

The goal is not one perfect campaign decision, but a repeatable process that
consistently makes better calls and compounds channel growth over time.

---

## Core Responsibilities

```
1.  Decision Gate Stack      → run all 6 policy/risk checks in order before
                               any recommendation reaches Zeus
2.  Incrementality Analysis  → measure true lift, not just raw performance
3.  Traffic Quality Scoring  → score view quality beyond cheap impressions
4.  BCG Portfolio Matrix     → classify every campaign as SCALE/FIX/HARVEST/KILL
5.  Expected Value + Risk    → EV calculation with hard risk gate (never negative EV)
6.  Diminishing Returns      → detect spend efficiency decay before budget is wasted
7.  Lag-Aware Evaluation     → evaluate at 24h / 7d / 14d windows, not real-time noise
8.  ICE Prioritization       → rank which campaigns deserve Zeus's attention first
9.  Creative Fatigue         → detect frequency cap breaches + audience saturation
10. Cohort Quality           → analyse subscriber quality by acquisition cohort
11. Scenario Stress Tests    → model best / base / worst case outcomes before scaling
12. Attribution Split        → separate direct ad impact from organic spillover
13. Diversification Guard    → flag over-concentration in one campaign or niche
14. Regret + Learning Value  → score decisions by regret risk and information gain
15. Accuracy Calibration     → track every recommendation outcome, self-improve
```

---

## Decision Order — Every Recommendation Runs This Sequence

Harvy evaluates every campaign in this fixed order. A campaign that fails
any gate gets a PAUSE or KILL recommendation immediately — later steps are
skipped. This prevents expensive analysis on campaigns that are already
disqualified.

### Step 1 — Policy / Risk Gate

Pass all hard rules before anything else:
- Account balance ≥ $30 (else: `SKIP`)
- Quality gate score ≥ 8.0 for new campaign creation (else: `SKIP`)
- No active emergency stops triggered in `budget-guard.ts` (else: `HALT`)
- Daily spend not exceeding 50% of account balance (budget-guard rule)
- Campaign not already paused for policy violation in last 7 days (else: `HOLD_OFF`)

### Step 2 — Positive Incremental Value

Does this campaign generate real lift, or is it capturing traffic that would
have come organically anyway?
- Compare views during campaign window vs matched organic baseline (same
  day-of-week, prior 2 weeks, no campaign running)
- If incremental view rate < 15%: flag `INVESTIGATE` — may be cannibalising organic
- If incremental subscriber rate is negative: `PAUSE` immediately (active cannibalism)

### Step 3 — Traffic Quality Above Floor

Cheap views that bounce do not move the channel.
- `avgViewDurationPct` ≥ 30% (watched at least 30% of video)
- `endScreenCTR` ≥ 0.5%
- `subscriberConversionRate` ≥ 1.0% (at least 1 in 100 viewers subscribes)
- Traffic quality score < 40/100 → `PAUSE` or reduce budget 50%

### Step 4 — BCG Quadrant Classification

Classify every campaign into one of four quadrants:
```
SCALE   → high LTV-adjusted ROAS + high growth potential → spend more
FIX     → high growth potential + poor ROAS → creative or targeting problem
HARVEST → high ROAS + low growth potential → hold budget, do not over-invest
KILL    → low ROAS + low growth potential → terminate
```

### Step 5 — Diminishing Returns Detection

Is spend efficiency decaying as budget increases?
- Track ROAS curve over last 7 days
- ROAS dropped > 25% in last 3 days on same budget: flag `DR_DETECTED`
- `DR_DETECTED` + ROAS < 1.5×: reduce budget 30%, do not scale
- ROAS improving over 3 days: safe to scale further (pass to BCG for final call)

### Step 6 — Confidence Threshold for Scale vs Test Mode

Before recommending `SCALE`, Harvy requires minimum data:
- `impressions` ≥ 1,000
- `views` ≥ 200
- Days running ≥ 3

If below threshold: recommend `TEST` (run at current budget, do not scale yet).
Include `confidence` score (0–1) in every recommendation.

---

## Strategy Stack — Implementation Detail

### Strategy 1: KPI Tree (North Star + Child Metrics)

North star: **subscriber LTV per dollar spent** — not raw subscriber count,
not raw ROAS, but the compound value metric.

Child metrics feeding the north star:
- CPV (cost per view) — efficiency of reach
- view-to-subscriber rate — quality of traffic
- RPM by content niche — revenue density of acquired subscribers
- subscriber 30-day retention rate — durability of acquisition

```typescript
interface KPITree {
  northStar: number;                   // LTV per dollar: (subscribers × LTV) / totalSpend
  cpv: number;                         // total spend / total views
  viewToSubscriberRate: number;        // subscribers / views
  rpmByNiche: Record<string, number>;
  subscriber30DayRetention: number;    // % still active after 30 days (channel-health)
}
```

### Strategy 2: Incrementality / Lift Measurement

```typescript
interface IncrementalityResult {
  incrementalViews: number;         // campaign views - estimated organic views
  incrementalSubscribers: number;   // campaign subs - estimated organic subs
  incrementalViewRate: number;      // incrementalViews / totalImpressions
  cannibalisation: boolean;         // true if incrementalSubscribers < 0
  liftMultiplier: number;           // campaign performance / organic baseline
}

// incrementalViewRate < 0.15 → INVESTIGATE (may be cannibalising organic)
// incrementalSubscribers < 0 → PAUSE immediately
```

### Strategy 3: Traffic Quality Score (0–100)

```typescript
function calculateTrafficQualityScore(campaign: CampaignPerformance): number {
  const durationScore = Math.min((campaign.avgViewDurationPct / 0.30) * 30, 30);
  const ctaScore      = Math.min((campaign.endScreenCTR / 0.005) * 20, 20);
  const subConvScore  = Math.min((campaign.subConversionRate / 0.01) * 30, 30);
  const bounceScore   = Math.min(((1 - campaign.skipRate) / 0.70) * 20, 20);
  return Math.round(durationScore + ctaScore + subConvScore + bounceScore);
  // score < 40 → PAUSE or -50% budget
}
```

### Strategy 4: BCG Matrix Classification

```typescript
type BCGQuadrant = "SCALE" | "FIX" | "HARVEST" | "KILL";

function classifyBCG(
  ltvAdjustedROAS: number,
  growthPotential: number  // 0–1: views trend + subscriber trend + niche RPM trend
): BCGQuadrant {
  const highROAS   = ltvAdjustedROAS >= 1.5;
  const highGrowth = growthPotential >= 0.5;
  if (highROAS && highGrowth)  return "SCALE";
  if (!highROAS && highGrowth) return "FIX";
  if (highROAS && !highGrowth) return "HARVEST";
  return "KILL";
}
// SCALE   → recommend Zeus increase budget up to 2×
// FIX     → recommend creative or targeting change, hold budget
// HARVEST → recommend hold budget, do not scale
// KILL    → recommend Zeus pause campaign
```

### Strategy 5: Expected Value + Hard Risk Gate

```typescript
interface ExpectedValueResult {
  ev: number;              // expected value in USD
  bestCase: number;
  baseCase: number;
  worstCase: number;
  riskGatePassed: boolean; // false if worst case destroys > 40% of spend
}

function calculateEV(
  spend: number,
  bestCaseROAS: number,   // e.g. 3.0
  baseCaseROAS: number,   // e.g. 1.8
  worstCaseROAS: number,  // e.g. 0.6
  bestProb: number,       // e.g. 0.20
  baseProb: number,       // e.g. 0.60
  worstProb: number       // e.g. 0.20
): ExpectedValueResult {
  const best  = spend * bestCaseROAS  * bestProb;
  const base  = spend * baseCaseROAS  * baseProb;
  const worst = spend * worstCaseROAS * worstProb;
  return {
    ev: best + base + worst - spend,
    bestCase: best,
    baseCase: base,
    worstCase: worst,
    riskGatePassed: (spend - worst) / spend <= 0.40,
  };
}
```

### Strategy 6: Diminishing Returns Detection

```typescript
interface DiminishingReturnsResult {
  detected: boolean;
  roasTrend: number[];     // daily ROAS for last 7 days
  roasDecayRate: number;   // % ROAS drop over last 3 days
  budgetRecommendation: "HOLD" | "REDUCE_30PCT" | "PAUSE" | "INCREASE";
}

// roasDecayRate > 0.25 AND ROAS < 1.5× → REDUCE_30PCT
// roasDecayRate > 0.40 OR ROAS < 1.0×  → PAUSE
// roasTrend improving over 3 days      → INCREASE (pass to BCG for final call)
```

### Strategy 7: Lag-Aware Evaluation Windows

Never evaluate on single-day snapshots — ad attribution has inherent lag.

```typescript
interface LagAwarePerformance {
  window24h:    CampaignPerformance; // weight: 0.15 — high noise, directional only
  window7d:     CampaignPerformance; // weight: 0.50 — primary evaluation window
  window14d:    CampaignPerformance; // weight: 0.35 — trend confirmation
  weightedROAS: number;              // 0.15×ROAS_24h + 0.50×ROAS_7d + 0.35×ROAS_14d
  stabilityFlag: boolean;            // true if 24h ROAS deviates > 50% from 7d ROAS
}

// stabilityFlag = true → lower confidence score by 0.20
// Zeus sees: "Recent performance deviating from weekly trend — monitoring"
```

### Strategy 8: ICE Prioritization

Which campaigns get Zeus's attention first when multiple signals arrive?

```typescript
interface ICEScore {
  campaignId: string;
  impact: number;     // 1–10: revenue at stake if this call is wrong
  confidence: number; // 1–10: how confident Harvy is in the data
  ease: number;       // 1–10: how easy is the action (PAUSE = easy, creative rebuild = hard)
  iceScore: number;   // (impact × confidence × ease) / 3
}

// Harvy sorts all recommendations by iceScore descending.
// KILL recommendations always surface above HOLD/INVESTIGATE regardless of ICE.
```

### Strategy 9: Creative Fatigue + Audience Saturation

```typescript
interface CreativeFatigueResult {
  fatigued: boolean;
  avgFrequency: number;         // avg impressions per unique user
  frequencyThreshold: number;   // 3.0 for most niches
  skipRateTrend: "RISING" | "STABLE" | "FALLING";
  ctrTrend:      "RISING" | "STABLE" | "FALLING";
  saturationScore: number;      // 0–100: how saturated the target audience is
  recommendation: string;       // "Rotate creative" | "Expand audience" | "Pause 7 days"
}

// avgFrequency > 3.0 AND skipRateTrend RISING → creative fatigue confirmed
// saturationScore > 70 → audience saturation — expand targeting or pause
```

### Strategy 10: Cohort Quality Analysis

Not all subscribers are equal. A subscriber from a finance video is worth
more than one from a trending reaction clip.

```typescript
interface CohortQuality {
  cohortId: string;               // campaignId + week acquired
  avgWatchTimeMinutes: number;    // 30-day avg watch time per cohort subscriber
  returnViewRate: number;         // % who watched a 2nd video within 30 days
  commentRate: number;            // % who commented on any video within 30 days
  cohortLTVEstimate: number;      // revised LTV based on actual engagement, not model
  qualityTier: "A" | "B" | "C"; // A = high engagement, B = medium, C = low/disengaged
}

// Cohort C → Zeus should not spend to acquire more of these subscribers
// Cohort A → Zeus should increase spend — high-value acquisition confirmed
```

### Strategy 11: Scenario / Sensitivity Stress Tests

Before any SCALE recommendation, Harvy models three scenarios:

```typescript
interface ScenarioStressTest {
  currentBudget: number;
  proposedBudget: number;   // typically 2× current for SCALE
  scenarios: {
    optimistic:  { roasMultiplier: number; outcome: number }; // e.g. 1.3×
    base:        { roasMultiplier: number; outcome: number }; // e.g. 1.0× (flat)
    pessimistic: { roasMultiplier: number; outcome: number }; // e.g. 0.7× (DR kicks in)
  };
  maxDrawdown: number;        // worst-case loss from proposed scaling
  recommendScale: boolean;    // true only if pessimistic scenario still positive EV
}
```

### Strategy 12: Attribution Split

Direct ad impact vs organic spillover:

```typescript
interface AttributionSplit {
  directAdViews: number;       // views from ad impressions (Google Ads data)
  organicSpillover: number;    // organic views during campaign window - baseline
  spilloverRate: number;       // organicSpillover / directAdViews
  brandLiftEstimate: number;   // estimated channel search volume increase during campaign
  trueAdCPA: number;           // CPA from direct ad clicks only
  blendedCPA: number;          // CPA including spillover credit
}

// spilloverRate > 0.30 → Harvy notes brand lift in recommendation
// Zeus and Regum see: "This campaign builds brand awareness beyond direct response"
```

### Strategy 13: Diversification Guardrails

```typescript
interface DiversificationCheck {
  totalActiveSpend: number;
  largestCampaignShare: number;             // single campaign as % of total spend
  nicheConcentration: Record<string, number>; // spend % per niche
  diversificationScore: number;             // 0–100: 100 = perfectly spread
  flags: string[];                          // e.g. "Finance = 78% of spend"
}

// largestCampaignShare > 60% → OVER_CONCENTRATED
// any single niche > 70%     → NICHE_CONCENTRATION
// Harvy recommends spreading remaining budget across under-invested niches
```

### Strategy 14: Regret Analysis + Learning Value

Some decisions have asymmetric regret. Not scaling a SCALE campaign loses
money slowly. Failing to PAUSE a KILL campaign burns money fast.

```typescript
interface RegretAnalysis {
  regretIfAct: number;    // estimated cost if Harvy is wrong and Zeus acts
  regretIfSkip: number;   // estimated cost if Harvy is right and Zeus ignores
  regretRatio: number;    // regretIfSkip / regretIfAct — > 2.0 = act
  learningValue: number;  // 0–1: how much would Zeus learn by running this campaign
}

// High learning value + negative EV → recommend TEST budget instead of SKIP
// Example: "Spend $5 to learn whether this niche converts — worth the information cost"
```

### Strategy 15: Harvy Accuracy Calibration Loop

Zeus fills in `zeusActed` + `actualOutcome` 7 days after every recommendation.
Harvy reads its own past records every Sunday and recalibrates.

```typescript
interface CalibrationRecord {
  recommendationId: string;
  recommendation: HarvyFinalRec;
  predictedROAS: number;
  actualROAS: number;
  wasCorrect: boolean;
  errorMagnitude: number; // abs(predictedROAS - actualROAS) / predictedROAS
}

// accuracy < 60% over last 20 recommendations:
//   → lower all confidence scores by 0.15 until next calibration restores > 70%
//   → Zeus lesson written: "Harvy accuracy at X% — thresholds auto-adjusted"
```

---

## Subscriber LTV Model

This is the core financial insight Harvy provides that Zeus's threshold
system does not model. A subscriber acquired through an ad is not just a
view — it is a recurring revenue unit for the lifetime of the channel.

```typescript
function calculateSubscriberLTV(
  phase: ChannelPhase,
  niche: string,
  currentRPM: number
): number {

  const NICHE_RPM_BASELINE: Record<string, number> = {
    finance:        12.00,
    tech:            8.50,
    business:        9.00,
    health:          7.50,
    gaming:          4.00,
    entertainment:   3.50,
    education:       6.00,
    sports:          5.00,
    news:            4.50,
    default:         5.00,
  };

  const PHASE_RPM_MULTIPLIER: Record<ChannelPhase, number> = {
    COLD_START: 0.60,  // low advertiser trust, fewer targeted ads
    MOMENTUM:   0.80,
    PUSH:       0.90,
    MONETISED:  1.00,
  };

  const PHASE_LIFESPAN_MONTHS: Record<ChannelPhase, number> = {
    COLD_START: 12,
    MOMENTUM:   18,
    PUSH:       24,
    MONETISED:  30,
  };

  const nicheRPM = NICHE_RPM_BASELINE[niche] ?? NICHE_RPM_BASELINE.default;
  const effectiveRPM = Math.max(
    currentRPM,
    nicheRPM * PHASE_RPM_MULTIPLIER[phase]
  ) * getSeasonalMultiplier(new Date());

  const avgViewsPerSubPerVideo = (niche === "tech" || niche === "finance") ? 0.10 : 0.07;
  const avgVideosPerMonth = 12;
  const monthlyViewsPerSub = avgViewsPerSubPerVideo * avgVideosPerMonth;
  const monthlyRevenuePerSub = (monthlyViewsPerSub / 1000) * effectiveRPM;

  return Math.max(monthlyRevenuePerSub * PHASE_LIFESPAN_MONTHS[phase], 0.10);
}
```

### Seasonal Ad Rate Multipliers

```typescript
function getSeasonalMultiplier(date: Date): number {
  const SEASONAL: Record<number, number> = {
    1: 0.75,  // January  — post-holiday budget exhaustion
    2: 0.80,  // February
    3: 0.90,  // March
    4: 0.95,  // April
    5: 1.00,  // May
    6: 0.95,  // June
    7: 0.85,  // July    — summer trough
    8: 0.90,  // August  — back-to-school
    9: 1.00,  // September
    10: 1.20, // October  — Q4 ramp
    11: 1.45, // November — Black Friday peak
    12: 1.40, // December — holiday peak
  };
  const m = date.getMonth() + 1;
  const base = SEASONAL[m] ?? 1.0;
  // Post-Christmas pullback
  return (m === 12 && date.getDate() > 26) ? base * 0.70 : base;
}
```

---

## HarvyRecommendation — Output Contract

```typescript
type HarvyFinalRec = "SCALE" | "HOLD" | "PAUSE" | "SKIP" | "INVESTIGATE" | "TEST";

interface HarvyRecommendation {
  recommendationId: string;  // UUID — PK in harvy-roi-signals
  runId: string;             // groups all recs from one Harvy run
  triggeredBy: "POST_AD_REVIEW" | "POST_UPLOAD" | "WEEKLY_PORTFOLIO";
  createdAt: string;         // ISO timestamp
  expiresAt: string;         // TTL: +90 days

  videoId: string;
  campaignId: string | null;

  // ── 6-step decision gate results ───────────────────────────────────
  policyGatePassed: boolean;
  incrementalityResult: IncrementalityResult;
  trafficQualityScore: number;        // 0–100
  bcgQuadrant: BCGQuadrant;
  expectedValue: ExpectedValueResult;
  diminishingReturns: DiminishingReturnsResult;
  lagAwarePerformance: LagAwarePerformance;
  iceScore: ICEScore;

  // ── Extra strategies (weekly portfolio only) ────────────────────────
  creativeFatigue?: CreativeFatigueResult;
  cohortQuality?: CohortQuality;
  scenarioStressTest?: ScenarioStressTest;
  attributionSplit?: AttributionSplit;
  diversificationCheck?: DiversificationCheck;
  regretAnalysis?: RegretAnalysis;

  // ── Final recommendation ────────────────────────────────────────────
  recommendation: HarvyFinalRec;
  confidence: number;           // 0–1
  reasoning: string;            // one paragraph — Sonnet-written, Zeus reads before acting
  ltvPerSubscriber: number;
  ltvAdjustedCPA: number;
  breakEvenCPA: number;
  earlyWasteFlag: boolean;
  scaleSignal: boolean;
  seasonalAdjustment: number;

  // ── Downstream guidance (routed via Zeus → THE LINE morning briefing) ──
  regumGuidance: string;        // content strategy implication for Regum
  rexGuidance: string | null;   // topic/niche implication for Rex

  // ── Outcome tracking — Zeus fills these in 7 days after acting ──────
  zeusActed: boolean;
  zeusAction: string | null;
  actualOutcome: {
    roasActual: number | null;
    wasAccurate: boolean | null;
  } | null;
  accuracyScore: number | null; // filled retrospectively by calibration loop
}
```

---

## DynamoDB Tables

### Tables Harvy Reads From
| Table | PK | Purpose |
|---|---|---|
| `ad-insights` | date | Zeus's 30-day ad review history |
| `ad-campaigns` | campaignId | Live campaign records + status |
| `video-memory` | videoId | Per-video performance + content attributes |
| `channel-health` | date | Daily analytics: subscriber retention, watch time |
| `harvy-roi-signals` | recommendationId | Harvy's own prior recs (calibration) |
| `agent-policies` | agentId | Harvy reads its own thresholds at runtime (SK: policyKey) |

### Centralized Policy Table: `agent-policies`

All Harvy decision thresholds are stored here — not hardcoded. Harvy reads
them at the start of every run via `getAgentPolicies("harvy")`. Oracle injects
updated policies here. Analytics UI queries this table to display live policy state.

```
PK:  agentId   (String)  — e.g. "harvy", "zeus", "rex"
SK:  policyKey (String)  — e.g. "MIN_ACCOUNT_BALANCE", "TRAFFIC_QUALITY_FLOOR"
GSI: category-agentId   — query all RISK_GATE policies, all SCALING policies, etc.
TTL: none (policies are permanent until explicitly updated)
```

**Harvy seed policies (written at deploy time):**

```json
[
  { "agentId": "harvy", "policyKey": "MIN_ACCOUNT_BALANCE",         "value": "30",    "valueType": "number",  "category": "RISK_GATE",       "description": "Account balance floor before any campaign action",              "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "QUALITY_GATE_SCORE_MIN",      "value": "8.0",   "valueType": "number",  "category": "RISK_GATE",       "description": "Minimum quality gate score for new campaign creation",          "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "DAILY_SPEND_MAX_PCT",         "value": "0.50",  "valueType": "number",  "category": "RISK_GATE",       "description": "Max daily spend as fraction of account balance",                "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "POLICY_VIOLATION_COOLDOWN_DAYS","value": "7",   "valueType": "number",  "category": "RISK_GATE",       "description": "Days a campaign must wait after policy violation before re-eval","source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "INCREMENTAL_VIEW_RATE_MIN",   "value": "0.15",  "valueType": "number",  "category": "INCREMENTALITY",  "description": "Min incremental view rate before INVESTIGATE flag",             "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "AVG_VIEW_DURATION_PCT_MIN",   "value": "0.30",  "valueType": "number",  "category": "TRAFFIC_QUALITY", "description": "Min avg view duration percentage for quality floor",            "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "END_SCREEN_CTR_MIN",          "value": "0.005", "valueType": "number",  "category": "TRAFFIC_QUALITY", "description": "Min end-screen CTA click-through rate",                         "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "SUB_CONVERSION_RATE_MIN",     "value": "0.01",  "valueType": "number",  "category": "TRAFFIC_QUALITY", "description": "Min subscriber conversion rate (1 in 100 viewers)",             "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "TRAFFIC_QUALITY_SCORE_FLOOR", "value": "40",    "valueType": "number",  "category": "TRAFFIC_QUALITY", "description": "Traffic quality score below which campaign is paused",          "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "BCG_HIGH_ROAS_THRESHOLD",     "value": "1.5",   "valueType": "number",  "category": "BCG_MATRIX",      "description": "LTV-adjusted ROAS threshold separating high/low ROAS quadrants","source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "BCG_HIGH_GROWTH_THRESHOLD",   "value": "0.5",   "valueType": "number",  "category": "BCG_MATRIX",      "description": "Growth potential score threshold (0–1) separating quadrants",   "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "EV_RISK_GATE_MAX_LOSS_PCT",   "value": "0.40",  "valueType": "number",  "category": "EXPECTED_VALUE",  "description": "Max fraction of spend worst case can destroy before risk gate fails","source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "DR_ROAS_DECAY_FLAG_THRESHOLD","value": "0.25",  "valueType": "number",  "category": "DIM_RETURNS",     "description": "ROAS decay rate over 3 days that triggers DR_DETECTED flag",   "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "DR_ROAS_FLOOR",               "value": "1.5",   "valueType": "number",  "category": "DIM_RETURNS",     "description": "ROAS floor — DR + below this → reduce budget 30%",             "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "DR_BUDGET_REDUCTION_PCT",     "value": "0.30",  "valueType": "number",  "category": "DIM_RETURNS",     "description": "Budget reduction applied when DR_DETECTED and below floor",     "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "SCALE_MIN_IMPRESSIONS",       "value": "1000",  "valueType": "number",  "category": "SCALING",         "description": "Minimum impressions before SCALE recommendation is allowed",    "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "SCALE_MIN_VIEWS",             "value": "200",   "valueType": "number",  "category": "SCALING",         "description": "Minimum views before SCALE recommendation is allowed",          "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "SCALE_MIN_DAYS",              "value": "3",     "valueType": "number",  "category": "SCALING",         "description": "Minimum days running before SCALE recommendation is allowed",   "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "SCALE_BUDGET_MULTIPLIER_MAX", "value": "2.0",   "valueType": "number",  "category": "SCALING",         "description": "Max budget multiplier for a SCALE recommendation",              "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "CREATIVE_FATIGUE_FREQ_THRESHOLD","value": "3.0","valueType": "number",  "category": "CREATIVE_FATIGUE","description": "Avg frequency above which creative fatigue is confirmed",        "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "AUDIENCE_SATURATION_THRESHOLD","value": "70",   "valueType": "number",  "category": "CREATIVE_FATIGUE","description": "Saturation score (0–100) above which audience is saturated",    "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "DIVERSIFICATION_MAX_SINGLE_CAMPAIGN_PCT","value":"0.60","valueType":"number","category":"DIVERSIFICATION","description":"Single campaign spend share above which OVER_CONCENTRATED is flagged","source":"HARDCODED" },
  { "agentId": "harvy", "policyKey": "DIVERSIFICATION_MAX_NICHE_PCT","value": "0.70", "valueType": "number",  "category": "DIVERSIFICATION","description": "Single niche spend share above which NICHE_CONCENTRATION is flagged","source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "ATTRIBUTION_SPILLOVER_BRAND_LIFT_THRESHOLD","value":"0.30","valueType":"number","category":"ATTRIBUTION","description":"Organic spillover rate above which brand lift multiplier is noted","source":"HARDCODED" },
  { "agentId": "harvy", "policyKey": "CALIBRATION_ACCURACY_FLOOR",  "value": "0.60",  "valueType": "number",  "category": "CALIBRATION",     "description": "Accuracy floor — below this, confidence scores reduced by 0.15","source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "CALIBRATION_ACCURACY_TARGET", "value": "0.70",  "valueType": "number",  "category": "CALIBRATION",     "description": "Accuracy target to restore normal confidence scoring",          "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "CALIBRATION_CONFIDENCE_PENALTY","value": "0.15","valueType": "number",  "category": "CALIBRATION",     "description": "Confidence score penalty applied when accuracy below floor",    "source": "HARDCODED" },
  { "agentId": "harvy", "policyKey": "REGRET_RATIO_ACT_THRESHOLD",  "value": "2.0",   "valueType": "number",  "category": "REGRET",          "description": "Regret ratio (skip/act) above which Harvy recommends acting",   "source": "HARDCODED" }
]
```

`source` values:
- `HARDCODED` — written at deploy, reflects original Harvy spec
- `ORACLE` — Oracle injected or updated this policy based on research
- `USER` — user manually overrode via analytics UI

### New Table: `harvy-roi-signals`

```
PK:  recommendationId (String)
SK:  runId (String)
GSI 1: videoId-createdAt       → Zeus queries by video before campaign decisions
GSI 2: triggeredBy-createdAt   → Zeus queries SCALE signals before budget reviews
TTL: expiresAt (90 days — keeps table lean)
```

**Add `harvy-roi-signals` to DynamoDB tables list in CLAUDE.md.**

**Add HARVY as 13th entry to `agent-status` table:**
```json
{
  "agentId": "harvy",
  "humanName": "Harvey",
  "publicTitle": "ROI Analyst",
  "model": "Sonnet 4",
  "status": "active"
}
```

---

## Trigger / Run Schedule

Harvy runs inside Zeus's existing `zeusAnalyticsWorkflow` as `step.run()` calls.
No new Inngest workflow, no new EventBridge rule needed.

### Trigger 1 — POST_AD_REVIEW
Fires after `zeus-ad-review` step completes. Scores all active campaigns.
Provides SCALE/PAUSE/KILL signals before Zeus makes any campaign changes.
Duration: ~20–40s (Sonnet, ~5 campaigns avg).

### Trigger 2 — POST_UPLOAD
Fires after Qeon's `PRODUCTION_COMPLETE` message is processed.
Assesses the new video for campaign creation viability.
Zeus calls `shouldRunAdCampaignWithHarvy()` — not the original function.
Duration: ~10–20s (single video).

### Trigger 3 — WEEKLY_PORTFOLIO (Sundays only)
Full attribution analysis + creative fatigue + cohort quality + calibration.
Writes `regumGuidance` and `rexGuidance` to Zeus morning briefing payload.
Duration: ~60–90s.

### Step Insertion Order in `zeusAnalyticsWorkflow`
```
zeus-channel-analytics
zeus-ad-review
→ harvy-roi-analysis           ← INSERT: Trigger 1
zeus-process-uploads
→ harvy-new-video-assessment   ← INSERT: Trigger 2 (conditional: newUploads.length > 0)
[zeus-campaign-decisions]      ← Zeus reads Harvy signals here before acting
→ harvy-weekly-portfolio       ← INSERT: Trigger 3 (conditional: isSunday)
zeus-write-lessons
```

---

## Harvy → Zeus Communication

Harvy writes to `harvy-roi-signals`. Zeus reads before every ad action.

```typescript
// Before creating a campaign for a new video
const harvySignal = await getHarvySignalForVideo(videoId);
if (harvySignal?.recommendation === "SKIP") {
  return { run: false, reason: harvySignal.reasoning };
}

// Before weekly budget review
const scaleSignals = await getHarvyScaleSignals();

// For morning briefing — Zeus bundles into THE LINE payload
const harvyInsights = await getRecentHarvyInsights(7);
const morningBriefing = {
  ...existingFields,
  harvyROI: {
    topRegumInsight:       harvyInsights.find(h => h.regumGuidance)?.regumGuidance ?? null,
    topRexInsight:         harvyInsights.find(h => h.rexGuidance)?.rexGuidance ?? null,
    scaleOpportunities:    harvyInsights.filter(h => h.recommendation === "SCALE").length,
    earlyWasteFlags:       harvyInsights.filter(h => h.earlyWasteFlag).length,
  },
};
```

`regumGuidance` and `rexGuidance` are routed by Zeus via THE LINE morning
briefing — not as direct agent messages. Zeus fills in `zeusActed` +
`actualOutcome` 7 days after acting. Harvy calibration loop reads these
records every Sunday.

---

## lib/harvy/ — Files to Create

```
lib/harvy/
  types.ts             — all interfaces: HarvyRecommendation, KPITree,
                         IncrementalityResult, TrafficQuality, BCGQuadrant,
                         ExpectedValueResult, DiminishingReturnsResult,
                         LagAwarePerformance, ICEScore, CreativeFatigueResult,
                         CohortQuality, ScenarioStressTest, AttributionSplit,
                         DiversificationCheck, RegretAnalysis, CalibrationRecord,
                         AgentPolicy, HarvyPolicies
  policy-db.ts         — getAgentPolicies(agentId): HarvyPolicies
                         seedHarvyPolicies(): writes all 28 seed records to agent-policies
                         Harvy calls getAgentPolicies("harvy") at start of every run
                         All threshold comparisons use values from this object, never literals
  decision-gate.ts     — 6-step decision order: policyGate(), incrementality(),
                         trafficQuality(), bcgClassify(), expectedValue(),
                         confidenceCheck()
                         All gate thresholds read from HarvyPolicies, not hardcoded
  ltv-model.ts         — calculateSubscriberLTV(), getSeasonalMultiplier()
  strategies.ts        — all 15 strategy functions
  harvy-analysis.ts    — runHarvyAnalysis() — orchestrates gate + strategies,
                         calls Sonnet for reasoning, writes to DynamoDB
  harvy-signals-db.ts  — writeHarvySignals(), getHarvySignalForVideo(),
                         getHarvyScaleSignals(), getRecentHarvyInsights()
  calibration.ts       — calibrateHarvyConfidence(), writeCalibrationLesson()

Zeus integration:
  lib/ads/zeus-ad-review.ts  EDIT — add shouldRunAdCampaignWithHarvy()
```

### AgentPolicy Interface

```typescript
interface AgentPolicy {
  agentId: string;
  policyKey: string;
  value: string;           // always stored as string — cast on read
  valueType: "number" | "string" | "boolean" | "json";
  description: string;
  category: string;        // RISK_GATE | TRAFFIC_QUALITY | BCG_MATRIX | SCALING | etc.
  source: "HARDCODED" | "ORACLE" | "USER";
  updatedAt: string;       // ISO timestamp
  updatedBy: string;       // "system" | "oracle" | Clerk userId
}

// Harvy reads all its policies in one BatchGetItem call at run start:
interface HarvyPolicies {
  MIN_ACCOUNT_BALANCE: number;
  QUALITY_GATE_SCORE_MIN: number;
  DAILY_SPEND_MAX_PCT: number;
  POLICY_VIOLATION_COOLDOWN_DAYS: number;
  INCREMENTAL_VIEW_RATE_MIN: number;
  AVG_VIEW_DURATION_PCT_MIN: number;
  END_SCREEN_CTR_MIN: number;
  SUB_CONVERSION_RATE_MIN: number;
  TRAFFIC_QUALITY_SCORE_FLOOR: number;
  BCG_HIGH_ROAS_THRESHOLD: number;
  BCG_HIGH_GROWTH_THRESHOLD: number;
  EV_RISK_GATE_MAX_LOSS_PCT: number;
  DR_ROAS_DECAY_FLAG_THRESHOLD: number;
  DR_ROAS_FLOOR: number;
  DR_BUDGET_REDUCTION_PCT: number;
  SCALE_MIN_IMPRESSIONS: number;
  SCALE_MIN_VIEWS: number;
  SCALE_MIN_DAYS: number;
  SCALE_BUDGET_MULTIPLIER_MAX: number;
  CREATIVE_FATIGUE_FREQ_THRESHOLD: number;
  AUDIENCE_SATURATION_THRESHOLD: number;
  DIVERSIFICATION_MAX_SINGLE_CAMPAIGN_PCT: number;
  DIVERSIFICATION_MAX_NICHE_PCT: number;
  ATTRIBUTION_SPILLOVER_BRAND_LIFT_THRESHOLD: number;
  CALIBRATION_ACCURACY_FLOOR: number;
  CALIBRATION_ACCURACY_TARGET: number;
  CALIBRATION_CONFIDENCE_PENALTY: number;
  REGRET_RATIO_ACT_THRESHOLD: number;
}
```

---

## No New Environment Variables Required

Harvy reuses existing AWS credentials (Bedrock Sonnet, DynamoDB) and
all `lib/ads/` credentials already in scope for the Lambda/Vercel runtime.

---

## Implementation Checklist

```
[ ] Read skills/ads-manager/SKILL.md completely
[ ] Read skills/agents/mission-protocol/SKILL.md completely
[ ] Create lib/harvy/types.ts — all interfaces including AgentPolicy + HarvyPolicies
[ ] Create lib/harvy/policy-db.ts — getAgentPolicies(), seedHarvyPolicies()
[ ] Create lib/harvy/ltv-model.ts — calculateSubscriberLTV(), getSeasonalMultiplier()
[ ] Create lib/harvy/decision-gate.ts — 6-step decision order (reads from HarvyPolicies)
[ ] Create lib/harvy/strategies.ts — all 15 strategy functions
[ ] Create lib/harvy/harvy-analysis.ts — runHarvyAnalysis() orchestrator
[ ] Create lib/harvy/harvy-signals-db.ts — DynamoDB read/write helpers
[ ] Create lib/harvy/calibration.ts — calibrateHarvyConfidence()
[ ] Create agent-policies DynamoDB table
    PK: agentId | SK: policyKey
    GSI: category-agentId (for analytics UI + Oracle queries)
[ ] Run seedHarvyPolicies() — write all 28 Harvy seed records to agent-policies
[ ] Create harvy-roi-signals DynamoDB table
    PK: recommendationId | SK: runId
    GSI 1: videoId-createdAt | GSI 2: triggeredBy-createdAt | TTL: expiresAt
[ ] Add harvy-roi-signals to DynamoDB tables list in CLAUDE.md
[ ] Add HARVY to agent-status DynamoDB table seed
[ ] Edit lib/ads/zeus-ad-review.ts — add shouldRunAdCampaignWithHarvy()
[ ] Edit zeusAnalyticsWorkflow — insert 3× step.run() for Harvy triggers
[ ] Test: POST_UPLOAD SKIP signal prevents campaign creation
[ ] Test: POST_AD_REVIEW SCALE signal appears in Zeus logs before budget review
[ ] Test: WEEKLY_PORTFOLIO — attribution insights + regumGuidance in briefing
[ ] Test: Calibration loop — mock 10 past recs + outcomes → lesson written to Zeus KB
[ ] Test: Seasonal multiplier — November returns > 1.4, January returns 0.75
[ ] Test: LTV model — finance niche MONETISED → LTV > $0.30 per subscriber
[ ] Test: BCG KILL → final recommendation is PAUSE
[ ] Test: Policy gate fail (balance < $30) → recommendation is SKIP
[ ] Test: Incrementality cannibalisation (incrementalSubscribers < 0) → PAUSE
[ ] Test: Traffic quality < 40 → PAUSE or budget reduction
[ ] Test: DR detected (roasDecayRate > 0.25) → REDUCE_30PCT recommendation
[ ] Test: Confidence below threshold → TEST not SCALE
[ ] Verify: Harvy never imports from lib/ads/campaign-control.ts
[ ] Verify: Harvy never imports from lib/ads/budget-guard.ts
[ ] Verify: No threshold literals in decision-gate.ts — all values from HarvyPolicies object
[ ] Verify: Oracle can update a policy (source="ORACLE") and next Harvy run uses new value
[ ] Verify: Analytics UI can query getAgentPolicies("harvy") and render all 28 policies
```

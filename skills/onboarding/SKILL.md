---
name: onboarding
description: >
  Optimizar onboarding flow. Two distinct paths: NEW CHANNEL (user has no
  YouTube channel or a brand new one with no data) and EXISTING CHANNEL
  (user connects a live channel with history). New channel path runs a
  live niche intelligence report — current trends, CTR benchmarks, CPM
  ranges, saturation levels — and recommends niches based on real data.
  Existing channel path audits the connected channel's videos, keywords,
  and watch time distribution, identifies the channel's actual niche
  identity, then compares against the user's chosen niche and fires a
  conflict notification if there is a meaningful mismatch. Read this skill
  when building the onboarding flow, niche selection, channel audit,
  niche conflict detection, or the niche recommendation report.
---

# Onboarding — Niche Intelligence & Channel Audit

## Two Doors

```
User lands on onboarding
         │
         ▼
┌─────────────────────────────────┐
│  Do you have a YouTube channel? │
│                                 │
│  [I'm starting fresh]           │
│  [I have an existing channel]   │
└─────────────────────────────────┘
         │                    │
         ▼                    ▼
   NEW CHANNEL           EXISTING CHANNEL
   FLOW                  FLOW
   (Niche Scout)         (Channel Audit)
```

---

## FLOW 1 — New Channel: Niche Scout

User has no channel or a blank one. They need our team to tell them
where the opportunity is right now. Not opinions. Live data.

### What Niche Scout Does

```
Rex     → scans current trending topics across all niches
SNIPER  → overlays CPM data, market traction, geo opportunity
Oracle  → contributes historical performance patterns per niche
Sonnet  → synthesises into a ranked niche recommendation report
```

### Trigger

```
Button on onboarding screen:
"Find the best niche for me right now →"

Sub-label: "Our team scans current trends, CTR benchmarks,
            and CPM data to find where the opportunity is today."
```

### The Scout Run

```typescript
// lib/onboarding/niche-scout.ts

export const TRACKABLE_NICHES = [
  { id: "tech",          label: "Tech & AI",          icon: "💻" },
  { id: "finance",       label: "Finance & Investing", icon: "📈" },
  { id: "gaming",        label: "Gaming",              icon: "🎮" },
  { id: "beauty",        label: "Beauty & Lifestyle",  icon: "✨" },
  { id: "health",        label: "Health & Fitness",    icon: "💪" },
  { id: "food",          label: "Food & Cooking",      icon: "🍳" },
  { id: "sports",        label: "Sports",              icon: "⚽" },
  { id: "f1",            label: "F1 & Motorsport",     icon: "🏎️" },
  { id: "business",      label: "Business & Startups", icon: "🚀" },
  { id: "science",       label: "Science & Space",     icon: "🔬" },
  { id: "travel",        label: "Travel",              icon: "✈️" },
  { id: "entertainment", label: "Entertainment & Pop", icon: "🎬" },
] as const;

export interface NicheIntelligence {
  nicheId: string;
  label: string;

  // Opportunity signals
  avgCTR: number;                  // % — current avg CTR for top videos in niche
  cpmRange: { min: number; max: number }; // USD
  saturationLevel: "LOW" | "MEDIUM" | "HIGH";
  growthVelocity: "ACCELERATING" | "STABLE" | "DECLINING";

  // Evidence
  breakoutChannelsLast60Days: number;  // new channels that crossed 10k subs
  topTrendingTopics: string[];         // top 3 trending right now
  avgWatchTime: number;                // minutes — benchmark for niche
  searchVolumeGrowth: string;          // e.g. "+34% vs last quarter"

  // Verdict
  opportunityScore: number;            // 0–100
  whyNow: string;                      // one sentence — why this niche right now
  bestForNewChannel: boolean;          // ARIA's verdict on cold start viability
  multiNicheCompatibility: string[];   // which other niches pair well
}

export async function runNicheScout(): Promise<NicheScoutReport> {

  // Step 1 — Rex scans trending topics per niche in parallel
  const trendingByNiche = await Promise.all(
    TRACKABLE_NICHES.map(niche => scanNicheTrends(niche.id))
  );

  // Step 2 — SNIPER overlays CPM + market data per niche
  const marketData = await Promise.all(
    TRACKABLE_NICHES.map(niche => getSniperNicheData(niche.id))
  );

  // Step 3 — Oracle contributes historical performance context
  const oracleContext = await queryOracleKnowledge(
    "Which YouTube niches are showing the strongest growth velocity " +
    "and best CPM performance right now? Which are saturating?",
    "CONTENT_TREND_SIGNALS"
  );

  // Step 4 — Sonnet synthesises into ranked report
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: `You are the Optimizar team's niche intelligence analyst.
               A new creator is deciding where to start their YouTube channel.
               Your job: give them the most useful, data-backed niche
               recommendation possible. Be specific. Use the actual numbers.
               Don't be generic. Tell them what is working RIGHT NOW.
               Oracle context: ${oracleContext}`,
      messages: [{
        role: "user",
        content: `Analyse this niche data and return a ranked niche report.

Trending by niche: ${JSON.stringify(trendingByNiche)}
Market data: ${JSON.stringify(marketData)}

Return JSON:
{
  "rankedNiches": NicheIntelligence[],  // sorted by opportunityScore desc
  "topPick": string,                     // single best niche right now
  "topPairings": [                       // best 2-niche and 3-niche combos
    { "niches": string[], "reason": string, "combinedScore": number }
  ],
  "marketSummary": string,              // 2-sentence overall landscape summary
  "generatedAt": string                 // ISO timestamp
}`
      }]
    })
  });

  const data = await response.json();
  const report = JSON.parse(
    data.content[0].text.replace(/```json|```/g, "").trim()
  );

  // Cache report — valid for 6 hours (Rex refresh cycle)
  await cacheNicheScoutReport(report);
  return report;
}
```

### Niche Scout UI

```
┌──────────────────────────────────────────────────────────────────┐
│  NICHE INTELLIGENCE REPORT              Live · Updated 2 hrs ago │
│  Based on current trends, CTR data, and CPM benchmarks           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🏆 TOP OPPORTUNITY RIGHT NOW                                     │
│                                                                   │
│  Tech & AI                                          Score: 91/100 │
│  ████████████████████████████████████████████████████████░░      │
│                                                                   │
│  Avg CTR: 7.2%   CPM: $18–34   Saturation: LOW   Growth: ↑↑     │
│  "AI tool comparisons and LLM breakdowns are getting 40%+        │
│   higher CTR than any other tech sub-niche right now."           │
│  Top trending: GPT-5 release · DeepSeek R2 · Claude 4 vs Gemini  │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  ALL NICHES                                                       │
│                                                                   │
│  💻 Tech & AI          91  ████████████████████  7.2% CTR  $18–34│
│  📈 Finance            87  ███████████████████   6.8% CTR  $22–41│
│  ✨ Beauty             79  █████████████████     5.1% CTR  $12–19│
│  🚀 Business           76  ████████████████      6.1% CTR  $19–28│
│  🔬 Science            71  ███████████████       5.8% CTR  $14–22│
│  🏎️  F1 & Motorsport   68  ██████████████        6.4% CTR  $16–24│
│  💪 Health             65  █████████████         4.9% CTR  $11–18│
│  🎮 Gaming             61  ████████████          4.2% CTR  $ 8–14│
│  ⚽ Sports             58  ███████████           5.5% CTR  $10–16│
│  🍳 Food               54  ██████████            4.1% CTR  $ 9–13│
│  ✈️  Travel             49  █████████             3.8% CTR  $ 8–12│
│  🎬 Entertainment      44  ████████              4.4% CTR  $ 7–11│
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  BEST COMBINATIONS                                                │
│                                                                   │
│  ✦ Tech + Finance     Score: 94   "Shared audience of 25–40yr    │
│                                    professionals. AI investing    │
│                                    is a breakout sub-niche."      │
│                                                                   │
│  Tech + Business      Score: 89   "Startup & SaaS founders       │
│                                    watch both. High CPM overlap." │
│                                                                   │
│  Finance + Business   Score: 85   "Strong evergreen potential.    │
│                                    Lower viral ceiling."           │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  [Select Tech & AI →]   [Select Tech + Finance →]   [Custom]    │
└──────────────────────────────────────────────────────────────────┘
```

Design notes:
- Score bars animate in left to right on page load, staggered 80ms per row
- Top opportunity card pulses amber border on load — draws eye immediately
- Combinations section shows pairing logic in plain English — not just numbers
- "Live · Updated X hrs ago" timestamp — builds trust in data freshness
- Refresh button triggers a new Rex scan (rate limited to once per hour)

---

## FLOW 2 — Existing Channel: Channel Audit

User connects their YouTube channel. We read their data.
Our team figures out what their channel actually is — then compares
against what they want it to be.

### What Channel Audit Does

```
YouTube Analytics API  → pulls videos, keywords, watch time, CTR per video
ARIA                   → identifies content distribution across themes
Oracle                 → cross-references against niche pattern library
Sonnet 4               → generates channel identity report
Opus 4 (if conflict)   → writes the conflict notification
```

### The Audit Run

```typescript
// lib/onboarding/channel-audit.ts

export interface ChannelIdentityReport {

  // What the data says
  dominantNiche: string;              // e.g. "Cooking & Food"
  dominantNicheConfidence: number;    // 0–100 — how clear the signal is
  secondaryNiche: string | null;      // if channel straddles two niches
  contentDistribution: {
    niche: string;
    videoCount: number;
    watchTimePercent: number;
    avgCTR: number;
  }[];

  // Channel health snapshot
  totalVideos: number;
  totalWatchHours: number;
  avgCTR: number;
  avgRetention: number;
  subscriberGrowthTrend: "GROWING" | "FLAT" | "DECLINING";
  bestPerformingNiche: string;        // which niche drives most subs
  bestPerformingFormat: string;       // e.g. "tutorials over 10 mins"

  // Top keywords from existing content
  topKeywords: { keyword: string; searchVolume: string; avgCTR: number }[];

  // Identity verdict
  identityClarity: "CLEAR" | "MIXED" | "SCATTERED";
  identitySummary: string;            // 2 sentences — plain English
  strengthsToKeep: string[];
  weaknessesToAddress: string[];
}

export async function runChannelAudit(
  userId: string
): Promise<ChannelIdentityReport> {

  // Pull all channel data from YouTube Analytics API
  const [videos, analytics, keywords] = await Promise.all([
    getChannelVideos(userId, { limit: 100 }),
    getChannelAnalytics(userId, { days: 365 }),
    getChannelKeywords(userId),
  ]);

  // ARIA analyses content distribution
  const distribution = await ariaContentDistribution(videos, analytics);

  // Oracle cross-references niche patterns
  const oracleContext = await queryOracleKnowledge(
    `What defines a ${distribution.topNiche} channel? What are the
     clearest signals that a channel belongs to this niche?`,
    "CONTENT_TREND_SIGNALS"
  );

  // Sonnet synthesises into identity report
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are the Optimizar team analysing a YouTube channel's
               identity based on real data. Be precise and direct.
               You are helping the creator understand what their channel
               actually is — so they can make informed decisions.
               Oracle context: ${oracleContext}`,
      messages: [{
        role: "user",
        content: `Analyse this channel data and return a ChannelIdentityReport.

Videos: ${JSON.stringify(videos.slice(0, 50))}
Analytics: ${JSON.stringify(analytics)}
Keywords: ${JSON.stringify(keywords)}
ARIA distribution: ${JSON.stringify(distribution)}

Be specific about the dominant niche. Use real numbers.
Return JSON only.`
      }]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
}
```

### Channel Audit UI

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR CHANNEL REPORT                         247 videos analysed │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CHANNEL IDENTITY                                                 │
│  ─────────────────                                                │
│  Your channel is a: Cooking & Food channel                        │
│  Identity clarity:  CLEAR  (87% confidence)                      │
│                                                                   │
│  "73% of your watch time comes from recipe and cooking tutorial   │
│   content. Your top 5 performing videos are all food-related.     │
│   Your audience has a clear expectation."                         │
│                                                                   │
│  CONTENT DISTRIBUTION                                             │
│  Cooking & Food     ███████████████████████  73%   4.8% CTR      │
│  Lifestyle          ████████                 18%   3.1% CTR      │
│  Vlogs              ███                       9%   2.4% CTR      │
│                                                                   │
│  TOP KEYWORDS                                                     │
│  "easy dinner recipes"  · 4.2% CTR · High volume                 │
│  "meal prep ideas"      · 5.1% CTR · High volume                 │
│  "30 minute meals"      · 6.3% CTR · Medium volume               │
│                                                                   │
│  STRENGTHS                                                        │
│  ✓ Strong recipe tutorial retention (avg 52%)                     │
│  ✓ Meal prep content drives subscriber conversion                 │
│                                                                   │
│  AREAS TO ADDRESS                                                 │
│  ✗ Lifestyle content underperforms — consider cutting             │
│  ✗ No consistent upload schedule visible in data                  │
│                                                                   │
│  [This looks right — continue →]   [My channel is changing]      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Niche Conflict Detection — The "Bro" Moment

When the user's selected niche conflicts meaningfully with their
channel's audited identity, Jason fires the conflict notification.
Not a blocker. A checkpoint.

### Conflict Scoring

```typescript
// lib/onboarding/conflict-detector.ts

export interface NicheConflict {
  detected: boolean;
  severity: "MILD" | "MODERATE" | "STRONG";
  channelNiche: string;
  selectedNiche: string;
  overlapScore: number;    // 0–100 — how related the niches are
  watchTimeAtRisk: number; // % of current watch time that won't transfer
  message: string;         // the notification text
  options: ConflictOption[];
}

export type ConflictOption =
  | "PROCEED_ANYWAY"       // user knows, wants to pivot
  | "RUN_BOTH"             // keep cooking, add gaming — dual niche
  | "GRADUAL_TRANSITION"   // blend content for 30 days then pivot
  | "CHANGE_SELECTION"     // go back and pick a different niche

// Niche overlap matrix — how related are two niches?
// 0 = completely unrelated, 100 = effectively the same
export const NICHE_OVERLAP: Record<string, Record<string, number>> = {
  food:          { food: 100, lifestyle: 65, health: 55, travel: 40, beauty: 30,
                   finance: 5,  tech: 5,  gaming: 5,  sports: 10 },
  tech:          { tech: 100, finance: 60, business: 65, science: 55, gaming: 45,
                   food: 5,  beauty: 5,  lifestyle: 15, sports: 10 },
  gaming:        { gaming: 100, tech: 45, entertainment: 55, sports: 30,
                   food: 5,  beauty: 5,  finance: 10 },
  finance:       { finance: 100, business: 75, tech: 60, science: 25,
                   food: 5,  gaming: 10, beauty: 5 },
  beauty:        { beauty: 100, lifestyle: 80, health: 60, food: 35,
                   travel: 45, tech: 5, gaming: 5, finance: 5 },
  sports:        { sports: 100, f1: 60, gaming: 30, health: 40, entertainment: 35,
                   food: 10, tech: 10 },
  // ... extend for all niches
};

export function detectConflict(
  audit: ChannelIdentityReport,
  selectedNiches: string[]
): NicheConflict {

  const channelNiche = audit.dominantNiche.toLowerCase();
  const primarySelected = selectedNiches[0].toLowerCase();

  // Find overlap score — use highest overlap if multi-niche selected
  const overlapScore = Math.max(
    ...selectedNiches.map(n =>
      NICHE_OVERLAP[channelNiche]?.[n.toLowerCase()] ?? 20
    )
  );

  const watchTimeAtRisk = audit.contentDistribution
    .filter(d => !selectedNiches.some(n =>
      d.niche.toLowerCase().includes(n.toLowerCase())
    ))
    .reduce((sum, d) => sum + d.watchTimePercent, 0);

  // No conflict if niches are closely related
  if (overlapScore >= 60) {
    return { detected: false, severity: "MILD", overlapScore,
             channelNiche, selectedNiche: primarySelected,
             watchTimeAtRisk, message: "", options: [] };
  }

  const severity = overlapScore < 20 ? "STRONG"
                 : overlapScore < 40 ? "MODERATE"
                 : "MILD";

  const message = buildConflictMessage(
    audit, selectedNiches, severity, overlapScore, watchTimeAtRisk
  );

  return {
    detected: true,
    severity,
    channelNiche,
    selectedNiche: primarySelected,
    overlapScore,
    watchTimeAtRisk,
    message,
    options: buildOptions(severity, channelNiche, selectedNiches),
  };
}

// Opus 4 writes the notification — tone matters here
async function buildConflictMessage(
  audit: ChannelIdentityReport,
  selectedNiches: string[],
  severity: string,
  overlapScore: number,
  watchTimeAtRisk: number,
): Promise<string> {

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 300,
      system: `You are Jason — the project manager at Optimizar.
               A user is about to make a significant niche change on their
               YouTube channel. Your job is to flag it clearly, honestly,
               and with personality. Not preachy. Not corporate.
               Direct, warm, and a little bit like a smart friend
               who knows YouTube. Max 3 sentences.
               Severity: ${severity}. Keep the tone proportional —
               MILD is a gentle heads-up, STRONG is a clear flag.`,
      messages: [{
        role: "user",
        content: `Channel identity: ${audit.dominantNiche}
                  (${audit.totalVideos} videos, ${audit.totalWatchHours} watch hours)
                  User is selecting: ${selectedNiches.join(" + ")}
                  Overlap score: ${overlapScore}/100
                  Watch time at risk: ${watchTimeAtRisk}%

                  Write the conflict notification. Be specific with the numbers.
                  Don't use "bro" literally — but match that energy.`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text.trim();
}
```

### Conflict Notification UI

```
STRONG conflict example (Food → Gaming):

┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  HEADS UP FROM JASON                                         │
│                                                                   │
│  "You've built 2,300 watch hours in cooking content — that's     │
│   real equity. Gaming has about a 5% audience overlap with       │
│   food creators, so you'd essentially be starting over.          │
│   Are you pivoting or want to run both?"                         │
│                                                                   │
│  [I know — go gaming]   [Run both niches]   [Gradual transition] │
│  [Actually, let me reconsider]                                    │
└──────────────────────────────────────────────────────────────────┘

MODERATE conflict example (Food → Health):

┌──────────────────────────────────────────────────────────────────┐
│  💡  QUICK NOTE FROM JASON                                        │
│                                                                   │
│  "Your cooking audience and health audiences do overlap —        │
│   about 55%. Healthy recipes could be your bridge. Just worth    │
│   knowing 45% of your current watch time may not follow."        │
│                                                                   │
│  [Got it — continue]   [Show me the bridge strategy]             │
└──────────────────────────────────────────────────────────────────┘

MILD (no conflict) — no notification. Just proceed silently.
```

Design notes for both notifications:
- STRONG: amber border, warning icon, 4 options
- MODERATE: subtle blue border, info icon, 2 options
- MILD: no notification — smooth proceed, no friction
- All options are non-blocking — user always has the final word
- "Show me the bridge strategy" → Jason generates a 30-day
  transition plan showing how to blend content across niches

---

## Confidence Score Evaluation

Before a user commits to their niche+mode combination, the system calls Bedrock Haiku to evaluate and return a confidence score (0–100). NOT hardcoded — genuinely evaluated per combination every time.

User can select multiple niches (e.g. AI + Finance + Racing) and set mode per niche independently:
- Face — SkyReels avatar presenter
- Faceless — TONY + Wan2.2 + ElevenLabs only
- Let RRQ Decide — Regum picks per video based on content type

### Types

```typescript
interface ConfidenceEvalRequest {
  channelId: string;
  niches: {
    niche: string;           // e.g. "AI_NEWS", "FINANCE", "RACING"
    mode: 'FACE' | 'FACELESS' | 'LET_RRQ_DECIDE';
  }[];
  channelType: 'EDUCATIONAL' | 'ENTERTAINMENT' | 'NEWS' | 'MIXED';
}

interface ConfidenceEvalResult {
  overall: number;           // 0-100
  label: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'LOW' | 'NOT_RECOMMENDED';
  perNiche: {
    niche: string;
    mode: string;
    score: number;
    reasoning: string;
    risks: string[];
  }[];
  crossNicheCoherence: number;  // do these niches make sense together?
  suggestions: string[];         // e.g. "Switch Racing to Faceless for +7 points"
  risks: string[];               // channel-level risks
}

// Score labels:
// 90-100: EXCELLENT
// 75-89:  GOOD
// 60-74:  MODERATE
// 40-59:  LOW
// 0-39:   NOT_RECOMMENDED
```

### Seven Evaluation Dimensions

Haiku evaluates these dimensions on every call. NOT hardcoded — passed as evaluation criteria in the system prompt so Haiku reasons about them freshly for each niche+mode combination:

1. Content producibility — can TONY + Wan2.2 handle this niche visually without a face?
2. Niche-mode fit — does faceless/face work for this content type?
3. Market saturation — how crowded is this niche right now?
4. Cross-niche coherence — do these niches make sense on one channel?
5. AI detection risk — how likely is YouTube to flag this combo?
6. Revenue potential — CPM estimates per niche (finance > racing > AI news typical)
7. Audience overlap — do these audiences overlap or fragment?

### Implementation

```typescript
// lib/onboarding/confidence-eval.ts

export async function evaluateChannelConfidence(
  req: ConfidenceEvalRequest
): Promise<ConfidenceEvalResult> {

  // Check DynamoDB cache first (24h TTL)
  const cached = await getConfidenceCache(req.channelId);
  if (cached && !cacheExpired(cached)) return cached;

  const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

  const systemPrompt = `You are the Optimizar confidence analysis system.
A creator is selecting niches and production modes for their YouTube channel.
Evaluate this combination on seven dimensions:
1. Content producibility — can TONY + Wan2.2 produce this niche visually without a face?
2. Niche-mode fit — does the chosen face/faceless mode suit this content type?
3. Market saturation — how competitive is this niche at this moment?
4. Cross-niche coherence — do these niches make sense together on one channel?
5. AI detection risk — how likely is YouTube to flag this content combination?
6. Revenue potential — realistic CPM range for this niche mix?
7. Audience overlap — do these audiences reinforce or fragment each other?

Be specific and honest. Score each niche independently, then produce an overall score.
Return JSON only — no prose outside the JSON block.`;

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_HAIKU_MODEL ?? "anthropic.claude-haiku-4-5-20251001",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Channel type: ${req.channelType}
Niche+mode selections: ${JSON.stringify(req.niches, null, 2)}

Evaluate this combination and return a ConfidenceEvalResult JSON object.
Overall score 0–100. Per-niche score 0–100 each.
Include concrete suggestions if score < 90 (e.g. "Switch Racing to Faceless for +7 points").
Include honest risks at the channel level.`
      }]
    }),
    contentType: "application/json",
    accept: "application/json",
  });

  const response = await bedrockClient.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const result: ConfidenceEvalResult = JSON.parse(
    body.content[0].text.replace(/```json|```/g, "").trim()
  );

  // Cache result with 24h TTL
  await setConfidenceCache(req.channelId, result);
  return result;
}
```

### Caching

DynamoDB table: `channel-confidence`
- PK: channelId
- TTL: 24 hours
- Re-evaluate anytime user changes niche or mode selection
- Never block re-evaluation — it is a Haiku call (~1–2 seconds)

### Escalation

If Haiku call fails twice → show cached result with "Last evaluated X hours ago" label.
If no cache → show manual checklist prompt, do not block onboarding.
Reference: ESCALATION_POLICIES.CONFIDENCE_SCORE in skills/escalation/SKILL.md

### Integration Point

Called from: onboarding UI after niche+mode selection, before [ACCEPT] button activates.
Also callable from: channel settings page anytime user wants to re-evaluate.

---

## Post-Onboarding — Niche Written to Channel Settings

Whichever flow completes, the final niche selection is written to
`channel-settings` DynamoDB table and broadcast to all agents.

```typescript
// lib/onboarding/complete.ts

export async function completeOnboarding(
  userId: string,
  selectedNiches: string[],
  channelMode: "OPEN" | "NICHE_LOCKED" | "MULTI_NICHE",
  conflictResolution?: ConflictOption,
): Promise<void> {

  // Write to channel settings
  await updateChannelSettings(userId, {
    niches: selectedNiches,
    channelMode,
    conflictResolution: conflictResolution ?? null,
    onboardingCompletedAt: new Date().toISOString(),
  });

  // Broadcast to all agents via agent-messages
  await writeToAgentMessages({
    type: "CHANNEL_MODE_SET",
    from: "ONBOARDING",
    to: "THE_LINE",
    payload: {
      niches: selectedNiches,
      channelMode,
      missionSuccessOdds: channelMode === "MULTI_NICHE" ? 95 : 93,
    }
  });

  // Jason creates the first sprint immediately
  await writeToAgentMessages({
    type: "FIRST_SPRINT_TRIGGER",
    from: "ONBOARDING",
    to: "THE_LINE",
    payload: { userId, niches: selectedNiches, phase: "COLD_START" },
  });

  // If existing channel — inject audit findings into Zeus memory
  if (conflictResolution) {
    await writeToAgentMessages({
      type: "MEMORY_INJECTION",
      from: "ONBOARDING",
      to: "ZEUS",
      payload: {
        source: "CHANNEL_AUDIT",
        instruction: `Channel has history in ${selectedNiches.join(" + ")}.
                      User resolved conflict as: ${conflictResolution}.
                      Factor this into all early content decisions.`,
      }
    });
  }
}
```

---

## Onboarding Flow Summary

```
NEW CHANNEL                         EXISTING CHANNEL
───────────                         ────────────────
1. Click "Find my niche"            1. Connect YouTube channel
2. Rex + SNIPER + Oracle scan       2. Audit runs (30 seconds)
3. Niche Scout report loads         3. Channel Identity report loads
4. User sees ranked niches + pairs  4. User sees what their channel is
5. User selects 1, 2, or 3 niches   5. User selects desired niches
6. Probability bar shows 91–95%     6. Conflict detector runs
7. Confirm → onboarding complete    7a. No conflict → proceed
                                    7b. Conflict → Jason notification
                                    7c. User chooses resolution
                                    8. Onboarding complete

Both flows end at the same place:
Channel settings written, agents briefed, first sprint created,
Mission Control dashboard opens, Jason's Day 1 sprint plan ready.
```

---

## New DynamoDB Tables

```
channel-audit         PK: userId
                      fields: dominantNiche, confidence, distribution[],
                              topKeywords[], identityClarity, identitySummary,
                              auditRunAt, videosAnalysed

channel-confidence    PK: channelId
                      fields: overall, label, perNiche[], crossNicheCoherence,
                              suggestions[], risks[], evaluatedAt
                      TTL:  24 hours — re-evaluates automatically on change
```

---

## Environment Variables

```bash
# All YouTube API vars already set from platform-uploader skill
# Oracle already configured
# No new vars needed — reuses existing infrastructure
```

---

## Confidence Scoring — Dynamic Niche + Mode Evaluation

After user selects niches and mode per niche, before they proceed:

**Trigger:** user clicks `[EVALUATE]` button

**What fires:**
- Bedrock Haiku call (fast, ~2–3 seconds)
- Input: niche combination, mode per niche, channel type
- Haiku evaluates 7 dimensions dynamically (NOT hardcoded scores):

```
1. Content producibility     Can TONY + Wan2.2 handle this niche visually?
2. Niche-mode fit            Does faceless/face work for this content type?
3. Market saturation         How crowded is this niche right now?
4. Cross-niche coherence     Do these niches make sense on one channel?
5. AI detection risk         How likely is YouTube to flag this combo?
6. Revenue potential         CPM estimates per niche
7. Audience overlap          Do these audiences overlap or fragment?
```

**Output:**
- Overall score (0–100)
- Per-niche breakdown with score + label
- Risk warnings (specific, not generic)
- Suggestions (e.g. "switch Racing to faceless → score goes from 67 to 89")

**Caching:**
- Result stored in `channel-confidence` DynamoDB table (24h TTL)
- If user returns within 24h with same niche/mode combo → show cached result
- Re-evaluate available any time via button

**User can:**
- Change any niche or mode and re-evaluate instantly
- No limit on evaluations
- Proceed with any score (not gated — informational only)

---

## Rex Warm-Up Sprint — First Run Intelligence

**Trigger:** user completes onboarding and enters Rex Mode for the first time

**What fires:**
- Rex full signal scan (all 6 sources in parallel)
- Takes 5–15 minutes — do not skip or fake this
- Real market data, not placeholder scores

**UI during scan:**
- Rex warm-up sprint screen (see frontend-design-spec `## Rex Warm-Up Sprint UI`)
- Live signal feed updating as each source completes
- Confidence score building in real time

**Why it takes time (explain to user in UI):**
- Rex is querying 6 live signal sources
- Building a real trend map for the niche
- First scan is the most thorough — subsequent scans are incremental

**On completion:**
- Rex Topic Queue populated with ranked opportunities
- User sees ranked list with confidence scores and Rex reasoning
- User picks topic and clicks GO

---

## Channel Tone Capture

Tone is captured as a **single optional step after niche selection**, before the confidence
evaluation fires. It is never a gate — a user who skips it or selects "Not sure yet" proceeds
normally with tone defaulting to `"hybrid"`.

### Tone Step UI

```
How do you want your channel to feel?

○ Analytical     — Data-driven, credible, structured
○ Explanatory    — Educational, clear, accessible
○ Critical       — Opinion-led, contrarian, bold
○ Entertainment  — Engaging, story-driven, emotional
○ Hybrid         — Mix of the above (recommended for new channels)
○ Not sure yet   — We'll start neutral and learn over time

[SKIP →]  [CONTINUE →]
```

"Not sure yet" maps to `"hybrid"`. Both SKIP and "Not sure yet" are equivalent — neither
blocks the user, neither requires a rationale.

### DynamoDB Schema

Stored in `user-settings` under `channelTone`:

```typescript
interface ChannelTone {
  primary: "analytical" | "explanatory" | "critical" | "entertainment" | "hybrid";
  secondary?: "analytical" | "explanatory" | "critical" | "entertainment";
  confidence: number;           // 0–1: how certain the user was at time of selection
  definedAt: "onboarding" | "evolved" | "user-set";
  lastUpdatedAt: string;        // ISO timestamp
}
```

- `definedAt: "onboarding"` — user selected at this step
- `definedAt: "evolved"` — Oracle suggested a refinement and user accepted
- `definedAt: "user-set"` — user manually changed in Settings after onboarding

**Default if skipped:** `{ primary: "hybrid", confidence: 0.3, definedAt: "onboarding" }`

### Downstream Injection

Once captured, `channelTone` is passed as a context field in:
- Muse's MuseBlueprint generation call
- Script writer system prompt addendum (DynamoDB hybrid prompt)
- SEO title generation (tone shapes title framing)
- Rex topic confidence scoring (topic-tone fit dimension)

No agent uses tone as a hard gate. It is a directional signal, not a filter.

### Tone Evolution (Oracle + Zeus)

After 5+ videos are published, Oracle Domain 10 surfaces a tone refinement suggestion:

```
Based on your last 8 videos:
• Analytical scripts averaged 68% retention
• Explanatory scripts averaged 74% retention

Suggested tone update: Add "explanatory" as secondary tone.
[ACCEPT]  [DISMISS]
```

User accepts → `channelTone.secondary` updated, `definedAt` → `"evolved"`.
User dismisses → Oracle does not re-suggest for 30 days.
Zeus logs the outcome as an episode to S3 (`rrq-memory/episodes/oracle/`).

---

## Checklist

```
[ ] Create lib/onboarding/ folder
[ ] Create lib/onboarding/niche-scout.ts       — Rex + SNIPER + Oracle scan
[ ] Create lib/onboarding/channel-audit.ts     — YouTube data pull + ARIA analysis
[ ] Create lib/onboarding/conflict-detector.ts — overlap matrix + Opus notification
[ ] Create lib/onboarding/confidence-eval.ts   — Bedrock Haiku 7-dimension scorer
[ ] Create lib/onboarding/complete.ts          — write settings, brief agents, start sprint
[ ] Create DynamoDB table: channel-audit
[ ] Create DynamoDB table: channel-confidence  — 24h TTL, PK: channelId
[ ] Create app/onboarding/ Next.js route
[ ] Create components/onboarding/
      TwoDoors.tsx              — new vs existing channel choice
      NicheScoutReport.tsx      — ranked niche cards with bars
      NichePairings.tsx         — best combination cards
      ChannelAuditReport.tsx    — identity report + distribution
      NicheSelector.tsx         — multi-select with mode toggle + probability bar
      NicheModeToggle.tsx       — per-niche Face/Faceless/Let RRQ radio group
      ConflictNotification.tsx  — Jason's warning with resolution options
      ConfidenceScoreCard.tsx   — overall + per-niche score bars with RE-EVALUATE
      ToneSelector.tsx          — 5-option tone radio group + skip button
      OnboardingComplete.tsx    — transition to Mission Control
[ ] Wire "Find my niche" button → runNicheScout()
[ ] Wire YouTube connect → runChannelAudit()
[ ] Wire niche selection → detectConflict()
[ ] Wire niche+mode selection → evaluateChannelConfidence() — fires before ACCEPT
[ ] Wire RE-EVALUATE button → evaluateChannelConfidence() with loading spinner
[ ] Wire ACCEPT button — only enabled when confidence overall >= 40
[ ] Wire tone selection → user-settings DynamoDB channelTone field (or default hybrid on skip)
[ ] Wire completion → completeOnboarding() + Jason first sprint
[ ] Cache niche scout report — 6 hour TTL
[ ] Cache confidence eval — 24 hour TTL in channel-confidence DynamoDB
[ ] Rate limit niche scout refresh — max once per hour per user
[ ] Test confidence eval: EXCELLENT combination (Finance Faceless + AI Faceless)
[ ] Test confidence eval: LOW combination (Beauty Face + Finance Faceless + Gaming Face)
[ ] Test confidence eval: Haiku failure × 2 — verify cached fallback with timestamp
[ ] Test confidence eval: no cache + Haiku down — verify manual checklist prompt shown
[ ] Test ACCEPT button disabled when overall < 40
[ ] Test strong conflict (food → gaming) — verify Jason notification fires
[ ] Test mild overlap (tech → finance) — verify no notification
[ ] Test multi-niche selection — verify probability bar animates to 95%
[ ] Test tone selection → user-settings write verified
[ ] Test tone skip → default hybrid written with confidence 0.3
[ ] Test "Not sure yet" → maps to hybrid correctly
[ ] Test tone injection reaches Muse system prompt on first video
[ ] Test new channel flow end-to-end
[ ] Test existing channel flow end-to-end
```

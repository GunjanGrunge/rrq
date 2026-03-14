---
name: rex
description: >
  Rex is the intelligence and scouting agent of RRQ. Monitors the world
  for trending topics, breaking news, product launches, viral moments,
  and emerging stories. Scores every signal for confidence, content
  maturity, and channel fit before passing to Regum. Rex never produces
  content — Rex decides what is worth making and when it is ready.
  Triggers on: scheduled scans every 30 minutes, GO RRQ button press,
  niche-specific scan requests, and Zeus memory injection events.
---

# Rex — Intelligence & Scout Agent

## Model
Use **claude-opus-4** via AWS Bedrock (`anthropic.claude-opus-4-5`).
Rex makes judgment calls under uncertainty. Is this story credible?
Is there enough verified content? Will this trend peak in 6 hours or
6 days? These nuanced assessments require Opus-level reasoning.
A wrong Rex call — flagging misinformation as credible — can permanently
damage the channel's reputation. Never downgrade to Sonnet for Rex.

Always request Zeus memory injection before starting any scan.

**Read `skills/data-harvest/SKILL.md`** — Rex uses harvestSignals() for all signal collection.
**Read `skills/aria/SKILL.md`** — Rex sends greenlights to ARIA, not Regum directly.
---

## Mission Protocol

**Read `skills/agents/mission-protocol/SKILL.md` before every run.**

The channel is building from zero. Every decision is evaluated against the
90-day monetisation mission: 1,000 subscribers + 4,000 watch hours.
Zeus broadcasts the current phase (COLD_START → MOMENTUM → PUSH → MONETISED)
and daily briefing. All behaviour — thresholds, urgency, content strategy —
shifts based on phase. Never act without knowing the current phase.



---

## Core Responsibilities

```
1. Trend Monitoring     → scan all signals every 30 minutes
2. Confidence Scoring   → assess content maturity per topic
3. Watchlist Management → monitor developing stories over time
4. Viewer Request Queue → process topics from Zeus comment intelligence
5. Opportunity Ranking  → deliver ranked shortlist to Regum
```

---

## Signal Sources

Rex scans all of these in parallel on every run:

### Trend Signals
```typescript
const SIGNAL_SOURCES = {
  googleTrends: {
    url: "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US",
    weight: 1.5,    // high authority
    type: "rss"
  },
  redditRising: {
    url: "https://www.reddit.com/r/worldnews+technology+science+sports/rising.json?limit=25",
    weight: 1.2,
    type: "json"
  },
  newsAPI: {
    url: `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${NEWS_API_KEY}`,
    weight: 1.4,
    type: "json"
  },
  youtubeTrending: {
    url: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=20&key=${YT_API_KEY}`,
    weight: 1.6,    // highest — already proven on platform
    type: "json"
  },
  hackerNews: {
    url: "https://hacker-news.firebaseio.com/v0/topstories.json",
    weight: 1.1,
    type: "json"
  },
  twitterTrending: {
    url: `https://api.twitter.com/2/trends/by/woeid/1`,  // worldwide
    weight: 1.3,
    type: "json",
    auth: "Bearer " + process.env.TWITTER_BEARER_TOKEN
  }
};
```

### Niche-Specific Sources
Rex knows which sources matter per niche:

```typescript
const NICHE_SOURCES = {
  tech:          ["9to5mac.com", "theverge.com", "gsmarena.com", "anandtech.com"],
  sports:        ["espn.com", "bbc.com/sport", "skysports.com"],
  finance:       ["reuters.com/finance", "bloomberg.com", "cnbc.com"],
  science:       ["nasa.gov/news", "nature.com/news", "sciencedaily.com"],
  entertainment: ["variety.com", "deadline.com", "rottentomatoes.com"],
  politics:      ["reuters.com", "apnews.com", "bbc.com/news"],
  gaming:        ["ign.com", "kotaku.com", "gamespot.com"]
};
```

---

## Confidence Scoring System

Every flagged topic gets a confidence score (0.0–1.0) before it touches Regum.

### Scoring Dimensions

```typescript
interface ConfidenceScore {
  sourceQuality: number;      // 0-1: are sources authoritative?
  sourceCount: number;        // 0-1: how many independent sources confirm?
  contentMaturity: number;    // 0-1: enough facts to make a full video?
  trendVelocity: number;      // 0-1: is this rising or falling?
  channelFit: number;         // 0-1: will our audience care?
  competitorGap: number;      // 0-1: has this been done well already?
  shelfLife: number;          // 0-1: 24hr story vs evergreen
  overall: number;            // weighted average
}
```

### Source Quality Scoring

```typescript
const SOURCE_TIERS = {
  tier1: {  // 1.0 weight
    sources: ["reuters.com", "apnews.com", "bbc.com", "nasa.gov", "who.int"],
    label: "Primary wire / official"
  },
  tier2: {  // 0.8 weight
    sources: ["nytimes.com", "theguardian.com", "wsj.com", "nature.com"],
    label: "Major news organisations"
  },
  tier3: {  // 0.6 weight
    sources: ["techcrunch.com", "theverge.com", "espn.com", "variety.com"],
    label: "Specialist vertical press"
  },
  tier4: {  // 0.3 weight
    sources: ["reddit.com", "twitter.com", "youtube.com"],
    label: "Social / UGC — corroboration only"
  }
};
```

### Content Maturity Thresholds

```typescript
const MATURITY_GATES = {
  breaking:   { minSources: 2, minAge: "0hr",  minConfidence: 0.85, label: "World event — huge story" },
  developing: { minSources: 4, minAge: "4hr",  minConfidence: 0.65, label: "Story confirmed, details emerging" },
  confirmed:  { minSources: 6, minAge: "8hr",  minConfidence: 0.80, label: "Full picture available" },
  evergreen:  { minSources: 8, minAge: "24hr", minConfidence: 0.90, label: "Deep research possible" }
};
```

### Overall Confidence Calculation

```typescript
function calculateConfidence(signals: SignalData): ConfidenceScore {
  const sourceQuality = getSourceQualityScore(signals.sources);
  const sourceCount   = Math.min(signals.sources.length / 8, 1.0);
  const maturity      = getContentMaturityScore(signals);
  const velocity      = getTrendVelocityScore(signals);
  const channelFit    = getChannelFitScore(signals, channelMemory);
  const compGap       = getCompetitorGapScore(signals);
  const shelfLife     = getShelfLifeScore(signals);

  const overall = (
    sourceQuality * 0.25 +
    sourceCount   * 0.15 +
    maturity      * 0.20 +
    velocity      * 0.15 +
    channelFit    * 0.15 +
    compGap       * 0.05 +
    shelfLife     * 0.05
  );

  return { sourceQuality, sourceCount, contentMaturity: maturity,
           trendVelocity: velocity, channelFit, competitorGap: compGap,
           shelfLife, overall };
}
```

---

## Watchlist Management

Stories that aren't ready yet go onto the watchlist. Rex checks them every scan.

```typescript
interface WatchlistItem {
  topicId: string;
  topic: string;
  niche: string;
  firstSeen: string;        // ISO timestamp
  lastChecked: string;
  confidenceHistory: number[];  // score per check — shows trajectory
  sources: string[];
  checkCount: number;
  status: "monitoring" | "ready" | "greenlit" | "dropped" | "too_late";
  source: "rex_scan" | "viewer_request" | "zeus_alert";
}
```

### Watchlist Decision Logic

```typescript
function evaluateWatchlistItem(item: WatchlistItem, latestScore: ConfidenceScore) {
  const ageDays = daysSince(item.firstSeen);
  const trajectory = getTrajectory(item.confidenceHistory);

  if (latestScore.overall >= 0.80) return "ready";               // enough info
  if (trajectory === "falling" && ageDays > 3) return "dropped"; // story died
  if (ageDays > 14) return "dropped";                            // too stale
  if (latestScore.trendVelocity < 0.2) return "dropped";        // no interest
  return "monitoring";                                            // keep watching
}
```

---

## Rex Scan Run — Full Flow

```typescript
async function rexScan(mode: "full" | "niche", niche?: string) {
  // 1. Request Zeus memory injection
  const memory = await zeus.prepareAgentContext("rex",
    `trend scanning for ${mode === "niche" ? niche : "all niches"}`
  );

  // 2. Fetch all signals in parallel
  const signals = await fetchAllSignals(mode, niche);

  // 3. Deduplicate and cluster by topic
  const clusters = await clusterTopics(signals);

  // 4. Score each cluster
  const scored = await Promise.all(
    clusters.map(async cluster => {
      const confidence = calculateConfidence(cluster);
      return { ...cluster, confidence };
    })
  );

  // 5. Opus reasoning pass — Rex makes final judgment
  const rexJudgment = await bedrock.invoke({
    modelId: "anthropic.claude-opus-4-5",
    body: {
      system: `You are Rex, intelligence agent for RRQ YouTube channel.
${memory}

Your job: evaluate these trending topics and decide which to flag for Regum.
Be conservative. It is better to miss a story than to flag bad content.
Never flag topics without enough verified factual content for a full video.`,
      messages: [{
        role: "user",
        content: `Trending signals with confidence scores:
${JSON.stringify(scored, null, 2)}

Current watchlist:
${JSON.stringify(watchlist, null, 2)}

For each topic decide:
- GREENLIGHT: ready for Regum now
- WATCHLIST: needs more time
- DROP: not worth pursuing

Return JSON array with decision + reasoning per topic.`
      }]
    }
  });

  // 6. Update watchlist, pass greenlights to Regum
  await processRexDecisions(rexJudgment);
}
```

---

## Rex Output to Regum

```typescript
interface RexOpportunity {
  topicId: string;
  topic: string;
  niche: string;
  headline: string;             // Rex's single-line take on the story
  confidenceScore: number;      // 0.0-1.0
  maturityLevel: "breaking" | "developing" | "confirmed" | "evergreen";
  trendVelocity: "rising_fast" | "rising" | "peaked" | "falling";
  shelfLife: "24hrs" | "48hrs" | "1week" | "evergreen";
  sources: { url: string; tier: number; title: string }[];
  suggestedAngles: string[];    // 2-3 angles Rex identified
  competitorGap: string;        // what hasn't been covered well
  urgency: "publish_now" | "publish_today" | "publish_thisweek";
  viewerRequestCount: number;   // how many viewers asked for this
  rexReasoning: string;         // why Rex thinks this is worth making
}
```

---

## Content Maturity Frame for Developing Stories

When confidence is MEDIUM (0.5-0.79) and story is huge — Rex can flag with a developing frame:

```
Rex flags topic with maturityLevel: "developing"
Regum sees the flag + maturity level
Regum can choose to produce with this disclaimer frame:

"This is a developing story. Everything stated here
 is based on verified sources as of [timestamp].
 We'll follow up with a full breakdown once more
 is confirmed. Sources linked in description."

Zeus monitors for comment corrections on developing videos
If factual errors found → Rex adds to watchlist for correction video
```

---

## Rex Performance Metrics (Zeus tracks these)

```
Trend accuracy:     did flagged topics actually perform?
Timing accuracy:    was urgency call right? (too early / too late?)
Confidence calibration: did HIGH confidence = high views?
False positive rate:    how often did Rex flag low-performing topics?
Missed opportunities:   competitor videos Rex didn't catch
Viewer request hit rate: did flagged viewer requests get good response?
```


## Narrative Drift Detection

Rex does not just track whether a niche is trending — he tracks
whether the *conversation inside the niche* has shifted. A niche
can stay hot while the dominant framing changes completely.

```typescript
export interface NarrativeDriftSignal {
  niche: string;
  previousDominantFrame: string;   // what people were saying 30 days ago
  currentDominantFrame: string;    // what people are saying now
  driftVelocity: "SLOW" | "MODERATE" | "FAST" | "RAPID";
  driftConfidence: number;         // 0–100
  openWindows: string[];           // angles the drift has opened
  closingWindows: string[];        // angles the drift is closing
  councilAlert: boolean;           // flag to The Line if drift is RAPID
}

// Drift detection runs:
// 1. During cold start deep research (full niche scan)
// 2. Daily as part of Rex's monitoring cycle
// 3. On-demand when a council candidate is being evaluated

export async function detectNarrativeDrift(
  niche: string,
  options: { compareWindows: string[] }
): Promise<NarrativeDriftSignal> {

  // Compare top-performing video titles and angles across time windows
  const [week1, month1, month3] = await Promise.all([
    getTopAngles(niche, { days: 7 }),
    getTopAngles(niche, { days: 30 }),
    getTopAngles(niche, { days: 90 }),
  ]);

  // Detect shift in dominant framing
  const drift = analyseFramingShift(week1, month1, month3);

  // Alert The Line if drift is RAPID — council needs to know
  if (drift.driftVelocity === "RAPID") {
    await writeToAgentMessages({
      type: "NARRATIVE_DRIFT_ALERT",
      from: "REX",
      to: "THE_LINE",
      payload: {
        niche,
        previousFrame: drift.previousDominantFrame,
        currentFrame: drift.currentDominantFrame,
        urgency: "HIGH",
        message: `Rapid narrative drift detected in ${niche}.
                  The conversation has shifted from "${drift.previousDominantFrame}"
                  to "${drift.currentDominantFrame}".
                  Any queued videos using the old frame need council review.`,
      }
    });
  }

  return drift;
}
```

### Drift Shared With Council

When Rex gives his council verdict, he includes the current
narrative frame explicitly:

```
"The narrative window is open. Current dominant frame in this niche:
 [frame]. This angle sits inside that frame — it will resonate.
 No drift detected in the last 7 days. Window estimate: 5 days."

OR

"Moderate drift detected. The frame has shifted from [old] to [new].
 This angle was stronger 2 weeks ago. Still viable but adjust the
 opening framing to match the current conversation."
```

Rex surfaces drift to Oracle and ARIA during the council so
portfolio and historical pattern checks use the current frame,
not a stale one.


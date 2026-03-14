---
name: data-harvest
description: >
  External data harvesting layer for RRQ. Provides Rex and ARIA with
  validated, structured signals from Google Trends, YouTube Trending,
  Reddit velocity, X/Twitter pulse, NewsAPI + GDELT, sports fixture
  calendars, and major events calendars. Now also includes six new
  intent-layer sources: Google Autocomplete (what people are typing
  RIGHT NOW), YouTube Search Suggestions (platform-native search intent),
  Reddit Trending posts (proactive community discovery), TikTok Creative
  Center (48-72hr cross-platform early warning), Google Keyword Planner
  (exact search volume + CPC = revenue signal), and Polymarket (real-money
  prediction market crowd intelligence). All data normalises into a standard
  SignalPacket format so Rex and ARIA speak the same language.
  Read this skill when building any data harvesting, signal collection,
  or external trend validation feature.
---

# Data Harvest — External Signal Layer

## Why These Six New Sources

The existing harvester tells Rex what is trending. The new intent-layer
sources tell Rex what people are **actively searching for and predicting
right now** — a fundamentally different and more valuable signal.

```
EXISTING SOURCES (what's trending on platforms):
  Google Trends       → search interest over time — trajectory
  YouTube Trending    → what's already big on YouTube
  Reddit Velocity     → keyword search upvote velocity
  X/Twitter Pulse     → conversation + debate velocity
  NewsAPI + GDELT     → journalistic coverage volume
  Sports + Events     → calendar-driven opportunities

NEW INTENT SOURCES (what people are typing, searching, betting on):
  Google Autocomplete    → real-time autocomplete = exact words people type NOW
  YouTube Suggestions    → YouTube's own suggestion engine = platform native intent
  Reddit Trending Posts  → proactive trending scan (discovers topics Rex didn't search for)
  TikTok Creative Center → cross-platform early warning before topics hit YouTube
  Google Keyword Planner → exact monthly search volume + CPC (revenue signal)
  Polymarket             → real-money prediction markets = crowd intelligence on outcomes
```

### Why Each Source Matters for Video Production

**Google Autocomplete** — Returns what millions of users are mid-typing. These
are exact words people use, not keyword tool guesses. Rex surfaces both the
topic AND the precise angle people want. If "does Claude AI work for" autofills
to "coding", "writing essays", "replacing jobs" — those are three video angles
handed to you for free. No other source has this specificity.

**YouTube Search Suggestions** — YouTube's own suggestion engine is the
highest-value signal in the entire harvester. It reflects what YouTube's
algorithm knows people are searching for on the platform we publish to.
The "alphabet soup" technique (appending a-z) surfaces 200+ long-tail
suggestions per topic — many with zero competition on YouTube.

**Reddit Trending Posts** — The existing Reddit harvester searches by keyword.
This source proactively scans Reddit's trending posts to catch topics Rex
hasn't thought to look for yet. Rex discovers unknown unknowns — topics too
new to have a keyword in Rex's watchlist.

**TikTok Creative Center** — TikTok trends migrate to YouTube search with a
48-72 hour lag. Rex catching a TikTok trend early means Qeon can publish
before competitor channels even know the topic exists. The Creative Center
also identifies which content formats are dominating — Rex feeds this to MUSE.

**Google Keyword Planner** — The only source that gives exact monthly search
volume and CPC per keyword. CPC directly maps to RPM — high CPC keywords =
high CPM content = more revenue per 1,000 views. When two topics score equally
on confidence, Keyword Planner's revenue score breaks the tie.

**Polymarket** — Real-money prediction markets. Heavy trading means people
have financial skin in the outcome — they will follow it closely and watch
videos on it. A political event trading at 73% on Polymarket will generate
enormous engagement. This is crowd intelligence that news sources miss.

---

## Full Architecture (Updated)

```
External World
  │
  ├── Google Trends API        → keyword trajectory + regional breakdown
  ├── YouTube Data API v3      → trending videos + competitor velocity
  ├── Reddit JSON API          → upvote velocity + subreddit spread (keyword)
  ├── X/Twitter API v2         → keyword volume + source quality + X trending
  ├── NewsAPI                  → article count + source diversity
  ├── GDELT Project            → global tone + event classification
  ├── Sports Reference APIs    → fixture calendars (4 weeks ahead)
  ├── Ticketmaster API         → major events calendar
  │
  ├── ── NEW: INTENT LAYER ────────────────────────────────────────────────
  ├── Google Autocomplete API  → real-time search intent (what people type NOW)
  ├── YouTube Suggest API      → platform-native search suggestions + gap detection
  ├── Reddit Trending Scan     → proactive trending discovery (not keyword search)
  ├── TikTok Creative Center   → 48–72hr cross-platform early warning
  ├── Google Keyword Planner   → exact search volume + CPC (revenue signal)
  └── Polymarket API           → prediction market trading = crowd intelligence
         │
         ▼
  lib/harvest/normaliser.ts  → everything becomes a SignalPacket
         │
         ▼
  Rex + ARIA consume SignalPackets — same format, always
```

---

## Environment Variables (Updated)

```bash
# Existing — unchanged:
TWITTER_BEARER_TOKEN=
NEWS_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
SERPAPI_KEY=
TICKETMASTER_API_KEY=

# NEW — intent layer:
TIKTOK_ACCESS_TOKEN=           # TikTok for Business API (free Research API)
                               # Sign up: business.tiktok.com → developer tools → API

# Google Keyword Planner reuses existing Google Ads credentials — no new keys:
GOOGLE_ADS_DEVELOPER_TOKEN=    # already in env from ads-manager
GOOGLE_ADS_CUSTOMER_ID=        # already in env from ads-manager
GOOGLE_ADS_LOGIN_CUSTOMER_ID=  # already in env from ads-manager
GOOGLE_ADS_REFRESH_TOKEN=      # already in env from ads-manager
GOOGLE_ADS_CLIENT_ID=          # already in env from ads-manager
GOOGLE_ADS_CLIENT_SECRET=      # already in env from ads-manager

# No new keys needed for:
# Google Autocomplete → public endpoint, no auth
# YouTube Suggestions → public endpoint, no auth
# Reddit Trending     → public JSON API, no auth
# Polymarket          → public REST API, no auth
```

---

## Updated Standard Signal Packet

The `intent` block is new. All existing `external` and `internal` fields are unchanged.

```typescript
// lib/harvest/types.ts

export interface SignalPacket {
  topicId: string;
  topic: string;
  harvestedAt: string;

  // ── External signals (unchanged) ─────────────────────────────────────
  external: {
    googleTrends:    { /* unchanged */ };
    youTubeTrending: { /* unchanged */ };
    reddit:          { /* unchanged — keyword search signals */ };
    twitter:         { /* unchanged */ };
    news:            { /* unchanged */ };
    calendar:        { /* unchanged */ };
  };

  // ── NEW: Intent signals ───────────────────────────────────────────────
  intent: {
    googleAutocomplete: {
      suggestions: string[];           // top 10 autocomplete completions
      questionSuggestions: string[];   // "how", "why", "what", "when" variants
      comparisonSuggestions: string[]; // "vs", "or", "versus" variants
      anglesFromSuggestions: string[]; // Rex-extracted video angle ideas
      searchMomentum: "ACCELERATING" | "STABLE" | "DECLINING" | "NEW_ENTRY";
      // NEW_ENTRY: term appeared in autocomplete in last 48hrs — very hot signal
    };

    youtubeSuggestions: {
      primarySuggestions: string[];    // top 8 YouTube suggest results
      longTailSuggestions: string[];   // alphabet soup expansions (a-z trick)
      topicClusters: string[];         // Rex clusters suggestions into topic buckets
      gapTopics: string[];             // high-suggestion topics with FEW existing videos
      // gapTopics = search demand with no supply = first-mover opportunity
    };

    redditTrending: {
      trendingPosts: {
        title: string;
        subreddit: string;
        upvotes: number;
        upvoteVelocity: number;        // upvotes/hr
        commentVelocity: number;       // comments/hr
        crosspostCount: number;        // spreading to other subreddits
        matchesOurTopic: boolean;      // flagged by Rex scan loop
      }[];
      discoveredTopics: string[];      // new topics Rex found (not in original scan)
      sentimentDistribution: {
        positive: number;              // % of top posts with positive sentiment
        negative: number;
        neutral: number;
      };
    };

    tiktokCreativeCenter: {
      isOnTikTokTrending: boolean;
      tiktokTrendRank: number | null;
      trendingHashtags: string[];      // relevant hashtags trending on TikTok
      estimatedYouTubeLag: number;     // hours before this hits YouTube search
      contentFormats: string[];        // what format dominates on TikTok
      targetAgeGroup: string;          // TikTok audience age bracket for this trend
      crossPlatformPotential: "HIGH" | "MEDIUM" | "LOW";
      // HIGH = topics that reliably migrate to YouTube (tech, finance, news)
      // LOW = TikTok-native content that stays there (dances, sounds)
    };

    keywordPlanner: {
      monthlySearchVolume: number;     // exact global monthly searches
      searchVolumeByMarket: { market: string; volume: number; }[];
      avgCPC: number;                  // USD — advertiser cost per click = RPM proxy
      competition: "LOW" | "MEDIUM" | "HIGH";
      relatedHighCPCKeywords: { keyword: string; cpc: number; volume: number; }[];
      revenueScore: number;            // 0-100: combined CPC × volume score
      // revenueScore > 70 = high RPM topic — use as tiebreaker
    };

    polymarket: {
      hasActiveMarkets: boolean;
      activeMarkets: {
        question: string;
        volume24h: number;             // USD traded in last 24h
        totalLiquidity: number;        // USD total liquidity
        leadingOutcome: string;        // outcome currently priced highest
        leadingProbability: number;    // 0-100%
        category: string;
        resolveDate: string;
      }[];
      crowdSentiment: "BULLISH" | "BEARISH" | "UNCERTAIN";
      engagementPrediction: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
      // Based on: liquidity × volume × proximity to resolution date
    };
  };

  // ── Geo-linguistic strategy (SNIPER adds) ────────────────────────────
  geoStrategy?: { /* unchanged */ };

  // ── Internal signals (Zeus/ARIA adds) ────────────────────────────────
  internal: { /* unchanged */ };
}
```

---

## New Harvester: Google Autocomplete

```typescript
// lib/harvest/google-autocomplete.ts
// No API key — public Google suggest endpoint
// Returns what people are mid-typing RIGHT NOW

export async function fetchGoogleAutocomplete(
  topic: string
): Promise<SignalPacket["intent"]["googleAutocomplete"]> {

  const encode = (q: string) => encodeURIComponent(q);
  const suggestUrl = (q: string) =>
    `https://suggestqueries.google.com/complete/search?output=firefox&q=${encode(q)}`;

  const questionPrefixes = ["how", "why", "what", "when", "does", "can", "is", "will"];
  const comparisonSuffixes = ["vs", "or", "versus", "compared to", "better than"];

  const [baseResult, ...variantResults] = await Promise.allSettled([
    fetch(suggestUrl(topic)).then(r => r.json()),
    ...questionPrefixes.map(p => fetch(suggestUrl(`${p} ${topic}`)).then(r => r.json())),
    ...comparisonSuffixes.map(s => fetch(suggestUrl(`${topic} ${s}`)).then(r => r.json())),
  ]);

  const baseSuggestions: string[] = baseResult.status === "fulfilled"
    ? (baseResult.value[1] ?? []).slice(0, 10) : [];

  const questionSuggestions: string[] = variantResults
    .slice(0, questionPrefixes.length)
    .filter(r => r.status === "fulfilled")
    .flatMap(r => (r as PromiseFulfilledResult<any>).value[1] ?? [])
    .slice(0, 15);

  const comparisonSuggestions: string[] = variantResults
    .slice(questionPrefixes.length)
    .filter(r => r.status === "fulfilled")
    .flatMap(r => (r as PromiseFulfilledResult<any>).value[1] ?? [])
    .filter((s: string) => s.includes("vs") || s.includes("or ") || s.includes("better"))
    .slice(0, 8);

  const anglesFromSuggestions = extractAngles([
    ...questionSuggestions.slice(0, 5),
    ...comparisonSuggestions.slice(0, 3),
  ]);

  const avgLength = baseSuggestions.reduce((s, t) => s + t.length, 0) / (baseSuggestions.length || 1);
  const searchMomentum: SignalPacket["intent"]["googleAutocomplete"]["searchMomentum"] =
    baseSuggestions.length === 0 ? "DECLINING" :
    avgLength < 20              ? "NEW_ENTRY"  :
    baseSuggestions.length >= 8 ? "STABLE"     : "ACCELERATING";

  return { suggestions: baseSuggestions, questionSuggestions, comparisonSuggestions, anglesFromSuggestions, searchMomentum };
}

function extractAngles(suggestions: string[]): string[] {
  return suggestions.map(s => {
    const l = s.toLowerCase();
    if (l.startsWith("how"))           return `Tutorial: ${s}`;
    if (l.startsWith("why"))           return `Explainer: ${s}`;
    if (l.includes(" vs ") || l.includes(" or ")) return `Comparison: ${s}`;
    if (l.startsWith("is ") || l.startsWith("does ")) return `Fact-check: ${s}`;
    if (l.startsWith("best "))         return `Ranking: ${s}`;
    return `Angle: ${s}`;
  }).slice(0, 6);
}
```

---

## New Harvester: YouTube Search Suggestions

```typescript
// lib/harvest/youtube-suggestions.ts
// No API key — YouTube's public suggest endpoint
// Highest-value source in the intent layer

export async function fetchYouTubeSuggestions(
  topic: string
): Promise<SignalPacket["intent"]["youtubeSuggestions"]> {

  const encode = (q: string) => encodeURIComponent(q);
  // ds=yt = YouTube-specific suggestions, not general Google
  const ytUrl = (q: string) =>
    `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encode(q)}`;

  // Primary suggestions
  const primaryResponse = await fetch(ytUrl(topic));
  const primaryData = await primaryResponse.json();
  const primarySuggestions: string[] = (primaryData[1] ?? [])
    .map((item: any) => Array.isArray(item) ? item[0] : item)
    .filter(Boolean).slice(0, 8);

  // Long-tail alphabet soup — a-z expansion surfaces 200+ hidden queries
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const longTailResults = await Promise.allSettled(
    letters.map(l => fetch(ytUrl(`${topic} ${l}`)).then(r => r.json()))
  );

  const longTailSuggestions: string[] = longTailResults
    .filter(r => r.status === "fulfilled")
    .flatMap(r => {
      const d = (r as PromiseFulfilledResult<any>).value;
      return (d[1] ?? []).map((item: any) => Array.isArray(item) ? item[0] : item);
    })
    .filter(Boolean)
    .filter((s: string) => !primarySuggestions.includes(s))
    .slice(0, 30);

  const topicClusters = clusterSuggestions([...primarySuggestions, ...longTailSuggestions], topic);
  const gapTopics = await findGapTopics(longTailSuggestions.slice(0, 10));

  return { primarySuggestions, longTailSuggestions: longTailSuggestions.slice(0, 20), topicClusters, gapTopics };
}

function clusterSuggestions(suggestions: string[], base: string): string[] {
  const counts = new Map<string, number>();
  suggestions.forEach(s => {
    s.toLowerCase().replace(base.toLowerCase(), "").trim().split(" ")
      .filter(w => w.length > 3 && !["with","that","this","from","your","have"].includes(w))
      .forEach(w => counts.set(w, (counts.get(w) ?? 0) + 1));
  });
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1])
    .map(([w]) => `${base} ${w}`).slice(0, 5);
}

async function findGapTopics(suggestions: string[]): Promise<string[]> {
  // Low YouTube result count + suggestion appearance = gap opportunity
  const youtube = await getYouTubeClient();
  const gaps: string[] = [];
  for (const s of suggestions.slice(0, 8)) {
    try {
      const res = await youtube.search.list({ part: ["id"], q: s, type: ["video"], maxResults: 1 });
      if ((res.data.pageInfo?.totalResults ?? 0) < 500) gaps.push(s);
    } catch { /* quota protection — fail silently */ }
  }
  return gaps.slice(0, 5);
}
```

---

## New Harvester: Reddit Trending Posts (Proactive Discovery)

```typescript
// lib/harvest/reddit-trending.ts
// No API key — public Reddit JSON endpoints
// DIFFERENT from existing reddit-velocity.ts:
//   reddit-velocity.ts  = keyword search (Rex knows what to look for)
//   reddit-trending.ts  = proactive scan (Rex discovers unknowns)

export async function fetchRedditTrending(
  niche?: string
): Promise<SignalPacket["intent"]["redditTrending"]> {

  const NICHE_SUBREDDITS: Record<string, string> = {
    tech:          "r/technology+r/MachineLearning+r/artificial+r/programming+r/gadgets",
    finance:       "r/investing+r/wallstreetbets+r/personalfinance+r/CryptoCurrency+r/stocks",
    sports:        "r/sports+r/nba+r/soccer+r/nfl+r/formula1+r/cricket",
    entertainment: "r/movies+r/television+r/Music+r/gaming+r/anime",
    science:       "r/science+r/space+r/Physics+r/biology+r/Futurology",
    politics:      "r/worldnews+r/politics+r/geopolitics+r/news",
    gaming:        "r/gaming+r/pcgaming+r/PS5+r/XboxSeriesX+r/nintendo",
    default:       "r/popular+r/all",
  };

  const path = NICHE_SUBREDDITS[niche ?? "default"];

  const [hot, rising] = await Promise.allSettled([
    fetch(`https://www.reddit.com/${path}/hot.json?limit=25`, { headers: { "User-Agent": "RRQ-Scout/1.0" } }).then(r => r.json()),
    fetch(`https://www.reddit.com/${path}/rising.json?limit=25`, { headers: { "User-Agent": "RRQ-Scout/1.0" } }).then(r => r.json()),
  ]);

  const allPosts = [
    ...(hot.status === "fulfilled" ? hot.value.data?.children?.map((c: any) => c.data) ?? [] : []),
    ...(rising.status === "fulfilled" ? rising.value.data?.children?.map((c: any) => c.data) ?? [] : []),
  ];

  const trendingPosts = allPosts.map((p: any) => {
    const ageHours = (Date.now() / 1000 - p.created_utc) / 3600;
    return {
      title: p.title,
      subreddit: p.subreddit_name_prefixed,
      upvotes: p.ups,
      upvoteVelocity: ageHours > 0 ? Math.round(p.ups / ageHours) : p.ups,
      commentVelocity: ageHours > 0 ? Math.round(p.num_comments / ageHours) : p.num_comments,
      crosspostCount: p.num_crossposts ?? 0,
      matchesOurTopic: false,
    };
  }).sort((a, b) => b.upvoteVelocity - a.upvoteVelocity).slice(0, 15);

  const discoveredTopics = trendingPosts
    .map(p => p.title.replace(/\[.*?\]|\(.*?\)/g, "").trim())
    .filter(t => t.length > 15 && t.length < 100).slice(0, 8);

  const posWords = ["breakthrough","win","amazing","record","best","love","exciting","launch"];
  const negWords = ["fail","crash","ban","controversy","scandal","worst","terrible","problem"];
  let pos = 0, neg = 0, neut = 0;
  trendingPosts.forEach(p => {
    const l = p.title.toLowerCase();
    const hasPos = posWords.some(w => l.includes(w));
    const hasNeg = negWords.some(w => l.includes(w));
    if (hasPos && !hasNeg) pos++;
    else if (hasNeg && !hasPos) neg++;
    else neut++;
  });
  const total = pos + neg + neut || 1;

  return {
    trendingPosts,
    discoveredTopics,
    sentimentDistribution: {
      positive: Math.round((pos / total) * 100),
      negative: Math.round((neg / total) * 100),
      neutral:  Math.round((neut / total) * 100),
    },
  };
}
```

---

## New Harvester: TikTok Creative Center

```typescript
// lib/harvest/tiktok-creative-center.ts
// TikTok for Business Research API — free, requires business account
// 48-72hr early warning before topics hit YouTube search

export async function fetchTikTokTrends(
  topic: string,
  niche?: string
): Promise<SignalPacket["intent"]["tiktokCreativeCenter"]> {

  const BASE = "https://business-api.tiktok.com/open_api/v1.3";
  const headers = {
    "Access-Token": process.env.TIKTOK_ACCESS_TOKEN!,
    "Content-Type": "application/json",
  };

  const [keywordRes, hashtagRes] = await Promise.allSettled([
    fetch(`${BASE}/research/adv/keyword_insights/?keyword=${encodeURIComponent(topic)}&period=7`, { headers }).then(r => r.json()),
    fetch(`${BASE}/research/hashtag/suggest/?keyword=${encodeURIComponent(topic)}&count=20`, { headers }).then(r => r.json()),
  ]);

  let isOnTikTokTrending = false;
  let tiktokTrendRank: number | null = null;

  if (keywordRes.status === "fulfilled") {
    const keywords = keywordRes.value.data?.list ?? [];
    const match = keywords.find((k: any) => k.keyword?.toLowerCase().includes(topic.toLowerCase()));
    if (match) {
      isOnTikTokTrending = match.trend_type === "TRENDING_UP";
      tiktokTrendRank = match.rank ?? null;
    }
  }

  const trendingHashtags: string[] = hashtagRes.status === "fulfilled"
    ? (hashtagRes.value.data?.list ?? []).map((h: any) => `#${h.hashtag_name}`).slice(0, 10)
    : [];

  const contentFormats = detectTikTokFormats(niche);
  const estimatedYouTubeLag = estimateLag(niche);
  const crossPlatformPotential = assessCrossPlatform(niche, isOnTikTokTrending);

  return {
    isOnTikTokTrending,
    tiktokTrendRank,
    trendingHashtags,
    estimatedYouTubeLag,
    contentFormats,
    targetAgeGroup: "18-24",
    crossPlatformPotential,
  };
}

function detectTikTokFormats(niche?: string): string[] {
  const map: Record<string, string[]> = {
    tech:    ["explainer", "reaction", "first impressions", "tutorial"],
    finance: ["explainer", "breakdown", "opinion take", "case study"],
    sports:  ["highlights reaction", "analysis", "prediction", "breakdown"],
    entertainment: ["reaction", "commentary", "ranking", "review"],
    science: ["explainer", "animation", "myth-bust", "experiment"],
  };
  return map[niche ?? ""] ?? ["explainer", "reaction", "commentary"];
}

function estimateLag(niche?: string): number {
  if (niche === "entertainment" || niche === "sports") return 12;
  if (niche === "tech" || niche === "finance") return 24;
  if (niche === "science" || niche === "politics") return 48;
  return 36;
}

function assessCrossPlatform(niche: string | undefined, trending: boolean): "HIGH" | "MEDIUM" | "LOW" {
  if (!trending) return "LOW";
  const high = ["tech", "finance", "news", "science", "gaming"];
  const low  = ["dance", "sounds", "filters", "beauty hacks"];
  if (high.includes(niche ?? "")) return "HIGH";
  if (low.includes(niche ?? ""))  return "LOW";
  return "MEDIUM";
}
```

---

## New Harvester: Google Keyword Planner

```typescript
// lib/harvest/keyword-planner.ts
// Uses Google Ads API — already configured from ads-manager skill
// Exact monthly search volume + CPC = revenue signal for topic prioritisation

import { GoogleAdsApi } from "google-ads-api";

export async function fetchKeywordPlannerData(
  topic: string,
  targetMarkets: string[] = ["US", "GB", "IN", "AU", "CA"]
): Promise<SignalPacket["intent"]["keywordPlanner"]> {

  const client = new GoogleAdsApi({
    client_id:       process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret:   process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const customer = client.Customer({
    customer_id:       process.env.GOOGLE_ADS_CUSTOMER_ID!,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
    refresh_token:     process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  const GEO: Record<string, number> = {
    US: 2840, GB: 2826, IN: 2356, AU: 2036, CA: 2124,
    DE: 2276, FR: 2250, BR: 2076, JP: 2392, KR: 2410,
  };

  try {
    const [response] = await customer.keywordPlanIdeas.generateKeywordIdeas({
      keywords: [topic],
      language: "languageConstants/1000",
      geo_target_constants: targetMarkets
        .map(m => GEO[m]).filter(Boolean)
        .map(id => ({ geo_target_constant: `geoTargetConstants/${id}` })),
      keyword_plan_network: "GOOGLE_SEARCH_AND_PARTNERS",
    });

    const ideas = response.results ?? [];
    const main  = ideas.find((i: any) => i.text?.toLowerCase() === topic.toLowerCase());

    const monthlySearchVolume = main?.keyword_idea_metrics?.avg_monthly_searches ?? 0;
    const avgCPC = main?.keyword_idea_metrics?.average_cpc_micros
      ? main.keyword_idea_metrics.average_cpc_micros / 1_000_000 : 0;
    const competition: "LOW" | "MEDIUM" | "HIGH" =
      main?.keyword_idea_metrics?.competition === "LOW"    ? "LOW"    :
      main?.keyword_idea_metrics?.competition === "MEDIUM" ? "MEDIUM" : "HIGH";

    const relatedHighCPCKeywords = ideas
      .filter((i: any) => i.text !== topic)
      .map((i: any) => ({
        keyword: i.text ?? "",
        cpc:     (i.keyword_idea_metrics?.average_cpc_micros ?? 0) / 1_000_000,
        volume:  i.keyword_idea_metrics?.avg_monthly_searches ?? 0,
      }))
      .filter(k => k.cpc > avgCPC * 0.8)
      .sort((a, b) => b.cpc - a.cpc)
      .slice(0, 8);

    // Revenue score: log-normalised volume × CPC blend (0-100)
    const revenueScore = Math.min(100, Math.round(
      (Math.log10(monthlySearchVolume + 1) * 15) + (Math.min(avgCPC, 30) / 30 * 55)
    ));

    return {
      monthlySearchVolume,
      searchVolumeByMarket: targetMarkets.map(m => ({
        market: m,
        volume: Math.round(monthlySearchVolume / targetMarkets.length),
      })),
      avgCPC,
      competition,
      relatedHighCPCKeywords,
      revenueScore,
    };

  } catch (err) {
    console.warn("[keyword-planner] API error, returning defaults:", err);
    return { monthlySearchVolume: 0, searchVolumeByMarket: [], avgCPC: 0, competition: "MEDIUM", relatedHighCPCKeywords: [], revenueScore: 0 };
  }
}
```

---

## New Harvester: Polymarket

```typescript
// lib/harvest/polymarket.ts
// Real-money prediction markets = crowd intelligence on topic outcomes
// Fully public REST API — no auth required

export async function fetchPolymarketData(
  topic: string
): Promise<SignalPacket["intent"]["polymarket"]> {

  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(topic)}&active=true&closed=false&limit=10`,
      { headers: { "Accept": "application/json" } }
    );

    if (!res.ok) return defaultPolymarketResult();

    const markets = await res.json();
    if (!markets || markets.length === 0) return defaultPolymarketResult();

    const activeMarkets = markets
      .filter((m: any) => parseFloat(m.volume ?? "0") > 1000)
      .map((m: any) => {
        const outcomes  = m.outcomes ?? [];
        const prices    = m.outcomePrices ?? [];
        const ranked    = outcomes.map((o: string, i: number) => ({
          outcome: o, probability: parseFloat(prices[i] ?? "0.5") * 100,
        })).sort((a: any, b: any) => b.probability - a.probability);

        return {
          question:           m.question ?? "",
          volume24h:          parseFloat(m.volume24hr ?? "0"),
          totalLiquidity:     parseFloat(m.liquidity ?? "0"),
          leadingOutcome:     ranked[0]?.outcome ?? "Yes",
          leadingProbability: Math.round(ranked[0]?.probability ?? 50),
          category:           m.category ?? "general",
          resolveDate:        m.endDate ?? "",
        };
      })
      .sort((a: any, b: any) => b.volume24h - a.volume24h)
      .slice(0, 5);

    const avgProb = activeMarkets.length > 0
      ? activeMarkets.reduce((s: number, m: any) => s + m.leadingProbability, 0) / activeMarkets.length : 50;

    const crowdSentiment: "BULLISH" | "BEARISH" | "UNCERTAIN" =
      avgProb > 65 ? "BULLISH" : avgProb < 35 ? "BEARISH" : "UNCERTAIN";

    const totalVol24h = activeMarkets.reduce((s: any, m: any) => s + m.volume24h, 0);
    const daysToResolve = activeMarkets.length > 0
      ? Math.min(...activeMarkets.map((m: any) => {
          const d = (new Date(m.resolveDate).getTime() - Date.now()) / 86400000;
          return Math.max(0, d);
        })) : 999;

    const engagementPrediction: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" =
      totalVol24h > 100000 && daysToResolve < 7  ? "VERY_HIGH" :
      totalVol24h > 50000  || daysToResolve < 14 ? "HIGH"      :
      totalVol24h > 10000                         ? "MEDIUM"    : "LOW";

    return { hasActiveMarkets: activeMarkets.length > 0, activeMarkets, crowdSentiment, engagementPrediction };

  } catch {
    return defaultPolymarketResult();
  }
}

function defaultPolymarketResult(): SignalPacket["intent"]["polymarket"] {
  return { hasActiveMarkets: false, activeMarkets: [], crowdSentiment: "UNCERTAIN", engagementPrediction: "LOW" };
}
```

---

## Updated Master Harvester

```typescript
// lib/harvest/index.ts (updated)

import { fetchGoogleTrends }       from "./google-trends";
import { fetchYouTubeTrending }    from "./youtube-trending";
import { fetchRedditVelocity }     from "./reddit-velocity";        // existing keyword search
import { fetchXPulse }             from "./x-pulse";
import { fetchNewsPulse }          from "./news-pulse";
import { fetchSportsCalendar, getSeasonalContext } from "./calendar";
import { fetchGoogleAutocomplete } from "./google-autocomplete";    // NEW
import { fetchYouTubeSuggestions } from "./youtube-suggestions";    // NEW
import { fetchRedditTrending }     from "./reddit-trending";        // NEW proactive scan
import { fetchTikTokTrends }       from "./tiktok-creative-center"; // NEW
import { fetchKeywordPlannerData } from "./keyword-planner";        // NEW
import { fetchPolymarketData }     from "./polymarket";             // NEW

export async function harvestSignals(
  topic: string,
  topicId: string,
  niche?: string,
): Promise<Omit<SignalPacket, "internal">> {

  // All 12 sources run in parallel — intent layer adds zero latency
  const [
    googleTrends, youTubeTrending, reddit, twitter, news, upcomingEvents,
    googleAutocomplete, youtubeSuggestions, redditTrending,
    tiktokTrends, keywordPlanner, polymarket,
  ] = await Promise.allSettled([
    fetchGoogleTrends(topic),
    fetchYouTubeTrending(topic),
    fetchRedditVelocity(topic),
    fetchXPulse(topic),
    fetchNewsPulse(topic),
    fetchSportsCalendar(4),
    fetchGoogleAutocomplete(topic),
    fetchYouTubeSuggestions(topic),
    fetchRedditTrending(niche),
    fetchTikTokTrends(topic, niche),
    fetchKeywordPlannerData(topic),
    fetchPolymarketData(topic),
  ]);

  const seasonal = getSeasonalContext();

  return {
    topicId, topic,
    harvestedAt: new Date().toISOString(),
    external: {
      googleTrends:    googleTrends.status    === "fulfilled" ? googleTrends.value    : defaultTrends(),
      youTubeTrending: youTubeTrending.status === "fulfilled" ? youTubeTrending.value : defaultYT(),
      reddit:          reddit.status          === "fulfilled" ? reddit.value          : defaultReddit(),
      twitter:         twitter.status         === "fulfilled" ? twitter.value         : defaultTwitter(),
      news:            news.status            === "fulfilled" ? news.value            : defaultNews(),
      calendar: {
        upcomingEvents: upcomingEvents.status === "fulfilled" ? upcomingEvents.value : [],
        seasonalContext: seasonal.context,
        isSeasonallyRelevant: false,
      },
    },
    intent: {
      googleAutocomplete: googleAutocomplete.status === "fulfilled" ? googleAutocomplete.value : defaultAutocomplete(),
      youtubeSuggestions: youtubeSuggestions.status === "fulfilled" ? youtubeSuggestions.value : defaultYTSuggestions(),
      redditTrending:     redditTrending.status     === "fulfilled" ? redditTrending.value     : defaultRedditTrending(),
      tiktokCreativeCenter: tiktokTrends.status     === "fulfilled" ? tiktokTrends.value       : defaultTikTok(),
      keywordPlanner:     keywordPlanner.status     === "fulfilled" ? keywordPlanner.value     : defaultKeywordPlanner(),
      polymarket:         polymarket.status         === "fulfilled" ? polymarket.value         : defaultPolymarket(),
    },
  };
}

// Intent layer zero-value defaults
function defaultAutocomplete()   { return { suggestions: [], questionSuggestions: [], comparisonSuggestions: [], anglesFromSuggestions: [], searchMomentum: "STABLE" as const }; }
function defaultYTSuggestions()  { return { primarySuggestions: [], longTailSuggestions: [], topicClusters: [], gapTopics: [] }; }
function defaultRedditTrending() { return { trendingPosts: [], discoveredTopics: [], sentimentDistribution: { positive: 0, negative: 0, neutral: 100 } }; }
function defaultTikTok()         { return { isOnTikTokTrending: false, tiktokTrendRank: null, trendingHashtags: [], estimatedYouTubeLag: 48, contentFormats: [], targetAgeGroup: "18-24", crossPlatformPotential: "LOW" as const }; }
function defaultKeywordPlanner() { return { monthlySearchVolume: 0, searchVolumeByMarket: [], avgCPC: 0, competition: "MEDIUM" as const, relatedHighCPCKeywords: [], revenueScore: 0 }; }
function defaultPolymarket()     { return { hasActiveMarkets: false, activeMarkets: [], crowdSentiment: "UNCERTAIN" as const, engagementPrediction: "LOW" as const }; }
// Existing defaults unchanged
function defaultTrends()  { return { score: 0, trajectory: "FLAT" as const, weeklyChange: 0, regional: [], relatedRising: [] }; }
function defaultYT()      { return { isOnTrendingPage: false, trendingCategory: null, competitorVideos: [], searchResultCount: 0, topResultViews: 0 }; }
function defaultReddit()  { return { topPostUpvotes: 0, upvoteVelocity: 0, subredditCount: 0, subreddits: [], commentVelocity: 0, sentimentScore: 0 }; }
function defaultTwitter() { return { keywordTweetCount24h: 0, keywordTweetsPerHour: 0, quoteTweetVelocity: 0, conversationClusters: 0, isOnXTrending: false, trendingRank: null, trendingWoeid: 1, sourceQuality: "PUBLIC" as const, journalistAccountCount: 0, industryAccountCount: 0, verifiedAccountPercent: 0, sentimentScore: 0, avgEngagementRate: 0, peakHour: "" }; }
function defaultNews()    { return { articlesLast24h: 0, articlesLast7d: 0, sourceCount: 0, sourceDiversity: 0, publicationVelocity: "STABLE" as const, gdeltTone: 0, topSources: [], isBreaking: false }; }
```

---

## How Intent Signals Feed Rex's Opus Reasoning Pass

The intent layer is injected as a dedicated context block into Rex's final Opus judgment call.

```typescript
// In Rex's rexScan() — add to the Opus system prompt:

const intentContext = `
INTENT LAYER SIGNALS for "${topic}":

Google Autocomplete (what people type RIGHT NOW):
  Momentum: ${intent.googleAutocomplete.searchMomentum}
  Top completions: ${intent.googleAutocomplete.suggestions.slice(0,5).join(" | ")}
  Video angles from search: ${intent.googleAutocomplete.anglesFromSuggestions.join(" | ")}
  Question searches: ${intent.googleAutocomplete.questionSuggestions.slice(0,4).join(" | ")}

YouTube Suggestions (platform-native intent):
  Primary: ${intent.youtubeSuggestions.primarySuggestions.slice(0,5).join(" | ")}
  Gap opportunities (demand, no supply): ${intent.youtubeSuggestions.gapTopics.join(" | ")}
  Topic clusters: ${intent.youtubeSuggestions.topicClusters.join(" | ")}

Reddit Trending (proactive community discovery):
  Discovered topics (not in original scan): ${intent.redditTrending.discoveredTopics.join(" | ")}
  Top trending post: "${intent.redditTrending.trendingPosts[0]?.title ?? "none"}"
  Top post velocity: ${intent.redditTrending.trendingPosts[0]?.upvoteVelocity ?? 0} upvotes/hr

TikTok (48-72hr early warning):
  On TikTok trending: ${intent.tiktokCreativeCenter.isOnTikTokTrending}
  Est. YouTube migration: ${intent.tiktokCreativeCenter.estimatedYouTubeLag}hrs
  Cross-platform potential: ${intent.tiktokCreativeCenter.crossPlatformPotential}
  Trending hashtags: ${intent.tiktokCreativeCenter.trendingHashtags.slice(0,5).join(" ")}

Google Keyword Planner (search volume + revenue):
  Monthly searches: ${intent.keywordPlanner.monthlySearchVolume.toLocaleString()}
  Avg CPC (RPM proxy): $${intent.keywordPlanner.avgCPC.toFixed(2)}
  Revenue score: ${intent.keywordPlanner.revenueScore}/100
  High-CPC related: ${intent.keywordPlanner.relatedHighCPCKeywords.slice(0,3).map(k => `${k.keyword} ($${k.cpc.toFixed(2)})`).join(" | ")}

Polymarket (crowd intelligence):
  Active markets: ${intent.polymarket.hasActiveMarkets}
  ${intent.polymarket.activeMarkets[0]
    ? `Top: "${intent.polymarket.activeMarkets[0].question}" — ${intent.polymarket.activeMarkets[0].leadingProbability}% ${intent.polymarket.activeMarkets[0].leadingOutcome}`
    : "No active markets"}
  Crowd sentiment: ${intent.polymarket.crowdSentiment}
  Engagement prediction: ${intent.polymarket.engagementPrediction}
`;
```

### Rex Decision Rules from Intent Signals

```
googleAutocomplete.searchMomentum === "NEW_ENTRY"
  → urgency boost → consider "publish_now" regardless of other signals
  → use question/comparison suggestions as primary angle shortlist

youtubeSuggestions.gapTopics.length > 0
  → first-mover flag → include in Regum brief as: "YouTube gap detected"
  → Qeon uses gap topic phrasing in exact title for SEO

redditTrending.discoveredTopics
  → Rex adds each to watchlist for next scan cycle evaluation
  → Any scoring > 0.7 confidence → fast-track greenlight immediately

tiktokCreativeCenter.isOnTikTokTrending && estimatedYouTubeLag < 24
  → urgency = "publish_now" — window closes fast
  → MUSE receives: tiktokContentFormats → feeds format selection

keywordPlanner.revenueScore > 70
  → Revenue priority: if two topics equal on confidence, pick higher revenueScore
  → Zeus campaign note: "High CPC — increase ad budget ceiling 20%"

polymarket.engagementPrediction === "VERY_HIGH"
  → Audience has financial skin in outcome → multiple video opportunity
  → Script writer: include Polymarket probability in hook as credibility signal
  → Regum brief: consider follow-up video when market resolves
```

---

## ARIA Evidence Scoring — Intent Layer Additions

Two new scoring inputs added to `resolver.ts`:

```typescript
// lib/aria/resolver.ts — add to Rex score calculation:

// Intent signal strength (0-15 pts)
const intentPts = (() => {
  let pts = 0;
  if (intent.googleAutocomplete.searchMomentum === "NEW_ENTRY")      pts += 8;
  else if (intent.googleAutocomplete.searchMomentum === "ACCELERATING") pts += 5;
  if (intent.youtubeSuggestions.gapTopics.length > 0)                pts += 5;
  if (intent.tiktokCreativeCenter.isOnTikTokTrending &&
      intent.tiktokCreativeCenter.crossPlatformPotential === "HIGH") pts += 4;
  if (intent.polymarket.engagementPrediction === "VERY_HIGH")        pts += 5;
  else if (intent.polymarket.engagementPrediction === "HIGH")        pts += 3;
  return Math.min(15, pts);
})();

// Revenue score from Keyword Planner (0-10 pts)
const revenuePts = Math.round(intent.keywordPlanner.revenueScore * 0.10);

// Update rexScore:
const rexScore = trendPts + searchPts + redditPts + twitterPts + newsPts
               + intentPts + revenuePts + competitorPenalty + safetyPenalty;
```

---

## How Intent Signals Flow to the Script Writer

```typescript
// Added to youtube-research output contract:
intentSignals: {
  validatedAngles:    string[];  // from googleAutocomplete.anglesFromSuggestions
  titleCandidates:    string[];  // from youtubeSuggestions.primarySuggestions
  audienceQuestions:  string[];  // from googleAutocomplete.questionSuggestions
  // Script uses these as re-engagement moments: "You might be wondering: X. Here's why..."
  revenueKeywords:    string[];  // from keywordPlanner.relatedHighCPCKeywords
  // Script naturally weaves these into narration for better ad targeting (no stuffing)
  polymarketContext:  string | null;
  // "As of now, prediction markets give X a Y% chance of Z"
  // Only included when hasActiveMarkets && engagementPrediction >= "HIGH"
}
```

---

## Mode-Specific Behaviour

**Cold Start** — No Zeus performance history exists. Keyword Planner's `revenueScore`
becomes the primary tiebreaker when topics have equal external signal. TikTok
trending data is especially valuable because it requires no channel history.

**NICHE_LOCKED** — Reddit Trending scans only niche-relevant subreddits.
TikTok Creative Center filters to niche hashtags. Keyword Planner seeds from
niche-specific keyword clusters instead of the broad topic.

**MULTI_NICHE** — All six sources run across all configured niches in parallel.
Reddit Trending runs one scan per niche subreddit group. Polymarket is always
global. YouTube Suggestions runs per-niche to surface niche-specific gap topics.

---

## Updated Cost Estimate

```
All six new intent-layer sources:     $0

  Google Autocomplete   → public endpoint, unlimited
  YouTube Suggestions   → public endpoint, unlimited
  Reddit Trending       → public JSON API, no auth, generous rate limits
  TikTok Creative Center → free Research API (1,000 req/day — enough for 30 topics/scan)
  Google Keyword Planner → reuses existing Google Ads API (10 keyword idea requests/day default
                           — request quota increase from Google if needed, free)
  Polymarket            → public REST API, no key, no rate limit documented

Total new monthly cost: $0
All six sources are free or reuse existing paid credentials.
```

---

## File Checklist

```
[ ] Create lib/harvest/google-autocomplete.ts
[ ] Create lib/harvest/youtube-suggestions.ts
[ ] Create lib/harvest/reddit-trending.ts
[ ] Create lib/harvest/tiktok-creative-center.ts
[ ] Create lib/harvest/keyword-planner.ts
[ ] Create lib/harvest/polymarket.ts
[ ] Update lib/harvest/types.ts     → add intent block to SignalPacket
[ ] Update lib/harvest/index.ts     → add 6 new harvesters to Promise.allSettled()
[ ] Update lib/aria/resolver.ts     → add intentPts + revenuePts to rexScore
[ ] Update youtube-research output  → add intentSignals block
[ ] Update Rex Opus prompt          → add intentContext block to reasoning pass
[ ] Add TIKTOK_ACCESS_TOKEN to env + Vercel
[ ] Register TikTok for Business developer account (free — business.tiktok.com)
[ ] Request Google Keyword Planner quota increase if needed (free, 2-3 day response)
[ ] Test each harvester individually with a known trending topic
[ ] Test harvestSignals() total time — target < 8s with all 12 sources parallel
[ ] Confirm all 6 new sources fall back to zero-value defaults on failure
[ ] Test cold start mode — intent layer correctly substitutes for missing Zeus history
[ ] Test NICHE_LOCKED — Reddit Trending uses correct niche subreddits
[ ] Test MULTI_NICHE — parallel niche scans complete within 8s budget
[ ] Add intent layer summary panel to Zeus Command Center UI
[ ] Update signal-cache TTL confirmation covers all 12 sources (30 min)
```

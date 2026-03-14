---
name: sniper
description: >
  SNIPER is RRQ's geo-linguistic intelligence layer. It sits inside ARIA's
  signal processing pipeline and activates whenever a topic is trending
  across multiple locations or languages. SNIPER answers three questions:
  (1) Is this topic trending in one market or many? (2) Does the same
  topic need different angles per market? (3) Which markets have the
  highest CPM — where should Zeus focus ad spend? SNIPER turns one Rex
  greenlight into a multi-market content strategy and feeds Zeus with
  geo-targeted campaign data. Read this skill when building any geo,
  language, location, or market-targeting feature.
---

# SNIPER — Geo-Linguistic Intelligence Layer

## The Core Insight

```
Without SNIPER:
  Rex finds "Claude new model" trending → 1 video → worldwide campaign
  → US audience gets the video, UK audience gets the video, India gets it
  → One size fits all → average performance everywhere

With SNIPER:
  Rex finds "Claude new model" trending
  SNIPER scans: trending in US (English), UK (English), India (English),
                Germany (German), Brazil (Portuguese)
  
  Strategy output:
  → Video 1: English — US/UK/Australia angle ("how it competes with GPT")
             Zeus targets: US, UK, CA, AU — CPM $8-15
  → Video 2: English — India angle ("best free AI tools for students")  
             Zeus targets: IN — CPM $1-2 but volume 10x higher
  → Video 3: German — dubbed/subtitled ("Claude vs GPT auf Deutsch")
             Zeus targets: DE, AT, CH — CPM $12-18
  → Video 4: Portuguese — Brazilian angle  
             Zeus targets: BR — CPM $2-4, 215M Portuguese speakers
  
  4 videos. 4 targeted campaigns. Maximum traction per market.
```

---

## Where SNIPER Sits

```
REX          → finds topic, harvests global SignalPacket
  ↓
SNIPER       → geo-linguistic analysis, market strategy, CPM intelligence
  ↓  
ARIA         → portfolio balance (now market-aware)
  ↓
REGUM        → scheduling decisions (now includes market sequencing)
  ↓
QEON         → produces videos (angle + language adapted per market)
  ↑
ZEUS         → runs geo-targeted ad campaigns per market (SNIPER feeds params)
```

SNIPER is a module, not a standalone agent. It runs inside ARIA's pipeline
between signal harvesting and portfolio evaluation. It enriches every
SignalPacket with a `geoStrategy` object before ARIA scores it.

---

## Market Intelligence Database

Hardcoded market knowledge — CPM ranges, language coverage, YouTube
penetration, content angle tendencies. Updated manually quarterly.

```typescript
// lib/sniper/markets.ts

export interface Market {
  code: string;              // ISO country code
  name: string;
  language: string;          // primary content language
  languageCode: string;      // BCP-47 code
  youtubeMonthlyUsers: number; // millions
  avgCPM: {
    low: number;             // USD — bottom quartile
    mid: number;             // USD — median
    high: number;            // USD — top quartile (tech/finance content)
  };
  audienceTraits: string[];  // what resonates in this market
  contentAngles: string[];   // proven angle styles for this market
  xWoeid: number;            // X trending location ID
  googleTrendsGeo: string;   // Google Trends geo code
  timezone: string;          // for upload timing
  bestUploadTime: string;    // local time that maximises first-hour views
}

export const MARKETS: Record<string, Market> = {

  US: {
    code: "US", name: "United States", language: "English", languageCode: "en-US",
    youtubeMonthlyUsers: 240,
    avgCPM: { low: 6, mid: 12, high: 22 },
    audienceTraits: ["direct", "opinion-led", "entertainment-first", "competitive"],
    contentAngles: ["vs comparisons", "rankings", "controversies", "money angles"],
    xWoeid: 23424977, googleTrendsGeo: "US", timezone: "America/New_York",
    bestUploadTime: "15:00",
  },

  GB: {
    code: "GB", name: "United Kingdom", language: "English", languageCode: "en-GB",
    youtubeMonthlyUsers: 52,
    avgCPM: { low: 5, mid: 10, high: 18 },
    audienceTraits: ["sceptical", "dry humour", "underdog stories", "nuanced"],
    contentAngles: ["honest reviews", "debunking hype", "class/culture angles"],
    xWoeid: 23424975, googleTrendsGeo: "GB", timezone: "Europe/London",
    bestUploadTime: "17:00",
  },

  IN: {
    code: "IN", name: "India", language: "English", languageCode: "en-IN",
    youtubeMonthlyUsers: 462,
    avgCPM: { low: 0.5, mid: 1.5, high: 3 },
    audienceTraits: ["value-seeking", "career-focused", "aspirational", "community"],
    contentAngles: ["how to use for work/study", "free alternatives", "career impact"],
    xWoeid: 23424848, googleTrendsGeo: "IN", timezone: "Asia/Kolkata",
    bestUploadTime: "20:00",
  },

  AU: {
    code: "AU", name: "Australia", language: "English", languageCode: "en-AU",
    youtubeMonthlyUsers: 18,
    avgCPM: { low: 5, mid: 11, high: 19 },
    audienceTraits: ["casual", "outdoors", "anti-hype", "practical"],
    contentAngles: ["real world tests", "practical use cases", "no bs reviews"],
    xWoeid: 23424748, googleTrendsGeo: "AU", timezone: "Australia/Sydney",
    bestUploadTime: "18:00",
  },

  CA: {
    code: "CA", name: "Canada", language: "English", languageCode: "en-CA",
    youtubeMonthlyUsers: 30,
    avgCPM: { low: 5, mid: 10, high: 17 },
    audienceTraits: ["balanced", "multicultural", "tech-positive"],
    contentAngles: ["balanced comparisons", "inclusive angles", "tech adoption"],
    xWoeid: 23424775, googleTrendsGeo: "CA", timezone: "America/Toronto",
    bestUploadTime: "16:00",
  },

  DE: {
    code: "DE", name: "Germany", language: "German", languageCode: "de-DE",
    youtubeMonthlyUsers: 67,
    avgCPM: { low: 6, mid: 13, high: 20 },
    audienceTraits: ["engineering-minded", "quality-focused", "privacy-conscious", "thorough"],
    contentAngles: ["technical depth", "privacy/security angles", "engineering analysis"],
    xWoeid: 23424829, googleTrendsGeo: "DE", timezone: "Europe/Berlin",
    bestUploadTime: "18:00",
  },

  FR: {
    code: "FR", name: "France", language: "French", languageCode: "fr-FR",
    youtubeMonthlyUsers: 50,
    avgCPM: { low: 4, mid: 9, high: 15 },
    audienceTraits: ["intellectual", "cultural pride", "debate-loving"],
    contentAngles: ["cultural impact", "political angles", "intellectual debate"],
    xWoeid: 23424819, googleTrendsGeo: "FR", timezone: "Europe/Paris",
    bestUploadTime: "18:30",
  },

  BR: {
    code: "BR", name: "Brazil", language: "Portuguese", languageCode: "pt-BR",
    youtubeMonthlyUsers: 142,
    avgCPM: { low: 1, mid: 2.5, high: 5 },
    audienceTraits: ["entertainment-first", "community-driven", "humour", "passion"],
    contentAngles: ["entertainment angle", "community reactions", "relatable content"],
    xWoeid: 23424768, googleTrendsGeo: "BR", timezone: "America/Sao_Paulo",
    bestUploadTime: "20:00",
  },

  ES: {
    code: "ES", name: "Spain", language: "Spanish", languageCode: "es-ES",
    youtubeMonthlyUsers: 38,
    avgCPM: { low: 3, mid: 7, high: 12 },
    audienceTraits: ["social", "lifestyle", "entertainment"],
    contentAngles: ["lifestyle impact", "social angles", "celebrity connections"],
    xWoeid: 23424950, googleTrendsGeo: "ES", timezone: "Europe/Madrid",
    bestUploadTime: "19:00",
  },

  MX: {
    code: "MX", name: "Mexico", language: "Spanish", languageCode: "es-MX",
    youtubeMonthlyUsers: 75,
    avgCPM: { low: 1, mid: 3, high: 6 },
    audienceTraits: ["entertainment", "music", "youth culture"],
    contentAngles: ["relatable scenarios", "local cultural context", "aspirational"],
    xWoeid: 23424900, googleTrendsGeo: "MX", timezone: "America/Mexico_City",
    bestUploadTime: "20:00",
  },

  JP: {
    code: "JP", name: "Japan", language: "Japanese", languageCode: "ja-JP",
    youtubeMonthlyUsers: 90,
    avgCPM: { low: 5, mid: 11, high: 18 },
    audienceTraits: ["detail-oriented", "quality-focused", "tech-enthusiast"],
    contentAngles: ["technical detail", "product quality", "efficiency angles"],
    xWoeid: 23424856, googleTrendsGeo: "JP", timezone: "Asia/Tokyo",
    bestUploadTime: "20:00",
  },

  KR: {
    code: "KR", name: "South Korea", language: "Korean", languageCode: "ko-KR",
    youtubeMonthlyUsers: 46,
    avgCPM: { low: 4, mid: 9, high: 15 },
    audienceTraits: ["trend-early", "quality-obsessed", "beauty/tech crossover"],
    contentAngles: ["trend analysis", "tech + lifestyle crossover", "speed of adoption"],
    xWoeid: 23424868, googleTrendsGeo: "KR", timezone: "Asia/Seoul",
    bestUploadTime: "21:00",
  },

  NG: {
    code: "NG", name: "Nigeria", language: "English", languageCode: "en-NG",
    youtubeMonthlyUsers: 32,
    avgCPM: { low: 0.3, mid: 0.8, high: 2 },
    audienceTraits: ["entrepreneurial", "aspirational", "hustle culture"],
    contentAngles: ["business opportunity", "how to earn", "entrepreneurship"],
    xWoeid: 23424908, googleTrendsGeo: "NG", timezone: "Africa/Lagos",
    bestUploadTime: "19:00",
  },
};

// Languages we can produce content in (based on available TTS + translation)
export const SUPPORTED_LANGUAGES = ["en", "es", "pt", "de", "fr", "hi", "ja", "ko"];

// CPM tiers for Zeus campaign strategy
export const CPM_TIERS = {
  PREMIUM:   { min: 10,  markets: ["US", "CA", "AU", "GB", "DE", "JP", "KR"] },
  MID:       { min: 4,   markets: ["FR", "ES", "NL", "SE", "SG"] },
  VOLUME:    { min: 1,   markets: ["BR", "MX", "IN", "NG", "PH", "ID"] },
  EMERGING:  { min: 0,   markets: ["PK", "BD", "VN", "TH", "EG"] },
};
```

---

## Geo Signal Harvester

SNIPER extends the data-harvest layer with per-market signal collection.

```typescript
// lib/sniper/geo-harvest.ts

export interface MarketSignal {
  marketCode: string;
  trendingScore: number;       // 0-100 combined score for this market
  googleTrendsScore: number;   // Google Trends score for this market specifically
  isOnXTrending: boolean;      // trending on X in this country
  xTrendingRank: number | null;
  redditActivity: number;      // subreddit activity score for this market
  newsArticles: number;        // news articles in this market's language
  languageVariant: string;     // what language/variant is this market discussing in
  topLocalKeywords: string[];  // how this market searches for the topic (localised)
  velocity: "EXPLODING" | "RISING" | "STABLE" | "DECLINING";
  firstSeenHoursAgo: number;   // how long has this market been discussing it
}

export async function harvestGeoSignals(
  topic: string,
  markets: string[]             // market codes to check
): Promise<MarketSignal[]> {

  const signals = await Promise.allSettled(
    markets.map(code => harvestMarketSignal(topic, code))
  );

  return signals
    .filter(s => s.status === "fulfilled")
    .map(s => (s as PromiseFulfilledResult<MarketSignal>).value)
    .filter(s => s.trendingScore > 20); // only markets with real signal
}

async function harvestMarketSignal(
  topic: string,
  marketCode: string
): Promise<MarketSignal> {

  const market = MARKETS[marketCode];
  if (!market) throw new Error(`Unknown market: ${marketCode}`);

  // 1. Google Trends for this specific market
  const trendsParams = new URLSearchParams({
    api_key: process.env.SERPAPI_KEY!,
    engine: "google_trends",
    q: topic,
    geo: market.googleTrendsGeo,
    date: "now 7-d",
    data_type: "TIMESERIES",
  });
  const trendsResponse = await fetch(`https://serpapi.com/search?${trendsParams}`);
  const trendsData = await trendsResponse.json();
  const timeline = trendsData.interest_over_time?.timeline_data ?? [];
  const values = timeline.map((t: any) => t.values[0]?.extracted_value ?? 0);
  const googleTrendsScore = values[values.length - 1] ?? 0;

  // 2. X trending for this market's WOEID
  let isOnXTrending = false;
  let xTrendingRank: number | null = null;

  try {
    const xUrl = `https://api.twitter.com/1.1/trends/place.json?id=${market.xWoeid}`;
    const xResponse = await fetch(xUrl, {
      headers: { "Authorization": `Bearer ${process.env.TWITTER_BEARER_TOKEN}` }
    });
    const xData = await xResponse.json();
    const trends = xData[0]?.trends ?? [];
    const topicLower = topic.toLowerCase();
    const match = trends.find((t: any) =>
      t.name?.toLowerCase().includes(topicLower) ||
      topicLower.split(" ").some((w: string) => w.length > 4 && t.name?.toLowerCase().includes(w))
    );
    isOnXTrending = !!match;
    xTrendingRank = match ? trends.indexOf(match) + 1 : null;
  } catch { /* fail silently */ }

  // 3. Google Trends — localised keywords (how this market searches)
  const relatedParams = new URLSearchParams({
    api_key: process.env.SERPAPI_KEY!,
    engine: "google_trends",
    q: topic,
    geo: market.googleTrendsGeo,
    data_type: "RELATED_QUERIES",
  });
  const relatedResponse = await fetch(`https://serpapi.com/search?${relatedParams}`);
  const relatedData = await relatedResponse.json();
  const topLocalKeywords = (relatedData.related_queries?.top ?? [])
    .slice(0, 5)
    .map((r: any) => r.query);

  // 4. News in market language (using NewsAPI language filter)
  const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=${market.languageCode.slice(0,2)}&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;
  const newsResponse = await fetch(newsUrl);
  const newsData = await newsResponse.json();
  const newsArticles = newsData.totalResults ?? 0;

  // Calculate velocity
  const recentValues = values.slice(-3);
  const velocity: MarketSignal["velocity"] =
    googleTrendsScore > 80 && recentValues[2] > recentValues[1] ? "EXPLODING" :
    recentValues[2] > recentValues[1] ? "RISING" :
    recentValues[2] < recentValues[1] ? "DECLINING" : "STABLE";

  // Combined trending score for this market
  const trendingScore = Math.min(100,
    googleTrendsScore * 0.5 +
    (isOnXTrending ? (xTrendingRank && xTrendingRank <= 10 ? 30 : 20) : 0) +
    Math.min(20, newsArticles / 5)
  );

  return {
    marketCode,
    trendingScore,
    googleTrendsScore,
    isOnXTrending,
    xTrendingRank,
    redditActivity: 0,   // populated by reddit harvester if needed
    newsArticles,
    languageVariant: market.languageCode,
    topLocalKeywords,
    velocity,
    firstSeenHoursAgo: 0, // SNIPER estimates from signal pattern
  };
}
```

---

## Sniper Analysis Engine

The core of SNIPER — takes raw geo signals and outputs a multi-market strategy.

```typescript
// lib/sniper/analyser.ts

export interface SniperAnalysis {
  topicId: string;
  topic: string;

  // Market coverage
  activeMarkets: MarketSignal[];       // markets where topic is trending
  marketCount: number;
  languageCount: number;               // how many distinct languages
  isMultiMarket: boolean;              // trending in 2+ markets
  isMultiLanguage: boolean;            // trending in 2+ languages

  // Market groupings
  languageGroups: LanguageGroup[];     // markets grouped by language

  // Content strategy
  contentStrategy: MarketContentPlan[];

  // Ad strategy for Zeus
  adStrategy: MarketAdPlan[];

  // Priority ranking
  priorityMarkets: string[];           // ranked by (CPM × audience size × trend score)
  totalAdressableViews: number;        // estimated total view potential across all markets
}

export interface LanguageGroup {
  language: string;
  languageCode: string;
  markets: string[];                   // market codes in this language group
  combinedScore: number;               // average trend score across markets
  totalYouTubeUsers: number;           // combined monthly users (millions)
  angleVariants: string[];             // should these markets share an angle or differ?
}

export interface MarketContentPlan {
  marketCode: string;
  language: string;
  suggestedAngle: string;              // tailored to market's audience traits
  titleStyle: string;                  // how titles should be written for this market
  keyLocalKeywords: string[];          // what this market is searching for
  recommendedLength: number;           // minutes — based on market viewing habits
  uploadTime: string;                  // optimal local time
  shareAngleWithMarkets: string[];     // can share same video with sub/dub
  needsSeparateVideo: boolean;         // different enough to need unique production
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface MarketAdPlan {
  marketCode: string;
  targetCPM: number;
  estimatedReach: number;              // at target budget
  recommendedDailyBudget: number;      // Zeus will apply 50% cap on top of this
  targetingKeywords: string[];         // localised keywords for this market
  audienceAge: string[];
  campaignType: "AWARENESS" | "GROWTH" | "CONVERSION";
  priority: "RUN_NOW" | "RUN_IF_BUDGET" | "SKIP";
  reasoning: string;
}

export function analyseGeoSignals(
  topic: string,
  topicId: string,
  marketSignals: MarketSignal[],
  accountBalance: number
): SniperAnalysis {

  // ── Group by language ─────────────────────────────────────────────────
  const languageMap = new Map<string, MarketSignal[]>();
  for (const signal of marketSignals) {
    const market = MARKETS[signal.marketCode];
    const lang = market.language;
    if (!languageMap.has(lang)) languageMap.set(lang, []);
    languageMap.get(lang)!.push(signal);
  }

  const languageGroups: LanguageGroup[] = Array.from(languageMap.entries()).map(([lang, signals]) => {
    const markets = signals.map(s => s.marketCode);
    const totalUsers = markets.reduce((s, m) => s + MARKETS[m].youtubeMonthlyUsers, 0);
    const avgScore = signals.reduce((s, m) => s + m.trendingScore, 0) / signals.length;

    // Are angle variants needed within the same language?
    // Yes if markets have very different audience traits
    const angleVariants = markets.length === 1
      ? ["single market — no variants needed"]
      : suggestLanguageGroupAngles(lang, markets, topic);

    return {
      language: lang,
      languageCode: MARKETS[markets[0]].languageCode,
      markets,
      combinedScore: avgScore,
      totalYouTubeUsers: totalUsers,
      angleVariants,
    };
  });

  // ── Content plans per market ──────────────────────────────────────────
  const contentStrategy: MarketContentPlan[] = marketSignals.map(signal => {
    const market = MARKETS[signal.marketCode];
    const sameLanguageMarkets = languageGroups
      .find(g => g.language === market.language)?.markets
      .filter(m => m !== signal.marketCode) ?? [];

    // Can this market share a video with others in the same language group?
    const shareableMarkets = sameLanguageMarkets.filter(m => {
      const other = MARKETS[m];
      // Share if audience traits overlap significantly
      const sharedTraits = market.audienceTraits.filter(t => other.audienceTraits.includes(t));
      return sharedTraits.length >= 2;
    });

    return {
      marketCode: signal.marketCode,
      language: market.language,
      suggestedAngle: buildMarketAngle(topic, market, signal),
      titleStyle: buildTitleStyle(market),
      keyLocalKeywords: signal.topLocalKeywords,
      recommendedLength: getRecommendedLength(market),
      uploadTime: market.bestUploadTime,
      shareAngleWithMarkets: shareableMarkets,
      needsSeparateVideo: shareableMarkets.length === 0 || hasDistinctCulturalNeed(market),
      priority: signal.velocity === "EXPLODING" ? "HIGH" :
                signal.trendingScore > 60 ? "HIGH" :
                signal.trendingScore > 40 ? "MEDIUM" : "LOW",
    };
  });

  // ── Ad plans for Zeus ─────────────────────────────────────────────────
  const maxTotalBudget = accountBalance * 0.50; // 50% cap applies
  const adStrategy: MarketAdPlan[] = buildAdPlans(marketSignals, maxTotalBudget);

  // ── Priority ranking ──────────────────────────────────────────────────
  // Rank by: CPM × trend score × market size (logarithmic to prevent big markets dominating)
  const priorityMarkets = marketSignals
    .map(s => ({
      code: s.marketCode,
      score: MARKETS[s.marketCode].avgCPM.mid *
             (s.trendingScore / 100) *
             Math.log10(MARKETS[s.marketCode].youtubeMonthlyUsers + 1),
    }))
    .sort((a, b) => b.score - a.score)
    .map(s => s.code);

  const totalAdressableViews = marketSignals.reduce((sum, s) => {
    return sum + (MARKETS[s.marketCode].youtubeMonthlyUsers * 1_000_000 * (s.trendingScore / 100) * 0.001);
  }, 0);

  return {
    topicId, topic,
    activeMarkets: marketSignals,
    marketCount: marketSignals.length,
    languageCount: languageGroups.length,
    isMultiMarket: marketSignals.length > 1,
    isMultiLanguage: languageGroups.length > 1,
    languageGroups,
    contentStrategy,
    adStrategy,
    priorityMarkets,
    totalAdressableViews: Math.round(totalAdressableViews),
  };
}

function buildMarketAngle(topic: string, market: Market, signal: MarketSignal): string {
  // Pull from market's proven content angles, filtered by topic type
  const angles = market.contentAngles;
  const traits = market.audienceTraits;

  // Simple heuristic — SNIPER generates this, Regum refines it
  if (traits.includes("career-focused")) return `How ${topic} affects your career and studies`;
  if (traits.includes("engineering-minded")) return `Technical deep-dive: ${topic} explained`;
  if (traits.includes("value-seeking")) return `${topic}: free tools and practical guide`;
  if (traits.includes("entertainment-first")) return `${topic}: reactions and community takes`;
  if (traits.includes("sceptical")) return `${topic}: honest review, no hype`;
  return `${topic}: what you need to know`;
}

function buildTitleStyle(market: Market): string {
  if (market.audienceTraits.includes("direct")) return "Question or bold claim: 'Is X Worth It?'";
  if (market.audienceTraits.includes("sceptical")) return "Honest framing: 'The Truth About X'";
  if (market.audienceTraits.includes("career-focused")) return "Utility framing: 'How X Will Help You'";
  if (market.audienceTraits.includes("engineering-minded")) return "Technical framing: 'How X Actually Works'";
  return "Neutral informational: 'Everything You Need to Know About X'";
}

function getRecommendedLength(market: Market): number {
  // Markets with longer avg viewing sessions prefer longer content
  if (["IN", "NG", "PH"].includes(market.code)) return 12; // mobile-heavy, longer sessions
  if (["JP", "KR", "DE"].includes(market.code)) return 10; // quality-focused, thorough
  if (["US", "GB", "AU"].includes(market.code)) return 8;  // shorter attention, strong hooks needed
  return 9;
}

function hasDistinctCulturalNeed(market: Market): boolean {
  // These markets need culturally distinct content — can't share even same language
  return ["IN", "NG"].includes(market.code); // English but very different cultural context
}

function buildAdPlans(signals: MarketSignal[], maxTotalBudget: number): MarketAdPlan[] {
  // Allocate budget across markets weighted by (CPM × trend score)
  const weights = signals.map(s => ({
    code: s.marketCode,
    weight: MARKETS[s.marketCode].avgCPM.mid * (s.trendingScore / 100),
  }));
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);

  return signals.map(s => {
    const market = MARKETS[s.marketCode];
    const weight = weights.find(w => w.code === s.marketCode)!.weight;
    const budgetShare = totalWeight > 0 ? (weight / totalWeight) : (1 / signals.length);
    const recommendedBudget = Math.floor(maxTotalBudget * budgetShare);

    const priority: MarketAdPlan["priority"] =
      s.velocity === "EXPLODING" && market.avgCPM.mid > 8  ? "RUN_NOW" :
      s.trendingScore > 60 && recommendedBudget > 2        ? "RUN_NOW" :
      s.trendingScore > 40 && recommendedBudget > 1        ? "RUN_IF_BUDGET" : "SKIP";

    return {
      marketCode: s.marketCode,
      targetCPM: market.avgCPM.mid,
      estimatedReach: Math.round(recommendedBudget / market.avgCPM.mid * 1000),
      recommendedDailyBudget: recommendedBudget,
      targetingKeywords: s.topLocalKeywords,
      audienceAge: market.audienceTraits.includes("career-focused")
        ? ["AGE_RANGE_18_24", "AGE_RANGE_25_34"]
        : ["AGE_RANGE_25_34", "AGE_RANGE_35_44"],
      campaignType: s.velocity === "EXPLODING" ? "AWARENESS" : "GROWTH",
      priority,
      reasoning: `${market.name}: trend score ${s.trendingScore}, CPM $${market.avgCPM.mid}, budget $${recommendedBudget}/day`,
    };
  });
}

function suggestLanguageGroupAngles(language: string, markets: string[], topic: string): string[] {
  // Within same language — should markets share an angle or have variants?
  // Example: US + UK + AU all English — one video or three?
  if (language === "English") {
    const hasIndia = markets.includes("IN");
    const hasPremium = markets.some(m => ["US", "GB", "AU", "CA"].includes(m));
    if (hasIndia && hasPremium) {
      return [
        "Premium English (US/GB/AU/CA): comparison/opinion angle, higher production",
        "India English (IN): practical/career angle, relatable examples",
      ];
    }
    return ["Shared angle works — US/GB/AU/CA cultural overlap sufficient"];
  }
  if (language === "Spanish") {
    const hasES = markets.includes("ES");
    const hasLatAm = markets.some(m => ["MX", "BR", "AR", "CO"].includes(m));
    if (hasES && hasLatAm) {
      return [
        "Spain Spanish: intellectual/cultural tone",
        "LatAm Spanish: entertainment/relatable tone",
      ];
    }
  }
  return [`Single ${language} video serves all markets`];
}
```

---

## Sniper Integration into ARIA Pipeline

```typescript
// lib/sniper/index.ts — called by ARIA before evidence scoring

export async function runSniper(
  signalPacket: SignalPacket,
  channelMode: ChannelMode,
  accountBalance: number
): Promise<SniperAnalysis | null> {

  // Determine which markets to check
  const marketsToScan = determineMarketsToScan(signalPacket, channelMode);

  // Harvest geo signals for each market in parallel
  const geoSignals = await harvestGeoSignals(signalPacket.topic, marketsToScan);

  // Not trending enough in any market — skip SNIPER
  if (geoSignals.length === 0) return null;

  // Run analysis
  const analysis = analyseGeoSignals(
    signalPacket.topic,
    signalPacket.topicId,
    geoSignals,
    accountBalance
  );

  // Attach to signal packet for ARIA scoring
  signalPacket.geoStrategy = analysis;

  // Save to DynamoDB for Zeus + Regum to read
  await saveGeoStrategy(signalPacket.topicId, analysis);

  return analysis;
}

function determineMarketsToScan(
  packet: SignalPacket,
  mode: ChannelMode
): string[] {

  // Start with markets where Google Trends already showed regional interest
  const trendingRegions = packet.external.googleTrends.regional
    .map(r => regionToMarketCode(r.region))
    .filter(Boolean) as string[];

  // Always include the channel's home markets as baseline
  const homeMarkets = ["US", "GB", "IN", "AU", "CA"];

  // Add markets relevant to channel mode
  const modeMarkets = mode.type === "NICHE_LOCKED"
    ? getNicheRelevantMarkets(mode.niche)
    : [];

  // Deduplicate and limit to 10 markets max per scan
  return [...new Set([...trendingRegions, ...homeMarkets, ...modeMarkets])].slice(0, 10);
}

function regionToMarketCode(region: string): string | null {
  const map: Record<string, string> = {
    "United States": "US", "United Kingdom": "GB", "India": "IN",
    "Australia": "AU", "Canada": "CA", "Germany": "DE", "France": "FR",
    "Brazil": "BR", "Mexico": "MX", "Japan": "JP", "South Korea": "KR",
    "Nigeria": "NG", "Spain": "ES",
  };
  return map[region] ?? null;
}

function getNicheRelevantMarkets(niche: string): string[] {
  const nicheMarkets: Record<string, string[]> = {
    "f1 racing":       ["GB", "DE", "IT", "ES", "AU", "JP"],
    "cricket":         ["IN", "AU", "GB", "PK", "ZA", "NG"],
    "k-pop":           ["KR", "US", "ID", "TH", "PH"],
    "crypto":          ["US", "NG", "IN", "DE", "KR"],
    "bollywood":       ["IN", "PK", "AE", "GB"],
    "personal finance":["US", "GB", "AU", "IN", "CA"],
    "tech reviews":    ["US", "IN", "GB", "DE", "JP"],
  };

  const nicheLower = niche.toLowerCase();
  for (const [key, markets] of Object.entries(nicheMarkets)) {
    if (nicheLower.includes(key)) return markets;
  }
  return []; // no specific market bias for unknown niches
}
```

---

## What Zeus Receives from SNIPER

Zeus reads the `geoStrategy` from DynamoDB when deciding ad campaigns.
Instead of one worldwide campaign, Zeus creates market-specific campaigns.

```typescript
// lib/ads/zeus-sniper-integration.ts

export async function createSniperCampaigns(
  videoId: string,
  topicId: string,
  accountBalance: number
): Promise<void> {

  const geoStrategy = await getGeoStrategy(topicId);
  if (!geoStrategy) {
    // No geo strategy — fall back to default single worldwide campaign
    return createDefaultCampaign(videoId, accountBalance);
  }

  const maxBudget = accountBalance * 0.50; // 50% cap always
  let budgetUsed = 0;

  for (const adPlan of geoStrategy.adStrategy) {
    if (adPlan.priority === "SKIP") continue;
    if (adPlan.priority === "RUN_IF_BUDGET" && budgetUsed >= maxBudget * 0.7) continue;

    const market = MARKETS[adPlan.marketCode];
    const campaignBudget = Math.min(adPlan.recommendedDailyBudget, maxBudget - budgetUsed);
    if (campaignBudget < 1) break; // not enough left

    await createVideoAdCampaign({
      name: `RRQ_${videoId}_${adPlan.marketCode}`,
      videoId,
      dailyBudgetUSD: campaignBudget,
      biddingStrategy: "TARGET_CPV",
      targetCPVMicros: Math.round(market.avgCPM.low / 1000 * 1_000_000 * 0.8), // bid 80% of low CPM
      targeting: {
        keywords: adPlan.targetingKeywords,
        topics: [],
        demographics: { ageRanges: adPlan.audienceAge, genders: ["GENDER_MALE", "GENDER_FEMALE", "GENDER_UNDETERMINED"] },
        geoTargets: [adPlan.marketCode],    // geo-targeted campaign
      },
    });

    budgetUsed += campaignBudget;

    await zeus.writeLesson(
      `Campaign created: ${market.name} | Budget $${campaignBudget}/day | Est. reach ${adPlan.estimatedReach.toLocaleString()} views`
    );
  }
}
```

---

## What Regum Receives from SNIPER

Regum's `QeonBrief` now includes a `geoStrategy` section.

```typescript
// Added to QeonBrief in Regum's output:
geoStrategy: {
  primaryMarket: "US",          // produce main video for this market first
  sharedMarkets: ["GB", "AU"],  // same video works here — add subtitles/region tags
  separateVideos: [             // need distinct production
    {
      market: "IN",
      angle: "How Claude helps with study and career",
      language: "English",
      titleStyle: "Utility framing",
      uploadDelay: "24h",       // stagger uploads for algorithm health
    },
    {
      market: "DE",
      angle: "Claude — technische Analyse",
      language: "German",
      uploadDelay: "48h",
      note: "Qeon to use German TTS voice + German keyword metadata",
    },
  ],
  totalMarketsTargeted: 4,
  estimatedCombinedViews: 45000,
}
```

---

## Language Production in Qeon

For non-English markets, Qeon adapts production:

```typescript
// Plugs into Qeon's audio step (Step 5 in pipeline)

if (market.language !== "English") {
  // Option 1: Translate script + use ElevenLabs multilingual TTS
  // ElevenLabs supports: English, Spanish, French, German, Portuguese,
  //                      Italian, Polish, Hindi, Japanese, Korean, Arabic
  const translatedScript = await translateScript(script, market.languageCode);
  const audioFile = await elevenLabsTTS(translatedScript, {
    language: market.languageCode,
    voice: getVoiceForLanguage(market.languageCode),
  });

  // Option 2: English video with translated subtitles (faster, cheaper)
  // Use this when production timeline is tight
  const subtitles = await generateSubtitles(script, market.languageCode);
  // YouTube auto-handles subtitle display per viewer language preference
}

// For all markets: localised metadata
// Title, description, and tags in the target market's language
const localMetadata = await generateLocalMetadata(script, market);
```

---

## SNIPER Settings — User Controls

In Zeus Command Center Settings panel:

```
SNIPER — GEO-LINGUISTIC TARGETING

Markets to scan:
☑ United States (EN)   CPM $12 avg
☑ United Kingdom (EN)  CPM $10 avg
☑ India (EN)           CPM $1.5 avg
☑ Australia (EN)       CPM $11 avg
☑ Canada (EN)          CPM $10 avg
☐ Germany (DE)         CPM $13 avg   [add]
☐ Brazil (PT)          CPM $2.5 avg  [add]
☐ Japan (JA)           CPM $11 avg   [add]

Production mode:
○ Single video (geo-targeted ads only)
  One video, multiple campaigns targeting different markets.
  Best for: speed, low cost.

○ Multi-angle (separate videos per language group)
  Separate scripts/production per language group.
  Best for: maximum market fit, higher total views.

○ Full localisation (separate video per market)
  Unique angle, language, and production per market.
  Best for: established channels with production budget.

Language production:
○ English only + subtitles for other markets
○ Translate + dub major language markets (ES, PT, DE, FR, HI)
○ Full multilingual production

[Save SNIPER Settings]
```

---

## New DynamoDB Tables

```
geo-strategies    → SNIPER analysis per topic
  PK: topicId
  TTL: 7 days

market-performance → Zeus tracks per-market campaign results
  PK: marketCode + date
  tracks: views, subs, CTR, CPV, ad spend per market
  Zeus uses this weekly to recalibrate market priority scoring
```

---

## New Environment Variables

```bash
# No new keys needed — SNIPER reuses:
# SERPAPI_KEY         (Google Trends with geo param)
# TWITTER_BEARER_TOKEN (X trending per WOEID)
# NEWS_API_KEY        (with language filter)
# GOOGLE_ADS_*        (for geo-targeted campaigns)
```

---

## Checklist

```
[ ] Create lib/sniper/ folder with all 3 files (markets.ts, geo-harvest.ts, analyser.ts)
[ ] Create lib/sniper/index.ts — runSniper() integration point
[ ] Create lib/ads/zeus-sniper-integration.ts
[ ] Add geoStrategy field to SignalPacket type in data-harvest/types.ts
[ ] Add geoStrategy to QeonBrief type in Regum's output
[ ] Create geo-strategies and market-performance DynamoDB tables
[ ] Plug runSniper() into ARIA pipeline (between harvest and resolve)
[ ] Plug createSniperCampaigns() into Zeus post-upload workflow
[ ] Update Qeon Step 5 (audio) to handle multilingual TTS
[ ] Update Qeon SEO step to generate localised metadata per market
[ ] Add SNIPER panel to Zeus Command Center UI
[ ] Add SNIPER settings to Zeus Command Center Settings page
[ ] Test with a known multi-market topic (e.g. a major Apple product launch)
```


## Council Role — Geo Sign-Off

SNIPER speaks second in the On The Line council, immediately after Rex.

```
SNIPER's council statement covers:
  - Which markets are showing the strongest signal for this angle
  - CPM range in those markets
  - Any geo-specific framing that would strengthen the video
  - Whether the geo data supports the narrative window Rex called

SNIPER does NOT override Rex on timing.
SNIPER does NOT comment on production or editorial.
SNIPER speaks only from geo and market intelligence.
```

SNIPER's verdict feeds directly into the CouncilBrief
that Muse receives — the primaryGeo and geoFramingNote
fields come from SNIPER's council position.

SNIPER also validates RRQ Retro geo findings:
after a video completes its 7-day window, SNIPER
reviews whether the geo prediction matched reality
and calibrates market performance tables accordingly.

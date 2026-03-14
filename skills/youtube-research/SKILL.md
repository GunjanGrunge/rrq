---
name: youtube-research
description: >
  Deep research skill for YouTube content creation. Use this skill whenever
  a user wants to research a topic for a YouTube video, needs pros/cons
  analysis, wants to understand audience intent, needs key facts and data
  points, or wants a competitive content angle. Triggers on any mention of
  "research a topic", "what should I cover", "find facts about", "content
  brief", "video research", or any YouTube content planning request.
---

# YouTube Research Skill

## Purpose
Produce a structured, insight-rich research brief that becomes the foundation for every downstream step: script, SEO, thumbnail, and distribution. Good research prevents generic content and is the primary driver of watch time and subscriber growth.

## Model
Use **claude-opus-4** via AWS Bedrock (`anthropic.claude-opus-4-5`).
Research is the foundation of everything — weak research produces weak scripts, weak SEO, and weak hooks. Opus's deeper reasoning produces significantly better insight extraction, competitor gap analysis, and hook generation than Sonnet.
Enable prompt caching on the system prompt — this skill is called once per pipeline run and the context is identical across runs.

## Bedrock Call Pattern
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });
// Use IAM role auth — never hardcode credentials
```

---

## SNIPER Geo Context

**Read `skills/sniper/SKILL.md`** — when this research run is initiated
by SNIPER's MarketContentPlan, the research JSON receives a `geoContext`
field specifying which market this video targets. Research must incorporate
market-specific angles, examples, cultural references, and pricing data.

```typescript
// If geoContext is present in the research request:
if (request.geoContext) {
  // Adjust examples to be locally relevant
  // Weight sources from that market (local news, local pricing)
  // Note cultural sensitivities in controversialAngle
  // Use market-appropriate comparators in pros/cons
  researchOutput.geoContext = request.geoContext;
}
```

Without `geoContext`, research targets global English-speaking audience
(US primary, UK/AU secondary).

## Mission Beta Signal

During research, flag viral potential explicitly. Opus evaluates:
- Does this topic have mass-market crossover appeal?
- Is this something people would share outside the subscriber base?
- Does the hook create a reaction strong enough to drive shares?

```typescript
// Add to output contract:
viralPotential: {
  score: "LOW | MEDIUM | HIGH",
  reasoning: "string — why this might or might not break through",
  shareTrigger: "string — the specific emotion or reaction that drives sharing"
}
```

HIGH viral potential → passed to MUSE to select highest-performing format.
HIGH viral potential → flagged in platform-uploader as VIRAL_CANDIDATE for Jason.

---

## Research Process

### Step 1 — Decode User Intent
Before researching, understand what the user actually wants:
- What is the core question viewers are trying to answer?
- Is this a "how-to", "should I", "what is", "comparison", or "story" video?
- Who is the target viewer — beginner, intermediate, or expert?
- What emotion should they leave with: informed, inspired, warned, entertained?

This shapes everything. A beginner "what is X" video needs different research depth than an expert "X vs Y deep dive."

### Step 2 — Research Sources

**Read `skills/crawler-cloudflare/SKILL.md` before building this Lambda.**
The Cloudflare crawler is what upgrades snippets into full deep-read content.

**Layer 1 — Bedrock web search (always first):**
Run 3–5 targeted queries to get the best URLs and surface-level snippets.

```
Example queries for "Samsung Galaxy S25 Ultra vs iPhone 16 Pro Max":
  "Samsung Galaxy S25 Ultra full review 2025"
  "S25 Ultra vs iPhone 16 Pro Max camera test"
  "Galaxy S25 Ultra benchmark AnandTech"
```

**Layer 2 — Cloudflare Browser Rendering /crawl (immediately after Layer 1):**
Take the top 6 URLs returned from Bedrock search and fetch their FULL page
content as Markdown. This gives Opus the actual article body, spec tables,
and reviewer opinions — not just 2-sentence snippets.

```typescript
import { fetchPageAsMarkdown } from "@/lib/crawler";

const fullPages = await Promise.allSettled(
  topUrls.map(url => fetchPageAsMarkdown(url))
);
```

For comparison videos, also use `/json` endpoint to extract structured specs
directly from GSMArena, Notebookcheck, and manufacturer pages.
See crawler skill for per-niche crawl strategies.

**Layer 3 — Free APIs (run in parallel with Layer 2):**
```
Wikipedia API:  https://en.wikipedia.org/api/rest_v1/page/summary/{topic}
Reddit (JSON):  https://www.reddit.com/search.json?q={topic}&sort=top&limit=10
NewsAPI:        https://newsapi.org/v2/everything?q={topic}&pageSize=5
```

Extract from all sources:
- Key factual claims with recency
- Emotional angles (what gets upvoted, what angers/excites people)
- Frequently asked questions
- Contrarian or underexplored viewpoints

### Step 2b — Structured Comparative Data Fetching

When `videoType` is `comparison` OR the topic contains multiple subjects (products, people, events, companies) — fetch structured data for each subject with verified sources. Every data point must have a `sourceUrl` and `fetchedAt` timestamp. Never fabricate numbers.

**For product comparisons (phones, laptops, cars, appliances):**
```
Fetch from manufacturer official pages via web search + fetch
Fetch benchmark scores from: GSMArena, Notebookcheck, AnandTech, CarWow
Fetch current prices from: Amazon, official store
```

**For personality/people comparisons:**
```
Wikipedia API per person → biography, key facts, dates
Google Knowledge Graph → role, organisation, image
Fetch recent news → NewsAPI with person name as query
```

**For news/events:**
```
NewsAPI → fetch 5+ sources per event
Wikipedia API → background context
Fetch primary source URLs directly for quotes
Build chronological timeline of key dates
```

**For finance/markets:**
```
Yahoo Finance API (free): https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
CoinGecko API (crypto, free): https://api.coingecko.com/api/v3/coins/{id}
World Bank API (macro data): https://api.worldbank.org/v2/country/{code}/indicator/{id}
```

**For sports:**
```
Free sports APIs: api-football.com free tier, TheSportsDB
ESPN public endpoints for scores and stats
```

All fetched data stored in `comparativeData` array with full source attribution. This feeds directly into `visualAssets` in the script writer.

**Structured data output per subject:**
```json
{
  "subject": "MacBook Neo",
  "attributes": [
    {
      "key": "Price",
      "value": "$1,299",
      "sourceUrl": "https://apple.com/shop/buy-mac/macbook",
      "fetchedAt": "2025-03-12T10:00:00Z"
    },
    {
      "key": "Chip",
      "value": "Apple M4",
      "sourceUrl": "https://apple.com/macbook-neo/specs",
      "fetchedAt": "2025-03-12T10:00:00Z"
    }
  ]
}
```

### Step 3 — Synthesise with Opus
Pass all raw research AND structured comparative data to Claude Opus for synthesis.

---

## Output Contract

Return a single JSON object. Every downstream skill depends on this exact shape — do not add or remove top-level keys.

```json
{
  "topic": "string — cleaned, canonical topic name",
  "videoType": "howto | comparison | explainer | story | opinion | list",
  "targetAudience": "string — specific description, not just 'general audience'",
  "summary": "string — 2-3 sentences, the core insight a viewer should leave with",

  "hook": "string — single sentence, the most surprising or provocative angle. Must make someone stop scrolling.",

  "keyFacts": [
    { "fact": "string", "source": "string", "recency": "recent | evergreen" }
  ],

  "pros": [
    { "point": "string — short label", "detail": "string — 1-2 sentence expansion" }
  ],
  "cons": [
    { "point": "string — short label", "detail": "string — 1-2 sentence expansion" }
  ],

  "commonMisconceptions": ["string"],

  "controversialAngle": "string — a take that challenges conventional wisdom. Drives comments.",

  "reEngagementMoments": [
    "string — a mid-video revelation or twist that justifies watching past the 50% mark"
  ],

  "seoTitles": [
    {
      "title": "string",
      "formula": "curiosity-gap | number-list | how-to | vs-comparison | warning",
      "estimatedCTR": "high | medium | low"
    }
  ],

  "keywords": {
    "primary": ["string"],
    "secondary": ["string"],
    "longTail": ["string — full question phrases people search"]
  },

  "thumbnailConcept": {
    "emotion": "string — the face/feeling the thumbnail should convey",
    "textOverlay": "string — max 4 words",
    "visualIdea": "string — concrete description of imagery",
    "colorScheme": "string — e.g. 'high contrast red and black'"
  },

  "competitorGap": "string — what existing top videos on this topic are missing that we can own",

  "comparativeData": [
    {
      "subject": "string — product name, person name, event name",
      "subjectType": "product | person | event | company | place",
      "imageUrl": "string — verified image URL (Wikipedia Commons, Unsplash, official press)",
      "attributes": [
        {
          "key": "string — attribute label",
          "value": "string — attribute value",
          "unit": "string — optional unit e.g. kg, hrs, $",
          "winner": "boolean — true if this subject wins this attribute",
          "sourceUrl": "string — verified source URL",
          "fetchedAt": "string — ISO timestamp"
        }
      ]
    }
  ],

  "timeline": [
    {
      "date": "string — ISO date or readable e.g. 'March 2024'",
      "event": "string — what happened",
      "significance": "string — why it matters to the viewer",
      "sourceUrl": "string"
    }
  ],

  "citations": [
    {
      "id": "string — ref-1, ref-2 etc",
      "title": "string — page or article title",
      "url": "string",
      "fetchedAt": "string — ISO timestamp"
    }
  ],

  "viralPotential": {
    "score": "LOW | MEDIUM | HIGH",
    "reasoning": "string — why this might or might not break through",
    "shareTrigger": "string — the specific emotion or reaction that drives sharing"
  },

  "geoContext": "string | null — market code if SNIPER-initiated e.g. 'IN', 'DE'"
}
```

---

## Quality Standards

The research output is good when:
- The hook would make a curious person stop scrolling on their phone
- The pros/cons are genuinely balanced, not promotional
- The keywords include at least 3 long-tail phrases (full questions)
- The controversial angle is defensible, not just clickbait
- The competitor gap is specific and actionable

If any of these feel generic or templated, regenerate that section with more specificity before returning.

---

## Example

**Input:** `{ "topic": "intermittent fasting", "duration": 8, "tone": "informative" }`

**Good hook:** `"Most people doing intermittent fasting are accidentally eating at the worst possible times for their body type."`

**Bad hook (too generic):** `"Intermittent fasting has many benefits you should know about."`

The difference is specificity + implicit promise of a payoff.

---

## References
- See `references/youtube-algorithm.md` for how research topics map to watch-time signals
- See `references/audience-psychology.md` for hook formulas by video type

---
name: crawler-cloudflare
description: >
  Deep web crawling using Cloudflare Browser Rendering /crawl endpoint (open
  beta, released March 2025). Use this skill whenever the research step needs
  to read full page content from specific URLs — product spec pages, review
  sites, news articles, Wikipedia sections, official documentation, or any
  source where snippets are not enough. This replaces Puppeteer for content
  fetching. Do NOT use for visual asset rendering (that is still Puppeteer Lambda).
  Triggers on: "crawl a site", "read the full page", "fetch the specs",
  "scrape the review", "deep research", or whenever research URLs need full
  content extraction beyond what web search snippets provide.
---

# Cloudflare Browser Rendering Crawler

## What This Is

Cloudflare's `/crawl` endpoint (open beta, March 2025) crawls entire websites
with a single API call. Submit a URL, get back full page content in Markdown,
HTML, or structured JSON. Pages are rendered in a real headless browser —
JavaScript executes, dynamic content loads. No Puppeteer setup, no browser
management, no infrastructure to run.

This is how RRQ goes from "web search snippet" to "full article read."

---

## Where This Fits in the Pipeline

```
Step 1 — Research:

  Bedrock web search  →  returns top URLs + snippets (surface level)
         ↓
  Cloudflare /crawl   →  fetches full content of top 5-8 URLs (deep level)
         ↓
  Opus synthesis      →  writes research brief from FULL content, not snippets
```

Without the crawler, Opus is writing from 2-3 sentence snippets.
With the crawler, Opus is reading complete articles, spec sheets, and reviews.

---

## Setup

Add to environment variables:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_BROWSER_RENDERING_TOKEN=   # API token with Browser Rendering - Edit permission
```

Create the Cloudflare API token:
1. Cloudflare dashboard → My Profile → API Tokens → Create Token
2. Use "Edit Cloudflare Workers" template OR custom token
3. Permission: Browser Rendering - Edit
4. Save token as `CLOUDFLARE_BROWSER_RENDERING_TOKEN`

---

## API Endpoints

```
Base URL: https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering

POST /crawl          — Start a crawl job, returns job ID
GET  /crawl/{jobId}  — Poll for results
DEL  /crawl/{jobId}  — Cancel a running job

Single page (no crawling, instant):
POST /markdown       — Get single page as Markdown
POST /json           — Extract structured data from single page
POST /content        — Get raw HTML from single page
```

---

## Core Implementation

### lib/crawler.ts

```typescript
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering`;

const CF_HEADERS = {
  "Authorization": `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── SINGLE PAGE: instant markdown fetch (no crawl job needed) ───────────────

export async function fetchPageAsMarkdown(url: string): Promise<string> {
  const response = await fetch(`${CF_BASE}/markdown`, {
    method: "POST",
    headers: CF_HEADERS,
    body: JSON.stringify({
      url,
      rejectResourceTypes: ["image", "media", "font", "stylesheet"],
    }),
  });

  if (!response.ok) throw new Error(`Cloudflare fetch failed: ${response.status}`);
  const data = await response.json();
  return data.result?.markdown ?? "";
}

// ─── SINGLE PAGE: extract structured JSON with AI ───────────────────────────

export async function fetchPageAsJSON<T>(
  url: string,
  prompt: string,
  schema: object
): Promise<T | null> {
  const response = await fetch(`${CF_BASE}/json`, {
    method: "POST",
    headers: CF_HEADERS,
    body: JSON.stringify({
      url,
      prompt,
      response_format: {
        type: "json_schema",
        json_schema: { name: "extract", properties: schema },
      },
      rejectResourceTypes: ["image", "media", "font", "stylesheet"],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.result?.data ?? null;
}

// ─── MULTI-PAGE CRAWL: async job with polling ────────────────────────────────

export interface CrawlRecord {
  url: string;
  status: "completed" | "errored" | "disallowed" | "skipped";
  markdown?: string;
  metadata?: { title: string; status: number; url: string };
}

export interface CrawlOptions {
  limit?: number;            // max pages (default 10, max 100,000)
  depth?: number;            // max link depth (default 2 for research)
  formats?: ("markdown" | "html" | "json")[];
  render?: boolean;          // false = fast static fetch, true = full JS render
  includePatterns?: string[];
  excludePatterns?: string[];
  rejectResourceTypes?: string[];
  modifiedSince?: number;    // unix timestamp — only crawl pages newer than this
}

export async function startCrawl(url: string, options: CrawlOptions = {}): Promise<string> {
  const response = await fetch(`${CF_BASE}/crawl`, {
    method: "POST",
    headers: CF_HEADERS,
    body: JSON.stringify({
      url,
      limit: options.limit ?? 10,
      depth: options.depth ?? 2,
      formats: options.formats ?? ["markdown"],
      render: options.render ?? true,
      rejectResourceTypes: options.rejectResourceTypes ?? ["image", "media", "font", "stylesheet"],
      ...(options.includePatterns && { options: { includePatterns: options.includePatterns } }),
      ...(options.excludePatterns && { options: { excludePatterns: options.excludePatterns } }),
      ...(options.modifiedSince && { modifiedSince: options.modifiedSince }),
    }),
  });

  if (!response.ok) throw new Error(`Crawl start failed: ${response.status}`);
  const data = await response.json();
  return data.result; // job ID string
}

export async function pollCrawl(jobId: string, timeoutMs = 60_000): Promise<CrawlRecord[]> {
  const start = Date.now();
  const pollInterval = 3_000;

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const response = await fetch(`${CF_BASE}/crawl/${jobId}?limit=1`, {
      headers: { "Authorization": `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}` },
    });

    const data = await response.json();
    const status = data.result?.status;

    if (status !== "running") break;
  }

  // Fetch full results
  const response = await fetch(`${CF_BASE}/crawl/${jobId}`, {
    headers: { "Authorization": `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}` },
  });

  const data = await response.json();
  return data.result?.records ?? [];
}

export async function cancelCrawl(jobId: string): Promise<void> {
  await fetch(`${CF_BASE}/crawl/${jobId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}` },
  });
}
```

---

## How to Use in the Research Step

### Pattern 1 — Fetch top search result URLs as Markdown (most common)

After Bedrock web search returns URLs, fetch full content in parallel:

```typescript
// research Lambda — after getting search results
import { fetchPageAsMarkdown } from "@/lib/crawler";

const searchResults = await bedrockWebSearch(topic); // returns [{url, snippet}]

// Take top 6 most relevant URLs — skip social media and paywalled sites
const urlsToFetch = searchResults
  .filter(r => !r.url.includes("twitter.com") && !r.url.includes("reddit.com"))
  .slice(0, 6)
  .map(r => r.url);

// Fetch all in parallel — Cloudflare handles the browser instances
const fullPages = await Promise.allSettled(
  urlsToFetch.map(url => fetchPageAsMarkdown(url))
);

// Collect successful fetches
const pageContents = fullPages
  .map((result, i) => ({
    url: urlsToFetch[i],
    content: result.status === "fulfilled" ? result.value : null,
  }))
  .filter(p => p.content && p.content.length > 200);
```

### Pattern 2 — Extract structured specs from product pages

For comparison videos (phone vs phone, laptop vs laptop):

```typescript
import { fetchPageAsJSON } from "@/lib/crawler";

const s25Specs = await fetchPageAsJSON(
  "https://www.gsmarena.com/samsung_galaxy_s25_ultra-12771.php",
  "Extract all technical specifications: display, camera, battery, processor, dimensions, price",
  {
    display: "string",
    mainCamera: "string",
    battery: "string",
    processor: "string",
    ram: "string",
    storage: "string",
    price: "string",
  }
);
```

### Pattern 3 — Crawl a review site section

For deep research on a topic, crawl 5-10 pages from a trusted source:

```typescript
import { startCrawl, pollCrawl } from "@/lib/crawler";

// Crawl only review pages, not navigation/footer/etc
const jobId = await startCrawl("https://www.notebookcheck.net/", {
  limit: 5,
  depth: 1,
  formats: ["markdown"],
  render: false,            // static content — much faster
  includePatterns: ["**/reviews/**"],
  excludePatterns: ["**/archive/**", "**/tag/**"],
});

const records = await pollCrawl(jobId, 45_000);
const reviewContent = records
  .filter(r => r.status === "completed" && r.markdown)
  .map(r => `### ${r.metadata?.title}\n${r.markdown}`)
  .join("\n\n---\n\n");
```

---

## Research Step Integration — Full Flow

```typescript
// lambdas/research/index.ts
import { fetchPageAsMarkdown, fetchPageAsJSON } from "@/lib/crawler";

export async function runResearch(topic: string, videoType: string) {

  // Step 1: Bedrock web search — get URLs + snippets
  const searchResults = await bedrockWebSearch(topic, 8);

  // Step 2: Cloudflare crawl — fetch full content of top results
  const urlsToRead = pickBestUrls(searchResults, videoType);
  const fullPageContents = await fetchPagesInParallel(urlsToRead);

  // Step 3: For comparison videos — also fetch structured specs per subject
  let comparativeData = [];
  if (videoType === "comparison") {
    const subjects = extractSubjects(topic); // ["iPhone 16 Pro", "Samsung S25 Ultra"]
    comparativeData = await Promise.all(
      subjects.map(subject => fetchStructuredSpecs(subject))
    );
  }

  // Step 4: Reddit + NewsAPI for emotional angles and audience questions
  const [redditPosts, newsArticles] = await Promise.all([
    fetchReddit(topic),
    fetchNewsAPI(topic),
  ]);

  // Step 5: Opus synthesis — now has FULL page content, not snippets
  const researchBrief = await synthesiseWithOpus({
    topic,
    videoType,
    fullPageContents,      // ← this is the game changer vs just snippets
    comparativeData,
    redditPosts,
    newsArticles,
    searchSnippets: searchResults,
  });

  return researchBrief;
}

async function fetchPagesInParallel(urls: string[]) {
  const results = await Promise.allSettled(
    urls.map(url => fetchPageAsMarkdown(url))
  );
  return results
    .map((r, i) => ({
      url: urls[i],
      content: r.status === "fulfilled" ? r.value : "",
    }))
    .filter(p => p.content.length > 300);
}

function pickBestUrls(searchResults: SearchResult[], videoType: string): string[] {
  // Priority sources by video type
  const priorityDomains: Record<string, string[]> = {
    comparison: ["gsmarena.com", "notebookcheck.net", "anandtech.com", "carwow.co.uk"],
    howto:      ["wikihow.com", "reddit.com/r/", "medium.com"],
    finance:    ["investopedia.com", "reuters.com", "bloomberg.com"],
    news:       ["bbc.com", "reuters.com", "apnews.com", "guardian.com"],
    explainer:  ["wikipedia.org", "britannica.com", "howstuffworks.com"],
  };

  const preferred = priorityDomains[videoType] ?? [];

  // Sort: preferred domains first, then everything else
  // Exclude: social media paywalls, low-quality aggregators
  const excluded = ["twitter.com", "instagram.com", "tiktok.com", "pinterest.com"];

  return searchResults
    .filter(r => !excluded.some(d => r.url.includes(d)))
    .sort((a, b) => {
      const aPreferred = preferred.some(d => a.url.includes(d)) ? -1 : 1;
      const bPreferred = preferred.some(d => b.url.includes(d)) ? -1 : 1;
      return aPreferred - bPreferred;
    })
    .slice(0, 6)
    .map(r => r.url);
}
```

---

## Topic-Specific Crawl Strategies

### Tech / Product Review (phones, laptops, cars)
```typescript
// GSMArena for phones — structured specs
fetchPageAsJSON(gsmarenaUrl, "Extract full specs", phoneSchema)

// Notebookcheck for laptops — fetch markdown of review section
fetchPageAsMarkdown(notebookcheckUrl)

// Official manufacturer page — structured pricing + features
fetchPageAsJSON(manufacturerUrl, "Extract pricing, storage options, colours", productSchema)
```

### Finance / Crypto
```typescript
// Yahoo Finance — static HTML, render: false is faster
startCrawl("https://finance.yahoo.com/quote/" + symbol, { render: false, limit: 3 })

// Investopedia for context articles — markdown
fetchPageAsMarkdown(investopediaArticleUrl)
```

### News / Events
```typescript
// Crawl 3-5 news sources for the same story — compare angles
const urls = await bedrockWebSearch(topic + " news today");
await Promise.all(urls.slice(0,5).map(u => fetchPageAsMarkdown(u.url)))
```

### People / Personalities
```typescript
// Wikipedia full article — get the real content, not just summary API
fetchPageAsMarkdown(`https://en.wikipedia.org/wiki/${personName.replace(" ", "_")}`)

// Their official site or IMDB if relevant
fetchPageAsMarkdown(officialSiteUrl)
```

### Health / Science
```typescript
// PubMed abstract pages
fetchPageAsMarkdown(pubmedUrl)

// Healthline or Mayo Clinic for lay explanations
fetchPageAsMarkdown(healthlineUrl)
```

---

## Render Mode Decision

```
render: true  (default) — Full headless browser, executes JavaScript
  Use for: SPAs, React/Vue sites, pages that load content dynamically
  Cost: browser time (paid plan)
  Speed: slower (~3-8s per page)
  Example: most modern review sites, YouTube pages, Reddit

render: false — Fast static HTML fetch, no browser
  Use for: Wikipedia, news articles, blogs, static docs
  Cost: free during beta, Workers pricing after
  Speed: very fast (~0.3-1s per page)
  Example: Wikipedia, BBC, most newspapers
```

Rule of thumb: start with `render: false`. If content comes back empty or minimal, retry with `render: true`.

---

## Cost and Limits

```
Workers Free plan:
  10 minutes browser time / day
  Good for: 50-100 single-page fetches OR 3-5 small crawls
  render: false fetches = free during beta

Workers Paid plan ($5/month base):
  3,000 minutes browser time / month
  Good for: 1,800+ page fetches
  At ~$0.001-0.003/page render time

For RRQ at 100 videos/month:
  ~600 page fetches (6 per video)
  Estimated cost: ~$0.60-1.80/month
  Well within Workers Paid plan
```

---

## Error Handling

```typescript
async function safeFetchPage(url: string): Promise<string> {
  try {
    // Try fast static fetch first
    const markdown = await fetchPageAsMarkdown(url);
    if (markdown.length > 300) return markdown;

    // If too short, page might be JS-rendered — would need crawl with render: true
    // For now return what we have — Opus handles sparse content gracefully
    return markdown;
  } catch (error) {
    console.warn(`Cloudflare fetch failed for ${url}:`, error);
    return ""; // fail silently — research continues with other sources
  }
}
```

Key rule: **crawler failures never block the research step.** If Cloudflare
returns an error or a page is disallowed by robots.txt, the research continues
with web search snippets + free API data. The crawler is an enhancement, not
a dependency.

---

## Adding to CLAUDE.md Environment Variables

```bash
# Cloudflare Browser Rendering (crawler)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_BROWSER_RENDERING_TOKEN=   # API token — Browser Rendering Edit permission
```

---

## Files to Create

```
lib/crawler.ts          ← core crawler functions (fetchPageAsMarkdown, fetchPageAsJSON,
                           startCrawl, pollCrawl, cancelCrawl)
lambdas/research/
  crawler-utils.ts      ← pickBestUrls(), fetchPagesInParallel(), fetchStructuredSpecs()
  index.ts              ← updated to call crawler between search and Opus synthesis
```

---

## Checklist

```
[ ] Create Cloudflare account (free tier is enough to start)
[ ] Create API token with Browser Rendering - Edit permission
[ ] Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_BROWSER_RENDERING_TOKEN to env
[ ] Create lib/crawler.ts with all 5 core functions
[ ] Update research Lambda to call fetchPagesInParallel after web search
[ ] Update comparison research to use fetchPageAsJSON for spec sheets
[ ] Add error handling — crawler failures must never block research
[ ] Test with a comparison video topic end to end
[ ] Upgrade Cloudflare to Workers Paid ($5/mo) before production launch
```

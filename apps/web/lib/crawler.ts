// ─── Cloudflare Browser Rendering Crawler ───────────────────────────────────
// See skills/crawler-cloudflare/SKILL.md for full documentation.
// Crawler failures NEVER block research — they are enhancements, not dependencies.

const CF_BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering`;

const CF_HEADERS = () => ({
  Authorization: `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}`,
  "Content-Type": "application/json",
});

// ─── Single Page: instant markdown fetch ────────────────────────────────────

export async function fetchPageAsMarkdown(url: string): Promise<string> {
  const response = await fetch(`${CF_BASE()}/markdown`, {
    method: "POST",
    headers: CF_HEADERS(),
    body: JSON.stringify({
      url,
      rejectResourceTypes: ["image", "media", "font", "stylesheet"],
    }),
  });

  if (!response.ok) throw new Error(`Cloudflare fetch failed: ${response.status}`);
  const data = await response.json();
  return (data as { result?: { markdown?: string } }).result?.markdown ?? "";
}

// ─── Single Page: extract structured JSON ───────────────────────────────────

export async function fetchPageAsJSON<T>(
  url: string,
  prompt: string,
  schema: object
): Promise<T | null> {
  const response = await fetch(`${CF_BASE()}/json`, {
    method: "POST",
    headers: CF_HEADERS(),
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
  return ((data as { result?: { data?: T } }).result?.data as T) ?? null;
}

// ─── Multi-page crawl: async job with polling ───────────────────────────────

export interface CrawlRecord {
  url: string;
  status: "completed" | "errored" | "disallowed" | "skipped";
  markdown?: string;
  metadata?: { title: string; status: number; url: string };
}

export interface CrawlOptions {
  limit?: number;
  depth?: number;
  formats?: ("markdown" | "html" | "json")[];
  render?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  rejectResourceTypes?: string[];
}

export async function startCrawl(
  url: string,
  options: CrawlOptions = {}
): Promise<string> {
  const response = await fetch(`${CF_BASE()}/crawl`, {
    method: "POST",
    headers: CF_HEADERS(),
    body: JSON.stringify({
      url,
      limit: options.limit ?? 10,
      depth: options.depth ?? 2,
      formats: options.formats ?? ["markdown"],
      render: options.render ?? true,
      rejectResourceTypes:
        options.rejectResourceTypes ?? ["image", "media", "font", "stylesheet"],
      ...(options.includePatterns && {
        options: { includePatterns: options.includePatterns },
      }),
      ...(options.excludePatterns && {
        options: { excludePatterns: options.excludePatterns },
      }),
    }),
  });

  if (!response.ok)
    throw new Error(`Crawl start failed: ${response.status}`);
  const data = await response.json();
  return (data as { result: string }).result;
}

export async function pollCrawl(
  jobId: string,
  timeoutMs = 60_000
): Promise<CrawlRecord[]> {
  const start = Date.now();
  const pollInterval = 3_000;

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const response = await fetch(`${CF_BASE()}/crawl/${jobId}?limit=1`, {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}`,
      },
    });

    const data = await response.json();
    const status = (data as { result?: { status?: string } }).result?.status;
    if (status !== "running") break;
  }

  const response = await fetch(`${CF_BASE()}/crawl/${jobId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}`,
    },
  });

  const data = await response.json();
  return (
    (data as { result?: { records?: CrawlRecord[] } }).result?.records ?? []
  );
}

export async function cancelCrawl(jobId: string): Promise<void> {
  await fetch(`${CF_BASE()}/crawl/${jobId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN}`,
    },
  });
}

// ─── Safe fetch (never throws — research continues on failure) ──────────────

export async function safeFetchPage(url: string): Promise<string> {
  try {
    const markdown = await fetchPageAsMarkdown(url);
    return markdown.length > 300 ? markdown : markdown;
  } catch (error) {
    console.warn(`Cloudflare fetch failed for ${url}:`, error);
    return "";
  }
}

// ─── Fetch multiple pages in parallel ───────────────────────────────────────

export async function fetchPagesInParallel(
  urls: string[]
): Promise<Array<{ url: string; content: string }>> {
  const results = await Promise.allSettled(
    urls.map((url) => safeFetchPage(url))
  );

  return results
    .map((r, i) => ({
      url: urls[i],
      content: r.status === "fulfilled" ? r.value : "",
    }))
    .filter((p) => p.content.length > 300);
}

// ─── URL filtering for research ─────────────────────────────────────────────

const EXCLUDED_DOMAINS = [
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
];

const PRIORITY_DOMAINS: Record<string, string[]> = {
  comparison: [
    "gsmarena.com",
    "notebookcheck.net",
    "anandtech.com",
    "carwow.co.uk",
  ],
  howto: ["wikihow.com", "reddit.com/r/", "medium.com"],
  finance: ["investopedia.com", "reuters.com", "bloomberg.com"],
  news: ["bbc.com", "reuters.com", "apnews.com", "guardian.com"],
  explainer: ["wikipedia.org", "britannica.com", "howstuffworks.com"],
};

export function pickBestUrls(
  searchResults: Array<{ url: string }>,
  videoType: string,
  limit = 6
): string[] {
  const preferred = PRIORITY_DOMAINS[videoType] ?? [];

  return searchResults
    .filter((r) => !EXCLUDED_DOMAINS.some((d) => r.url.includes(d)))
    .sort((a, b) => {
      const aP = preferred.some((d) => a.url.includes(d)) ? -1 : 1;
      const bP = preferred.some((d) => b.url.includes(d)) ? -1 : 1;
      return aP - bP;
    })
    .slice(0, limit)
    .map((r) => r.url);
}

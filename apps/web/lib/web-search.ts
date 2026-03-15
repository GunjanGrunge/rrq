/**
 * Web search utility for pipeline agents.
 *
 * Primary:  SerpAPI (Google Search) — set SERPAPI_KEY in .env.local
 * Fallback: Brave Search API        — set BRAVE_SEARCH_API_KEY in .env.local
 * Falls back silently to empty array when neither key is present.
 *
 * SerpAPI docs: https://serpapi.com/search-api
 * Brave docs:   https://api.search.brave.com/res/v1/web/search
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string; // e.g. "2 days ago", "March 2026"
}

// ─── SerpAPI (Google Search) ──────────────────────────────────────────────────

async function searchViaSerpApi(
  query: string,
  count: number
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(count));
    url.searchParams.set("tbs", "qdr:m"); // past month — recent results first
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      organic_results?: Array<{
        title: string;
        link: string;
        snippet?: string;
        date?: string;
      }>;
    };

    return (data.organic_results ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      description: r.snippet ?? "",
      age: r.date,
    }));
  } catch {
    return [];
  }
}

// ─── Brave Search (fallback) ──────────────────────────────────────────────────

async function searchViaBrave(
  query: string,
  count: number
): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));
    url.searchParams.set("freshness", "pm"); // past month

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      web?: {
        results?: Array<{
          title: string;
          url: string;
          description?: string;
          age?: string;
        }>;
      };
    };

    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? "",
      age: r.age,
    }));
  } catch {
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function webSearch(
  query: string,
  count = 8
): Promise<SearchResult[]> {
  // Run both in parallel — deduplicate by URL, SerpAPI results listed first
  const [serpResults, braveResults] = await Promise.all([
    searchViaSerpApi(query, count),
    searchViaBrave(query, count),
  ]);

  if (serpResults.length === 0 && braveResults.length === 0) return [];

  // Deduplicate: keep first occurrence of each URL
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...serpResults, ...braveResults]) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      merged.push(r);
    }
  }

  return merged.slice(0, count);
}

/**
 * Format search results into a compact string for injection into a prompt.
 */
export function formatSearchResults(
  results: SearchResult[],
  label: string
): string {
  if (results.length === 0) return "";
  const lines = results.map(
    (r, i) =>
      `[${i + 1}] ${r.title}${r.age ? ` (${r.age})` : ""}\n${r.description}\nURL: ${r.url}`
  );
  return `### ${label}\n${lines.join("\n\n")}`;
}

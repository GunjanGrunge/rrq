export interface RawSignal {
  id: string;
  topic: string;
  source: string;
  sourceUrl: string;
  tier: 1 | 2 | 3 | 4;
  publishedAt?: string;
  velocity?: number; // upvote velocity or engagement score
  metadata: Record<string, unknown>;
}

const SOURCE_TIERS: Record<string, 1 | 2 | 3 | 4> = {
  "reuters.com": 1, "apnews.com": 1, "bbc.com": 1, "nasa.gov": 1, "who.int": 1,
  "nytimes.com": 2, "theguardian.com": 2, "wsj.com": 2, "nature.com": 2,
  "techcrunch.com": 3, "theverge.com": 3, "espn.com": 3, "variety.com": 3,
  "reddit.com": 4, "twitter.com": 4, "youtube.com": 4,
};

export function getSourceTier(url: string): 1 | 2 | 3 | 4 {
  for (const [domain, tier] of Object.entries(SOURCE_TIERS)) {
    if (url.includes(domain)) return tier;
  }
  return 4;
}

export async function fetchGoogleTrends(): Promise<RawSignal[]> {
  try {
    const res = await fetch(
      "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    // Parse RSS — extract <title> items
    const matches = xml.match(/<title>(?!Google Trends)([^<]+)<\/title>/g) ?? [];
    return matches.slice(0, 20).map((m, i) => {
      const topic = m.replace(/<\/?title>/g, "").trim();
      return {
        id: `gt-${i}-${Date.now()}`,
        topic,
        source: "google_trends",
        sourceUrl: "https://trends.google.com",
        tier: 3 as const,
        publishedAt: new Date().toISOString(),
        velocity: 0.8,
        metadata: {},
      };
    });
  } catch {
    return [];
  }
}

export async function fetchRedditRising(): Promise<RawSignal[]> {
  try {
    const res = await fetch(
      "https://www.reddit.com/r/worldnews+technology+science+sports/rising.json?limit=25",
      {
        headers: { "User-Agent": "RRQ-Rex-Agent/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: {
        children?: Array<{
          data: { title: string; score: number; url: string; created_utc: number };
        }>;
      };
    };
    return (data?.data?.children ?? []).map((item, i) => ({
      id: `reddit-${i}-${Date.now()}`,
      topic: item.data.title,
      source: "reddit_rising",
      sourceUrl: item.data.url,
      tier: 4 as const,
      publishedAt: new Date(item.data.created_utc * 1000).toISOString(),
      velocity: Math.min(item.data.score / 1000, 1.0),
      metadata: { score: item.data.score },
    }));
  } catch {
    return [];
  }
}

export async function fetchNewsAPI(): Promise<RawSignal[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=20&apiKey=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      articles?: Array<{
        title: string;
        url: string;
        publishedAt: string;
        source: { name: string };
      }>;
    };
    return (data?.articles ?? []).map((article, i) => ({
      id: `news-${i}-${Date.now()}`,
      topic: article.title,
      source: "news_api",
      sourceUrl: article.url,
      tier: getSourceTier(article.url),
      publishedAt: article.publishedAt,
      velocity: 0.7,
      metadata: { sourceName: article.source.name },
    }));
  } catch {
    return [];
  }
}

export async function fetchYouTubeTrending(): Promise<RawSignal[]> {
  const key = process.env.YOUTUBE_API_KEY ?? process.env.YOUTUBE_CLIENT_ID;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=20&key=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      items?: Array<{
        snippet: { title: string; publishedAt: string };
        statistics: { viewCount: string };
      }>;
    };
    return (data?.items ?? []).map((item, i) => ({
      id: `yt-${i}-${Date.now()}`,
      topic: item.snippet.title,
      source: "youtube_trending",
      sourceUrl: "https://youtube.com",
      tier: 4 as const,
      publishedAt: item.snippet.publishedAt,
      velocity: Math.min(parseInt(item.statistics.viewCount) / 1_000_000, 1.0),
      metadata: { viewCount: item.statistics.viewCount },
    }));
  } catch {
    return [];
  }
}

export async function fetchHackerNews(): Promise<RawSignal[]> {
  try {
    const idsRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!idsRes.ok) return [];
    const ids = (await idsRes.json() as number[]).slice(0, 15);

    const items = await Promise.allSettled(
      ids.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: AbortSignal.timeout(3000),
        }).then(r => r.json() as Promise<{ title: string; url?: string; score: number; time: number }>)
      )
    );

    return items
      .filter(
        (r): r is PromiseFulfilledResult<{ title: string; url?: string; score: number; time: number }> =>
          r.status === "fulfilled"
      )
      .map((r, i) => ({
        id: `hn-${i}-${Date.now()}`,
        topic: r.value.title,
        source: "hacker_news",
        sourceUrl: r.value.url ?? "https://news.ycombinator.com",
        tier: (getSourceTier(r.value.url ?? "") ?? 3) as 1 | 2 | 3 | 4,
        publishedAt: new Date(r.value.time * 1000).toISOString(),
        velocity: Math.min(r.value.score / 500, 1.0),
        metadata: { score: r.value.score },
      }));
  } catch {
    return [];
  }
}

export async function fetchTwitterTrending(): Promise<RawSignal[]> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      "https://api.twitter.com/2/trends/by/woeid/1",
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      trends?: Array<{ name: string; tweet_volume?: number }>;
    }>;
    const trends = data[0]?.trends ?? [];
    return trends.slice(0, 20).map((t, i) => ({
      id: `tw-${i}-${Date.now()}`,
      topic: t.name,
      source: "twitter_trending",
      sourceUrl: "https://twitter.com",
      tier: 4 as const,
      publishedAt: new Date().toISOString(),
      velocity: t.tweet_volume ? Math.min(t.tweet_volume / 100_000, 1.0) : 0.5,
      metadata: { tweetVolume: t.tweet_volume },
    }));
  } catch {
    return [];
  }
}

export async function fetchAllSignals(): Promise<RawSignal[]> {
  const results = await Promise.allSettled([
    fetchGoogleTrends(),
    fetchRedditRising(),
    fetchNewsAPI(),
    fetchYouTubeTrending(),
    fetchHackerNews(),
    fetchTwitterTrending(),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<RawSignal[]> => r.status === "fulfilled")
    .flatMap(r => r.value);
}

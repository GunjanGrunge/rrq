/**
 * GET /api/youtube/analytics
 *
 * Returns real YouTube channel stats and analytics for the authenticated user.
 * Uses raw fetch against the YouTube Data API v3 and YouTube Analytics API v2
 * (googleapis is not installed in apps/web — we use the REST endpoints directly).
 *
 * Response shape: AnalyticsResponse (defined below)
 *
 * Sub-request failure strategy:
 *   Each data section is fetched in a try/catch. If one section fails (e.g.
 *   the user is not monetised and the revenue call 403s), the rest of the
 *   response is still returned with nulls for the failed fields.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasYouTubeConnected, getYouTubeClient } from "@/lib/youtube-auth";
import type { YouTubeClient } from "@/lib/youtube-auth";

// ─── Response types ───────────────────────────────────────────────────────────

interface DailyMetric {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
}

interface TopVideo {
  videoId: string;
  title: string;
  views: number;
  watchTimeMinutes: number;
  averageViewDuration: number;
  clickThroughRate: number | null;
  averageViewPercentage: number;
  estimatedRevenue: number | null;
}

interface AnalyticsResponse {
  connected: boolean;
  channelStats?: {
    viewCount: number;
    subscriberCount: number;
    videoCount: number;
  };
  analytics?: {
    dailyMetrics: DailyMetric[];
    totalViews: number;
    totalWatchHours: number;
    totalSubscribers: number;
    subscribersGained: number;
    estimatedRevenue: number | null;
    rpm: number | null;
    cpm: number | null;
  };
  topVideos?: TopVideo[];
  monetisationProgress?: {
    subscriberCount: number;
    watchHours: number;
    subscriberGoal: number;
    watchHourGoal: number;
  };
}

// ─── YouTube API REST helpers ─────────────────────────────────────────────────

/** ISO date string in YYYY-MM-DD format */
function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Date 28 days ago */
function startDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return toYMD(d);
}

/** Today */
function endDate(): string {
  return toYMD(new Date());
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

interface ChannelStatisticsResult {
  channelId: string;
  viewCount: number;
  subscriberCount: number;
  videoCount: number;
}

async function fetchChannelStatistics(
  client: YouTubeClient
): Promise<ChannelStatisticsResult> {
  const url =
    "https://www.googleapis.com/youtube/v3/channels" +
    "?part=statistics,id&mine=true";

  const res = await client.get(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`channels.list failed ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    items?: Array<{
      id: string;
      statistics: {
        viewCount?: string;
        subscriberCount?: string;
        videoCount?: string;
      };
    }>;
  };

  const item = data.items?.[0];
  if (!item) throw new Error("No channel found for this user");

  return {
    channelId: item.id,
    viewCount: parseInt(item.statistics.viewCount ?? "0", 10),
    subscriberCount: parseInt(item.statistics.subscriberCount ?? "0", 10),
    videoCount: parseInt(item.statistics.videoCount ?? "0", 10),
  };
}

interface DailyAnalyticsRow {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
}

async function fetchDailyAnalytics(
  client: YouTubeClient,
  channelId: string
): Promise<DailyAnalyticsRow[]> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: startDate(),
    endDate: endDate(),
    metrics: "views,estimatedMinutesWatched,subscribersGained",
    dimensions: "day",
    sort: "day",
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const res = await client.get(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`youtubeAnalytics.reports.query (daily) failed ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<(string | number)[]>;
  };

  const rows = data.rows ?? [];
  // column order: day, views, estimatedMinutesWatched, subscribersGained
  return rows.map((row) => ({
    date: String(row[0]),
    views: Number(row[1]) || 0,
    estimatedMinutesWatched: Number(row[2]) || 0,
    subscribersGained: Number(row[3]) || 0,
  }));
}

interface RevenueMetrics {
  estimatedRevenue: number | null;
  rpm: number | null;
  cpm: number | null;
}

async function fetchRevenueMetrics(
  client: YouTubeClient,
  channelId: string
): Promise<RevenueMetrics> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: startDate(),
    endDate: endDate(),
    metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,estimatedAdRpm",
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const res = await client.get(url);

  // Non-2xx = not monetised or insufficient permissions — return nulls, not an error
  if (!res.ok) {
    return { estimatedRevenue: null, rpm: null, cpm: null };
  }

  const data = await res.json() as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<(string | number)[]>;
  };

  const row = data.rows?.[0];
  if (!row) return { estimatedRevenue: null, rpm: null, cpm: null };

  // column order: estimatedRevenue, estimatedAdRevenue, grossRevenue, cpm, estimatedAdRpm
  const estimatedRevenue = row[0] !== undefined ? Number(row[0]) : null;
  const cpm = row[3] !== undefined ? Number(row[3]) : null;
  const rpm = row[4] !== undefined ? Number(row[4]) : null;

  return { estimatedRevenue, rpm, cpm };
}

interface TopVideoRow {
  videoId: string;
  views: number;
  watchTimeMinutes: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  estimatedRevenue: number | null;
}

async function fetchTopVideos(
  client: YouTubeClient,
  channelId: string
): Promise<TopVideoRow[]> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: startDate(),
    endDate: endDate(),
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
    dimensions: "video",
    sort: "-views",
    maxResults: "10",
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const res = await client.get(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`youtubeAnalytics top videos failed ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<(string | number)[]>;
  };

  const rows = data.rows ?? [];
  // column order: video, views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage
  return rows.map((row) => ({
    videoId: String(row[0]),
    views: Number(row[1]) || 0,
    watchTimeMinutes: Number(row[2]) || 0,
    averageViewDuration: Number(row[3]) || 0,
    averageViewPercentage: Number(row[4]) || 0,
    estimatedRevenue: null, // enriched separately if monetised
  }));
}

async function fetchTopVideoRevenue(
  client: YouTubeClient,
  channelId: string
): Promise<Map<string, number>> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: startDate(),
    endDate: endDate(),
    metrics: "estimatedRevenue",
    dimensions: "video",
    sort: "-estimatedRevenue",
    maxResults: "10",
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const res = await client.get(url);

  // 403 = not monetised — return empty map
  if (res.status === 403) return new Map();
  if (!res.ok) return new Map(); // non-fatal

  const data = await res.json() as {
    rows?: Array<(string | number)[]>;
  };

  const map = new Map<string, number>();
  for (const row of data.rows ?? []) {
    map.set(String(row[0]), Number(row[1]) || 0);
  }
  return map;
}

async function fetchVideoTitles(
  client: YouTubeClient,
  videoIds: string[]
): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map();

  // YouTube Data API allows up to 50 ids per call
  const ids = videoIds.slice(0, 50).join(",");
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet&id=${encodeURIComponent(ids)}`;

  const res = await client.get(url);
  if (!res.ok) {
    console.warn(`[youtube/analytics] videos.list failed ${res.status}`);
    return new Map();
  }

  const data = await res.json() as {
    items?: Array<{ id: string; snippet: { title: string } }>;
  };

  const map = new Map<string, string>();
  for (const item of data.items ?? []) {
    map.set(item.id, item.snippet.title);
  }
  return map;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check connection before any API call
  const connected = await hasYouTubeConnected(userId);
  if (!connected) {
    return NextResponse.json({ connected: false } satisfies AnalyticsResponse);
  }

  let client: YouTubeClient;
  try {
    client = await getYouTubeClient(userId);
  } catch (err) {
    console.error(`[youtube/analytics] Could not get client for ${userId}:`, err);
    return NextResponse.json({ connected: false } satisfies AnalyticsResponse);
  }

  // ── 1. Channel statistics ────────────────────────────────────────────────
  let channelStats: AnalyticsResponse["channelStats"];
  let channelId = "";

  try {
    const stats = await fetchChannelStatistics(client);
    channelId = stats.channelId;
    channelStats = {
      viewCount: stats.viewCount,
      subscriberCount: stats.subscriberCount,
      videoCount: stats.videoCount,
    };
  } catch (err) {
    console.error("[youtube/analytics] channelStats fetch failed:", err);
    // Without a channelId we cannot call Analytics API at all
    return NextResponse.json(
      { connected: true, channelStats: undefined } satisfies AnalyticsResponse
    );
  }

  // ── 2. Daily analytics (28d) ─────────────────────────────────────────────
  let dailyMetrics: DailyMetric[] = [];
  let totalViews = 0;
  let totalWatchHours = 0;
  let subscribersGained = 0;

  try {
    const rows = await fetchDailyAnalytics(client, channelId);
    dailyMetrics = rows;
    totalViews = rows.reduce((s, r) => s + r.views, 0);
    const totalMinutes = rows.reduce((s, r) => s + r.estimatedMinutesWatched, 0);
    totalWatchHours = Math.round(totalMinutes / 60);
    subscribersGained = rows.reduce((s, r) => s + r.subscribersGained, 0);
  } catch (err) {
    console.error("[youtube/analytics] dailyAnalytics fetch failed:", err);
    // Continue — return zeros rather than failing the whole response
  }

  // ── 3. Revenue metrics (non-fatal — null if not monetised) ───────────────
  let estimatedRevenue: number | null = null;
  let rpm: number | null = null;
  let cpm: number | null = null;

  try {
    const rev = await fetchRevenueMetrics(client, channelId);
    estimatedRevenue = rev.estimatedRevenue;
    rpm = rev.rpm;
    cpm = rev.cpm;
  } catch (err) {
    console.warn("[youtube/analytics] revenue fetch failed (non-fatal):", err);
  }

  // ── 4. Top videos ─────────────────────────────────────────────────────────
  let topVideos: TopVideo[] | undefined;

  try {
    const [videoRows, revMap] = await Promise.all([
      fetchTopVideos(client, channelId),
      fetchTopVideoRevenue(client, channelId).catch(() => new Map<string, number>()),
    ]);

    const videoIds = videoRows.map((v) => v.videoId);
    const titleMap = await fetchVideoTitles(client, videoIds);

    topVideos = videoRows.map((v) => ({
      videoId: v.videoId,
      title: titleMap.get(v.videoId) ?? v.videoId,
      views: v.views,
      watchTimeMinutes: v.watchTimeMinutes,
      averageViewDuration: v.averageViewDuration,
      clickThroughRate: null, // CTR requires impressions metric — available in newer API scopes
      averageViewPercentage: v.averageViewPercentage,
      estimatedRevenue: revMap.get(v.videoId) ?? null,
    }));
  } catch (err) {
    console.error("[youtube/analytics] topVideos fetch failed:", err);
    // topVideos remains undefined — partial response is still valid
  }

  // ── 5. Monetisation progress ──────────────────────────────────────────────
  // YouTube Partner Programme thresholds: 1,000 subs + 4,000 watch hours
  const SUBSCRIBER_GOAL = 1_000;
  const WATCH_HOUR_GOAL = 4_000;

  // Compute cumulative watch hours from DynamoDB-backed data is not available
  // here — we use the 28d totalWatchHours as a best-effort indicator.
  // A full lifetime calculation would require a wider date range query.
  const monetisationProgress: AnalyticsResponse["monetisationProgress"] = {
    subscriberCount: channelStats.subscriberCount,
    watchHours: totalWatchHours, // 28-day window
    subscriberGoal: SUBSCRIBER_GOAL,
    watchHourGoal: WATCH_HOUR_GOAL,
  };

  // ── Assemble response ─────────────────────────────────────────────────────

  const response: AnalyticsResponse = {
    connected: true,
    channelStats,
    analytics: {
      dailyMetrics,
      totalViews,
      totalWatchHours,
      totalSubscribers: channelStats.subscriberCount,
      subscribersGained,
      estimatedRevenue,
      rpm,
      cpm,
    },
    topVideos,
    monetisationProgress,
  };

  return NextResponse.json(response);
}

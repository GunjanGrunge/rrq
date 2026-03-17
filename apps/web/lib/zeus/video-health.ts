import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { VideoHealthScore, VideoAction, VideoMemoryRecord } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// ─── Fetch video health metrics from YouTube Analytics API ───────────────────

export async function getVideoHealth(
  videoId: string,
  windowHours: 24 | 72
): Promise<{
  views: number;
  ctr: number;
  avgViewDuration: number; // seconds
  retentionPercent: number;
  subscribersGained: number;
  shares: number;
  likes: number;
  comments: number;
} | null> {
  const accessToken = process.env.YOUTUBE_ANALYTICS_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn(
      "[zeus:health] YOUTUBE_ANALYTICS_ACCESS_TOKEN not set — returning mock data"
    );
    return null;
  }

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - windowHours * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const url = new URL(
      "https://youtubeanalytics.googleapis.com/v2/reports"
    );
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,shares,likes,comments,annotationClickThroughRate"
    );
    url.searchParams.set("filters", `video==${videoId}`);
    url.searchParams.set("dimensions", "video");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(
        `[zeus:health] YouTube Analytics API error: ${response.status}`
      );
      return null;
    }

    const data = (await response.json()) as {
      rows?: number[][];
    };

    const row = data.rows?.[0];
    if (!row) return null;

    const [
      views,
      estimatedMinutesWatched,
      averageViewDuration,
      subscribersGained,
      shares,
      likes,
      comments,
      ctr,
    ] = row;

    // Compute retention as (avg view duration / estimated total video duration)
    // We use estimatedMinutesWatched / views as avg watch time, then compare to averageViewDuration
    const avgWatchMinutes = views > 0 ? estimatedMinutesWatched / views : 0;
    const retentionPercent =
      averageViewDuration > 0
        ? Math.min(100, (avgWatchMinutes * 60) / averageViewDuration) * 100
        : 0;

    return {
      views,
      ctr: (ctr ?? 0) * 100, // YouTube returns decimal, convert to percent
      avgViewDuration: averageViewDuration ?? 0,
      retentionPercent,
      subscribersGained: subscribersGained ?? 0,
      shares: shares ?? 0,
      likes: likes ?? 0,
      comments: comments ?? 0,
    };
  } catch (err) {
    console.error(`[zeus:health] Failed to fetch video health for ${videoId}:`, err);
    return null;
  }
}

// ─── Get channel average metrics for comparison ───────────────────────────────

async function getChannelAverages(): Promise<{
  avgCTR: number;
  avgRetention: number;
} | null> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: "channel-health",
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": "channel" }),
        ScanIndexForward: false,
        Limit: 7,
      })
    );

    if (!result.Items || result.Items.length === 0) return null;

    const records = result.Items.map(
      (i) => unmarshall(i) as { avgCTR?: number; avgRetentionPercent?: number }
    );
    const avgCTR =
      records.reduce((sum, r) => sum + (r.avgCTR ?? 0), 0) / records.length;
    const avgRetention =
      records.reduce((sum, r) => sum + (r.avgRetentionPercent ?? 0), 0) /
      records.length;

    return { avgCTR, avgRetention };
  } catch {
    return null;
  }
}

// ─── Score health (0–100) ─────────────────────────────────────────────────────

export function scoreVideoHealth(
  metrics: {
    ctr: number;
    retentionPercent: number;
    subscribersGained: number;
    commentSentimentAvg: number;
    sharesAndSaves: number;
  },
  channelAvgCTR: number,
  channelAvgRetention: number
): number {
  // CTR component — 25 pts max
  // +25 if CTR is ≥ 2x channel average, scaled linearly
  const ctrRatio =
    channelAvgCTR > 0 ? metrics.ctr / channelAvgCTR : 1;
  const ctrScore = Math.min(25, ctrRatio * 12.5);

  // Retention component — 25 pts max
  const retentionRatio =
    channelAvgRetention > 0
      ? metrics.retentionPercent / channelAvgRetention
      : 1;
  const retentionScore = Math.min(25, retentionRatio * 12.5);

  // Subscriber delta component — 20 pts max
  // Scale: 0 subs = 0, 100 subs = 20
  const subScore = Math.min(20, (metrics.subscribersGained / 100) * 20);

  // Comment sentiment — 15 pts max
  // +1 to -1 range → 0 to 15
  const sentimentScore = Math.max(
    0,
    ((metrics.commentSentimentAvg + 1) / 2) * 15
  );

  // Shares + saves — 15 pts max
  // Scale: 0 = 0, 50 = 15
  const sharesScore = Math.min(15, (metrics.sharesAndSaves / 50) * 15);

  return Math.round(
    ctrScore + retentionScore + subScore + sentimentScore + sharesScore
  );
}

// ─── Determine what action to take based on health score ─────────────────────

export function determineVideoAction(
  healthScore: number,
  windowHours: 24 | 72
): VideoAction {
  if (windowHours === 24) {
    if (healthScore >= 70) return "MONITOR";
    if (healthScore >= 50) return "BOOST_SHORTS";
    if (healthScore >= 30) return "FLAG_UNDERPERFORM";
    return "FLAG_UNDERPERFORM";
  }

  // 72hr window — more decisive
  if (healthScore >= 65) return "MONITOR";
  if (healthScore >= 45) return "BOOST_SHORTS";
  if (healthScore >= 25) return "FLAG_UNDERPERFORM";
  return "ARCHIVE";
}

// ─── Write video health record to DynamoDB ────────────────────────────────────

export async function writeVideoHealthRecord(
  videoId: string,
  score: VideoHealthScore
): Promise<void> {
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
        UpdateExpression:
          "SET health_#w = :h, lastHealthCheck = :t",
        ExpressionAttributeNames: {
          "#w": `${score.windowHours}hr`,
        },
        ExpressionAttributeValues: marshall({
          ":h": score,
          ":t": new Date().toISOString(),
        }),
      })
    );

    console.log(
      `[zeus:health] Health record written for ${videoId} at ${score.windowHours}hr: score=${score.healthScore} action=${score.action}`
    );
  } catch (err) {
    console.error(
      `[zeus:health] Failed to write health record for ${videoId}:`,
      err
    );
  }
}

// ─── Full health check for a single video ────────────────────────────────────

export async function runVideoHealthCheck(
  videoId: string,
  windowHours: 24 | 72,
  commentSentimentAvg: number = 0
): Promise<VideoHealthScore | null> {
  const metrics = await getVideoHealth(videoId, windowHours);
  if (!metrics) {
    console.warn(
      `[zeus:health] No metrics available for ${videoId} — skipping health check`
    );
    return null;
  }

  const channelAvgs = await getChannelAverages();
  const channelAvgCTR = channelAvgs?.avgCTR ?? 3.5; // default 3.5% CTR
  const channelAvgRetention = channelAvgs?.avgRetention ?? 40; // default 40%

  const healthScore = scoreVideoHealth(
    {
      ctr: metrics.ctr,
      retentionPercent: metrics.retentionPercent,
      subscribersGained: metrics.subscribersGained,
      commentSentimentAvg,
      sharesAndSaves: metrics.shares,
    },
    channelAvgCTR,
    channelAvgRetention
  );

  const action = determineVideoAction(healthScore, windowHours);

  const score: VideoHealthScore = {
    videoId,
    windowHours,
    ctr: metrics.ctr,
    ctrVsChannelAvg: metrics.ctr - channelAvgCTR,
    retentionPercent: metrics.retentionPercent,
    retentionVsChannelAvg: metrics.retentionPercent - channelAvgRetention,
    totalViews: metrics.views,
    subscriberDelta: metrics.subscribersGained,
    commentSentimentAvg,
    sharesAndSaves: metrics.shares,
    healthScore,
    action,
    computedAt: new Date().toISOString(),
  };

  await writeVideoHealthRecord(videoId, score);
  return score;
}

// ─── Get all videos that need health checks ───────────────────────────────────

export async function getVideosNeedingHealthCheck(
  windowHours: 24 | 72
): Promise<string[]> {
  try {
    const cutoffTime = new Date(
      Date.now() - windowHours * 60 * 60 * 1000
    ).toISOString();

    // Scan video-memory for videos published within the window
    const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
    const result = await db.send(
      new ScanCommand({
        TableName: "video-memory",
        FilterExpression:
          "publishedAt >= :cutoff AND lessonsWritten = :false",
        ExpressionAttributeValues: marshall({
          ":cutoff": cutoffTime,
          ":false": false,
        }),
        ProjectionExpression: "videoId, publishedAt",
      })
    );

    return (result.Items ?? []).map(
      (i) => (unmarshall(i) as VideoMemoryRecord).videoId
    );
  } catch (err) {
    console.error("[zeus:health] Failed to get videos needing health check:", err);
    return [];
  }
}

// ─── Update channel-health table with daily analytics snapshot ────────────────

export async function updateChannelHealthRecord(analytics: {
  date: string;
  totalViews: number;
  subscriberCount: number;
  subscribersGained: number;
  avgCTR: number;
  avgWatchTime: number;
  avgRetentionPercent: number;
  topPerformingVideoId: string | null;
  bottomPerformingVideoId: string | null;
}): Promise<void> {
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: "channel-health",
        Key: marshall({ pk: "channel", date: analytics.date }),
        UpdateExpression:
          "SET totalViews = :v, subscriberCount = :sc, subscribersGained = :sg, avgCTR = :ctr, avgWatchTime = :wt, avgRetentionPercent = :rp, topPerformingVideoId = :top, bottomPerformingVideoId = :bot, updatedAt = :t",
        ExpressionAttributeValues: marshall({
          ":v": analytics.totalViews,
          ":sc": analytics.subscriberCount,
          ":sg": analytics.subscribersGained,
          ":ctr": analytics.avgCTR,
          ":wt": analytics.avgWatchTime,
          ":rp": analytics.avgRetentionPercent,
          ":top": analytics.topPerformingVideoId ?? "none",
          ":bot": analytics.bottomPerformingVideoId ?? "none",
          ":t": new Date().toISOString(),
        }),
      })
    );

    console.log(`[zeus:health] Channel health record updated for ${analytics.date}`);
  } catch (err) {
    console.error("[zeus:health] Failed to update channel health record:", err);
  }
}

// ─── Fetch recent channel health records ─────────────────────────────────────

export async function getRecentChannelHealth(days: number = 7): Promise<
  Array<{
    date: string;
    totalViews: number;
    subscriberCount: number;
    avgCTR: number;
    avgWatchTime: number;
  }>
> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: "channel-health",
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({ ":pk": "channel" }),
        ScanIndexForward: false,
        Limit: days,
      })
    );

    return (result.Items ?? []).map((i) => {
      const item = unmarshall(i) as {
        date: string;
        totalViews: number;
        subscriberCount: number;
        avgCTR: number;
        avgWatchTime: number;
      };
      return {
        date: item.date,
        totalViews: item.totalViews ?? 0,
        subscriberCount: item.subscriberCount ?? 0,
        avgCTR: item.avgCTR ?? 0,
        avgWatchTime: item.avgWatchTime ?? 0,
      };
    });
  } catch (err) {
    console.error("[zeus:health] Failed to fetch recent channel health:", err);
    return [];
  }
}

// ─── Get video memory record ──────────────────────────────────────────────────

export async function getVideoMemoryRecord(
  videoId: string
): Promise<VideoMemoryRecord | null> {
  try {
    const result = await db.send(
      new GetItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
      })
    );

    if (!result.Item) return null;
    return unmarshall(result.Item) as VideoMemoryRecord;
  } catch (err) {
    console.error(`[zeus:health] Failed to get video memory for ${videoId}:`, err);
    return null;
  }
}

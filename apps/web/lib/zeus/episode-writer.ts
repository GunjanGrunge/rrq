import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { syncKnowledgeBase } from "@/lib/memory/kb-query";
import type { ZeusEpisode } from "./types";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const MEMORY_BUCKET = process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory";

// ─── Write an episode to S3 + trigger Bedrock KB sync ────────────────────────

export async function writeEpisode(
  agent: ZeusEpisode["agent"],
  topic: string,
  eventType: ZeusEpisode["eventType"],
  decision: string,
  reasoning: string,
  lesson: string,
  tags: string[],
  outcome: ZeusEpisode["outcome"] = {}
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Build topic slug for readable episodeId
  const topicSlug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .slice(0, 5)
    .join("-");

  const episodeId = `ep-${Date.now()}-${topicSlug}`;
  const s3Key = `episodes/${agent}/${year}/${month}/${episodeId}.json`;

  const episode: ZeusEpisode = {
    episodeId,
    timestamp: now.toISOString(),
    agent,
    eventType,
    topic,
    decision,
    reasoning,
    outcome,
    lesson,
    tags,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: MEMORY_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(episode, null, 2),
      ContentType: "application/json",
    })
  );

  console.log(`[zeus:episode] Written: ${s3Key}`);

  // Trigger KB sync
  await triggerKBSync(s3Key).catch((err) =>
    console.error("[zeus:episode] KB sync trigger failed:", err)
  );

  return s3Key;
}

// ─── Trigger Bedrock Knowledge Base ingestion job ────────────────────────────

export async function triggerKBSync(s3Key: string): Promise<void> {
  console.log(`[zeus:episode] Triggering KB sync for ${s3Key}`);
  await syncKnowledgeBase();
}

// ─── Get recent episodes from S3 ─────────────────────────────────────────────

export async function getRecentEpisodes(
  agent: ZeusEpisode["agent"],
  limit: number = 10
): Promise<ZeusEpisode[]> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Look in current month first
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: MEMORY_BUCKET,
        Prefix: `episodes/${agent}/${year}/${month}/`,
        MaxKeys: limit * 2, // fetch extra since some may fail to parse
      })
    );

    const keys = (listResult.Contents ?? [])
      .sort((a, b) => {
        const timeA = a.LastModified?.getTime() ?? 0;
        const timeB = b.LastModified?.getTime() ?? 0;
        return timeB - timeA; // most recent first
      })
      .slice(0, limit)
      .map((obj) => obj.Key!)
      .filter(Boolean);

    // Fetch each episode
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const episodes = await Promise.allSettled(
      keys.map(async (key) => {
        const result = await s3.send(
          new GetObjectCommand({
            Bucket: MEMORY_BUCKET,
            Key: key,
          })
        );

        const body = await result.Body?.transformToString();
        if (!body) return null;
        return JSON.parse(body) as ZeusEpisode;
      })
    );

    return episodes
      .filter(
        (r): r is PromiseFulfilledResult<ZeusEpisode> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
  } catch (err) {
    console.error(
      `[zeus:episode] Failed to get recent episodes for ${agent}:`,
      err
    );
    return [];
  }
}

// ─── Write a performance review episode ──────────────────────────────────────

export async function writePerformanceReviewEpisode(
  videoId: string,
  niche: string,
  healthScore: number,
  action: string,
  windowHours: 24 | 72,
  lesson: string
): Promise<string> {
  return writeEpisode(
    "zeus",
    videoId,
    "performance_reviewed",
    `Video ${videoId} scored ${healthScore}/100 at ${windowHours}hr review. Action: ${action}.`,
    `Health score computed from CTR, retention, subscriber delta, sentiment, and shares.`,
    lesson,
    ["performance_review", niche, `${windowHours}hr`],
    { views: undefined, ctr: undefined }
  );
}

// ─── Write a comment insight episode ─────────────────────────────────────────

export async function writeCommentInsightEpisode(
  videoId: string,
  niche: string,
  genuineCount: number,
  sentimentAvg: number,
  topRequest: string | null,
  topInsight: string | null
): Promise<string> {
  const sentimentLabel =
    sentimentAvg > 0.3 ? "positive" : sentimentAvg < -0.3 ? "negative" : "mixed";

  return writeEpisode(
    "zeus",
    videoId,
    "comment_insight",
    `Analysed ${genuineCount} genuine comments for video ${videoId}. Overall sentiment: ${sentimentLabel}.`,
    `Comment analysis via Opus batch classification. Attribution to agents based on comment category.`,
    topInsight ?? `Monitor viewer sentiment for ${niche} content. Sentiment: ${sentimentLabel}.`,
    ["comment_analysis", niche, sentimentLabel],
    { commentSentiment: sentimentAvg }
  );
}

// ─── Write a lesson-learned episode ──────────────────────────────────────────

export async function writeLessonEpisode(
  agent: ZeusEpisode["agent"],
  topic: string,
  lesson: string,
  context: string,
  outcome: ZeusEpisode["outcome"],
  tags: string[]
): Promise<string> {
  return writeEpisode(
    agent,
    topic,
    "lesson_learned",
    `Lesson recorded for ${agent}: ${lesson}`,
    context,
    lesson,
    tags,
    outcome
  );
}

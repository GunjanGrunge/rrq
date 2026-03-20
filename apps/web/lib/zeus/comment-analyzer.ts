import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  UpdateItemCommand,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getBedrockClient } from "@/lib/aws-clients";
import type {
  CommentClassification,
  RawComment,
  CommentBatch,
  VideoMemoryRecord,
} from "./types";

const bedrock = getBedrockClient();
const db = getDynamoClient();

const ZEUS_COMMENT_SYSTEM_PROMPT = `You are Zeus, the performance intelligence system for RRQ — an AI-powered YouTube channel.

Your role is to analyse YouTube comments and classify them for the agent performance scoring system.

For each comment you receive, evaluate and return structured JSON data about:
- Genuine human feedback vs spam/promotional content
- Which agent's work drove this comment (Rex scouts topics, Regum handles scheduling/strategy, Qeon handles production quality)
- Sentiment and actionable insights
- Whether the viewer is requesting future content topics

Always return ONLY a valid JSON array. No preamble. No markdown. No explanation outside the JSON.`;

// ─── Fetch comments from YouTube API ─────────────────────────────────────────

export async function fetchChannelComments(
  videoId: string,
  _channelId: string
): Promise<RawComment[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[zeus:comments] YOUTUBE_API_KEY not set — returning empty");
    return [];
  }

  try {
    const url = new URL(
      "https://www.googleapis.com/youtube/v3/commentThreads"
    );
    url.searchParams.set("part", "snippet,replies");
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("maxResults", "200");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(
        `[zeus:comments] YouTube API error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = (await response.json()) as {
      items?: Array<{
        id: string;
        snippet?: {
          topLevelComment?: {
            id: string;
            snippet?: {
              textDisplay: string;
              authorDisplayName: string;
              likeCount: number;
              publishedAt: string;
              updatedAt: string;
            };
          };
        };
      }>;
    };

    return (data.items ?? []).map((item) => {
      const snippet = item.snippet?.topLevelComment?.snippet;
      return {
        commentId: item.snippet?.topLevelComment?.id ?? item.id,
        text: snippet?.textDisplay ?? "",
        authorDisplayName: snippet?.authorDisplayName ?? "",
        likeCount: snippet?.likeCount ?? 0,
        publishedAt: snippet?.publishedAt ?? new Date().toISOString(),
        updatedAt: snippet?.updatedAt ?? new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error("[zeus:comments] Failed to fetch comments:", err);
    return [];
  }
}

// ─── Classify comments in batches of 50 via Bedrock Opus ─────────────────────

export async function classifyComments(
  comments: RawComment[],
  videoId: string
): Promise<CommentClassification[]> {
  if (comments.length === 0) return [];

  const BATCH_SIZE = 50;
  const allClassifications: CommentClassification[] = [];

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);

    const prompt = `Analyse these YouTube comments from video ${videoId} and return a JSON array.

For each comment, return an object with these exact fields:
1. commentId: string — the comment's ID
2. genuine: boolean — is this real human feedback vs spam/bot/promotional?
3. sentiment: "positive" | "negative" | "neutral" | "mixed"
4. category:
   - "topic_quality"       → comment about the subject chosen (Rex agent)
   - "production_quality"  → comment about video/audio/visuals (Qeon agent)
   - "research_accuracy"   → comment about facts, data, sources (Rex + Qeon agents)
   - "topic_timing"        → comment about being early/late on trend (Rex + Regum agents)
   - "channel_strategy"    → comment about channel overall (Regum agent)
   - "viewer_request"      → asking for future content (Rex watchlist)
   - "general_praise"      → positive but not specific
   - "irrelevant"          → off-topic, spam, promotional
5. agentAttribution: "rex" | "regum" | "qeon" | "shared" | "none"
   - rex: topic choice, trend timing, research accuracy
   - regum: upload strategy, scheduling, channel direction
   - qeon: production quality, audio/visuals, editing
   - shared: when multiple agents contributed equally
   - none: general or irrelevant
6. pointsAward: 0 | 1 | 2 | 3 (0=irrelevant/spam, 1=minor positive, 2=meaningful, 3=exceptional)
7. insight: string | null — one sentence actionable insight if present, else null
8. isViewerRequest: boolean — is this asking for a specific future topic?
9. requestTopic: string | null — if isViewerRequest, the exact topic they want

Comments to classify:
${JSON.stringify(
  batch.map((c) => ({ commentId: c.commentId, text: c.text })),
  null,
  2
)}

Return ONLY a JSON array. No preamble. No markdown.`;

    try {
      const response = await bedrock.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-opus-4-5",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 4000,
            system: ZEUS_COMMENT_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
          }),
        })
      );

      const responseText = JSON.parse(
        new TextDecoder().decode(response.body)
      ).content[0].text as string;

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("[zeus:comments] No JSON array found in Opus response");
        continue;
      }

      const batchResults = JSON.parse(jsonMatch[0]) as Array<{
        commentId: string;
        genuine: boolean;
        sentiment: CommentClassification["sentiment"];
        category: CommentClassification["category"];
        agentAttribution: CommentClassification["agentAttribution"];
        pointsAward: number;
        insight: string | null;
        isViewerRequest: boolean;
        requestTopic: string | null;
      }>;

      for (const result of batchResults) {
        const original = batch.find((c) => c.commentId === result.commentId);
        if (!original) continue;

        allClassifications.push({
          commentId: result.commentId,
          commentText: original.text,
          genuine: result.genuine,
          sentiment: result.sentiment,
          category: result.category,
          agentAttribution: result.agentAttribution,
          pointsAward: Math.max(0, Math.min(3, result.pointsAward)),
          insight: result.insight,
          isViewerRequest: result.isViewerRequest,
          requestTopic: result.requestTopic,
        });
      }
    } catch (err) {
      console.error(
        `[zeus:comments] Batch ${i / BATCH_SIZE + 1} classification failed:`,
        err
      );
    }
  }

  return allClassifications;
}

// ─── Apply points from comment classifications to agent-scores ────────────────

export async function applyPointsFromComments(
  classifications: CommentClassification[],
  channelId: string
): Promise<{ rex: number; regum: number; qeon: number }> {
  const points = { rex: 0, regum: 0, qeon: 0 };

  for (const c of classifications) {
    if (!c.genuine || c.category === "irrelevant") continue;

    const multiplier = c.sentiment === "positive" ? 1 : -0.5;
    const award = c.pointsAward * multiplier;

    if (c.agentAttribution === "rex") points.rex += award;
    else if (c.agentAttribution === "regum") points.regum += award;
    else if (c.agentAttribution === "qeon") points.qeon += award;
    else if (c.agentAttribution === "shared") {
      points.rex += award * 0.33;
      points.regum += award * 0.33;
      points.qeon += award * 0.33;
    }
  }

  // Atomic DynamoDB updates for each agent
  const now = new Date().toISOString();
  const updatePromises = (
    Object.entries(points) as Array<[keyof typeof points, number]>
  )
    .filter(([, delta]) => delta !== 0)
    .map(async ([agentId, delta]) => {
      try {
        await db.send(
          new UpdateItemCommand({
            TableName: "agent-scores",
            Key: marshall({ agentId, channelId }),
            UpdateExpression:
              "ADD dailyPoints :d, weeklyPoints :d, totalPoints :d SET lastUpdated = :t",
            ExpressionAttributeValues: marshall({
              ":d": Math.round(delta),
              ":t": now,
            }),
          })
        );
        console.log(
          `[zeus:scores] ${agentId} += ${Math.round(delta)} points from comments`
        );
      } catch (err) {
        console.error(`[zeus:scores] Failed to update ${agentId} points:`, err);
      }
    });

  await Promise.allSettled(updatePromises);
  return points;
}

// ─── Write comment insights to video-memory table ─────────────────────────────

export async function writeCommentInsights(
  videoId: string,
  insights: {
    totalAnalysed: number;
    genuineCount: number;
    sentimentAvg: number;
    topRequest: string | null;
    topPraise: string | null;
    topComplaint: string | null;
    viewerRequests: string[];
  }
): Promise<void> {
  try {
    // Read existing record
    const existing = await db.send(
      new GetItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
      })
    );

    const record = existing.Item
      ? (unmarshall(existing.Item) as VideoMemoryRecord)
      : null;

    // Update performance.commentSentiment and write insights
    await db.send(
      new UpdateItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
        UpdateExpression:
          "SET commentInsights = :ci, #perf.commentSentiment = :cs, lastCommentAnalysis = :t" +
          (record ? "" : ", topic = :topic, publishedAt = :pa, niche = :n"),
        ExpressionAttributeNames: { "#perf": "performance" },
        ExpressionAttributeValues: marshall({
          ":ci": insights,
          ":cs": insights.sentimentAvg,
          ":t": new Date().toISOString(),
          ...(record
            ? {}
            : {
                ":topic": "unknown",
                ":pa": new Date().toISOString(),
                ":n": "general",
              }),
        }),
      })
    );

    console.log(
      `[zeus:comments] Insights written for video ${videoId}: ${insights.totalAnalysed} analysed, ${insights.genuineCount} genuine`
    );
  } catch (err) {
    console.error(
      `[zeus:comments] Failed to write insights for video ${videoId}:`,
      err
    );
  }
}

// ─── Add viewer requests to Rex watchlist ─────────────────────────────────────

export async function addViewerRequestsToWatchlist(
  requests: string[],
  userId: string
): Promise<void> {
  for (const topic of requests) {
    if (!topic || topic.trim().length === 0) continue;

    try {
      const topicId = crypto.randomUUID();
      const now = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + 72 * 60 * 60; // 72-hour TTL

      await db.send(
        new PutItemCommand({
          TableName: "rex-watchlist",
          Item: marshall({
            userId,
            topicId,
            topic: topic.trim(),
            source: "viewer_request",
            confidenceScore: 30, // viewer requests start at 30 confidence
            status: "monitoring",
            checkCount: 0,
            confidenceHistory: [0.3],
            firstSeen: now,
            createdAt: now,
            ttl,
          }),
          ConditionExpression: "attribute_not_exists(topicId)",
        })
      );

      console.log(
        `[zeus:watchlist] Added viewer request to watchlist: "${topic}"`
      );
    } catch (err) {
      // Ignore conditional check failures (duplicate)
      const errorName = (err as Error).name;
      if (errorName !== "ConditionalCheckFailedException") {
        console.error(
          `[zeus:watchlist] Failed to add "${topic}" to watchlist:`,
          err
        );
      }
    }
  }
}

// ─── Process a full comment batch for a video ─────────────────────────────────

export async function processCommentBatch(
  batch: CommentBatch,
  channelId: string,
  userId: string
): Promise<{
  classifications: CommentClassification[];
  pointsApplied: { rex: number; regum: number; qeon: number };
  viewerRequests: string[];
}> {
  // 1. Classify all comments
  const classifications = await classifyComments(
    batch.comments,
    batch.videoId
  );

  // 2. Compute aggregate insights
  const genuineComments = classifications.filter((c) => c.genuine);
  const sentimentScores: Record<CommentClassification["sentiment"], number> = {
    positive: 1,
    negative: -1,
    neutral: 0,
    mixed: 0,
  };
  const sentimentAvg =
    genuineComments.length > 0
      ? genuineComments.reduce(
          (sum, c) => sum + sentimentScores[c.sentiment],
          0
        ) / genuineComments.length
      : 0;

  const topPraise =
    genuineComments
      .filter((c) => c.sentiment === "positive" && c.insight)
      .sort((a, b) => b.pointsAward - a.pointsAward)[0]?.insight ?? null;

  const topComplaint =
    genuineComments
      .filter((c) => c.sentiment === "negative" && c.insight)
      .sort((a, b) => b.pointsAward - a.pointsAward)[0]?.insight ?? null;

  const viewerRequests = classifications
    .filter((c) => c.isViewerRequest && c.requestTopic)
    .map((c) => c.requestTopic!)
    .filter(Boolean);

  const topRequest = viewerRequests[0] ?? null;

  // 3. Write insights to video-memory
  await writeCommentInsights(batch.videoId, {
    totalAnalysed: classifications.length,
    genuineCount: genuineComments.length,
    sentimentAvg,
    topRequest,
    topPraise,
    topComplaint,
    viewerRequests,
  });

  // 4. Apply points to agent scores
  const pointsApplied = await applyPointsFromComments(
    classifications,
    channelId
  );

  // 5. Add viewer requests to Rex watchlist
  if (viewerRequests.length > 0) {
    await addViewerRequestsToWatchlist(viewerRequests, userId);
  }

  return { classifications, pointsApplied, viewerRequests };
}

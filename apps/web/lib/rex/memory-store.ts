import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { createHash } from "crypto";
import { getDynamoClient } from "@/lib/aws-clients";

const db = getDynamoClient();

// ─── Source weights ───────────────────────────────────────────────────────────

export interface SourceWeight {
  sourceId: string;
  avgConfidence: number;
  performanceMultiplier: number; // 0.2–1.5
  runCount: number;
  lastUpdated: string;
}

export async function getSourceWeight(sourceId: string): Promise<SourceWeight> {
  const result = await db.send(new GetItemCommand({
    TableName: "source_weights",
    Key: marshall({ sourceId }),
  }));

  if (!result.Item) {
    return {
      sourceId,
      avgConfidence: 0.7,
      performanceMultiplier: 1.0,
      runCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
  return unmarshall(result.Item) as SourceWeight;
}

export async function updateSourceWeight(
  sourceId: string,
  clipPerformanceScore: number, // 0–1 from Zeus analytics
  signalConfidence: number      // 0–1 from Rex scoring
): Promise<void> {
  const current = await getSourceWeight(sourceId);
  // EMA: 80% old + 20% new
  const newMultiplier = Math.max(
    0.2,
    Math.min(1.5, current.performanceMultiplier * 0.8 + clipPerformanceScore * 0.2)
  );
  const newAvgConfidence = current.avgConfidence * 0.8 + signalConfidence * 0.2;

  await db.send(new PutItemCommand({
    TableName: "source_weights",
    Item: marshall({
      sourceId,
      avgConfidence: newAvgConfidence,
      performanceMultiplier: newMultiplier,
      runCount: current.runCount + 1,
      lastUpdated: new Date().toISOString(),
    }),
  }));
}

// ─── Topic history (dedup) ────────────────────────────────────────────────────

export function hashTopic(topic: string): string {
  return createHash("sha256")
    .update(topic.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

export async function isTopicInCooldown(topic: string): Promise<boolean> {
  const hash = hashTopic(topic);
  const result = await db.send(new GetItemCommand({
    TableName: "topic_history",
    Key: marshall({ topicHash: hash }),
  }));
  return !!result.Item;
}

export async function recordTopicSeen(topic: string, topicId: string): Promise<void> {
  const hash = hashTopic(topic);
  // 72h TTL
  const ttl = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
  await db.send(new PutItemCommand({
    TableName: "topic_history",
    Item: marshall({
      topicHash: hash,
      topicId,
      topic,
      seenAt: new Date().toISOString(),
      ttl,
    }),
  }));
}

// ─── Niche profiles ───────────────────────────────────────────────────────────

export interface NicheProfile {
  channelId: string;
  niche: string;
  seedKeywords: string[];
  subreddits: string[];
  tiktokHashtags: string[];
  embeddingS3Key?: string;
}

export async function getNicheProfile(channelId: string): Promise<NicheProfile | null> {
  const result = await db.send(new GetItemCommand({
    TableName: "niche_profiles",
    Key: marshall({ channelId }),
  }));
  return result.Item ? (unmarshall(result.Item) as NicheProfile) : null;
}

export async function getNicheRelevanceScore(
  topic: string,
  profile: NicheProfile | null
): Promise<number> {
  if (!profile) return 0.6; // neutral when no profile
  const topicLower = topic.toLowerCase();
  const keywordHits = profile.seedKeywords.filter(k =>
    topicLower.includes(k.toLowerCase())
  ).length;
  if (keywordHits === 0) return 0.35; // below hard drop threshold
  return Math.min(0.4 + keywordHits * 0.15, 1.0);
}

// ─── RRQ state ────────────────────────────────────────────────────────────────

export interface RRQState {
  channelId: string;
  triggerMode: "CRON" | "QUEUE_LOW" | "MANUAL";
  lastRunAt: string;
  queueDepth: number;
  sourceRotationIndex: number;
  runCount: number;
  queueLowThreshold: number;
}

export async function getRRQState(channelId = "default"): Promise<RRQState> {
  const result = await db.send(new GetItemCommand({
    TableName: "rrq_state",
    Key: marshall({ channelId }),
  }));
  if (!result.Item) {
    return {
      channelId,
      triggerMode: "CRON",
      lastRunAt: new Date(0).toISOString(),
      queueDepth: 0,
      sourceRotationIndex: 0,
      runCount: 0,
      queueLowThreshold: parseInt(process.env.RRQ_QUEUE_LOW_THRESHOLD ?? "3"),
    };
  }
  return unmarshall(result.Item) as RRQState;
}

export async function updateRRQState(
  channelId = "default",
  updates: Partial<
    Pick<RRQState, "triggerMode" | "lastRunAt" | "queueDepth" | "sourceRotationIndex" | "runCount">
  >
): Promise<void> {
  const sets: string[] = [];
  const values: Record<string, unknown> = {};

  if (updates.triggerMode !== undefined) {
    sets.push("triggerMode = :tm");
    values[":tm"] = updates.triggerMode;
  }
  if (updates.lastRunAt !== undefined) {
    sets.push("lastRunAt = :lr");
    values[":lr"] = updates.lastRunAt;
  }
  if (updates.queueDepth !== undefined) {
    sets.push("queueDepth = :qd");
    values[":qd"] = updates.queueDepth;
  }
  if (updates.sourceRotationIndex !== undefined) {
    sets.push("sourceRotationIndex = :sri");
    values[":sri"] = updates.sourceRotationIndex;
  }
  if (updates.runCount !== undefined) {
    sets.push("runCount = :rc");
    values[":rc"] = updates.runCount;
  }

  if (sets.length === 0) return;

  await db.send(new UpdateItemCommand({
    TableName: "rrq_state",
    Key: marshall({ channelId }),
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeValues: marshall(values),
  }));
}

export async function getQueueDepth(userId?: string): Promise<number> {
  void userId; // userId filtering handled by GSI in later phases
  const result = await db.send(new QueryCommand({
    TableName: "production-jobs",
    IndexName: "status-createdAt-index",
    KeyConditionExpression: "#s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({ ":s": "QUEUED" }),
    Select: "COUNT",
  }));
  return result.Count ?? 0;
}

import {
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";

const db = getDynamoClient();

export interface WatchlistItem {
  topicId: string;
  userId: string;
  topic: string;
  niche: string;
  firstSeen: string;
  lastChecked: string;
  confidenceHistory: number[];
  sources: string[];
  checkCount: number;
  status: "monitoring" | "ready" | "greenlit" | "dropped" | "too_late";
  source: "rex_scan" | "viewer_request" | "zeus_alert";
}

export function getTrajectory(history: number[]): "rising" | "falling" | "stable" {
  if (history.length < 2) return "stable";
  const recent = history.slice(-3);
  const delta = recent[recent.length - 1] - recent[0];
  if (delta > 0.05) return "rising";
  if (delta < -0.05) return "falling";
  return "stable";
}

export function daysSince(isoTimestamp: string): number {
  return (Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60 * 24);
}

export function evaluateWatchlistItem(
  item: WatchlistItem,
  latestOverallScore: number
): "ready" | "dropped" | "monitoring" {
  const ageDays = daysSince(item.firstSeen);
  const trajectory = getTrajectory(item.confidenceHistory);

  if (latestOverallScore >= 0.80) return "ready";
  if (trajectory === "falling" && ageDays > 3) return "dropped";
  if (ageDays > 14) return "dropped";
  // If overall is very low after many checks, drop
  if (item.checkCount > 5 && latestOverallScore < 0.3) return "dropped";
  return "monitoring";
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const result = await db.send(new QueryCommand({
    TableName: "rex-watchlist",
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "#s IN (:monitoring, :ready)",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({
      ":uid": userId,
      ":monitoring": "monitoring",
      ":ready": "ready",
    }),
  }));
  return (result.Items ?? []).map(i => unmarshall(i) as WatchlistItem);
}

export async function addToWatchlist(
  userId: string,
  item: Omit<WatchlistItem, "topicId" | "userId" | "firstSeen" | "lastChecked" | "checkCount" | "status">
): Promise<string> {
  const topicId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: WatchlistItem = {
    ...item,
    topicId,
    userId,
    firstSeen: now,
    lastChecked: now,
    checkCount: 1,
    status: "monitoring",
  };
  await db.send(new PutItemCommand({
    TableName: "rex-watchlist",
    Item: marshall(record),
  }));
  return topicId;
}

export async function updateWatchlistItem(
  userId: string,
  topicId: string,
  newScore: number,
  newStatus: WatchlistItem["status"]
): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: "rex-watchlist",
    Key: marshall({ userId, topicId }),
    UpdateExpression:
      "SET lastChecked = :lc, #s = :s, checkCount = checkCount + :one, confidenceHistory = list_append(confidenceHistory, :score)",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({
      ":lc": new Date().toISOString(),
      ":s": newStatus,
      ":one": 1,
      ":score": [newScore],
    }),
  }));
}

export async function markGreenlit(userId: string, topicId: string): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: "rex-watchlist",
    Key: marshall({ userId, topicId }),
    UpdateExpression: "SET #s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({ ":s": "greenlit" }),
  }));
}

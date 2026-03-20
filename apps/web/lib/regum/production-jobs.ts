import {
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import type { QeonBrief } from "./types";

const db = getDynamoClient();

export async function writeQeonBrief(brief: QeonBrief): Promise<void> {
  await db.send(
    new PutItemCommand({
      TableName: "production-jobs",
      Item: marshall({ ...brief, pk: "JOB", sk: brief.briefId }),
    })
  );
}

export async function getRecentTopics(limit = 20): Promise<string[]> {
  const result = await db.send(
    new ScanCommand({
      TableName: "production-jobs",
      ProjectionExpression: "topic, createdAt",
      Limit: 100,
    })
  );
  return (result.Items ?? [])
    .map(i => unmarshall(i))
    .sort((a, b) => ((b.createdAt as string) ?? "").localeCompare((a.createdAt as string) ?? ""))
    .slice(0, limit)
    .map(i => i.topic as string)
    .filter(Boolean);
}

export async function getTopPerformingVideo(
  niche: string,
  excludeVideoId?: string
): Promise<{ videoId: string; watchTime: number } | null> {
  const result = await db.send(
    new ScanCommand({
      TableName: "video-memory",
      FilterExpression: "niche = :niche",
      ExpressionAttributeValues: { ":niche": { S: niche } },
    })
  );
  const items = (result.Items ?? [])
    .map(i => unmarshall(i))
    .filter(i => i.videoId !== excludeVideoId)
    .sort((a, b) => ((b.watchTime as number) ?? 0) - ((a.watchTime as number) ?? 0));
  if (items.length === 0) return null;
  return {
    videoId: items[0].videoId as string,
    watchTime: (items[0].watchTime as number) ?? 0,
  };
}

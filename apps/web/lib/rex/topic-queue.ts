import {
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";

const db = getDynamoClient();

export interface TopicQueueEntry {
  userId: string;
  topicId: string;
  topic: string;
  confidenceScore: number;
  rexReasoning: string;
  signalSources: string[];
  estimatedCTR: string;
  nicheFit: "STRONG" | "MODERATE" | "WEAK";
  createdAt: string;
  status: "PENDING" | "ACCEPTED" | "DISMISSED";
  expiresAt: string;
  ttl: number;
}

export async function writeTopicToQueue(
  userId: string,
  entry: Omit<TopicQueueEntry, "userId" | "topicId" | "createdAt" | "expiresAt" | "ttl" | "status">
): Promise<string> {
  const topicId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 48 * 60 * 60;

  await db.send(new PutItemCommand({
    TableName: "rex-topic-queue",
    Item: marshall({
      ...entry,
      userId,
      topicId,
      createdAt,
      expiresAt,
      ttl,
      status: "PENDING",
    }),
  }));
  return topicId;
}

export async function getPendingTopics(userId: string): Promise<TopicQueueEntry[]> {
  const result = await db.send(new QueryCommand({
    TableName: "rex-topic-queue",
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "#s = :pending",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({ ":uid": userId, ":pending": "PENDING" }),
    ScanIndexForward: false,
  }));
  return (result.Items ?? []).map(i => unmarshall(i) as TopicQueueEntry);
}

export async function updateTopicStatus(
  userId: string,
  topicId: string,
  status: "ACCEPTED" | "DISMISSED"
): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: "rex-topic-queue",
    Key: marshall({ userId, topicId }),
    UpdateExpression: "SET #s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: marshall({ ":s": status }),
  }));
}

import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/lib-dynamodb";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

type MessageType =
  | "PHASE_UPDATE" | "PUSH_ALERT" | "GREENLIGHT" | "STRATEGY_BRIEF"
  | "PRODUCTION_COMPLETE" | "AD_INSIGHT" | "VIRAL_SIGNAL" | "MEMORY_INJECTION"
  | "LESSON_REQUEST" | "CONFLICT" | "MILESTONE" | "QUALITY_FAIL"
  | "LOW_BALANCE_ALERT" | "NARRATIVE_DRIFT_ALERT" | "REX_DESIGN_SIGNAL";

export interface AgentMessage {
  messageId: string;
  from: string;
  to: string;
  type: MessageType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  payload: Record<string, unknown>;
  sentAt: string;
  readAt?: string;
  requiresResponse: boolean;
  responseDeadlineMinutes?: number;
  ttl: number; // 30-day TTL
}

export async function sendAgentMessage(
  msg: Omit<AgentMessage, "messageId" | "sentAt" | "ttl">
): Promise<string> {
  const messageId = crypto.randomUUID();
  const sentAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await db.send(new PutItemCommand({
    TableName: "agent-messages",
    Item: marshall({ ...msg, messageId, sentAt, ttl }),
  }));

  return messageId;
}

export async function readAgentMessages(
  to: string,
  limit = 20
): Promise<AgentMessage[]> {
  const result = await db.send(new QueryCommand({
    TableName: "agent-messages",
    IndexName: "to-sentAt-index",
    KeyConditionExpression: "#to = :to",
    ExpressionAttributeNames: { "#to": "to" },
    ExpressionAttributeValues: marshall({ ":to": to }),
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items ?? []).map(i => unmarshall(i) as AgentMessage);
}

export async function markMessageRead(messageId: string): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: "agent-messages",
    Key: marshall({ messageId }),
    UpdateExpression: "SET readAt = :r",
    ExpressionAttributeValues: marshall({ ":r": new Date().toISOString() }),
  }));
}

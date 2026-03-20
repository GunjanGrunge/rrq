import { PutItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";

const db = getDynamoClient();

type MessageType =
  | "PHASE_UPDATE" | "PUSH_ALERT" | "GREENLIGHT" | "STRATEGY_BRIEF"
  | "PRODUCTION_COMPLETE" | "AD_INSIGHT" | "VIRAL_SIGNAL" | "MEMORY_INJECTION"
  | "LESSON_REQUEST" | "CONFLICT" | "MILESTONE" | "QUALITY_FAIL"
  | "LOW_BALANCE_ALERT" | "NARRATIVE_DRIFT_ALERT" | "REX_DESIGN_SIGNAL"
  | "SAFETY_ESCALATION" | "ZEUS_ESCALATION_DECISION"
  | "VIEWER_REQUEST" | "BOOST_SHORTS";

export interface AgentMessage {
  messageId: string;
  from: string;
  recipientAgent: string;
  type: MessageType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  payload: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
  requiresResponse: boolean;
  responseDeadlineMinutes?: number;
  ttl: number; // 30-day TTL
}

export async function sendAgentMessage(
  msg: Omit<AgentMessage, "messageId" | "createdAt" | "ttl">
): Promise<string> {
  const messageId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  try {
    await db.send(new PutItemCommand({
      TableName: "agent-messages",
      Item: marshall({ ...msg, messageId, createdAt, ttl }),
    }));
  } catch (err) {
    console.error(
      `[messaging:${msg.from}→${msg.recipientAgent}] Failed to send ${msg.type} (priority=${msg.priority}):`,
      err
    );
    throw err; // Caller decides retry — message delivery is critical
  }

  return messageId;
}

export async function readAgentMessages(
  recipientAgent: string,
  limit = 20
): Promise<AgentMessage[]> {
  try {
    const result = await db.send(new QueryCommand({
      TableName: "agent-messages",
      IndexName: "recipientAgent-createdAt-index",
      KeyConditionExpression: "recipientAgent = :ra",
      ExpressionAttributeValues: marshall({ ":ra": recipientAgent }),
      ScanIndexForward: false,
      Limit: limit,
    }));

    return (result.Items ?? []).map(i => unmarshall(i) as AgentMessage);
  } catch (err) {
    console.error(`[messaging:read:${recipientAgent}] Failed to read messages:`, err);
    return []; // Fail open — agent proceeds without messages
  }
}

export async function markMessageRead(messageId: string, recipientAgent: string): Promise<void> {
  try {
    await db.send(new UpdateItemCommand({
      TableName: "agent-messages",
      Key: marshall({ messageId, recipientAgent }),
      UpdateExpression: "SET readAt = :r",
      ExpressionAttributeValues: marshall({ ":r": new Date().toISOString() }),
    }));
  } catch (err) {
    console.error(`[messaging:ack:${messageId}] Failed to mark read:`, err);
    // Best-effort — don't throw for read receipts
  }
}

import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import type { MurphyDecisionEvent } from "./types";

const db = getDynamoClient();
const DECISION_LOG_TABLE = "agent-decision-log";
const VERSION_REGISTRY_TABLE = "agent-version-registry";
const MURPHY_AGENT_ID = "murphy";
const TTL_DAYS = 90;

// ─── Pull active Murphy version from agent-version-registry ──────────────────

let cachedVersion: string | null = null;

export async function getMurphyVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  try {
    // Query GSI: status-activationTimestamp for ACTIVE murphy version
    const { QueryCommand } = await import("@aws-sdk/client-dynamodb");
    const result = await db.send(
      new QueryCommand({
        TableName: VERSION_REGISTRY_TABLE,
        KeyConditionExpression: "agentId = :agentId",
        FilterExpression: "#st = :active",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":agentId": { S: MURPHY_AGENT_ID },
          ":active":  { S: "ACTIVE" },
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    const item = result.Items?.[0];
    if (item) {
      const record = unmarshall(item);
      cachedVersion = (record.version as string) ?? "1.0.0";
    } else {
      cachedVersion = "1.0.0";
    }
  } catch {
    cachedVersion = "1.0.0";
  }

  return cachedVersion!;
}

// ─── Write MurphyDecisionEvent to agent-decision-log ─────────────────────────

export async function logDecisionEvent(event: MurphyDecisionEvent): Promise<void> {
  try {
    const eventId = `murphy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

    await db.send(
      new PutItemCommand({
        TableName: DECISION_LOG_TABLE,
        Item: marshall(
          { ...event, eventId, ttl },
          { removeUndefinedValues: true }
        ),
      })
    );
  } catch (err) {
    console.error("[murphy:decision-logger] Failed to log decision event:", err);
  }
}

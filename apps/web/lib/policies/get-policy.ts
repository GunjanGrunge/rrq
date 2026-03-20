/**
 * Agent Policy Reader
 *
 * Reads runtime-configurable thresholds from the agent-policies DynamoDB table.
 * Falls back to hardcoded defaults when the table is unavailable or the key
 * doesn't exist yet. This allows Oracle to tune thresholds without code changes,
 * while ensuring the system works out-of-the-box before Phase 5 seed runs.
 *
 * Table: agent-policies — PK: agentId (S), SK: policyKey (S)
 * Fields: value, valueType, description, category, source, updatedAt, updatedBy
 */

import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";

const TABLE = "agent-policies";

interface PolicyRecord {
  agentId: string;
  policyKey: string;
  value: string | number | string[];
  valueType: "number" | "string" | "string[]";
  description: string;
  category: string;
  source: "HARDCODED" | "ORACLE" | "USER";
  updatedAt: string;
  updatedBy: string;
}

/**
 * Read a numeric policy value. Returns `fallback` if not found or on error.
 */
export async function getNumericPolicy(
  agentId: string,
  policyKey: string,
  fallback: number
): Promise<number> {
  try {
    const db = getDynamoClient();
    const result = await db.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          agentId: { S: agentId },
          policyKey: { S: policyKey },
        },
        ProjectionExpression: "#v, valueType",
        ExpressionAttributeNames: { "#v": "value" },
      })
    );
    if (!result.Item) return fallback;
    const record = unmarshall(result.Item) as Partial<PolicyRecord>;
    if (typeof record.value === "number") return record.value;
    if (typeof record.value === "string") {
      const parsed = parseFloat(record.value);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  } catch {
    // Fail open — use hardcoded default if DynamoDB is unavailable
    return fallback;
  }
}

/**
 * Read a string policy value. Returns `fallback` if not found or on error.
 */
export async function getStringPolicy(
  agentId: string,
  policyKey: string,
  fallback: string
): Promise<string> {
  try {
    const db = getDynamoClient();
    const result = await db.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          agentId: { S: agentId },
          policyKey: { S: policyKey },
        },
        ProjectionExpression: "#v",
        ExpressionAttributeNames: { "#v": "value" },
      })
    );
    if (!result.Item) return fallback;
    const record = unmarshall(result.Item) as Partial<PolicyRecord>;
    return typeof record.value === "string" ? record.value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Read a string array policy value. Returns `fallback` if not found or on error.
 */
export async function getStringArrayPolicy(
  agentId: string,
  policyKey: string,
  fallback: string[]
): Promise<string[]> {
  try {
    const db = getDynamoClient();
    const result = await db.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          agentId: { S: agentId },
          policyKey: { S: policyKey },
        },
        ProjectionExpression: "#v",
        ExpressionAttributeNames: { "#v": "value" },
      })
    );
    if (!result.Item) return fallback;
    const record = unmarshall(result.Item) as Partial<PolicyRecord>;
    return Array.isArray(record.value) ? record.value : fallback;
  } catch {
    return fallback;
  }
}

import { getDynamoClient } from "@/lib/aws-clients";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CouncilSession } from "./types";

// ─── Get single council session ────────────────────────────────────────────────

export async function getCouncilSession(
  sessionId: string
): Promise<CouncilSession | null> {
  const dynamo = getDynamoClient();

  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: "council-sessions",
        Key: { sessionId },
      })
    );
    return (result.Item as CouncilSession) ?? null;
  } catch (err) {
    console.error(`[council:get-session:${sessionId}] DynamoDB read failed:`, err);
    return null;
  }
}

// ─── Get recent council sessions ──────────────────────────────────────────────

export async function getRecentCouncilSessions(
  limit = 5
): Promise<CouncilSession[]> {
  const dynamo = getDynamoClient();

  try {
    // Scan with limit — council-sessions is small enough that scan is fine
    // In production, add a GSI on createdAt for efficient range queries
    const result = await dynamo.send(
      new QueryCommand({
        TableName: "council-sessions",
        IndexName: "status-createdAt-index",
        KeyConditionExpression: "#s = :dummy",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":dummy": "APPROVED" },
        Limit: limit,
        ScanIndexForward: false,
      })
    );

    // Fallback: if GSI query fails, return empty
    return (result.Items ?? []) as CouncilSession[];
  } catch {
    // Table or GSI not provisioned yet — return empty gracefully
    return [];
  }
}

// ─── Get council session by jobId ─────────────────────────────────────────────

export async function getCouncilSessionByJobId(
  jobId: string
): Promise<CouncilSession | null> {
  const dynamo = getDynamoClient();

  try {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: "council-sessions",
        IndexName: "jobId-index",
        KeyConditionExpression: "jobId = :jobId",
        ExpressionAttributeValues: { ":jobId": jobId },
        Limit: 1,
        ScanIndexForward: false,
      })
    );

    const items = result.Items ?? [];
    return items.length > 0 ? (items[0] as CouncilSession) : null;
  } catch (err) {
    console.error(`[council:get-by-job:${jobId}] DynamoDB query failed:`, err);
    return null;
  }
}

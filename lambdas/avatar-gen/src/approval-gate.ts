/**
 * approval-gate.ts
 *
 * Human-in-loop approval gate state management for presenter portrait review.
 *
 * Default state: OFF (avatar_approval_gate = false in user-settings DynamoDB).
 * When enabled: pipeline hard-stops after portrait generation for user review.
 * Auto-approves after 24-hour timeout if no user action.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const APPROVAL_TIMEOUT_HOURS = Number(
  process.env.AVATAR_APPROVAL_TIMEOUT_HOURS ?? "24"
);

// ─── Check approval gate setting ─────────────────────────────────────────────

/**
 * Check if the human approval gate is enabled for this user.
 * Reads avatar_approval_gate field from user-settings DynamoDB table.
 * Defaults to false (gate off) if setting not found.
 */
export async function isApprovalGateEnabled(userId: string): Promise<boolean> {
  try {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: "user-settings",
        Key: { userId: { S: userId } },
        ProjectionExpression: "avatar_approval_gate",
      })
    );

    const value = result.Item?.avatar_approval_gate?.BOOL;
    return value === true;
  } catch (err) {
    console.warn(
      `[approval-gate] Could not read user-settings for userId=${userId}: ${err}. Defaulting to gate OFF.`
    );
    return false;
  }
}

// ─── Auto-approve on timeout ──────────────────────────────────────────────────

/**
 * Check if a presenter is past the approval timeout window.
 * If so, auto-approve and log to CloudWatch.
 *
 * Called by a scheduled Lambda or EventBridge rule — not in the hot path.
 */
export async function checkApprovalTimeout(
  channelId: string,
  presenterId: string
): Promise<void> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      ProjectionExpression: "approval_status, generated_at",
    })
  );

  const item = result.Item;
  if (!item) {
    console.warn(
      `[approval-gate] No profile found for ${channelId}/${presenterId}`
    );
    return;
  }

  const approvalStatus = item.approval_status?.S;
  const generatedAt    = item.generated_at?.S;

  if (approvalStatus !== "PENDING_APPROVAL") {
    // Already approved — nothing to do
    return;
  }

  if (!generatedAt) {
    console.warn(
      `[approval-gate] Missing generated_at for ${channelId}/${presenterId} — cannot check timeout`
    );
    return;
  }

  const generatedAtMs  = new Date(generatedAt).getTime();
  const timeoutMs      = APPROVAL_TIMEOUT_HOURS * 60 * 60 * 1000;
  const now            = Date.now();

  if (now < generatedAtMs + timeoutMs) {
    // Not yet timed out
    return;
  }

  // Timeout exceeded — auto-approve
  console.log(
    `[approval-gate] Auto-approving ${presenterId} (channelId=${channelId}) — ` +
    `${APPROVAL_TIMEOUT_HOURS}hr timeout exceeded`
  );

  await approvePresenter(channelId, presenterId, "AUTO_TIMEOUT");
}

// ─── Approve presenter ────────────────────────────────────────────────────────

/**
 * Mark a presenter as approved in DynamoDB.
 * Called on human approval (from /api/avatars/approve) or auto-timeout.
 */
export async function approvePresenter(
  channelId: string,
  presenterId: string,
  approvedBy: "HUMAN" | "AUTO_TIMEOUT"
): Promise<void> {
  const approvedAt = new Date().toISOString();
  const newStatus  = approvedBy === "HUMAN" ? "APPROVED" : "AUTO_APPROVED";

  await dynamo.send(
    new UpdateItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      UpdateExpression:
        "SET approval_status = :s, approved_at = :t, approved_by = :b",
      ExpressionAttributeValues: {
        ":s": { S: newStatus },
        ":t": { S: approvedAt },
        ":b": { S: approvedBy },
      },
    })
  );

  console.log(
    `[approval-gate] ${presenterId} (channelId=${channelId}) ` +
    `${newStatus} by ${approvedBy} at ${approvedAt}`
  );
}

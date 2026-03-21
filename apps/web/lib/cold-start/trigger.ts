// ─── Cold Start — Trigger + DynamoDB State Management ───────────────────────

import { getDynamoClient } from "@/lib/aws-clients";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { inngest } from "@/lib/inngest";
import type { ColdStartSprint, SprintPhase, ColdStartStatus } from "./types";

// ─── Trigger ─────────────────────────────────────────────────────────────────

export async function triggerColdStart(
  userId: string,
  channelMode: "FULL_RRQ" | "MULTI_NICHE" | "SINGLE_NICHE",
  selectedNiches: string[],
): Promise<{ sprintId: string }> {
  const sprintId = `cs-${userId}-${Date.now()}`;

  // Write initial record
  const dynamo = getDynamoClient();
  await dynamo.send(
    new PutCommand({
      TableName: "cold-start-sprints",
      Item: {
        userId,
        sprintId,
        channelMode,
        selectedNiches,
        sprintStartedAt: new Date().toISOString(),
        currentPhase: "REX_SCAN" as SprintPhase,
        status: "RUNNING" as ColdStartStatus,
      } satisfies ColdStartSprint,
    }),
  );

  // Fire Inngest workflow
  await inngest.send({
    name: "cold-start/sprint.triggered",
    data: { userId, sprintId, channelMode, selectedNiches },
  });

  return { sprintId };
}

// ─── State reads ──────────────────────────────────────────────────────────────

export async function getColdStartSprint(
  userId: string,
): Promise<ColdStartSprint | null> {
  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: "cold-start-sprints",
        Key: { userId },
      }),
    );
    return (result.Item as ColdStartSprint) ?? null;
  } catch {
    return null;
  }
}

// ─── Phase updates (called by Inngest steps) ─────────────────────────────────

export async function updateSprintPhase(
  userId: string,
  phase: SprintPhase,
  extra?: Record<string, unknown>,
): Promise<void> {
  const dynamo = getDynamoClient();

  const updates: string[] = ["currentPhase = :phase", "updatedAt = :now"];
  const values: Record<string, unknown> = {
    ":phase": phase,
    ":now": new Date().toISOString(),
  };

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      updates.push(`${k} = :${k}`);
      values[`:${k}`] = v;
    }
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: "cold-start-sprints",
      Key: { userId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function markSprintComplete(
  userId: string,
  summary: {
    contentGapMap: unknown[];
    oversaturatedAngles: string[];
    firstVideoShortlist: unknown[];
    coldStartStrategy: string;
    syntheticRecordsSeeded: number;
  },
): Promise<void> {
  const dynamo = getDynamoClient();
  await dynamo.send(
    new UpdateCommand({
      TableName: "cold-start-sprints",
      Key: { userId },
      UpdateExpression:
        "SET #s = :s, currentPhase = :phase, sprintCompletedAt = :now, " +
        "contentGapMap = :gaps, oversaturatedAngles = :angles, " +
        "firstVideoShortlist = :shortlist, coldStartStrategy = :strategy, " +
        "syntheticRecordsSeeded = :seeded",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": "COMPLETE",
        ":phase": "COMPLETE",
        ":now": new Date().toISOString(),
        ":gaps": summary.contentGapMap,
        ":angles": summary.oversaturatedAngles,
        ":shortlist": summary.firstVideoShortlist,
        ":strategy": summary.coldStartStrategy,
        ":seeded": summary.syntheticRecordsSeeded,
      },
    }),
  );
}

export async function markSprintFailed(
  userId: string,
  error: string,
): Promise<void> {
  const dynamo = getDynamoClient();
  await dynamo.send(
    new UpdateCommand({
      TableName: "cold-start-sprints",
      Key: { userId },
      UpdateExpression:
        "SET #s = :s, #e = :e, updatedAt = :now",
      ExpressionAttributeNames: { "#s": "status", "#e": "error" },
      ExpressionAttributeValues: {
        ":s": "FAILED",
        ":e": error,
        ":now": new Date().toISOString(),
      },
    }),
  );
}

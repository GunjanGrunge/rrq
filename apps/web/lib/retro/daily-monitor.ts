import { getDynamoClient } from "@/lib/aws-clients";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { inngest } from "@/lib/inngest";
import type { RetroSession } from "./types";

// ─── Daily retro monitor ───────────────────────────────────────────────────────

export async function runDailyRetroCheck(sessionId: string): Promise<{
  action: "continue" | "early_close" | "full_retro";
  reason: string;
}> {
  const dynamo = getDynamoClient();

  // Load retro session
  let session: RetroSession | null = null;
  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: "retro-sessions",
        Key: { sessionId },
      })
    );
    session = (result.Item as RetroSession) ?? null;
  } catch (err) {
    console.error(`[retro:daily:${sessionId}] Session load failed:`, err);
    return { action: "continue", reason: "Session load failed — skipping" };
  }

  if (!session) {
    return { action: "continue", reason: "Session not found" };
  }

  if (session.status === "COMPLETED") {
    return { action: "continue", reason: "Session already completed" };
  }

  const newDay = session.currentDay + 1;

  // Check if target was hit
  let targetHit = false;
  try {
    const videoResult = await dynamo.send(
      new GetCommand({
        TableName: "video-memory",
        Key: { videoId: session.videoId },
      })
    );

    if (videoResult.Item) {
      const channelHealth = await dynamo.send(
        new GetCommand({
          TableName: "channel-health",
          Key: { channelId: session.channelId },
        })
      );

      const targetViews = (channelHealth.Item?.targetViews7d as number) ?? 10000;
      const currentViews = (videoResult.Item.totalViews as number) ?? 0;
      targetHit = currentViews >= targetViews;
    }
  } catch (err) {
    console.error(`[retro:daily:${sessionId}] Target check failed:`, err);
  }

  // Increment day counter
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: "retro-sessions",
        Key: { sessionId },
        UpdateExpression: "SET currentDay = :day, targetHit = :hit",
        ExpressionAttributeValues: {
          ":day": newDay,
          ":hit": targetHit,
        },
      })
    );
  } catch (err) {
    console.error(`[retro:daily:${sessionId}] Day increment failed:`, err);
  }

  // Early close if target hit
  if (targetHit) {
    await inngest.send({
      name: "retro/full.triggered",
      data: { sessionId, reason: "TARGET_HIT", day: newDay },
    });
    return { action: "early_close", reason: `Target hit on day ${newDay}` };
  }

  // Full retro at day 7
  if (newDay >= 7) {
    await inngest.send({
      name: "retro/full.triggered",
      data: { sessionId, reason: "DAY_7", day: newDay },
    });
    return { action: "full_retro", reason: "Day 7 reached" };
  }

  return { action: "continue", reason: `Day ${newDay} — monitoring continues` };
}

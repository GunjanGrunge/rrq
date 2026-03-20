import { getDynamoClient } from "@/lib/aws-clients";
import { callBedrockJSON } from "@/lib/bedrock";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { inngest } from "@/lib/inngest";
import type { Day2Result } from "./types";

// ─── Day 2 early read ─────────────────────────────────────────────────────────

export async function runDay2EarlyRead(
  videoId: string,
  sessionId: string,
  channelId: string
): Promise<Day2Result> {
  const dynamo = getDynamoClient();

  // Fetch YouTube analytics from DynamoDB channel-health snapshot
  let channelBaseline = { avgCTR: 4.0, avgRetention: 40 };
  try {
    const healthResult = await dynamo.send(
      new GetCommand({
        TableName: "channel-health",
        Key: { channelId },
      })
    );
    if (healthResult.Item) {
      channelBaseline.avgCTR = (healthResult.Item.avgCTR as number) ?? 4.0;
      channelBaseline.avgRetention = (healthResult.Item.avgRetention as number) ?? 40;
    }
  } catch (err) {
    console.error(`[retro:day2:${sessionId}] Channel health load failed:`, err);
  }

  // Fetch video analytics from video-memory table
  let videoCTR = 0;
  let videoImpressions = 0;
  let videoRetention = 0;
  try {
    const videoResult = await dynamo.send(
      new GetCommand({
        TableName: "video-memory",
        Key: { videoId },
      })
    );
    if (videoResult.Item) {
      videoCTR = (videoResult.Item.ctr48h as number) ?? 0;
      videoImpressions = (videoResult.Item.impressions48h as number) ?? 0;
      videoRetention = (videoResult.Item.avgRetention48h as number) ?? 0;
    }
  } catch (err) {
    console.error(`[retro:day2:${sessionId}] Video analytics load failed:`, err);
  }

  // Haiku evaluation: compare against channel baseline
  let state: Day2Result["state"] = "ON_TRACK";
  try {
    const evaluation = await callBedrockJSON<{ state: "ON_TRACK" | "CONCERN" | "EMERGENCY"; reasoning: string }>({
      model: "haiku",
      systemPrompt: `You are VERA and REX running the Day 2 early read for RRQ Retro.

Classify the 48-hour performance state based on CTR and retention vs channel baseline.

Rules:
- ON_TRACK: CTR ≥ 80% of baseline AND retention ≥ 80% of baseline
- CONCERN: CTR 60-79% of baseline OR retention 60-79% of baseline
- EMERGENCY: CTR < 60% of baseline OR retention < 60% of baseline

Return ONLY valid JSON: {"state": "ON_TRACK"|"CONCERN"|"EMERGENCY", "reasoning": "..."}`,
      userPrompt: `Video 48h performance:
CTR: ${videoCTR}% (channel baseline: ${channelBaseline.avgCTR}%)
Impressions: ${videoImpressions.toLocaleString()}
Retention: ${videoRetention}% (channel baseline: ${channelBaseline.avgRetention}%)

Classify the performance state.`,
      maxTokens: 256,
      temperature: 0.2,
    });
    state = evaluation.state;
  } catch (err) {
    console.error(`[retro:day2:${sessionId}] Haiku evaluation failed:`, err);
  }

  const day2Result: Day2Result = {
    ctr: videoCTR,
    impressions: videoImpressions,
    retention: videoRetention,
    state,
    evaluatedAt: new Date().toISOString(),
  };

  // Update retro session in DynamoDB
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: "retro-sessions",
        Key: { sessionId },
        UpdateExpression:
          "SET day2Result = :day2, #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":day2": day2Result,
          ":status": state,
        },
      })
    );
  } catch (err) {
    console.error(`[retro:day2:${sessionId}] DynamoDB update failed:`, err);
  }

  // On EMERGENCY: trigger council emergency review
  if (state === "EMERGENCY") {
    try {
      await inngest.send({
        name: "council/emergency.triggered",
        data: { sessionId, videoId, day2Result },
      });
    } catch (err) {
      console.error(`[retro:day2:${sessionId}] Emergency council trigger failed:`, err);
    }
  }

  return day2Result;
}

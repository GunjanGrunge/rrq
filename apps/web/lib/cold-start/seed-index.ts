// ─── Cold Start — Council Index Seeding (Hours 20–24) ───────────────────────
// Writes synthetic baseline records to S3 so Bedrock KB sync picks them up

import { getDynamoClient, getS3Client } from "@/lib/aws-clients";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { SprintSynthesis, SniperAuditResult } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function seedCouncilIndex(
  synthesis: SprintSynthesis,
  sniperAudit: SniperAuditResult,
  niches: string[],
  userId: string,
): Promise<number> {
  const bucket = process.env.RRQ_MEMORY_BUCKET;

  if (!bucket) {
    console.warn("[cold-start:seed-index] No RRQ_MEMORY_BUCKET — skipping seeding");
    return 0;
  }

  const syntheticRecords: Array<{ id: string; content: string }> = [];

  // MISS baselines — oversaturated angles to avoid
  for (const angle of synthesis.oversaturatedAngles) {
    const channelCount = sniperAudit.auditResults[0]?.topChannels.length ?? 0;
    syntheticRecords.push({
      id: `synthetic-miss-${generateId()}`,
      content: JSON.stringify({
        type: "SYNTHETIC_MISS_BASELINE",
        niche: niches[0],
        topicAngle: angle,
        lesson: `This angle is oversaturated in the niche as of channel launch. Competitor analysis shows ${channelCount}+ channels have covered this extensively. Avoid until established authority or a genuinely unique angle is developed.`,
        source: "COLD_START_RESEARCH",
        confidence: "RESEARCH_BASED",
        userId,
        createdAt: new Date().toISOString(),
      }),
    });
  }

  // WIN opportunity baselines — high-opportunity content gaps
  for (const gap of synthesis.contentGapMap.filter(
    (g) => g.opportunity === "HIGH",
  )) {
    syntheticRecords.push({
      id: `synthetic-win-${generateId()}`,
      content: JSON.stringify({
        type: "SYNTHETIC_WIN_OPPORTUNITY",
        niche: niches[0],
        topicAngle: gap.gap,
        lesson: `Content gap identified at channel launch. Gap: ${gap.why}. Competitors missing this: ${gap.competitors.join(", ")}. High first-mover opportunity.`,
        source: "COLD_START_RESEARCH",
        confidence: "RESEARCH_BASED",
        userId,
        createdAt: new Date().toISOString(),
      }),
    });
  }

  // Strategy baseline
  syntheticRecords.push({
    id: `synthetic-strategy-${generateId()}`,
    content: JSON.stringify({
      type: "SYNTHETIC_STRATEGY_BASELINE",
      niche: niches.join(", "),
      lesson: `Cold start strategy: ${synthesis.coldStartStrategy}`,
      keyInsight: (synthesis.nicheInsights as Record<string, string>)?.keyObservation ?? "",
      firstMoverOpp: (synthesis.nicheInsights as Record<string, string>)?.firstMoverOpportunity ?? "",
      avoidAtLaunch: (synthesis.nicheInsights as Record<string, string>)?.avoidAtAllCosts ?? "",
      source: "COLD_START_RESEARCH",
      confidence: "RESEARCH_BASED",
      userId,
      createdAt: new Date().toISOString(),
    }),
  });

  // Write each record to S3 — Bedrock KB syncs from s3://rrq-memory/episodes/
  const s3 = getS3Client();
  let seeded = 0;

  for (const record of syntheticRecords) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `episodes/the-line/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${record.id}.json`,
          Body: record.content,
          ContentType: "application/json",
        }),
      );
      seeded++;
    } catch (err) {
      console.error(`[cold-start:seed-index] Failed to write ${record.id} to S3:`, err);
    }
  }

  // Write seeding summary to DynamoDB
  const dynamo = getDynamoClient();
  try {
    await dynamo.send(
      new PutCommand({
        TableName: "oracle-knowledge-index",
        Item: {
          domain: `cold-start-${userId}`,
          lastUpdated: new Date().toISOString(),
          recordsSeeded: seeded,
          niches,
          source: "COLD_START_RESEARCH",
        },
      }),
    );
  } catch (err) {
    console.error("[cold-start:seed-index] Failed to write oracle-knowledge-index:", err);
  }

  return seeded;
}

import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { AdInsight } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

// ─── CPV thresholds by niche ──────────────────────────────────────────────────

const CPV_THRESHOLDS: Record<string, number> = {
  finance: 0.04,
  tech: 0.03,
  crypto: 0.04,
  business: 0.04,
  default: 0.025,
};

function getCPVThreshold(niche: string): number {
  const lower = niche.toLowerCase();
  for (const [key, threshold] of Object.entries(CPV_THRESHOLDS)) {
    if (lower.includes(key)) return threshold;
  }
  return CPV_THRESHOLDS.default;
}

// ─── Fetch ad insights from DynamoDB (written by ads-manager) ────────────────

export async function fetchAdInsights(date: string): Promise<
  Array<{
    campaignId: string;
    videoId: string;
    niche: string;
    views: number;
    clicks: number;
    ctr: number;
    cpv: number;
    viewRate: number;
    spend: number;
    revenueEstimate: number;
    impressions: number;
  }>
> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: "ad-insights",
        KeyConditionExpression: "#date = :date",
        ExpressionAttributeNames: { "#date": "date" },
        ExpressionAttributeValues: marshall({ ":date": date }),
      })
    );

    return (result.Items ?? []).map((i) => {
      const item = unmarshall(i) as {
        campaignId: string;
        videoId: string;
        niche?: string;
        views?: number;
        clicks?: number;
        ctr?: number;
        cpv?: number;
        viewRate?: number;
        spend?: number;
        revenueEstimate?: number;
        impressions?: number;
      };

      return {
        campaignId: item.campaignId,
        videoId: item.videoId,
        niche: item.niche ?? "general",
        views: item.views ?? 0,
        clicks: item.clicks ?? 0,
        ctr: item.ctr ?? 0,
        cpv: item.cpv ?? 0,
        viewRate: item.viewRate ?? 0,
        spend: item.spend ?? 0,
        revenueEstimate: item.revenueEstimate ?? 0,
        impressions: item.impressions ?? 0,
      };
    });
  } catch (err) {
    console.error(`[zeus:ads] Failed to fetch ad insights for ${date}:`, err);
    return [];
  }
}

// ─── Bedrock Sonnet ad performance review ────────────────────────────────────

export async function reviewAdPerformance(
  insights: Awaited<ReturnType<typeof fetchAdInsights>>
): Promise<AdInsight[]> {
  if (insights.length === 0) return [];

  const prompt = `You are Zeus, the performance intelligence system for RRQ YouTube channel.

Review these Google Ads campaign metrics and determine the optimal action for each campaign.

Campaigns to review:
${JSON.stringify(insights, null, 2)}

For each campaign, assess:
1. CPV (cost per view) — is it below the acceptable threshold for the niche?
2. View rate — is it above 30% (healthy)?
3. CTR — is it generating channel subscribers and engagement?
4. Budget efficiency — spend vs revenue estimate
5. Overall campaign health

Return a JSON array with one object per campaign:
[{
  "campaignId": string,
  "videoId": string,
  "signal": "SCALE" | "PAUSE" | "KILL" | "MONITOR",
  "reasoning": string (one sentence)
}]

Signal definitions:
- SCALE: CPV below threshold, view rate > 35%, strong CTR → increase budget 20%
- MONITOR: Within acceptable range but not exceptional → keep as is
- PAUSE: CPV above threshold or view rate < 20% → pause for 48hrs
- KILL: Severely underperforming → stop campaign entirely

Return ONLY valid JSON array. No preamble.`;

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-opus-4-5",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1024,
          system:
            "You are Zeus, performance intelligence for RRQ YouTube. Evaluate ad campaigns with precision. Return valid JSON only.",
          messages: [{ role: "user", content: prompt }],
        }),
      })
    );

    const text = JSON.parse(
      new TextDecoder().decode(response.body)
    ).content[0].text as string;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in Opus ad review response");

    const reviews = JSON.parse(jsonMatch[0]) as Array<{
      campaignId: string;
      videoId: string;
      signal: AdInsight["signal"];
      reasoning: string;
    }>;

    const now = new Date().toISOString();

    return reviews.map((review) => {
      const insight = insights.find(
        (i) => i.campaignId === review.campaignId
      );

      return {
        date: new Date().toISOString().split("T")[0],
        campaignId: review.campaignId,
        videoId: review.videoId,
        views: insight?.views ?? 0,
        clicks: insight?.clicks ?? 0,
        ctr: insight?.ctr ?? 0,
        cpv: insight?.cpv ?? 0,
        viewRate: insight?.viewRate ?? 0,
        spend: insight?.spend ?? 0,
        revenueEstimate: insight?.revenueEstimate ?? 0,
        signal: review.signal,
        reasoning: review.reasoning,
        reviewedAt: now,
      } satisfies AdInsight;
    });
  } catch (err) {
    console.error("[zeus:ads] Opus ad review failed:", err);

    // Fallback: apply threshold rules manually
    const now = new Date().toISOString();
    return insights.map((insight) => {
      const cpvThreshold = getCPVThreshold(insight.niche);
      let signal: AdInsight["signal"];
      let reasoning: string;

      if (insight.cpv === 0 && insight.views === 0) {
        signal = "KILL";
        reasoning = "No views recorded — campaign likely not running";
      } else if (insight.cpv > cpvThreshold * 1.5 || insight.viewRate < 0.15) {
        signal = "KILL";
        reasoning = `CPV ${insight.cpv.toFixed(3)} exceeds ${(cpvThreshold * 1.5).toFixed(3)} threshold or view rate critically low`;
      } else if (insight.cpv > cpvThreshold || insight.viewRate < 0.25) {
        signal = "PAUSE";
        reasoning = `CPV ${insight.cpv.toFixed(3)} above threshold ${cpvThreshold.toFixed(3)} or view rate below 25%`;
      } else if (insight.cpv < cpvThreshold * 0.7 && insight.viewRate > 0.35) {
        signal = "SCALE";
        reasoning = `CPV ${insight.cpv.toFixed(3)} well below threshold, view rate ${(insight.viewRate * 100).toFixed(0)}% strong`;
      } else {
        signal = "MONITOR";
        reasoning = "Performance within acceptable range";
      }

      return {
        date: new Date().toISOString().split("T")[0],
        campaignId: insight.campaignId,
        videoId: insight.videoId,
        views: insight.views,
        clicks: insight.clicks,
        ctr: insight.ctr,
        cpv: insight.cpv,
        viewRate: insight.viewRate,
        spend: insight.spend,
        revenueEstimate: insight.revenueEstimate,
        signal,
        reasoning,
        reviewedAt: now,
      } satisfies AdInsight;
    });
  }
}

// ─── Write ad review back to DynamoDB ────────────────────────────────────────

export async function writeAdReviewToMemory(
  reviews: AdInsight[]
): Promise<void> {
  const writeOps = reviews.map(async (review) => {
    try {
      await db.send(
        new UpdateItemCommand({
          TableName: "ad-insights",
          Key: marshall({
            date: review.date,
            campaignId: review.campaignId,
          }),
          UpdateExpression:
            "SET reviewSignal = :s, reviewReasoning = :r, reviewedAt = :t",
          ExpressionAttributeValues: marshall({
            ":s": review.signal,
            ":r": review.reasoning,
            ":t": review.reviewedAt,
          }),
        })
      );

      // Also update ad-campaigns table if action is significant
      if (review.signal !== "MONITOR") {
        await updateCampaignStatus(review);
      }

      console.log(
        `[zeus:ads] Review written for campaign ${review.campaignId}: ${review.signal}`
      );
    } catch (err) {
      console.error(
        `[zeus:ads] Failed to write review for campaign ${review.campaignId}:`,
        err
      );
    }
  });

  await Promise.allSettled(writeOps);
}

// ─── Update campaign status in ad-campaigns table ────────────────────────────

async function updateCampaignStatus(review: AdInsight): Promise<void> {
  // Zeus only reads and writes signals — never directly controls campaigns
  // That's Harvy's domain (budget-guard.ts, campaign-control.ts)
  // Zeus writes the signal to ad-campaigns so Harvy can pick it up
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: "ad-campaigns",
        Key: marshall({ videoId: review.videoId, campaignId: review.campaignId }),
        UpdateExpression:
          "SET zeusSignal = :s, zeusSignalReasoning = :r, zeusSignalAt = :t",
        ExpressionAttributeValues: marshall({
          ":s": review.signal,
          ":r": review.reasoning,
          ":t": new Date().toISOString(),
        }),
      })
    );
  } catch (err) {
    // Non-fatal — campaign may not exist yet
    console.warn(
      `[zeus:ads] Could not update ad-campaigns for ${review.videoId}:`,
      err
    );
  }
}

// ─── Check if a video qualifies for an ad campaign ───────────────────────────

export async function shouldRunAdCampaign(videoId: string): Promise<{
  eligible: boolean;
  reason: string;
}> {
  try {
    // Read the video's health record
    const result = await db.send(
      new GetItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
      })
    );

    if (!result.Item) {
      return { eligible: false, reason: "Video not found in memory" };
    }

    const record = unmarshall(result.Item) as {
      health_24hr?: { healthScore?: number; action?: string };
      health_72hr?: { healthScore?: number; action?: string };
    };

    const health24 = record.health_24hr?.healthScore ?? null;
    const health72 = record.health_72hr?.healthScore ?? null;
    const action72 = record.health_72hr?.action;

    // Must have 72hr data for campaign decision
    if (health72 === null) {
      return {
        eligible: false,
        reason: "Waiting for 72hr health data before campaign decision",
      };
    }

    // Not eligible if Zeus flagged for archival
    if (action72 === "ARCHIVE") {
      return { eligible: false, reason: "Video flagged for archival — not worth promoting" };
    }

    // Promote videos scoring above 55/100 at 72hr
    if (health72 >= 55) {
      return {
        eligible: true,
        reason: `72hr health score ${health72}/100 qualifies for campaign`,
      };
    }

    // Check if 24hr was strong (early momentum)
    if (health24 !== null && health24 >= 70 && health72 >= 40) {
      return {
        eligible: true,
        reason: `Strong 24hr score (${health24}) with maintained 72hr score (${health72}) — momentum candidate`,
      };
    }

    return {
      eligible: false,
      reason: `72hr health score ${health72}/100 below 55 threshold`,
    };
  } catch (err) {
    console.error(
      `[zeus:ads] Failed to check campaign eligibility for ${videoId}:`,
      err
    );
    return { eligible: false, reason: "Error checking campaign eligibility" };
  }
}

// ─── Fetch and log daily ad summary ──────────────────────────────────────────

export async function logDailyAdSummary(date: string): Promise<{
  totalSpend: number;
  totalViews: number;
  scaleCount: number;
  pauseCount: number;
  killCount: number;
  monitorCount: number;
}> {
  try {
    const reviews = await fetchAdInsights(date);

    const summary = {
      totalSpend: reviews.reduce((sum, r) => sum + r.spend, 0),
      totalViews: reviews.reduce((sum, r) => sum + r.views, 0),
      scaleCount: 0,
      pauseCount: 0,
      killCount: 0,
      monitorCount: 0,
    };

    // Read signals from DynamoDB to count actions
    for (const review of reviews) {
      const result = await db.send(
        new GetItemCommand({
          TableName: "ad-insights",
          Key: marshall({ date, campaignId: review.campaignId }),
          ProjectionExpression: "reviewSignal",
        })
      );

      const signal = result.Item
        ? (unmarshall(result.Item) as { reviewSignal?: string }).reviewSignal
        : null;

      if (signal === "SCALE") summary.scaleCount++;
      else if (signal === "PAUSE") summary.pauseCount++;
      else if (signal === "KILL") summary.killCount++;
      else summary.monitorCount++;
    }

    return summary;
  } catch (err) {
    console.error("[zeus:ads] Failed to log daily ad summary:", err);
    return {
      totalSpend: 0,
      totalViews: 0,
      scaleCount: 0,
      pauseCount: 0,
      killCount: 0,
      monitorCount: 0,
    };
  }
}

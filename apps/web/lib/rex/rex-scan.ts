import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getBedrockClient } from "@/lib/aws-clients";

import { fetchAllSignals, type RawSignal } from "./signal-fetchers";
import {
  calculateConfidence,
  getMaturityLevel,
  getUrgency,
  getTrendVelocityLabel,
  getShelfLifeLabel,
} from "./confidence-scorer";
import {
  getSourceWeight,
  getNicheProfile,
  getNicheRelevanceScore,
  isTopicInCooldown,
  recordTopicSeen,
  updateRRQState,
} from "./memory-store";
import {
  getWatchlist,
  addToWatchlist,
  updateWatchlistItem,
  evaluateWatchlistItem,
} from "./watchlist";
import { writeTopicToQueue } from "./topic-queue";
import { sendAgentMessage } from "../mission/messaging";
import { queryAgentMemory } from "../memory/kb-query";
import { setAgentStatus } from "../memory/agent-status";
import { getRexConfidenceThreshold } from "../mission/phase-engine";
import { getNumericPolicy } from "../policies/get-policy";
import type { ChannelPhase } from "../mission/phase-engine";

const bedrock = getBedrockClient();
const db = getDynamoClient();

export interface RexOpportunity {
  topicId: string;
  topic: string;
  niche: string;
  headline: string;
  confidenceScore: number; // 0–100
  maturityLevel: "breaking" | "developing" | "confirmed" | "evergreen";
  trendVelocity: "rising_fast" | "rising" | "peaked" | "falling";
  shelfLife: "24hrs" | "48hrs" | "1week" | "evergreen";
  sources: { url: string; tier: number; title: string }[];
  suggestedAngles: string[];
  competitorGap: string;
  urgency: "publish_now" | "publish_today" | "publish_thisweek";
  viewerRequestCount: number;
  rexReasoning: string;
}

interface TopicCluster {
  topic: string;
  signals: RawSignal[];
  normalizedScore: number;
}

function clusterSignals(signals: RawSignal[]): TopicCluster[] {
  const clusters = new Map<string, RawSignal[]>();

  for (const signal of signals) {
    // Normalize topic — simple keyword dedup
    const normalized = signal.topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(" ")
      .slice(0, 5)
      .join(" ");

    const existing = Array.from(clusters.keys()).find(k => {
      const words = normalized.split(" ");
      const keyWords = k.split(" ");
      const overlap = words.filter(w => keyWords.includes(w) && w.length > 3).length;
      return overlap >= 2;
    });

    const key = existing ?? normalized;
    const list = clusters.get(key) ?? [];
    list.push(signal);
    clusters.set(key, list);
  }

  return Array.from(clusters.entries()).map(([, sigs]) => ({
    topic: sigs[0].topic, // use original title from first signal
    signals: sigs,
    normalizedScore:
      sigs.reduce((sum, s) => sum + (s.velocity ?? 0.5), 0) / sigs.length,
  }));
}

async function applySourceWeights(
  clusters: TopicCluster[]
): Promise<TopicCluster[]> {
  return Promise.all(
    clusters.map(async cluster => {
      const weights = await Promise.all(
        cluster.signals.map(s => getSourceWeight(s.source))
      );
      const avgMultiplier =
        weights.reduce((a, w) => a + w.performanceMultiplier, 0) /
        weights.length;
      return {
        ...cluster,
        normalizedScore: cluster.normalizedScore * avgMultiplier,
      };
    })
  );
}

export async function runRexScan(
  channelId: string,
  userId: string,
  phase: ChannelPhase,
  channelMode: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE",
  niche?: string
): Promise<RexOpportunity[]> {
  await setAgentStatus("rex", "RUNNING", "scanning");

  try {
    // 1. Zeus memory injection
    const memoryResults = await queryAgentMemory(
      `trend scanning ${niche ?? "all niches"}`,
      5
    );
    const memory = memoryResults.map(r => r.text).join("\n");

    // 2. Fetch all signals in parallel
    const rawSignals = await fetchAllSignals();

    // 3. Cluster by topic
    const clusters = clusterSignals(rawSignals);

    // 4. Apply source weights + niche filter
    const weighted = await applySourceWeights(clusters);
    const nicheProfile = await getNicheProfile(channelId);

    const nicheRelevanceDrop = await getNumericPolicy("rex", "niche_relevance_drop", 0.4);

    const filtered: TopicCluster[] = [];
    for (const cluster of weighted) {
      const relevance = await getNicheRelevanceScore(cluster.topic, nicheProfile);
      if (relevance < nicheRelevanceDrop) continue; // hard drop — configurable via agent-policies
      if (await isTopicInCooldown(cluster.topic)) continue; // dedup 72h
      filtered.push(cluster);
    }

    // 5. Score each cluster
    const scored = filtered.map(cluster => {
      const confidence = calculateConfidence(
        cluster.topic,
        niche ?? "general",
        cluster.signals
      );
      return { ...cluster, confidence };
    });

    // 6. Fetch + update watchlist
    const watchlist = await getWatchlist(userId);
    for (const item of watchlist) {
      const matchingCluster = scored.find(s =>
        s.topic.toLowerCase().includes(item.topic.toLowerCase().slice(0, 20))
      );
      if (matchingCluster) {
        const newStatus = evaluateWatchlistItem(
          item,
          matchingCluster.confidence.overall
        );
        await updateWatchlistItem(
          userId,
          item.topicId,
          matchingCluster.confidence.overall,
          newStatus
        );
      }
    }

    // Sort by overall confidence desc, take top N for Opus
    const topN = await getNumericPolicy("rex", "opus_top_n", 15);
    const top = scored
      .sort((a, b) => b.confidence.overall - a.confidence.overall)
      .slice(0, topN);

    // 7. Opus reasoning pass
    const confidenceThreshold = await getRexConfidenceThreshold(phase);
    const watchlistSummary = watchlist
      .slice(0, 5)
      .map(w => ({
        topic: w.topic,
        checkCount: w.checkCount,
        trajectory: w.confidenceHistory.slice(-3),
      }));

    const prompt = `You are Rex, intelligence agent for RRQ YouTube channel.

${memory ? `Zeus memory context:\n${memory}\n\n` : ""}Channel phase: ${phase}
Minimum confidence threshold: ${confidenceThreshold}/100
Niche: ${niche ?? "open — all topics welcome"}

Evaluate these trending topics and decide which to GREENLIGHT, WATCHLIST, or DROP.

Scored topics (confidence × 100):
${top
  .map(
    t =>
      `- "${t.topic}" | confidence: ${Math.round(
        t.confidence.overall * 100
      )} | sources: ${t.signals.length} | velocity: ${Math.round(
        t.confidence.trendVelocity * 100
      )}`
  )
  .join("\n")}

Current watchlist (topics being monitored):
${
  watchlistSummary
    .map(
      w =>
        `- "${w.topic}" checked ${w.checkCount}x, score trend: ${w.trajectory}`
    )
    .join("\n") || "Empty"
}

Rules:
- GREENLIGHT only topics above confidence threshold (${confidenceThreshold})
- WATCHLIST topics with potential but not enough sources/maturity yet
- DROP everything else
- Be conservative — one bad video harms the channel permanently
- For GREENLIGHT: provide headline, 2-3 suggested angles, competitor gap analysis, reasoning
- Return ONLY valid JSON array

Format:
[{
  "topic": "exact topic string",
  "decision": "GREENLIGHT" | "WATCHLIST" | "DROP",
  "headline": "Rex's single-line take (GREENLIGHT only)",
  "suggestedAngles": ["angle1", "angle2"] (GREENLIGHT only),
  "competitorGap": "what hasn't been covered well" (GREENLIGHT only),
  "rexReasoning": "why this decision",
  "estimatedCTR": "3-5%" (GREENLIGHT only)
}]`;

    const bedrockRes = await bedrock.send(
      new InvokeModelCommand({
        modelId: "us.anthropic.claude-opus-4-6-v1",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 4000,
          system:
            "You are Rex, intelligence and scouting agent for RRQ. Always return valid JSON.",
          messages: [{ role: "user", content: prompt }],
        }),
      })
    );

    const responseText = JSON.parse(
      new TextDecoder().decode(bedrockRes.body)
    ).content[0].text as string;

    let decisions: Array<{
      topic: string;
      decision: "GREENLIGHT" | "WATCHLIST" | "DROP";
      headline?: string;
      suggestedAngles?: string[];
      competitorGap?: string;
      rexReasoning: string;
      estimatedCTR?: string;
    }>;

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      decisions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      decisions = [];
    }

    // 8. Process decisions
    const greenlights: RexOpportunity[] = [];

    for (const decision of decisions) {
      const cluster = top.find(t => t.topic === decision.topic);
      if (!cluster) continue;

      if (decision.decision === "GREENLIGHT") {
        const topicId = crypto.randomUUID();
        const maturity = getMaturityLevel(
          cluster.confidence,
          cluster.signals.length
        );
        const opportunity: RexOpportunity = {
          topicId,
          topic: decision.topic,
          niche: niche ?? "general",
          headline: decision.headline ?? decision.topic,
          confidenceScore: Math.round(cluster.confidence.overall * 100),
          maturityLevel: maturity,
          trendVelocity: getTrendVelocityLabel(cluster.confidence.trendVelocity),
          shelfLife: getShelfLifeLabel(cluster.confidence.shelfLife),
          sources: cluster.signals.map(s => ({
            url: s.sourceUrl,
            tier: s.tier,
            title: s.topic,
          })),
          suggestedAngles: decision.suggestedAngles ?? [],
          competitorGap: decision.competitorGap ?? "Unknown",
          urgency: getUrgency(maturity),
          viewerRequestCount: 0,
          rexReasoning: decision.rexReasoning,
        };

        // Record topic to prevent 72h re-generation
        await recordTopicSeen(decision.topic, topicId);

        // Write greenlit topic to DynamoDB rex-watchlist
        await db.send(
          new PutItemCommand({
            TableName: "rex-watchlist",
            Item: marshall({
              userId,
              topicId,
              topic: decision.topic,
              niche: opportunity.niche,
              headline: opportunity.headline,
              confidenceScore: opportunity.confidenceScore,
              maturityLevel: opportunity.maturityLevel,
              urgency: opportunity.urgency,
              sources: opportunity.sources,
              suggestedAngles: opportunity.suggestedAngles,
              competitorGap: opportunity.competitorGap,
              rexReasoning: opportunity.rexReasoning,
              status: "greenlit",
              createdAt: new Date().toISOString(),
            }),
          })
        );

        greenlights.push(opportunity);

        if (channelMode === "REX_MODE") {
          // Write to user-facing topic queue (user must GO)
          await writeTopicToQueue(userId, {
            topic: decision.topic,
            confidenceScore: opportunity.confidenceScore,
            rexReasoning: decision.rexReasoning,
            signalSources: cluster.signals.map(s => s.source),
            estimatedCTR: decision.estimatedCTR ?? "3–5%",
            nicheFit:
              opportunity.confidenceScore >= 75
                ? "STRONG"
                : opportunity.confidenceScore >= 55
                ? "MODERATE"
                : "WEAK",
          });
        } else if (channelMode === "AUTOPILOT_MODE") {
          // Forward to THE LINE → ARIA → Regum chain
          await sendAgentMessage({
            from: "rex",
            recipientAgent: "the_line",
            type: "GREENLIGHT",
            priority:
              opportunity.urgency === "publish_now" ? "URGENT" : "HIGH",
            requiresResponse: true,
            responseDeadlineMinutes: 60,
            payload: {
              topicId: opportunity.topicId,
              topic: opportunity.topic,
              confidenceScore: opportunity.confidenceScore,
              rexReasoning: opportunity.rexReasoning,
              suggestedAngles: opportunity.suggestedAngles,
              urgency: opportunity.urgency,
              maturityLevel: opportunity.maturityLevel,
            },
          });
        }
      } else if (decision.decision === "WATCHLIST") {
        await addToWatchlist(userId, {
          topic: decision.topic,
          niche: niche ?? "general",
          confidenceHistory: [cluster.confidence.overall],
          sources: cluster.signals.map(s => s.sourceUrl),
          source: "rex_scan",
        });
      }
    }

    // 9. Update RRQ state
    await updateRRQState(channelId, {
      lastRunAt: new Date().toISOString(),
      queueDepth: greenlights.length,
    });

    await setAgentStatus(
      "rex",
      "IDLE",
      `lastScan:${new Date().toISOString()} greenlights:${greenlights.length}`
    );

    return greenlights;
  } catch (error) {
    await setAgentStatus("rex", "ERROR", String(error));
    throw error;
  }
}

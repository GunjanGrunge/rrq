import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "@/lib/aws-clients";
import { getNumericPolicy, getStringArrayPolicy } from "@/lib/policies/get-policy";

import { queryAgentMemory } from "@/lib/memory/kb-query";
import { setAgentStatus } from "@/lib/memory/agent-status";
import { sendAgentMessage } from "@/lib/mission/messaging";
import type { ChannelPhase } from "@/lib/mission/phase-engine";
import type { RexOpportunity } from "@/lib/rex/rex-scan";

import {
  getNicheRatioLast7Days,
  findNextUploadSlot,
  calculateShortsPublish,
  writeToSchedule,
} from "./schedule";
import {
  findBestPlaylistKey,
  detectSeries,
} from "./playlist-manager";
import {
  getAvatarRoster,
  getRecentPresenterHistory,
  selectPresenter,
} from "./presenter-rotation";
import {
  writeQeonBrief,
  getRecentTopics,
  getTopPerformingVideo,
} from "./production-jobs";
import type {
  QeonBrief,
  RegumEvaluation,
  UploadUrgency,
  ContentTone,
  RegumAnalyticsReview,
} from "./types";

const bedrock = getBedrockClient();

const ANGLE_MULTIPLIERS: Record<string, number> = {
  curiosity_gap: 1.5,
  contrarian:    1.4,
  practical:     1.3,
  explainer:     1.2,
  straight_news: 0.8,
};

const HIGH_CPM_NICHES = [
  "finance", "tech", "business", "crypto", "software", "investing",
];

// ─── Topic similarity ─────────────────────────────────────────────────────────

function topicSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function detectAngleType(angle: string): string {
  const lower = angle.toLowerCase();
  if (
    lower.includes("why") ||
    lower.includes("secret") ||
    lower.includes("hidden") ||
    lower.includes("reveal")
  )
    return "curiosity_gap";
  if (
    lower.includes("wrong") ||
    lower.includes("myth") ||
    lower.includes("overrated") ||
    lower.includes("actually")
  )
    return "contrarian";
  if (
    lower.includes("how to") ||
    lower.includes("guide") ||
    lower.includes("step") ||
    lower.includes("tips")
  )
    return "practical";
  if (
    lower.includes("explain") ||
    lower.includes("what is") ||
    lower.includes("breakdown")
  )
    return "explainer";
  return "straight_news";
}

function selectBestAngle(angles: string[]): { angle: string; type: string } {
  if (angles.length === 0) return { angle: "Overview and analysis", type: "explainer" };
  const scored = angles
    .map(a => {
      const type = detectAngleType(a);
      return { angle: a, type, score: ANGLE_MULTIPLIERS[type] ?? 1.0 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0];
}

function estimateTimingScore(urgency: string, maturityLevel: string): number {
  if (urgency === "publish_now" && maturityLevel === "breaking") return 0.95;
  if (urgency === "publish_today" && maturityLevel === "developing") return 0.80;
  if (maturityLevel === "confirmed") return 0.70;
  if (maturityLevel === "evergreen") return 0.60;
  return 0.50;
}

function estimateRevenueScore(niche: string): number {
  const lower = niche.toLowerCase();
  return HIGH_CPM_NICHES.some(h => lower.includes(h)) ? 0.85 : 0.50;
}

function mapUrgency(rexUrgency: string): UploadUrgency {
  if (rexUrgency === "publish_now") return "now";
  if (rexUrgency === "publish_today") return "today";
  return "thisweek";
}

function mapTone(niche: string, angle: string): ContentTone {
  const lower = niche.toLowerCase() + " " + angle.toLowerCase();
  if (
    lower.includes("controversy") ||
    lower.includes("wrong") ||
    lower.includes("myth")
  )
    return "controversial";
  if (
    lower.includes("entertainment") ||
    lower.includes("culture") ||
    lower.includes("sports")
  )
    return "entertaining";
  if (
    lower.includes("deep") ||
    lower.includes("history") ||
    lower.includes("investigation")
  )
    return "documentary";
  return "informative";
}

function estimateTargetDuration(maturityLevel: string, angle: string): number {
  if (
    angle.toLowerCase().includes("deep dive") ||
    detectAngleType(angle) === "explainer"
  )
    return 15;
  if (maturityLevel === "evergreen") return 12;
  if (maturityLevel === "breaking") return 6;
  return 10;
}

// ─── Evaluate a single Rex opportunity ───────────────────────────────────────

async function evaluateOpportunity(
  opp: RexOpportunity,
  recentTopics: string[],
  channelMode: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE"
): Promise<RegumEvaluation> {
  // 1. Confidence floor
  if (opp.confidenceScore < 50) {
    return {
      topicId: opp.topicId,
      rexConfidence: opp.confidenceScore,
      rexUrgency: opp.urgency,
      rexAngles: opp.suggestedAngles,
      channelFitScore: 0,
      saturationScore: 0,
      timingScore: 0,
      revenueScore: 0,
      audienceRequestScore: 0,
      totalScore: 0,
      decision: "hold",
      chosenAngle: "",
      reasoning: "Rex confidence below minimum threshold (50)",
    };
  }

  // 2. Recently covered
  const recentlyCovered = recentTopics.some(t => topicSimilarity(t, opp.topic) > 0.8);
  if (recentlyCovered) {
    return {
      topicId: opp.topicId,
      rexConfidence: opp.confidenceScore,
      rexUrgency: opp.urgency,
      rexAngles: opp.suggestedAngles,
      channelFitScore: 0,
      saturationScore: 1,
      timingScore: 0,
      revenueScore: 0,
      audienceRequestScore: 0,
      totalScore: 0,
      decision: "reject",
      chosenAngle: "",
      reasoning: "Topic recently covered — too similar to recent production",
    };
  }

  // 3. Niche balance check
  const nicheRatio = await getNicheRatioLast7Days(opp.niche);
  if (nicheRatio > 0.5) {
    return {
      topicId: opp.topicId,
      rexConfidence: opp.confidenceScore,
      rexUrgency: opp.urgency,
      rexAngles: opp.suggestedAngles,
      channelFitScore: 0.5,
      saturationScore: nicheRatio,
      timingScore: 0,
      revenueScore: 0,
      audienceRequestScore: 0,
      totalScore: 0,
      decision: "hold",
      chosenAngle: "",
      reasoning: `Niche ${opp.niche} represents ${Math.round(nicheRatio * 100)}% of last 7 days — balance breached`,
    };
  }

  // 4. Score the opportunity
  const channelFitScore = (opp.confidenceScore / 100) * 0.8 + 0.2; // Rex already assessed fit
  const saturationScore = opp.competitorGap ? 0.3 : 0.6; // presence of gap = low saturation
  const timingScore = estimateTimingScore(opp.urgency, opp.maturityLevel);
  const revenueScore = estimateRevenueScore(opp.niche);
  const audienceRequestScore =
    opp.viewerRequestCount > 0 ? Math.min(1, opp.viewerRequestCount / 10) : 0;

  const totalScore =
    (opp.confidenceScore / 100) * 0.30 +
    channelFitScore             * 0.25 +
    (1 - saturationScore)       * 0.20 +
    timingScore                 * 0.15 +
    revenueScore                * 0.10;

  const { angle } = selectBestAngle(opp.suggestedAngles);

  return {
    topicId: opp.topicId,
    rexConfidence: opp.confidenceScore,
    rexUrgency: opp.urgency,
    rexAngles: opp.suggestedAngles,
    channelFitScore,
    saturationScore,
    timingScore,
    revenueScore,
    audienceRequestScore,
    totalScore,
    decision: totalScore >= 0.65 ? "greenlight" : "hold",
    chosenAngle: angle,
    reasoning: `Score: ${totalScore.toFixed(2)} — fit=${channelFitScore.toFixed(2)}, timing=${timingScore.toFixed(2)}, revenue=${revenueScore.toFixed(2)}`,
  };
}

// ─── Build QeonBrief ──────────────────────────────────────────────────────────

async function buildQeonBrief(
  opp: RexOpportunity,
  evaluation: RegumEvaluation,
  memories: string[],
  channelMode: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE",
  userId: string
): Promise<QeonBrief> {
  const urgency = mapUrgency(opp.urgency);
  const scheduledPublish = await findNextUploadSlot(urgency);
  const shortsPublish = calculateShortsPublish(scheduledPublish);
  const targetDuration = estimateTargetDuration(opp.maturityLevel, evaluation.chosenAngle);
  const tone = mapTone(opp.niche, evaluation.chosenAngle);
  const seriesId = detectSeries(opp.topic, opp.urgency, targetDuration, opp.maturityLevel);
  const playlistKey = findBestPlaylistKey(opp.topic, opp.niche);
  const endScreen = await getTopPerformingVideo(opp.niche);

  const contentType = opp.niche.toLowerCase().includes("tech")
    ? "tech-review"
    : opp.niche.toLowerCase().includes("news")
    ? "news-analysis"
    : opp.niche.toLowerCase().includes("finance")
    ? "finance-explainer"
    : "explainer";

  // Presenter selection (not for Autopilot Mode — faceless)
  let presenterId: string | null = null;
  if (channelMode !== "AUTOPILOT_MODE") {
    const roster = await getAvatarRoster();
    const recentHistory = await getRecentPresenterHistory(5);
    const presenter = selectPresenter(contentType, roster, recentHistory);
    presenterId = presenter?.presenterId ?? null;
  }

  const briefId = crypto.randomUUID();

  return {
    briefId,
    userId,
    topicId: opp.topicId,
    topic: opp.topic,
    niche: opp.niche,
    angle: evaluation.chosenAngle,
    tone,
    targetDuration,
    urgency,
    contentType,
    presenterId,
    scheduledPublish: scheduledPublish.toISOString(),
    shortsPublish: shortsPublish.toISOString(),
    playlistId: playlistKey,
    playlistName: playlistKey
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase()),
    seriesId,
    endScreenVideoId: endScreen?.videoId ?? null,
    titleDirection: `Use ${detectAngleType(evaluation.chosenAngle)} angle. Target keyword: ${opp.topic}. Curiosity gap encouraged.`,
    keywordFocus: [
      opp.topic,
      opp.niche,
      ...opp.sources.map(s => s.title).slice(0, 2),
    ],
    qualityThreshold: opp.maturityLevel === "breaking" ? 8 : 7,
    relevantMemories: memories,
    competitorGap: opp.competitorGap,
    viewerRequestCount: opp.viewerRequestCount,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}

// ─── Main Regum run ───────────────────────────────────────────────────────────

export async function runRegumStrategy(
  opportunities: RexOpportunity[],
  channelId: string,
  userId: string,
  phase: ChannelPhase,
  channelMode: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE"
): Promise<QeonBrief[]> {
  await setAgentStatus("regum", "RUNNING", "evaluating Rex opportunities");

  try {
    // 1. Query Zeus memory for strategy context
    const memories = await queryAgentMemory(
      `channel strategy decisions, angle selection, niche performance for phase ${phase}`,
      5
    );
    const memoryContext = memories.map(m => m.text).join("\n");

    // 2. Get recent topics to detect duplicates
    const recentTopics = await getRecentTopics(20);

    // 3. Get Sonnet to rank and filter opportunities
    const oppsJson = JSON.stringify(
      opportunities.map(o => ({
        topicId: o.topicId,
        topic: o.topic,
        niche: o.niche,
        confidence: o.confidenceScore,
        urgency: o.urgency,
        maturity: o.maturityLevel,
        angles: o.suggestedAngles.slice(0, 3),
        viewerRequests: o.viewerRequestCount,
      })),
      null,
      2
    );

    const systemPrompt = `You are Regum, the strategy and channel management agent for RRQ YouTube channel.
Channel phase: ${phase}
Channel mode: ${channelMode}

Memory from Zeus:
${memoryContext || "No relevant memories found."}

Your job: evaluate these Rex opportunities and select the top ones to greenlight.
Consider: topic freshness, angle quality, niche balance, audience demand.
Reject duplicates, over-covered niches, or low-quality opportunities.
Return a JSON array of topicIds to greenlight, sorted by priority (best first).
Maximum 3 greenlights per run.`;

    const userPrompt = `Rex opportunities to evaluate:\n${oppsJson}\n\nReturn JSON: {"greenlightIds": ["topicId1", "topicId2"]}`;

    let rankedIds: string[] = [];
    try {
      const response = await bedrock.send(
        new InvokeModelCommand({
          modelId: "us.anthropic.claude-sonnet-4-6",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        })
      );
      const parsed = JSON.parse(new TextDecoder().decode(response.body)) as {
        content?: Array<{ text: string }>;
      };
      const content = parsed.content?.[0]?.text ?? "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as { greenlightIds?: string[] };
        rankedIds = result.greenlightIds ?? [];
      }
    } catch (err) {
      console.error("[regum] Sonnet ranking failed, falling back to score order:", err);
      // Fallback: take top 3 by confidence
      rankedIds = opportunities
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 3)
        .map(o => o.topicId);
    }

    // 4. Evaluate and build briefs for ranked opportunities
    const briefs: QeonBrief[] = [];

    for (const topicId of rankedIds.slice(0, 3)) {
      const opp = opportunities.find(o => o.topicId === topicId);
      if (!opp) continue;

      const evaluation = await evaluateOpportunity(opp, recentTopics, channelMode);

      if (evaluation.decision !== "greenlight") {
        console.log(`[regum] ${opp.topic} — ${evaluation.decision}: ${evaluation.reasoning}`);
        continue;
      }

      const brief = await buildQeonBrief(
        opp,
        evaluation,
        memories.map(m => m.text),
        channelMode,
        userId
      );
      await writeQeonBrief(brief);

      // Write to schedule
      await writeToSchedule({
        timestamp: brief.scheduledPublish,
        niche: brief.niche,
        topicId: brief.topicId,
        briefId: brief.briefId,
        urgency: brief.urgency,
      });

      // Notify Qeon via agent-messages
      await sendAgentMessage({
        from: "regum",
        recipientAgent: "qeon",
        type: "STRATEGY_BRIEF",
        priority: brief.urgency === "now" ? "URGENT" : brief.urgency === "today" ? "HIGH" : "MEDIUM",
        requiresResponse: false,
        payload: {
          subject: "QEON_BRIEF_READY",
          body: `New production brief ready: ${brief.topic}. Angle: ${brief.angle}. Urgency: ${brief.urgency}.`,
          briefId: brief.briefId,
          topicId: brief.topicId,
        },
      });

      briefs.push(brief);
      console.log(
        `[regum] Greenlighted: ${brief.topic} → ${brief.angle} @ ${brief.scheduledPublish}`
      );
    }

    await setAgentStatus(
      "regum",
      "IDLE",
      `lastRun:${new Date().toISOString()} briefs:${briefs.length}`
    );
    return briefs;
  } catch (err) {
    await setAgentStatus("regum", "ERROR", String(err));
    throw err;
  }
}

// ─── Analytics review ─────────────────────────────────────────────────────────

export async function runRegumAnalyticsReview(
  analyticsData: string,
  topVideos: string,
  bottomVideos: string,
  commentInsights: string,
  viewerRequests: string
): Promise<RegumAnalyticsReview> {
  const prompt = `You are Regum, strategy agent for RRQ YouTube channel.

Last 7 days analytics:
${analyticsData}

Top 5 videos this week:
${topVideos}

Bottom 5 videos this week:
${bottomVideos}

Comment insights from Zeus:
${commentInsights}

Viewer requests:
${viewerRequests}

Analyse and return exactly this JSON:
{
  "whatWorked": ["string"],
  "whatDidnt": ["string"],
  "audienceInsights": ["string"],
  "nicheToDoubleDown": "string",
  "nicheToReduce": "string",
  "formatRecommendation": "string",
  "timingAdjustment": "string or null",
  "lessonsForZeus": ["string"]
}`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: "us.anthropic.claude-sonnet-4-6",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  );

  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as {
    content?: Array<{ text: string }>;
  };
  const content = parsed.content?.[0]?.text ?? "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      whatWorked: [],
      whatDidnt: [],
      audienceInsights: [],
      nicheToDoubleDown: "unknown",
      nicheToReduce: "none",
      formatRecommendation: "Continue current format",
      timingAdjustment: null,
      lessonsForZeus: [],
    };
  }
  return JSON.parse(jsonMatch[0]) as RegumAnalyticsReview;
}

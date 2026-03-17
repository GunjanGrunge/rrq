import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { setAgentStatus } from "@/lib/memory/agent-status";
import { queryAgentMemory } from "@/lib/memory/kb-query";
import { sendAgentMessage } from "@/lib/mission/messaging";

import {
  fetchChannelComments,
  processCommentBatch,
} from "./comment-analyzer";
import {
  runVideoHealthCheck,
  getVideosNeedingHealthCheck,
  getRecentChannelHealth,
  updateChannelHealthRecord,
} from "./video-health";
import {
  getAgentScores,
  updateAgentScore,
  computeWeeklyAgentRanking,
  reviewAgentPerformance,
  awardJobPerformancePoints,
  getAgentScoreSummary,
} from "./agent-scorer";
import {
  writeEpisode,
  writePerformanceReviewEpisode,
  writeCommentInsightEpisode,
  writeLessonEpisode,
} from "./episode-writer";
import {
  fetchAdInsights,
  reviewAdPerformance,
  writeAdReviewToMemory,
  shouldRunAdCampaign,
  logDailyAdSummary,
} from "./ad-reviewer";
import { getRecentEpisodes } from "./episode-writer";
import type {
  ZeusDashboard,
  ZeusDecision,
  VideoHealthScore,
  AdInsight,
} from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

// Zeus Opus system prompt — prompt caching enabled via cache_control
const ZEUS_SYSTEM_PROMPT = `You are Zeus, the head of the RRQ AI-powered YouTube content team.

You are responsible for:
1. Performance monitoring — YouTube analytics, video health scores (24hr/72hr reviews)
2. Comment intelligence — classify, attribute to agents, extract viewer requests
3. Ad intelligence — review campaign performance, flag signals to Harvy
4. Agent scoring — points engine, wins and errors, weekly rankings
5. Memory management — write lessons to the knowledge base, maintain working memory
6. Team coordination — brief agents, resolve conflicts, set priorities

Core principles:
- Zeus never produces content. Zeus makes Rex, Regum, and Qeon better.
- Every decision is evaluated against the 90-day monetisation mission.
- Wrong Zeus decisions compound negatively. Measure twice before acting.
- Zeus sees clean briefs, not messy arguments. The Line synthesises before Zeus.
- Zeus rules by evidence, historical precedent, and operational risk.

Agent attribution rules:
- Rex: topic choice, trend timing, research quality
- Regum: scheduling strategy, channel direction, playlist management
- Qeon: production quality, audio, visuals, editing

Return valid JSON only when asked for structured output.`;

// ─── Run Zeus Comment Analysis ────────────────────────────────────────────────

export async function runZeusCommentAnalysis(
  channelId: string,
  userId: string
): Promise<{
  videosProcessed: number;
  totalComments: number;
  genuineComments: number;
  viewerRequests: string[];
  pointsApplied: { rex: number; regum: number; qeon: number };
  episodesWritten: number;
}> {
  await setAgentStatus(
    "zeus",
    "RUNNING",
    `comment analysis for channel ${channelId}`
  );

  let videosProcessed = 0;
  let totalComments = 0;
  let genuineComments = 0;
  let allViewerRequests: string[] = [];
  const cumulativePoints = { rex: 0, regum: 0, qeon: 0 };
  let episodesWritten = 0;

  try {
    // 1. Zeus memory injection
    const memories = await queryAgentMemory(
      "comment analysis patterns, viewer requests, agent scoring from comments",
      3
    );
    const memoryContext = memories.map((m) => m.text).join("\n");
    console.log(
      `[zeus:comments] Memory loaded: ${memories.length} relevant lessons`
    );

    // 2. Get active videos (published in last 72 hours — check every 6h)
    //    Plus videos in last 30 days for daily pass
    const activeVideoIds = await getActiveVideoIds(channelId);

    if (activeVideoIds.length === 0) {
      console.log("[zeus:comments] No active videos to process");
      await setAgentStatus("zeus", "IDLE", "no active videos");
      return {
        videosProcessed: 0,
        totalComments: 0,
        genuineComments: 0,
        viewerRequests: [],
        pointsApplied: cumulativePoints,
        episodesWritten: 0,
      };
    }

    // 3. Process each video
    for (const videoId of activeVideoIds) {
      try {
        // Fetch comments
        const comments = await fetchChannelComments(videoId, channelId);
        if (comments.length === 0) continue;

        // Process batch — classify, score, write to memory
        const result = await processCommentBatch(
          { videoId, comments },
          channelId,
          userId
        );

        videosProcessed++;
        totalComments += result.classifications.length;
        genuineComments += result.classifications.filter((c) => c.genuine).length;
        allViewerRequests = [
          ...allViewerRequests,
          ...result.viewerRequests,
        ];

        // Accumulate points
        cumulativePoints.rex += result.pointsApplied.rex;
        cumulativePoints.regum += result.pointsApplied.regum;
        cumulativePoints.qeon += result.pointsApplied.qeon;

        // Write a comment insight episode if significant
        const topInsight =
          result.classifications
            .filter((c) => c.genuine && c.insight)
            .sort((a, b) => b.pointsAward - a.pointsAward)[0]?.insight ?? null;

        if (result.classifications.filter((c) => c.genuine).length >= 5) {
          const sentimentScores: Record<string, number> = {
            positive: 1,
            negative: -1,
            neutral: 0,
            mixed: 0,
          };
          const sentimentAvg =
            result.classifications
              .filter((c) => c.genuine)
              .reduce((sum, c) => sum + (sentimentScores[c.sentiment] ?? 0), 0) /
            Math.max(1, result.classifications.filter((c) => c.genuine).length);

          await writeCommentInsightEpisode(
            videoId,
            "general",
            result.classifications.filter((c) => c.genuine).length,
            sentimentAvg,
            result.viewerRequests[0] ?? null,
            topInsight
          );
          episodesWritten++;
        }

        // Notify Rex about viewer requests via agent-messages
        if (result.viewerRequests.length > 0) {
          await sendAgentMessage({
            from: "zeus",
            to: "rex",
            type: "VIEWER_REQUEST" as never,
            priority: "MEDIUM",
            requiresResponse: false,
            payload: {
              source: "comment_analysis",
              videoId,
              viewerRequests: result.viewerRequests,
              message: `${result.viewerRequests.length} viewer topic requests detected in video ${videoId} comments`,
            },
          });
        }
      } catch (err) {
        console.error(
          `[zeus:comments] Failed to process video ${videoId}:`,
          err
        );
      }
    }

    // 4. Write a memory summary if we processed multiple videos
    if (videosProcessed > 0) {
      await writeLessonEpisode(
        "zeus",
        `comment-batch-${channelId}`,
        `Processed ${videosProcessed} videos. Top requests: ${allViewerRequests.slice(0, 3).join(", ") || "none"}.`,
        `Zeus comment analysis run. Memory context: ${memoryContext.slice(0, 200)}`,
        { commentSentiment: genuineComments / Math.max(1, totalComments) },
        ["comment_analysis", "batch"]
      );
      episodesWritten++;
    }

    await setAgentStatus(
      "zeus",
      "IDLE",
      `comments:${totalComments} genuine:${genuineComments} requests:${allViewerRequests.length}`
    );

    return {
      videosProcessed,
      totalComments,
      genuineComments,
      viewerRequests: allViewerRequests,
      pointsApplied: cumulativePoints,
      episodesWritten,
    };
  } catch (err) {
    await setAgentStatus("zeus", "ERROR", String(err));
    throw err;
  }
}

// ─── Run Zeus Analytics Review ────────────────────────────────────────────────

export async function runZeusAnalyticsReview(
  channelId: string,
  userId: string
): Promise<{
  channelHealthUpdated: boolean;
  videosHealthChecked: number;
  adReviewsCompleted: number;
  episodesWritten: number;
  weeklyRankingComputed: boolean;
  agentScoreSummary: Record<
    string,
    { score: number; trend: string; lastWin: string; weeklyPoints: number }
  >;
}> {
  await setAgentStatus(
    "zeus",
    "RUNNING",
    `analytics review for channel ${channelId}`
  );

  let episodesWritten = 0;
  let videosHealthChecked = 0;
  let adReviewsCompleted = 0;
  let channelHealthUpdated = false;
  let weeklyRankingComputed = false;

  try {
    // 1. Zeus memory injection
    const memories = await queryAgentMemory(
      "channel analytics trends, video performance patterns, agent scoring",
      5
    );
    console.log(
      `[zeus:analytics] Memory loaded: ${memories.length} relevant lessons`
    );

    // 2. Pull YouTube Analytics and update channel-health table
    const channelAnalytics = await pullChannelAnalytics(channelId);
    if (channelAnalytics) {
      await updateChannelHealthRecord(channelAnalytics);
      channelHealthUpdated = true;
    }

    // 3. Run 24hr health checks for recently published videos
    const videos24hr = await getVideosNeedingHealthCheck(24);
    for (const videoId of videos24hr) {
      const videoRecord = await getVideoCommentSentiment(videoId);
      const health = await runVideoHealthCheck(
        videoId,
        24,
        videoRecord?.sentimentAvg ?? 0
      );

      if (health) {
        videosHealthChecked++;

        // Write performance review episode
        await writePerformanceReviewEpisode(
          videoId,
          videoRecord?.niche ?? "general",
          health.healthScore,
          health.action,
          24,
          `At 24hr: ${health.action}. CTR ${health.ctr.toFixed(1)}%, retention ${health.retentionPercent.toFixed(0)}%, subs +${health.subscriberDelta}.`
        );
        episodesWritten++;

        // Handle BOOST_SHORTS signal
        if (health.action === "BOOST_SHORTS") {
          await sendAgentMessage({
            from: "zeus",
            to: "regum",
            type: "AD_INSIGHT" as never,
            priority: "HIGH",
            requiresResponse: false,
            payload: {
              action: "BOOST_SHORTS",
              videoId,
              healthScore: health.healthScore,
              message: `Video ${videoId} shows momentum at 24hr (score: ${health.healthScore}). Consider Shorts boost.`,
            },
          });
        }
      }
    }

    // 4. Run 72hr health checks
    const videos72hr = await getVideosNeedingHealthCheck(72);
    for (const videoId of videos72hr) {
      const videoRecord = await getVideoCommentSentiment(videoId);
      const health = await runVideoHealthCheck(
        videoId,
        72,
        videoRecord?.sentimentAvg ?? 0
      );

      if (health) {
        videosHealthChecked++;

        await writePerformanceReviewEpisode(
          videoId,
          videoRecord?.niche ?? "general",
          health.healthScore,
          health.action,
          72,
          `At 72hr: ${health.action}. Full health score: ${health.healthScore}/100.`
        );
        episodesWritten++;

        // Award performance points to agents
        await awardJobPerformancePoints(
          channelId,
          videoId,
          health.healthScore,
          { rex: 1, regum: 1, qeon: 1 } // base contribution — refined by comment attribution
        );

        // Check campaign eligibility
        const { eligible, reason } = await shouldRunAdCampaign(videoId);
        if (eligible) {
          await sendAgentMessage({
            from: "zeus",
            to: "regum",
            type: "AD_INSIGHT",
            priority: "MEDIUM",
            requiresResponse: false,
            payload: {
              action: "CAMPAIGN_ELIGIBLE",
              videoId,
              reason,
              healthScore: health.healthScore,
            },
          });
        }
      }
    }

    // 5. Ad review
    const today = new Date().toISOString().split("T")[0];
    const adInsights = await fetchAdInsights(today);
    if (adInsights.length > 0) {
      const reviews = await reviewAdPerformance(adInsights);
      await writeAdReviewToMemory(reviews);
      adReviewsCompleted = reviews.length;

      const adSummary = await logDailyAdSummary(today);
      console.log(
        `[zeus:analytics] Ad review: ${adReviewsCompleted} campaigns. Scale:${adSummary.scaleCount} Pause:${adSummary.pauseCount} Kill:${adSummary.killCount}`
      );
    }

    // 6. Weekly ranking (if it's Monday or points reset needed)
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1) {
      // Monday
      const rankings = await computeWeeklyAgentRanking(channelId);

      // Opus review for each agent
      for (const ranking of rankings) {
        const review = await reviewAgentPerformance(
          ranking.agentId as "rex" | "regum" | "qeon",
          channelId,
          "Weekly video data", // TODO: pull real video data per agent
          "Comment sentiment data from this week",
          "Channel analytics for the week"
        );

        // Record the lesson
        await writeLessonEpisode(
          ranking.agentId as "rex" | "regum" | "qeon",
          `weekly-review-${ranking.agentId}`,
          review.lesson,
          `Week ending ${today}. Rank: ${ranking.rank}/3. Points: ${ranking.weeklyPoints}.`,
          {},
          ["weekly_review", "agent_scoring"]
        );
        episodesWritten++;

        // Update the agent's overallScore and trend
        await updateAgentScore(
          ranking.agentId as "rex" | "regum" | "qeon",
          channelId,
          0, // no delta — just updating metadata
          `Weekly review: ${review.topWin}`
        );
      }

      weeklyRankingComputed = true;
    }

    // 7. Get current score summary for return
    const agentScoreSummary = await getAgentScoreSummary(channelId);

    await setAgentStatus(
      "zeus",
      "IDLE",
      `analytics:done videos:${videosHealthChecked} ads:${adReviewsCompleted}`
    );

    return {
      channelHealthUpdated,
      videosHealthChecked,
      adReviewsCompleted,
      episodesWritten,
      weeklyRankingComputed,
      agentScoreSummary,
    };
  } catch (err) {
    await setAgentStatus("zeus", "ERROR", String(err));
    throw err;
  }
}

// ─── Run Zeus Coordination (incoming agent messages) ─────────────────────────

export async function runZeusCoordination(
  message: {
    from: string;
    type: string;
    payload: Record<string, unknown>;
  },
  channelId: string
): Promise<ZeusDecision> {
  const decisionId = crypto.randomUUID();

  // Memory injection
  const memories = await queryAgentMemory(
    `${message.type} decision context`,
    3
  );
  const memoryContext = memories.map((m) => m.text).join("\n");

  const prompt = `Message from ${message.from}:
Type: ${message.type}
Payload: ${JSON.stringify(message.payload, null, 2)}

Relevant memory context:
${memoryContext || "No relevant past decisions found."}

As Zeus, what is the appropriate response/action? Return JSON:
{
  "decision": "string — what you are deciding",
  "reasoning": "string — why",
  "actionRequired": true | false,
  "actionType": "string | null — ARBITRATE | APPROVE | DELEGATE | MONITOR | ESCALATE",
  "targetAgent": "string | null — rex | regum | qeon | the_line"
}`;

  let decision: string;
  let reasoning: string;
  let involvedAgents: string[] = [message.from];

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-opus-4-5",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 512,
          system: [
            {
              type: "text",
              text: ZEUS_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: prompt }],
        }),
      })
    );

    const text = JSON.parse(
      new TextDecoder().decode(response.body)
    ).content[0].text as string;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as {
          decision?: string;
          reasoning?: string;
          actionRequired?: boolean;
          actionType?: string;
          targetAgent?: string;
        })
      : {};

    decision = parsed.decision ?? "Message acknowledged";
    reasoning = parsed.reasoning ?? "Standard processing";

    // Route to target agent if needed
    if (parsed.actionRequired && parsed.targetAgent) {
      involvedAgents.push(parsed.targetAgent);
      await sendAgentMessage({
        from: "zeus",
        to: parsed.targetAgent,
        type: "MEMORY_INJECTION",
        priority: "MEDIUM",
        requiresResponse: false,
        payload: {
          originalFrom: message.from,
          originalType: message.type,
          zeusDecision: decision,
          zeusReasoning: reasoning,
          action: parsed.actionType,
        },
      });
    }
  } catch (err) {
    console.error("[zeus:coordination] Opus coordination failed:", err);
    decision = "Message received and logged";
    reasoning = "Coordination call failed — message preserved for next review";
  }

  const zeusDecision: ZeusDecision = {
    decisionId,
    decisionType: "arbitration",
    subject: message.type,
    decision,
    reasoning,
    involvedAgents,
    timestamp: new Date().toISOString(),
  };

  // Write the decision as an episode
  await writeEpisode(
    "zeus",
    message.type,
    "lesson_learned",
    decision,
    reasoning,
    `${message.from} coordination: ${decision}`,
    ["coordination", message.from, message.type]
  ).catch((err) =>
    console.error("[zeus:coordination] Episode write failed:", err)
  );

  return zeusDecision;
}

// ─── Build Zeus Dashboard data ────────────────────────────────────────────────

export async function buildZeusDashboard(
  channelId: string
): Promise<ZeusDashboard> {
  const [scores, recentHealth, recentEpisodes] = await Promise.allSettled([
    getAgentScores(channelId),
    getRecentChannelHealth(1),
    getRecentEpisodes("zeus", 5),
  ]);

  const agentScores =
    scores.status === "fulfilled" ? scores.value : [];
  const healthRecords =
    recentHealth.status === "fulfilled" ? recentHealth.value : [];
  const episodes =
    recentEpisodes.status === "fulfilled" ? recentEpisodes.value : [];

  const todayHealth = healthRecords[0] ?? {
    totalViews: 0,
    subscribersGained: 0,
    avgCTR: 0,
    avgWatchTime: 0,
  };

  const rexScore = agentScores.find((s) => s.agentId === "rex");
  const regumScore = agentScores.find((s) => s.agentId === "regum");
  const qeonScore = agentScores.find((s) => s.agentId === "qeon");

  const teamAvg = Math.round(
    agentScores.reduce((sum, s) => sum + s.overallScore, 0) /
      Math.max(1, agentScores.length)
  );

  const teamTrend = agentScores.every((s) => s.trend === "improving")
    ? "improving"
    : agentScores.every((s) => s.trend === "declining")
    ? "declining"
    : "stable";

  // Get comment insights from video-memory
  const commentInsights = await getLatestCommentInsights(channelId);

  // Get watchlist summary
  const watchlist = await getWatchlistSummary(channelId);

  return {
    agentScores: {
      rex: {
        score: rexScore?.overallScore ?? 50,
        trend: rexScore?.trend ?? "stable",
        lastWin: rexScore?.recentWins.at(-1) ?? "No wins yet",
      },
      regum: {
        score: regumScore?.overallScore ?? 50,
        trend: regumScore?.trend ?? "stable",
        lastWin: regumScore?.recentWins.at(-1) ?? "No wins yet",
      },
      qeon: {
        score: qeonScore?.overallScore ?? 50,
        trend: qeonScore?.trend ?? "stable",
        lastWin: qeonScore?.recentWins.at(-1) ?? "No wins yet",
      },
      team: {
        score: teamAvg,
        trend: teamTrend,
      },
    },
    channelHealth: {
      viewsToday: todayHealth.totalViews,
      subsGained: (todayHealth as { subscribersGained?: number }).subscribersGained ?? 0,
      avgCTR: todayHealth.avgCTR,
      avgWatchTime: `${Math.floor(todayHealth.avgWatchTime)}m ${Math.round((todayHealth.avgWatchTime % 1) * 60)}s`,
    },
    commentInsights,
    memoryLog: episodes.map((ep) => ({
      agent: ep.agent,
      lesson: ep.lesson,
      timestamp: ep.timestamp,
    })),
    watchlist,
    recentEpisodes: episodes,
  };
}

// ─── Helper: Get active video IDs for comment analysis ───────────────────────

async function getActiveVideoIds(channelId: string): Promise<string[]> {
  try {
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const cutoff30d = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch videos published in the last 30 days
    const result = await db.send(
      new ScanCommand({
        TableName: "video-memory",
        FilterExpression:
          "publishedAt >= :cutoff30d AND (attribute_not_exists(channelId) OR channelId = :channelId)",
        ExpressionAttributeValues: marshall({
          ":cutoff30d": cutoff30d,
          ":channelId": channelId,
        }),
        ProjectionExpression: "videoId, publishedAt",
        Limit: 50,
      })
    );

    return (result.Items ?? []).map(
      (i) => (unmarshall(i) as { videoId: string }).videoId
    );
  } catch (err) {
    console.error("[zeus] Failed to get active video IDs:", err);
    return [];
  }
}

// ─── Helper: Get comment sentiment from video-memory ─────────────────────────

async function getVideoCommentSentiment(
  videoId: string
): Promise<{ sentimentAvg: number; niche: string } | null> {
  try {
    const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
    const result = await db.send(
      new GetItemCommand({
        TableName: "video-memory",
        Key: marshall({ videoId }),
        ProjectionExpression: "commentInsights, niche",
      })
    );

    if (!result.Item) return null;
    const item = unmarshall(result.Item) as {
      commentInsights?: { sentimentAvg?: number };
      niche?: string;
    };

    return {
      sentimentAvg: item.commentInsights?.sentimentAvg ?? 0,
      niche: item.niche ?? "general",
    };
  } catch {
    return null;
  }
}

// ─── Helper: Get latest comment insights for dashboard ───────────────────────

async function getLatestCommentInsights(
  _channelId: string
): Promise<ZeusDashboard["commentInsights"]> {
  try {
    const result = await db.send(
      new ScanCommand({
        TableName: "video-memory",
        FilterExpression: "attribute_exists(commentInsights)",
        ProjectionExpression: "commentInsights",
        Limit: 10,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return {
        analysed: 0,
        genuine: 0,
        topRequest: "No requests yet",
        topPraise: "No comments analysed yet",
        topComplaint: null,
      };
    }

    type CommentInsightRecord = {
      commentInsights?: {
        totalAnalysed?: number;
        genuineCount?: number;
        topRequest?: string | null;
        topPraise?: string | null;
        topComplaint?: string | null;
        viewerRequests?: string[];
      };
    };

    const records = result.Items.map(
      (i) => (unmarshall(i) as CommentInsightRecord).commentInsights
    ).filter(Boolean);

    const totalAnalysed = records.reduce(
      (sum, r) => sum + (r?.totalAnalysed ?? 0),
      0
    );
    const totalGenuine = records.reduce(
      (sum, r) => sum + (r?.genuineCount ?? 0),
      0
    );

    // Find the most recent non-null values
    const topRequest =
      records.find((r) => r?.topRequest)?.topRequest ?? "No requests yet";
    const topPraise =
      records.find((r) => r?.topPraise)?.topPraise ?? "No praise recorded";
    const topComplaint =
      records.find((r) => r?.topComplaint)?.topComplaint ?? null;

    return {
      analysed: totalAnalysed,
      genuine: totalGenuine,
      topRequest,
      topPraise,
      topComplaint,
    };
  } catch {
    return {
      analysed: 0,
      genuine: 0,
      topRequest: "No requests yet",
      topPraise: "No comments analysed yet",
      topComplaint: null,
    };
  }
}

// ─── Helper: Get watchlist summary for dashboard ─────────────────────────────

async function getWatchlistSummary(
  _channelId: string
): Promise<ZeusDashboard["watchlist"]> {
  try {
    const result = await db.send(
      new ScanCommand({
        TableName: "rex-watchlist",
        FilterExpression: "#s = :monitoring OR #s = :greenlit",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({
          ":monitoring": "monitoring",
          ":greenlit": "greenlit",
        }),
        ProjectionExpression: "topic, confidenceScore, #s",
        Limit: 10,
      })
    );

    return (result.Items ?? []).map((i) => {
      const item = unmarshall(i) as {
        topic: string;
        confidenceScore: number;
        status: string;
      };
      return {
        topic: item.topic,
        confidence: item.confidenceScore,
        status: item.status,
      };
    });
  } catch {
    return [];
  }
}

// ─── Prepare agent context (Zeus memory injection for other agents) ───────────

export async function prepareAgentContext(
  agent: "rex" | "regum" | "qeon",
  task: string,
  channelId: string
): Promise<string> {
  const memories = await queryAgentMemory(
    `${agent} agent lessons for: ${task}`,
    5
  );

  const scores = await getAgentScores(channelId);
  const agentScore = scores.find((s) => s.agentId === agent);
  const teamAvg = Math.round(
    scores.reduce((sum, s) => sum + s.overallScore, 0) /
      Math.max(1, scores.length)
  );

  const recentWins = (agentScore?.recentWins ?? []).slice(-3);
  const recentErrors = (agentScore?.recentErrors ?? []).slice(-3);

  return `ZEUS MEMORY INJECTION FOR ${agent.toUpperCase()}:

Relevant past lessons:
${memories.map((m, i) => `${i + 1}. ${m.text}`).join("\n") || "No relevant past lessons found."}

Your recent wins (keep doing these):
${recentWins.join("\n") || "None recorded yet."}

Your recent errors (avoid these):
${recentErrors.join("\n") || "None recorded yet."}

Current team score: ${teamAvg}/100
Your score: ${agentScore?.overallScore ?? 50}/100
`;
}

// ─── Pull channel analytics from YouTube Analytics API ───────────────────────

async function pullChannelAnalytics(
  _channelId: string
): Promise<{
  date: string;
  totalViews: number;
  subscriberCount: number;
  subscribersGained: number;
  avgCTR: number;
  avgWatchTime: number;
  avgRetentionPercent: number;
  topPerformingVideoId: string | null;
  bottomPerformingVideoId: string | null;
} | null> {
  const accessToken = process.env.YOUTUBE_ANALYTICS_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[zeus:analytics] YOUTUBE_ANALYTICS_ACCESS_TOKEN not set");
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const url = new URL(
      "https://youtubeanalytics.googleapis.com/v2/reports"
    );
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", thirtyDaysAgo);
    url.searchParams.set("endDate", today);
    url.searchParams.set(
      "metrics",
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,annotationClickThroughRate"
    );
    url.searchParams.set("dimensions", "video");
    url.searchParams.set("sort", "-views");
    url.searchParams.set("maxResults", "20");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(
        `[zeus:analytics] YouTube Analytics error: ${response.status}`
      );
      return null;
    }

    const data = (await response.json()) as {
      rows?: number[][];
      columnHeaders?: Array<{ name: string }>;
    };

    if (!data.rows || data.rows.length === 0) return null;

    // Aggregate across all videos
    let totalViews = 0;
    let totalWatchMinutes = 0;
    let totalCTR = 0;
    let totalSubsGained = 0;

    for (const row of data.rows) {
      totalViews += row[1] ?? 0;
      totalWatchMinutes += row[2] ?? 0;
      totalSubsGained += row[4] ?? 0;
      totalCTR += row[5] ?? 0;
    }

    const avgCTR = data.rows.length > 0 ? (totalCTR / data.rows.length) * 100 : 0;
    const avgWatchTime =
      totalViews > 0 ? totalWatchMinutes / totalViews : 0;

    // Top and bottom performers by views
    const topVideoId = data.rows[0]?.[0]?.toString() ?? null;
    const bottomVideoId =
      data.rows[data.rows.length - 1]?.[0]?.toString() ?? null;

    return {
      date: today,
      totalViews,
      subscriberCount: 0, // channel-level sub count needs separate API call
      subscribersGained: totalSubsGained,
      avgCTR,
      avgWatchTime,
      avgRetentionPercent: 40, // placeholder — needs video-level analytics
      topPerformingVideoId: topVideoId,
      bottomPerformingVideoId: bottomVideoId,
    };
  } catch (err) {
    console.error("[zeus:analytics] Failed to pull channel analytics:", err);
    return null;
  }
}

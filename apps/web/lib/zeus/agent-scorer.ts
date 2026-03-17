import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { AgentPerformanceScore } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const SCORED_AGENTS = ["rex", "regum", "qeon"] as const;
type ScoredAgent = (typeof SCORED_AGENTS)[number];

// ─── Read agent scores from DynamoDB ─────────────────────────────────────────

export async function getAgentScores(
  channelId: string
): Promise<AgentPerformanceScore[]> {
  const results = await Promise.allSettled(
    SCORED_AGENTS.map(async (agentId) => {
      const result = await db.send(
        new GetItemCommand({
          TableName: "agent-scores",
          Key: marshall({ agentId, channelId }),
        })
      );

      if (!result.Item) {
        // Return a zeroed record if not found
        return {
          agentId,
          dailyPoints: 0,
          weeklyPoints: 0,
          totalPoints: 0,
          lastUpdated: new Date().toISOString(),
          recentWins: [],
          recentErrors: [],
          trend: "stable" as const,
          overallScore: 50,
        };
      }

      const item = unmarshall(result.Item) as {
        agentId: string;
        dailyPoints?: number;
        weeklyPoints?: number;
        totalPoints?: number;
        lastUpdated?: string;
        recentWins?: string[];
        recentErrors?: string[];
        trend?: "improving" | "stable" | "declining";
        overallScore?: number;
      };

      return {
        agentId: item.agentId,
        dailyPoints: item.dailyPoints ?? 0,
        weeklyPoints: item.weeklyPoints ?? 0,
        totalPoints: item.totalPoints ?? 0,
        lastUpdated: item.lastUpdated ?? new Date().toISOString(),
        recentWins: item.recentWins ?? [],
        recentErrors: item.recentErrors ?? [],
        trend: item.trend ?? "stable",
        overallScore: item.overallScore ?? 50,
      } satisfies AgentPerformanceScore;
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<AgentPerformanceScore> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}

// ─── Atomic increment of agent score with reason log ─────────────────────────

export async function updateAgentScore(
  agentId: ScoredAgent,
  channelId: string,
  delta: number,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const roundedDelta = Math.round(delta);

  if (roundedDelta === 0) return;

  try {
    const isWin = delta > 0;

    // Fetch current record to manage the recent wins/errors list
    const existing = await db.send(
      new GetItemCommand({
        TableName: "agent-scores",
        Key: marshall({ agentId, channelId }),
      })
    );

    const current = existing.Item
      ? (unmarshall(existing.Item) as {
          recentWins?: string[];
          recentErrors?: string[];
        })
      : {};

    const recentWins = (current.recentWins ?? []).slice(-4); // keep last 4, prepend new
    const recentErrors = (current.recentErrors ?? []).slice(-4);

    if (isWin) {
      recentWins.push(`[${now.slice(0, 10)}] ${reason}`);
    } else {
      recentErrors.push(`[${now.slice(0, 10)}] ${reason}`);
    }

    await db.send(
      new UpdateItemCommand({
        TableName: "agent-scores",
        Key: marshall({ agentId, channelId }),
        UpdateExpression:
          "ADD dailyPoints :d, weeklyPoints :d, totalPoints :d SET lastUpdated = :t, recentWins = :w, recentErrors = :e",
        ExpressionAttributeValues: marshall({
          ":d": roundedDelta,
          ":t": now,
          ":w": recentWins,
          ":e": recentErrors,
        }),
      })
    );

    console.log(
      `[zeus:scorer] ${agentId} ${delta > 0 ? "+" : ""}${roundedDelta} pts: ${reason}`
    );
  } catch (err) {
    console.error(
      `[zeus:scorer] Failed to update score for ${agentId}:`,
      err
    );
  }
}

// ─── Compute weekly agent ranking ─────────────────────────────────────────────

export async function computeWeeklyAgentRanking(channelId: string): Promise<
  Array<{
    agentId: string;
    weeklyPoints: number;
    rank: number;
    trend: "improving" | "stable" | "declining";
  }>
> {
  const scores = await getAgentScores(channelId);

  const ranked = scores
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .map((score, index) => ({
      agentId: score.agentId,
      weeklyPoints: score.weeklyPoints,
      rank: index + 1,
      trend: score.trend,
    }));

  return ranked;
}

// ─── Opus performance review per agent ───────────────────────────────────────

export async function reviewAgentPerformance(
  agentId: ScoredAgent,
  channelId: string,
  videosData: string,
  sentimentData: string,
  analyticsData: string
): Promise<{
  overallScore: number;
  topWin: string;
  topError: string;
  lesson: string;
  trend: "improving" | "stable" | "declining";
}> {
  const scores = await getAgentScores(channelId);
  const agentScore = scores.find((s) => s.agentId === agentId);

  const prompt = `You are Zeus reviewing weekly performance for agent: ${agentId.toUpperCase()}

Agent's recent wins:
${(agentScore?.recentWins ?? []).join("\n") || "None recorded"}

Agent's recent errors:
${(agentScore?.recentErrors ?? []).join("\n") || "None recorded"}

Agent's videos this week:
${videosData}

Comment sentiment data:
${sentimentData}

Analytics performance:
${analyticsData}

Write a performance review and return exactly this JSON:
{
  "overall_score": <number 0-100>,
  "top_win": "<best decision this week>",
  "top_error": "<worst decision or missed opportunity>",
  "lesson": "<one concrete thing to do differently>",
  "trend": "improving" | "stable" | "declining"
}

Return JSON only. No preamble.`;

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-opus-4-5",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 512,
          system:
            "You are Zeus, head of the RRQ agent team. You evaluate agent performance with objectivity and precision. Return valid JSON only.",
          messages: [{ role: "user", content: prompt }],
        }),
      })
    );

    const text = JSON.parse(
      new TextDecoder().decode(response.body)
    ).content[0].text as string;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Opus response");

    const result = JSON.parse(jsonMatch[0]) as {
      overall_score?: number;
      top_win?: string;
      top_error?: string;
      lesson?: string;
      trend?: "improving" | "stable" | "declining";
    };

    return {
      overallScore: result.overall_score ?? 50,
      topWin: result.top_win ?? "No major wins recorded",
      topError: result.top_error ?? "No major errors recorded",
      lesson: result.lesson ?? "Continue current approach",
      trend: result.trend ?? "stable",
    };
  } catch (err) {
    console.error(
      `[zeus:scorer] Opus review failed for ${agentId}:`,
      err
    );
    return {
      overallScore: 50,
      topWin: "Review unavailable",
      topError: "Review unavailable",
      lesson: "Continue current approach",
      trend: "stable",
    };
  }
}

// ─── Write performance episode to S3 ─────────────────────────────────────────

export async function writePerformanceEpisode(
  channelId: string,
  rankings: Array<{
    agentId: string;
    weeklyPoints: number;
    rank: number;
    trend: "improving" | "stable" | "declining";
  }>
): Promise<string> {
  const { writeEpisode, syncKnowledgeBase } = await import(
    "@/lib/memory/kb-query"
  );

  const episodeId = `ep-${Date.now()}-weekly-agent-review`;
  const topAgent = rankings[0];
  const bottomAgent = rankings[rankings.length - 1];

  const s3Key = await writeEpisode("zeus", episodeId, {
    decision: `Weekly agent ranking: ${rankings.map((r) => `${r.agentId}(${r.weeklyPoints}pts)`).join(", ")}`,
    context: `Channel: ${channelId}. Week ending ${new Date().toISOString().slice(0, 10)}.`,
    outcome: `Top performer: ${topAgent?.agentId ?? "unknown"} (${topAgent?.weeklyPoints ?? 0} pts). Bottom: ${bottomAgent?.agentId ?? "unknown"} (${bottomAgent?.weeklyPoints ?? 0} pts).`,
    lesson: `${topAgent?.agentId ?? "top agent"} led this week. Monitor ${bottomAgent?.agentId ?? "bottom agent"} for improvement opportunities.`,
    signalType: "STANDARD_LESSON",
  });

  // Trigger KB re-sync
  await syncKnowledgeBase().catch((err) =>
    console.error("[zeus:scorer] KB sync failed:", err)
  );

  // Reset weekly points after writing episode
  await resetWeeklyPoints(channelId);

  return s3Key;
}

// ─── Reset weekly points (called after weekly review) ────────────────────────

async function resetWeeklyPoints(channelId: string): Promise<void> {
  const resets = SCORED_AGENTS.map((agentId) =>
    db
      .send(
        new UpdateItemCommand({
          TableName: "agent-scores",
          Key: marshall({ agentId, channelId }),
          UpdateExpression: "SET weeklyPoints = :zero, dailyPoints = :zero",
          ExpressionAttributeValues: marshall({ ":zero": 0 }),
        })
      )
      .catch((err) =>
        console.error(`[zeus:scorer] Failed to reset weekly points for ${agentId}:`, err)
      )
  );

  await Promise.allSettled(resets);
  console.log("[zeus:scorer] Weekly points reset for all agents");
}

// ─── Award performance points to agents on a job ─────────────────────────────

export async function awardJobPerformancePoints(
  channelId: string,
  videoId: string,
  healthScore: number,
  agentContributions: { rex: number; regum: number; qeon: number }
): Promise<void> {
  const OUTPERFORM_THRESHOLD = 70;
  const GREAT_PERFORMANCE_BONUS = 5;

  if (healthScore >= OUTPERFORM_THRESHOLD) {
    // All contributing agents get a bonus
    const bonusPromises = (
      Object.entries(agentContributions) as Array<[ScoredAgent, number]>
    )
      .filter(([, contribution]) => contribution > 0)
      .map(([agentId]) =>
        updateAgentScore(
          agentId,
          channelId,
          GREAT_PERFORMANCE_BONUS,
          `Video ${videoId} outperformed at ${healthScore} health score`
        )
      );

    await Promise.allSettled(bonusPromises);
    console.log(
      `[zeus:scorer] Outperform bonus applied for video ${videoId} (score: ${healthScore})`
    );
  }
  // No penalty for underperforming — write a learning episode instead
}

// ─── Get dashboard summary for all agents ────────────────────────────────────

export async function getAgentScoreSummary(
  channelId: string
): Promise<
  Record<
    string,
    {
      score: number;
      trend: string;
      lastWin: string;
      weeklyPoints: number;
    }
  >
> {
  const scores = await getAgentScores(channelId);

  return Object.fromEntries(
    scores.map((s) => [
      s.agentId,
      {
        score: s.overallScore,
        trend: s.trend,
        lastWin: s.recentWins.at(-1) ?? "No wins yet",
        weeklyPoints: s.weeklyPoints,
      },
    ])
  );
}

import { getDynamoClient } from "@/lib/aws-clients";
import { callBedrock } from "@/lib/bedrock";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { writeEpisode } from "@/lib/zeus/episode-writer";
import type { RetroSession, RetroOutcome } from "./types";

// ─── Full retro council ────────────────────────────────────────────────────────

const RETRO_AGENTS = [
  {
    id: "zeus",
    name: "ZEUS",
    domain: "Operations",
    question: "Did team coordination, memory management, and oversight serve this video well?",
  },
  {
    id: "rex",
    name: "REX",
    domain: "Intelligence",
    question: "Was the topic signal accurate? Did confidence score predict actual performance?",
  },
  {
    id: "regum",
    name: "REGUM",
    domain: "Strategy",
    question: "Was the angle, niche, and scheduling decision correct in hindsight?",
  },
  {
    id: "qeon",
    name: "QEON",
    domain: "Production",
    question: "Did production quality meet the brief? Any production choices that hurt performance?",
  },
  {
    id: "muse",
    name: "MUSE",
    domain: "Creative",
    question: "Did the narrative architecture and visual blueprint serve retention?",
  },
];

export async function runFullRetro(
  sessionId: string,
  reason: "TARGET_HIT" | "DAY_7"
): Promise<RetroSession> {
  const dynamo = getDynamoClient();

  // Load retro session
  let session: RetroSession | null = null;
  try {
    const result = await dynamo.send(
      new GetCommand({ TableName: "retro-sessions", Key: { sessionId } })
    );
    session = (result.Item as RetroSession) ?? null;
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Session load failed:`, err);
  }

  if (!session) {
    throw new Error(`[retro:full:${sessionId}] Session not found`);
  }

  // Load video performance data
  let videoData: Record<string, unknown> = {};
  try {
    const videoResult = await dynamo.send(
      new GetCommand({ TableName: "video-memory", Key: { videoId: session.videoId } })
    );
    videoData = (videoResult.Item ?? {}) as Record<string, unknown>;
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Video data load failed:`, err);
  }

  // Load original QeonBrief from production-jobs
  let briefData: Record<string, unknown> = {};
  try {
    const jobResult = await dynamo.send(
      new GetCommand({ TableName: "production-jobs", Key: { jobId: session.jobId } })
    );
    briefData = (jobResult.Item ?? {}) as Record<string, unknown>;
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Brief data load failed:`, err);
  }

  const performanceSummary = `
Video: ${session.topic}
Day ${session.currentDay} performance:
- Total views: ${(videoData.totalViews as number)?.toLocaleString() ?? "N/A"}
- CTR: ${videoData.avgCTR ?? "N/A"}%
- Average retention: ${videoData.avgRetention ?? "N/A"}%
- Subscribers gained: ${videoData.subsGained ?? "N/A"}
- Target hit: ${session.targetHit ? "YES" : "NO"}
- Trigger: ${reason}`;

  // Run each agent review in parallel (Sonnet — structured decisions)
  const agentReviews = await Promise.allSettled(
    RETRO_AGENTS.map(async (agent) => {
      try {
        const review = await callBedrock({
          model: "sonnet",
          systemPrompt: `You are ${agent.name}, RRQ's ${agent.domain} agent in the RRQ Retro council.

Review your original production call against actual performance. Be honest. No excuses — what worked, what didn't, what you'd change.

Max 150 words. Be specific.`,
          userPrompt: `${performanceSummary}

Your domain question: ${agent.question}

Original call context:
${JSON.stringify(briefData, null, 2).slice(0, 800)}

What is your honest assessment?`,
          maxTokens: 384,
          temperature: 0.5,
        });
        return { agentId: agent.id, review };
      } catch (err) {
        console.error(`[retro:full:${sessionId}] Agent ${agent.id} review failed:`, err);
        return { agentId: agent.id, review: `${agent.name} review unavailable.` };
      }
    })
  );

  const reviewTexts = agentReviews
    .map((r) => {
      if (r.status === "fulfilled") {
        return `${r.value.agentId.toUpperCase()}: ${r.value.review}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  // The Line synthesis (Opus) — WIN_RECORD or MISS_RECORD
  const outcome: RetroOutcome = session.targetHit ? "WIN_RECORD" : "MISS_RECORD";
  let theLineSynthesis = "";

  try {
    theLineSynthesis = await callBedrock({
      model: "opus",
      systemPrompt: `You are THE LINE, RRQ's synthesis layer. You write the ${outcome} for this video's retro council.

A ${outcome === "WIN_RECORD" ? "WIN_RECORD captures what worked, why, and how to repeat it" : "MISS_RECORD captures what failed, why, and what to change"}.

Write a clear, actionable synthesis. This goes into Zeus's permanent memory. Max 300 words.`,
      userPrompt: `Synthesise the ${outcome} for this retro.

${performanceSummary}

Agent reviews:
${reviewTexts}

Write the ${outcome} synthesis.`,
      maxTokens: 512,
      temperature: 0.5,
    });
  } catch (err) {
    console.error(`[retro:full:${sessionId}] The Line synthesis failed:`, err);
    theLineSynthesis = `${outcome} synthesis unavailable — agent reviews archived for manual review.`;
  }

  const completedAt = new Date().toISOString();

  // Write lesson to S3 + Bedrock KB via Zeus episode writer
  try {
    await writeEpisode(
      "zeus",
      session.topic,
      "performance_reviewed",
      theLineSynthesis,
      `RRQ Retro ${reason} on day ${session.currentDay}. Video: ${session.videoId}`,
      performanceSummary,
      [outcome.toLowerCase(), session.channelId, reason.toLowerCase()]
    );
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Episode write failed:`, err);
  }

  // Update retro session as completed
  const completedSession: RetroSession = {
    ...session,
    status: "COMPLETED",
    outcome,
    theLineSynthesis,
    completedAt,
  };

  try {
    await dynamo.send(
      new PutCommand({
        TableName: "retro-sessions",
        Item: completedSession,
      })
    );
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Final session write failed:`, err);
  }

  // Update video-memory with retro outcome for Kanban WIN/MISS badges
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: "video-memory",
        Key: { videoId: session.videoId },
        UpdateExpression: "SET retroOutcome = :outcome, retroCompletedAt = :completedAt",
        ExpressionAttributeValues: {
          ":outcome": outcome,
          ":completedAt": completedAt,
        },
      })
    );
  } catch (err) {
    console.error(`[retro:full:${sessionId}] Video-memory update failed:`, err);
  }

  return completedSession;
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildZeusDashboard } from "@/lib/zeus/zeus-agent";
import { getAgentScores } from "@/lib/zeus/agent-scorer";
import { getRecentEpisodes } from "@/lib/zeus/episode-writer";
import { getDynamoClient } from "@/lib/aws-clients";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

async function getJobQueue(channelId: string) {
  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: "production-jobs",
        FilterExpression: "channelId = :cid",
        ExpressionAttributeValues: { ":cid": channelId },
        ProjectionExpression:
          "jobId, topic, niche, #s, createdAt, councilVotes, retroOutcome",
        ExpressionAttributeNames: { "#s": "status" },
        Limit: 50,
      })
    );
    return result.Items ?? [];
  } catch {
    return [];
  }
}

async function getRecentCouncilSessionsForDashboard() {
  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: "council-sessions",
        Limit: 5,
      })
    );
    return result.Items ?? [];
  } catch {
    return [];
  }
}

async function getActiveRetroSessions() {
  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: "retro-sessions",
        FilterExpression: "#s <> :completed",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":completed": "COMPLETED" },
        Limit: 20,
      })
    );
    return result.Items ?? [];
  } catch {
    return [];
  }
}

async function getRecentVeraResults() {
  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: "production-jobs",
        IndexName: "veraStatus-index",
        KeyConditionExpression: "veraStatus = :status",
        ExpressionAttributeValues: { ":status": "CLEARED" },
        ProjectionExpression: "jobId, veraQAResult, veraStatus, veraCompletedAt",
        Limit: 3,
        ScanIndexForward: false,
      })
    );
    return (result.Items ?? []).map((item) => item.veraQAResult).filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? "default";

  try {
    const [
      dashboard,
      agentScores,
      recentEpisodes,
      jobQueue,
      councilSessions,
      activeRetros,
      veraResults,
    ] = await Promise.allSettled([
      buildZeusDashboard(channelId),
      getAgentScores(channelId),
      getRecentEpisodes("zeus", 5),
      getJobQueue(channelId),
      getRecentCouncilSessionsForDashboard(),
      getActiveRetroSessions(),
      getRecentVeraResults(),
    ]);

    const dashboardData =
      dashboard.status === "fulfilled"
        ? dashboard.value
        : {
            agentScores: {
              rex: { score: 50, trend: "stable", lastWin: "No data" },
              regum: { score: 50, trend: "stable", lastWin: "No data" },
              qeon: { score: 50, trend: "stable", lastWin: "No data" },
              team: { score: 50, trend: "stable" },
            },
            channelHealth: {
              viewsToday: 0,
              subsGained: 0,
              avgCTR: 0,
              avgWatchTime: "0m 0s",
            },
            commentInsights: {
              analysed: 0,
              genuine: 0,
              topRequest: "No requests yet",
              topPraise: "No comments analysed yet",
              topComplaint: null,
            },
            memoryLog: [],
            watchlist: [],
            recentEpisodes: [],
          };

    return NextResponse.json({
      dashboard: dashboardData,
      agentScores: agentScores.status === "fulfilled" ? agentScores.value : [],
      recentEpisodes: recentEpisodes.status === "fulfilled" ? recentEpisodes.value : [],
      jobQueue: jobQueue.status === "fulfilled" ? jobQueue.value : [],
      councilSessions: councilSessions.status === "fulfilled" ? councilSessions.value : [],
      activeRetros: activeRetros.status === "fulfilled" ? activeRetros.value : [],
      veraResults: veraResults.status === "fulfilled" ? veraResults.value : [],
      generatedAt: new Date().toISOString(),
      channelId,
    });
  } catch (err) {
    console.error("[api/zeus/dashboard] Failed to build dashboard:", err);
    return NextResponse.json(
      { error: "Failed to load Zeus dashboard" },
      { status: 500 }
    );
  }
}

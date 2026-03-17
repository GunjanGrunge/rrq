import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildZeusDashboard } from "@/lib/zeus/zeus-agent";
import { getAgentScores } from "@/lib/zeus/agent-scorer";
import { getRecentEpisodes } from "@/lib/zeus/episode-writer";

export async function GET(req: Request): Promise<NextResponse> {
  // Clerk auth protection
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? "default";

  try {
    // Fetch dashboard data — parallelise non-dependent calls
    const [dashboard, agentScores, recentEpisodes] = await Promise.allSettled([
      buildZeusDashboard(channelId),
      getAgentScores(channelId),
      getRecentEpisodes("zeus", 5),
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

    const scores =
      agentScores.status === "fulfilled" ? agentScores.value : [];
    const episodes =
      recentEpisodes.status === "fulfilled" ? recentEpisodes.value : [];

    return NextResponse.json({
      dashboard: dashboardData,
      agentScores: scores,
      recentEpisodes: episodes,
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

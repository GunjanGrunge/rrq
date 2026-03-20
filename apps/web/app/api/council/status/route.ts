import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCouncilSession, getRecentCouncilSessions } from "@/lib/council/get-session";

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  try {
    if (sessionId) {
      const session = await getCouncilSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({ session });
    }

    // Return last 5 sessions
    const sessions = await getRecentCouncilSessions(5);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[api/council/status] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load council status" },
      { status: 500 }
    );
  }
}

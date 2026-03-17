import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(req: Request): Promise<NextResponse> {
  // Clerk auth protection
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; channelId?: string };
  try {
    body = (await req.json()) as { type?: string; channelId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, channelId = "default" } = body;

  if (!type || !["comments", "analytics"].includes(type)) {
    return NextResponse.json(
      {
        error:
          'Invalid type. Must be "comments" or "analytics".',
      },
      { status: 400 }
    );
  }

  try {
    if (type === "comments") {
      await inngest.send({
        name: "zeus/comments.triggered",
        data: { channelId, userId },
      });

      return NextResponse.json({
        status: "triggered",
        type: "comment_analysis",
        channelId,
        triggeredAt: new Date().toISOString(),
      });
    }

    if (type === "analytics") {
      await inngest.send({
        name: "zeus/analytics.triggered",
        data: { channelId, userId },
      });

      return NextResponse.json({
        status: "triggered",
        type: "analytics_review",
        channelId,
        triggeredAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Unexpected type" }, { status: 400 });
  } catch (err) {
    console.error("[api/zeus/trigger] Failed to trigger Zeus workflow:", err);
    return NextResponse.json(
      { error: "Failed to trigger Zeus workflow" },
      { status: 500 }
    );
  }
}

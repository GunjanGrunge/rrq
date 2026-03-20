import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId, qeonBrief } = await req.json() as {
      jobId: string;
      qeonBrief: {
        topic: string;
        angle: string;
        niche: string;
        tone: string;
        contentType: string;
        competitorGap: string;
        keywordFocus: string[];
        confidenceScore: number;
      };
    };

    if (!jobId || !qeonBrief) {
      return NextResponse.json(
        { error: "jobId and qeonBrief are required" },
        { status: 400 }
      );
    }

    await inngest.send({
      name: "council/session.triggered",
      data: { jobId, qeonBrief, triggeredBy: userId },
    });

    return NextResponse.json({
      status: "triggered",
      jobId,
      triggeredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/council/trigger] Failed:", err);
    return NextResponse.json(
      { error: "Failed to trigger council session" },
      { status: 500 }
    );
  }
}

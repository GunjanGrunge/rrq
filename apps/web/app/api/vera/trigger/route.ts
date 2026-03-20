import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import type { VeraDomain } from "@/lib/vera/types";

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobId, retryDomains } = await req.json() as {
      jobId: string;
      retryDomains?: VeraDomain[];
    };

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    await inngest.send({
      name: "vera/qa.triggered",
      data: { jobId, retryDomains, triggeredBy: userId },
    });

    return NextResponse.json({
      status: "triggered",
      jobId,
      retryDomains: retryDomains ?? null,
      triggeredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/vera/trigger] Failed:", err);
    return NextResponse.json(
      { error: "Failed to trigger Vera QA" },
      { status: 500 }
    );
  }
}

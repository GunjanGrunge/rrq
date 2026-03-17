import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    nicheOverride?: string;
    sourceFilter?: string[];
    channelId?: string;
  };

  await inngest.send({
    name: "rex/scan.triggered",
    data: {
      channelId: body.channelId ?? "default",
      userId,
      phase: "COLD_START", // Zeus will inject real phase in Phase 8
      channelMode: "STUDIO_MODE" as const,
      niche: body.nicheOverride,
    },
  });

  return NextResponse.json({ ok: true, queued: true });
}

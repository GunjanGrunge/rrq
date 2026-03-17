import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/lib/inngest";
import type { ChannelPhase } from "@/lib/mission/phase-engine";
import type { RexOpportunity } from "@/lib/rex/rex-scan";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    channelId?: string;
    phase?: ChannelPhase;
    channelMode?: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE";
    opportunities?: RexOpportunity[];
  };

  await inngest.send({
    name: "regum/schedule.triggered",
    data: {
      channelId: body.channelId ?? "default",
      userId,
      phase: body.phase ?? "COLD_START",
      channelMode: body.channelMode ?? "STUDIO_MODE",
      opportunities: body.opportunities ?? [],
    },
  });

  return NextResponse.json({ status: "triggered" });
}

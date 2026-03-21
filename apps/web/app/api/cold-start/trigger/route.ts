// POST /api/cold-start/trigger — fire cold start sprint on onboarding complete

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { triggerColdStart, getColdStartSprint } from "@/lib/cold-start/trigger";

interface TriggerBody {
  channelMode: "FULL_RRQ" | "MULTI_NICHE" | "SINGLE_NICHE";
  selectedNiches: string[];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: TriggerBody;
  try {
    body = await req.json() as TriggerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channelMode, selectedNiches } = body;

  if (!channelMode || !["FULL_RRQ", "MULTI_NICHE", "SINGLE_NICHE"].includes(channelMode)) {
    return NextResponse.json({ error: "Invalid channelMode" }, { status: 400 });
  }
  if (!Array.isArray(selectedNiches) || selectedNiches.length === 0) {
    return NextResponse.json({ error: "selectedNiches required" }, { status: 400 });
  }

  // Idempotency — if already running or complete, return existing
  const existing = await getColdStartSprint(userId);
  if (existing && (existing.status === "RUNNING" || existing.status === "COMPLETE")) {
    return NextResponse.json({
      ok: true,
      sprintId: existing.sprintId,
      status: existing.status,
      alreadyExists: true,
    });
  }

  try {
    const { sprintId } = await triggerColdStart(userId, channelMode, selectedNiches);
    return NextResponse.json({ ok: true, sprintId, status: "RUNNING" });
  } catch (err) {
    console.error(`[cold-start:trigger:${userId}] Failed to trigger sprint:`, err);
    return NextResponse.json({ error: "Failed to start sprint" }, { status: 500 });
  }
}

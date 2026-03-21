// POST /api/dev/seed-onboarding
// DEV ONLY — seeds user-settings + triggers cold start sprint
// Simulates completed onboarding for a user who skipped it

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDynamoClient } from "@/lib/aws-clients";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { triggerColdStart, getColdStartSprint } from "@/lib/cold-start/trigger";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Parse optional overrides from body
  let body: {
    niches?: string[];
    channelMode?: "FULL_RRQ" | "MULTI_NICHE" | "SINGLE_NICHE";
    force?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // no body — use defaults
  }

  const niches = body.niches ?? ["Tech Reviews"];
  const channelMode = body.channelMode ?? "SINGLE_NICHE";
  const force = body.force ?? false;

  // Write user-settings row
  const dynamo = getDynamoClient();
  await dynamo.send(
    new PutCommand({
      TableName: "user-settings",
      Item: {
        userId,
        channelMode,
        selectedNiches: niches,
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString(),
        seededByDev: true,
        qualityThreshold: 75,
        voicePreference: "default",
      },
    }),
  );

  // If there's an existing sprint and force=false, return it
  if (!force) {
    const existing = await getColdStartSprint(userId);
    if (existing && (existing.status === "RUNNING" || existing.status === "COMPLETE")) {
      return NextResponse.json({
        ok: true,
        message: "Existing sprint found — pass force=true to override",
        sprintId: existing.sprintId,
        status: existing.status,
        niches,
        channelMode,
      });
    }
  }

  // Trigger cold start sprint
  try {
    const { sprintId } = await triggerColdStart(userId, channelMode, niches);
    return NextResponse.json({
      ok: true,
      message: "user-settings seeded + cold start sprint triggered",
      sprintId,
      niches,
      channelMode,
      redirectTo: "/cold-start",
    });
  } catch (err) {
    console.error(`[dev:seed-onboarding:${userId}] Failed to trigger sprint:`, err);
    return NextResponse.json({ error: "Sprint trigger failed", detail: String(err) }, { status: 500 });
  }
}

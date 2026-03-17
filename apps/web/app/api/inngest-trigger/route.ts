// apps/web/app/api/inngest-trigger/route.ts
// Receives EventBridge scheduled events and forwards them to Inngest.
//
// EventBridge calls this route via:
//   - An API Destination (HTTP target) pointed at NEXT_PUBLIC_APP_URL/api/inngest-trigger
//   - OR a small Lambda bridge that does the HTTP call
//
// Expected request body (set by EventBridge rule Input transformer):
//   {
//     "detail-type": "rex/scan.triggered",   // Inngest event name
//     "ruleName": "rrq-rex-scan",
//     "detail": {}                           // Optional extra data
//   }

import { inngest } from "@/lib/inngest";
import { NextRequest, NextResponse } from "next/server";

// Optional shared secret to prevent unauthorized calls to this endpoint.
// Set INNGEST_BRIDGE_SECRET in Vercel env vars and in the Lambda bridge env.
const BRIDGE_SECRET = process.env.INNGEST_BRIDGE_SECRET;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth check (optional but recommended in production) ──────────────────
  if (BRIDGE_SECRET) {
    const authHeader = req.headers.get("x-bridge-secret");
    if (authHeader !== BRIDGE_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // ── Extract event name ────────────────────────────────────────────────────
  // Accept either "detail-type" (EventBridge format) or "eventName" (direct call format)
  const eventName =
    (body["detail-type"] as string | undefined) ??
    (body["eventName"] as string | undefined);

  if (!eventName || typeof eventName !== "string") {
    return NextResponse.json(
      { error: "missing event name — expected 'detail-type' or 'eventName' field" },
      { status: 400 }
    );
  }

  // ── Forward to Inngest ────────────────────────────────────────────────────
  const eventData = (body["detail"] as Record<string, unknown> | undefined) ?? {};

  await inngest.send({
    name: eventName,
    data: {
      ...eventData,
      triggeredBy: "eventbridge",
      ruleName: (body["ruleName"] as string | undefined) ?? "unknown",
      receivedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, event: eventName });
}

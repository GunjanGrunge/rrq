import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Zeus Chat Route — Murphy integration point
 *
 * Flow: Clerk auth → account ban check → device ban check →
 *       Murphy guardrail (future) → Zeus LLM call
 *
 * Murphy will be wired in here once lib/murphy/ is implemented.
 * For now this route handles auth, ban checks, and forwards to Zeus.
 */

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Clerk auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Account ban check (Clerk publicMetadata — hard enforcement)
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.banned === true) {
      return NextResponse.json(
        { error: "Your account has been permanently suspended." },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error("[api/zeus/chat] Clerk user fetch failed:", err);
    // Fail open on Clerk errors — don't block legitimate users
  }

  // 3. Device fingerprint check (best-effort deterrent)
  const fingerprintHash = req.headers.get("x-fingerprint") ?? null;
  if (fingerprintHash) {
    const banned = await isDeviceBanned(fingerprintHash);
    if (banned) {
      return NextResponse.json(
        { error: "Your account has been permanently suspended." },
        { status: 403 }
      );
    }
  }

  // 4. Parse message
  let message: string;
  try {
    const body = (await req.json()) as { message?: string };
    message = body.message?.trim() ?? "";
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!message || message.length === 0) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (max 2000 characters)" },
      { status: 400 }
    );
  }

  // ── Murphy guardrail will be inserted here ──────────────────────────
  // Once lib/murphy/ is implemented:
  //   const verdict = await runMurphyGuardrail(userId, message, fingerprintHash);
  //   if (verdict.decision === "BLOCK_IMMEDIATE") {
  //     await logStrike(userId, fingerprintHash, message);
  //     return NextResponse.json({ reply: verdict.userMessage }, { status: 200 });
  //   }
  //   if (verdict.decision === "ESCALATE_TO_ZEUS") { ... }
  // ────────────────────────────────────────────────────────────────────

  // 5. Forward to Zeus (placeholder — will call Zeus LLM with conversation context)
  try {
    // TODO: Wire to Zeus Bedrock Opus call with conversation history + memory injection
    return NextResponse.json({
      reply: "Zeus is coming online soon. This endpoint is ready for Murphy integration.",
      userId,
    });
  } catch (err) {
    console.error("[api/zeus/chat] Zeus call failed:", err);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// ── Device ban check (DynamoDB banned-devices table) ───────────────────

async function isDeviceBanned(fingerprintHash: string): Promise<boolean> {
  try {
    const { getDynamoClient } = await import("@/lib/aws-clients");
    const { GetItemCommand } = await import("@aws-sdk/client-dynamodb");
    const db = getDynamoClient();
    const result = await db.send(
      new GetItemCommand({
        TableName: "banned-devices",
        Key: { fingerprintHash: { S: fingerprintHash } },
        ProjectionExpression: "fingerprintHash",
      })
    );
    return !!result.Item;
  } catch (err) {
    console.error("[api/zeus/chat] Device ban check failed:", err);
    return false; // Fail open — don't block on DynamoDB errors
  }
}

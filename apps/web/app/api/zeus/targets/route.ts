import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDynamoClient } from "@/lib/aws-clients";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

export type TargetType =
  | "REVENUE_GROWTH"
  | "MORE_COMMENTS"
  | "MORE_VIEWS"
  | "REVENUE_TARGET"
  | "SUBSCRIBER_TARGET"
  | "COMBINED";

export interface ChannelTarget {
  type: TargetType;
  value?: number; // for REVENUE_TARGET ($/mo) and SUBSCRIBER_TARGET (count)
}

export interface SetTargetsRequest {
  targets: ChannelTarget[];
}

// POST /api/zeus/targets — set up to 3 channel targets, written to channel-targets table
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: SetTargetsRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { targets } = body;

  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: "At least one target required" }, { status: 400 });
  }
  if (targets.length > 3) {
    return NextResponse.json({ error: "Maximum 3 targets allowed" }, { status: 400 });
  }

  const valid: TargetType[] = [
    "REVENUE_GROWTH",
    "MORE_COMMENTS",
    "MORE_VIEWS",
    "REVENUE_TARGET",
    "SUBSCRIBER_TARGET",
    "COMBINED",
  ];

  for (const t of targets) {
    if (!valid.includes(t.type)) {
      return NextResponse.json({ error: `Unknown target type: ${t.type}` }, { status: 400 });
    }
    if ((t.type === "REVENUE_TARGET" || t.type === "SUBSCRIBER_TARGET") && !t.value) {
      return NextResponse.json({ error: `${t.type} requires a numeric value` }, { status: 400 });
    }
  }

  const dynamo = getDynamoClient();
  const now = new Date().toISOString();

  try {
    await dynamo.send(
      new PutCommand({
        TableName: "channel-targets",
        Item: {
          userId,
          targets,
          updatedAt: now,
          status: "ACTIVE",
          // Zeus reads this on next zeusAnalyticsWorkflow run (24h cycle)
          zeusAcknowledged: false,
          zeusAcknowledgedAt: null,
        },
      })
    );

    // Write to agent-messages so Zeus picks it up without waiting for 24h cron
    await dynamo.send(
      new PutCommand({
        TableName: "agent-messages",
        Item: {
          messageId: `targets-${userId}-${Date.now()}`,
          from: "USER",
          to: "ZEUS",
          type: "TARGETS_UPDATED",
          payload: { userId, targets },
          createdAt: now,
          read: false,
        },
      })
    );

    return NextResponse.json({ ok: true, targets, updatedAt: now });
  } catch (err) {
    console.error(`[zeus:targets:${userId}] Failed to write targets:`, err);
    return NextResponse.json({ error: "Failed to save targets" }, { status: 500 });
  }
}

// GET /api/zeus/targets — fetch current targets for the user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const dynamo = getDynamoClient();
  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: "channel-targets",
        Key: { userId },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ targets: [], updatedAt: null });
    }

    return NextResponse.json({
      targets: result.Item.targets as ChannelTarget[],
      updatedAt: result.Item.updatedAt as string,
    });
  } catch (err) {
    console.error(`[zeus:targets:${userId}] Failed to read targets:`, err);
    return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
  }
}

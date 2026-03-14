import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { sendNotificationEmail } from "@/lib/notifications/send-notification-email";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" })
);

const TABLE = "notifications";
const ARCHIVE_TABLE = "inbox-archive";

// GET /api/notifications — fetch user's messages
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const view = url.searchParams.get("view") ?? "inbox"; // "inbox" | "trash" | "archive"

    if (view === "archive") {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: ARCHIVE_TABLE,
          KeyConditionExpression: "userId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
      return NextResponse.json({ success: true, entries: result.Items ?? [] });
    }

    // inbox + trash — all messages, client filters by deletedAt
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    return NextResponse.json({ success: true, messages: result.Items ?? [] });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// POST /api/notifications — handle all actions
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, messageId } = body as {
      action:
        | "reply"
        | "accept-proposal"
        | "decline-proposal"
        | "create"
        | "delete"
        | "restore"
        | "purge";
      messageId?: string;
      content?: string;
      message?: Record<string, unknown>;
    };

    // ── Reply ──────────────────────────────────────────────────────────────
    if (action === "reply" && messageId) {
      const threadMsg = {
        role: "user",
        content: body.content ?? "",
        timestamp: Date.now(),
      };

      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, messageId },
          UpdateExpression:
            "SET #thread = list_append(if_not_exists(#thread, :empty), :msg), #read = :true",
          ExpressionAttributeNames: { "#thread": "thread", "#read": "read" },
          ExpressionAttributeValues: {
            ":msg": [threadMsg],
            ":empty": [],
            ":true": true,
          },
        })
      );

      return NextResponse.json({ success: true });
    }

    // ── Accept proposal ────────────────────────────────────────────────────
    if (action === "accept-proposal" && messageId) {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, messageId },
          UpdateExpression: "SET proposalData.#status = :approved, #read = :true",
          ExpressionAttributeNames: { "#status": "status", "#read": "read" },
          ExpressionAttributeValues: { ":approved": "approved", ":true": true },
        })
      );

      return NextResponse.json({ success: true });
    }

    // ── Decline proposal ───────────────────────────────────────────────────
    if (action === "decline-proposal" && messageId) {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, messageId },
          UpdateExpression: "SET proposalData.#status = :declined, #read = :true",
          ExpressionAttributeNames: { "#status": "status", "#read": "read" },
          ExpressionAttributeValues: { ":declined": "declined", ":true": true },
        })
      );

      return NextResponse.json({ success: true });
    }

    // ── Soft delete (move to trash) ────────────────────────────────────────
    if (action === "delete" && messageId) {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, messageId },
          UpdateExpression: "SET deletedAt = :now, #read = :true",
          ExpressionAttributeNames: { "#read": "read" },
          ExpressionAttributeValues: { ":now": Date.now(), ":true": true },
        })
      );

      return NextResponse.json({ success: true });
    }

    // ── Restore from trash ─────────────────────────────────────────────────
    if (action === "restore" && messageId) {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, messageId },
          UpdateExpression: "REMOVE deletedAt",
        })
      );

      return NextResponse.json({ success: true });
    }

    // ── Permanent delete (purge) ───────────────────────────────────────────
    // Zeus calls this after 90-day TTL. User can also trigger from trash UI.
    // Before deleting, write a one-line archive stub to inbox-archive table.
    if (action === "purge" && messageId) {
      // Fetch the message first so we can build the archive stub
      const existing = await dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { userId, messageId } })
      );

      if (existing.Item) {
        const item = existing.Item;
        const proposalStatus = item.proposalData?.status as string | undefined;

        // Determine action label for archive receipt
        let archiveAction: "accepted" | "declined" | "read" | "deleted" = "deleted";
        if (proposalStatus === "approved") archiveAction = "accepted";
        else if (proposalStatus === "declined") archiveAction = "declined";
        else if (item.read) archiveAction = "read";

        // Zeus-authored one-line summary (placeholder — Phase 5 Zeus will write this via Bedrock)
        const agentLabel = (item.agentSource as string) ?? "Agent";
        const title = (item.title as string) ?? "Notification";
        const dateStr = new Date(item.createdAt as number).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const summary = `${agentLabel} · ${title} · ${dateStr} — ${archiveAction}.`;

        // Write archive stub (TTL = 365 days from now)
        const archiveId = `${messageId}-arc`;
        const TTL_365_DAYS_SECS = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

        await dynamo.send(
          new PutCommand({
            TableName: ARCHIVE_TABLE,
            Item: {
              userId,
              archiveId,
              originalMessageId: messageId,
              agentSource: item.agentSource,
              tier: item.tier,
              title: item.title,
              summary,
              createdAt: item.createdAt,
              archivedAt: Date.now(),
              action: archiveAction,
              ttl: TTL_365_DAYS_SECS,
            },
          })
        );
      }

      // Delete the original message
      await dynamo.send(
        new DeleteCommand({ TableName: TABLE, Key: { userId, messageId } })
      );

      return NextResponse.json({ success: true });
    }

    // ── Create new message ─────────────────────────────────────────────────
    if (action === "create" && body.message) {
      const msg = body.message as {
        messageId: string;
        type: string;
        tier: string;
        title: string;
        body: string;
        agentSource: string;
        proposalData?: Record<string, unknown>;
        thread: unknown[];
        emailSent: boolean;
      };

      await dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            userId,
            ...msg,
            read: false,
            createdAt: Date.now(),
          },
        })
      );

      // Send email for Critical and High tiers if not already sent
      if ((msg.tier === "critical" || msg.tier === "high") && !msg.emailSent) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rrq.ai";
        const inboxUrl = `${appUrl}/inbox`;

        try {
          const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
            headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
          });
          const clerkUser = await clerkRes.json();
          const email = clerkUser?.email_addresses?.[0]?.email_address as string | undefined;

          if (email) {
            await sendNotificationEmail({
              toEmail: email,
              tier: msg.tier as "critical" | "high",
              title: msg.title,
              summary: msg.body,
              inboxUrl,
            });

            await dynamo.send(
              new UpdateCommand({
                TableName: TABLE,
                Key: { userId, messageId: msg.messageId },
                UpdateExpression: "SET emailSent = :true",
                ExpressionAttributeValues: { ":true": true },
              })
            );
          }
        } catch (emailErr) {
          console.error("Email send failed (non-fatal):", emailErr);
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/notifications error:", err);
    return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
  }
}

/*
 * Phase 5 — Zeus 24hr cron cleanup (commented stub)
 *
 * Zeus's existing zeusAnalyticsWorkflow (runs every 24hrs) should include:
 *
 * step.run("inbox-cleanup", async () => {
 *   const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
 *   const cutoff = Date.now() - MS_90_DAYS;
 *
 *   // Query notifications where deletedAt < cutoff (requires GSI on deletedAt)
 *   // For each expired item:
 *   //   1. POST /api/notifications { action: "purge", messageId } — writes archive stub + deletes
 *
 *   // Query inbox-archive where archivedAt < (now - 365 days)
 *   // Delete expired archive stubs via DynamoDB TTL (ttl field set on write)
 * });
 */

import { GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import { clerkClient } from "@clerk/nextjs/server";

const db = getDynamoClient();
const STRIKES_TABLE       = "user-strikes";
const BANNED_DEVICES_TABLE = "banned-devices";
const FINGERPRINTS_TABLE   = "user-fingerprints";
const FINGERPRINT_TTL_DAYS = 90;

// ─── Strike increment + ban logic ────────────────────────────────────────────

export async function incrementStrike(
  userId: string,
  fingerprintHash: string | null,
  harmfulMessage: string
): Promise<{ strikeCount: number; banned: boolean }> {
  const now = new Date().toISOString();
  const safeMessage = harmfulMessage.slice(0, 100).replace(/\d{4,}/g, "****"); // strip PII patterns

  try {
    // Atomic increment
    const result = await db.send(
      new UpdateItemCommand({
        TableName:                 STRIKES_TABLE,
        Key:                       marshall({ userId }),
        UpdateExpression:          "SET #count = if_not_exists(#count, :zero) + :one, lastStrikeAt = :now, lastHarmfulMessage = :msg, banned = if_not_exists(banned, :false)",
        ExpressionAttributeNames:  { "#count": "count" },
        ExpressionAttributeValues: marshall({
          ":zero":  0,
          ":one":   1,
          ":now":   now,
          ":msg":   safeMessage,
          ":false": false,
        }),
        ReturnValues: "ALL_NEW",
      })
    );

    const updated = unmarshall(result.Attributes ?? {});
    const strikeCount = (updated.count as number) ?? 1;

    if (strikeCount >= 3 && !updated.banned) {
      await applyPermaBan(userId, fingerprintHash);
      return { strikeCount, banned: true };
    }

    return { strikeCount, banned: false };
  } catch (err) {
    console.error(`[zeus:strike-manager:${userId}] Strike increment failed:`, err);
    return { strikeCount: 1, banned: false };
  }
}

async function applyPermaBan(userId: string, fingerprintHash: string | null): Promise<void> {
  const now = new Date().toISOString();

  // Mark banned in DynamoDB user-strikes
  try {
    await db.send(
      new UpdateItemCommand({
        TableName:                 STRIKES_TABLE,
        Key:                       marshall({ userId }),
        UpdateExpression:          "SET banned = :true",
        ExpressionAttributeValues: marshall({ ":true": true }),
      })
    );
  } catch (err) {
    console.error(`[zeus:strike-manager:${userId}] DynamoDB ban update failed:`, err);
  }

  // Write to Clerk publicMetadata
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { banned: true },
    });
  } catch (err) {
    console.error(`[zeus:strike-manager:${userId}] Clerk ban update failed:`, err);
  }

  // Write device to banned-devices
  if (fingerprintHash) {
    try {
      await db.send(
        new PutItemCommand({
          TableName: BANNED_DEVICES_TABLE,
          Item: marshall({
            fingerprintHash,
            userId,
            bannedAt:    now,
            reason:      "HARMFUL_CONTENT",
            strikeCount: 3,
          }),
        })
      );
    } catch (err) {
      console.error(`[zeus:strike-manager:${userId}] banned-devices write failed:`, err);
    }
  }
}

// ─── Upsert device fingerprint ────────────────────────────────────────────────

export async function upsertFingerprint(
  userId: string,
  fingerprintHash: string
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + FINGERPRINT_TTL_DAYS * 24 * 60 * 60;
  try {
    await db.send(
      new PutItemCommand({
        TableName: FINGERPRINTS_TABLE,
        Item: marshall({
          userId,
          fingerprintHash,
          lastSeenAt: new Date().toISOString(),
          ttl,
        }),
      })
    );
  } catch (err) {
    console.error(`[zeus:strike-manager:${userId}] Fingerprint upsert failed:`, err);
  }
}

// ─── Get current strike count ─────────────────────────────────────────────────

export async function getStrikeCount(userId: string): Promise<number> {
  try {
    const result = await db.send(
      new GetItemCommand({
        TableName:            STRIKES_TABLE,
        Key:                  marshall({ userId }),
        ProjectionExpression: "#count",
        ExpressionAttributeNames: { "#count": "count" },
      })
    );
    if (!result.Item) return 0;
    return (unmarshall(result.Item).count as number) ?? 0;
  } catch {
    return 0;
  }
}

// ─── Warning message by strike number ────────────────────────────────────────

export function getStrikeWarningMessage(strikeCount: number): string {
  if (strikeCount === 1) {
    return "This message violates RRQ's terms. You have 2 warnings remaining.";
  }
  if (strikeCount === 2) {
    return "Final warning — one more violation results in a permanent ban.";
  }
  return "Your account has been permanently suspended.";
}

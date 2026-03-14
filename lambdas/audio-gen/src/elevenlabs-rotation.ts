import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "elevenlabs-usage";

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const ddb = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
    docClient = DynamoDBDocumentClient.from(ddb);
  }
  return docClient;
}

export interface ElevenLabsAccount {
  id: string;
  apiKey: string;
  usedThisMonth: number;
  monthlyLimit: number;
}

/**
 * Four ElevenLabs free-tier accounts × 10,000 chars/month = 40,000 chars.
 * Environment keys: ELEVENLABS_KEY_1 through ELEVENLABS_KEY_4.
 *
 * Falls back to in-memory tracking if DynamoDB is not configured.
 */
const LOCAL_ACCOUNTS: ElevenLabsAccount[] = [
  { id: "1", apiKey: process.env.ELEVENLABS_KEY_1 ?? "", usedThisMonth: 0, monthlyLimit: 10000 },
  { id: "2", apiKey: process.env.ELEVENLABS_KEY_2 ?? "", usedThisMonth: 0, monthlyLimit: 10000 },
  { id: "3", apiKey: process.env.ELEVENLABS_KEY_3 ?? "", usedThisMonth: 0, monthlyLimit: 10000 },
  { id: "4", apiKey: process.env.ELEVENLABS_KEY_4 ?? "", usedThisMonth: 0, monthlyLimit: 10000 },
].filter((a) => a.apiKey !== "");

/**
 * Select the account with the most remaining chars that can fit this request.
 * Returns null if all accounts are exhausted → caller should use Edge-TTS.
 */
export function selectAccount(
  charCount: number
): ElevenLabsAccount | null {
  // First try DynamoDB for production usage tracking.
  // For now use in-memory tracking — DynamoDB integration wired in Phase 5.
  const available = LOCAL_ACCOUNTS
    .filter((a) => a.usedThisMonth + charCount <= a.monthlyLimit)
    .sort((a, b) => a.usedThisMonth - b.usedThisMonth);

  return available.length > 0 ? available[0] : null;
}

/**
 * Increment usage for an account after successful generation.
 * Uses DynamoDB atomic counter in production.
 */
export async function incrementUsage(
  accountId: string,
  charCount: number
): Promise<void> {
  // Update local tracking
  const account = LOCAL_ACCOUNTS.find((a) => a.id === accountId);
  if (account) {
    account.usedThisMonth += charCount;
  }

  // Update DynamoDB (best-effort — don't fail the Lambda if tracking fails)
  try {
    const client = getDocClient();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { accountId, monthKey },
        UpdateExpression:
          "SET usedChars = if_not_exists(usedChars, :zero) + :chars, updatedAt = :now",
        ExpressionAttributeValues: {
          ":chars": charCount,
          ":zero": 0,
          ":now": now.toISOString(),
        },
      })
    );
  } catch (err) {
    console.warn(`[elevenlabs-rotation] DynamoDB usage tracking failed:`, err);
  }
}

/**
 * Get usage from DynamoDB for accurate cross-invocation tracking.
 * Used by the production version of selectAccount.
 */
export async function getAccountUsagesFromDB(): Promise<ElevenLabsAccount[]> {
  try {
    const client = getDocClient();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "monthKey = :mk",
        ExpressionAttributeValues: { ":mk": monthKey },
      })
    );

    const usageMap = new Map<string, number>();
    for (const item of result.Items ?? []) {
      usageMap.set(item.accountId as string, (item.usedChars as number) ?? 0);
    }

    return LOCAL_ACCOUNTS.map((a) => ({
      ...a,
      usedThisMonth: usageMap.get(a.id) ?? 0,
    }));
  } catch {
    return LOCAL_ACCOUNTS;
  }
}

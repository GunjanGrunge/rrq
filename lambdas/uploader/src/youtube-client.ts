import { google, type youtube_v3 } from "googleapis";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TOKENS_TABLE = "user-tokens";

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    docClient = DynamoDBDocumentClient.from(ddb);
  }
  return docClient;
}

interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Get an authenticated YouTube Data API v3 client for a user.
 *
 * OAuth tokens are stored in DynamoDB `user-tokens` table,
 * keyed by Clerk userId. Auto-refreshes expired tokens.
 */
export async function getYouTubeClient(
  userId: string
): Promise<youtube_v3.Youtube> {
  const tokens = await getTokens(userId);

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt,
  });

  // Auto-refresh listener — persists new tokens to DynamoDB
  oauth2Client.on("tokens", async (newTokens) => {
    console.log(`[youtube-client] Token refreshed for user ${userId}`);
    await updateTokens(userId, {
      accessToken: newTokens.access_token ?? tokens.accessToken,
      refreshToken: newTokens.refresh_token ?? tokens.refreshToken,
      expiresAt: newTokens.expiry_date ?? Date.now() + 3600_000,
    });
  });

  return google.youtube({ version: "v3", auth: oauth2Client });
}

async function getTokens(userId: string): Promise<YouTubeTokens> {
  const client = getDocClient();
  const result = await client.send(
    new GetCommand({
      TableName: TOKENS_TABLE,
      Key: { userId },
    })
  );

  if (!result.Item) {
    throw new Error(`No YouTube tokens found for user ${userId}. User must connect YouTube first.`);
  }

  return {
    accessToken: result.Item.accessToken as string,
    refreshToken: result.Item.refreshToken as string,
    expiresAt: result.Item.expiresAt as number,
  };
}

async function updateTokens(
  userId: string,
  tokens: YouTubeTokens
): Promise<void> {
  const client = getDocClient();
  await client.send(
    new UpdateCommand({
      TableName: TOKENS_TABLE,
      Key: { userId },
      UpdateExpression:
        "SET accessToken = :at, refreshToken = :rt, expiresAt = :ea, updatedAt = :now",
      ExpressionAttributeValues: {
        ":at": tokens.accessToken,
        ":rt": tokens.refreshToken,
        ":ea": tokens.expiresAt,
        ":now": new Date().toISOString(),
      },
    })
  );
}

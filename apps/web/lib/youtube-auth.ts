/**
 * youtube-auth.ts
 *
 * Shared YouTube OAuth helpers for the Next.js app.
 * Uses raw fetch calls against the Google REST APIs — googleapis is not
 * installed in apps/web, only in the uploader Lambda.
 *
 * Exports:
 *   getOAuthClient()                      — returns a lightweight OAuth2 helper
 *   getYouTubeClient(userId)              — reads tokens from DynamoDB + returns
 *                                           an authed fetch wrapper (YouTubeClient)
 *   hasYouTubeConnected(userId)           — boolean check whether tokens exist
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// ─── DynamoDB singleton ──────────────────────────────────────────────────────

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" })
);

const TOKENS_TABLE = "user-tokens";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YouTubeTokenRecord {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  connectedAt?: string; // ISO string
  updatedAt?: string; // ISO string
}

/**
 * Lightweight fetch-based client returned by getYouTubeClient().
 * Wraps every request with the current access token and handles
 * transparent token refresh.
 */
export interface YouTubeClient {
  /** Raw access token — use for youtubeAnalytics requests that need the OAuth header */
  accessToken: string;
  /** Make an authenticated GET to any Google API URL. */
  get(url: string): Promise<Response>;
}

// ─── OAuth2 client (no googleapis dependency) ────────────────────────────────

interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Build the authorization URL with the requested scopes. */
  buildAuthUrl(scopes: string[]): string;
  /** Exchange an auth code for tokens. */
  exchangeCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
  /** Refresh an expired access token using the refresh token. */
  refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

export function getOAuthClient(): OAuthClient {
  const clientId = process.env.YOUTUBE_CLIENT_ID ?? "";
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? "";

  return {
    clientId,
    clientSecret,
    redirectUri,

    buildAuthUrl(scopes: string[]): string {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        prompt: "consent", // force refresh_token every time
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    async exchangeCode(code: string) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OAuth token exchange failed: ${err}`);
      }
      return res.json() as Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      }>;
    },

    async refreshAccessToken(refreshToken: string) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        }).toString(),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OAuth token refresh failed: ${err}`);
      }
      return res.json() as Promise<{
        access_token: string;
        expires_in: number;
      }>;
    },
  };
}

// ─── Token persistence helpers ───────────────────────────────────────────────

async function readTokenRecord(
  userId: string
): Promise<YouTubeTokenRecord | null> {
  try {
    const result = await dynamo.send(
      new GetCommand({ TableName: TOKENS_TABLE, Key: { userId } })
    );
    if (!result.Item) return null;
    return result.Item as YouTubeTokenRecord;
  } catch (err: unknown) {
    // Table doesn't exist yet — treat as no tokens
    const code = (err as { name?: string })?.name;
    if (code === "ResourceNotFoundException") return null;
    throw err;
  }
}

export async function writeTokenRecord(
  record: YouTubeTokenRecord
): Promise<void> {
  try {
    await dynamo.send(
      new PutCommand({
        TableName: TOKENS_TABLE,
        Item: { ...record, updatedAt: new Date().toISOString() },
      })
    );
  } catch (err: unknown) {
    const code = (err as { name?: string })?.name;
    if (code === "ResourceNotFoundException") {
      console.error(
        "[youtube-auth] user-tokens table does not exist. " +
          "Provision it in DynamoDB (PK: userId, PAY_PER_REQUEST) then reconnect."
      );
      throw new Error("YouTube token storage is not yet provisioned. Please contact support.");
    }
    throw err;
  }
}

async function refreshAndPersist(
  userId: string,
  record: YouTubeTokenRecord
): Promise<string> {
  const oauth = getOAuthClient();
  const refreshed = await oauth.refreshAccessToken(record.refreshToken);
  const newExpiresAt = Date.now() + refreshed.expires_in * 1000;

  await dynamo.send(
    new UpdateCommand({
      TableName: TOKENS_TABLE,
      Key: { userId },
      UpdateExpression:
        "SET accessToken = :at, expiresAt = :ea, updatedAt = :now",
      ExpressionAttributeValues: {
        ":at": refreshed.access_token,
        ":ea": newExpiresAt,
        ":now": new Date().toISOString(),
      },
    })
  );

  console.log(`[youtube-auth] Token refreshed and persisted for user ${userId}`);
  return refreshed.access_token;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the user has YouTube tokens stored in DynamoDB.
 */
export async function hasYouTubeConnected(userId: string): Promise<boolean> {
  const record = await readTokenRecord(userId);
  return record !== null;
}

/**
 * Reads tokens from DynamoDB, auto-refreshes if expired, and returns
 * a YouTubeClient that attaches the Bearer token to every fetch.
 *
 * Throws if no tokens exist (user has not connected YouTube).
 */
export async function getYouTubeClient(userId: string): Promise<YouTubeClient> {
  const record = await readTokenRecord(userId);
  if (!record) {
    throw new Error(
      `No YouTube tokens for user ${userId}. User must connect YouTube first.`
    );
  }

  // Refresh if token expires within the next 5 minutes
  const BUFFER_MS = 5 * 60 * 1000;
  let accessToken = record.accessToken;
  if (Date.now() >= record.expiresAt - BUFFER_MS) {
    accessToken = await refreshAndPersist(userId, record);
  }

  return {
    accessToken,
    async get(url: string): Promise<Response> {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res;
    },
  };
}

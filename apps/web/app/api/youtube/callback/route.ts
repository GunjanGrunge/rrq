/**
 * GET /api/youtube/callback
 *
 * OAuth2 callback handler. Google redirects here after the user grants
 * (or denies) permission.
 *
 * On success: exchanges the auth code for tokens, persists them to
 *             DynamoDB `user-tokens`, then redirects to /analytics/channel.
 * On failure: redirects to /settings?error=youtube_auth_failed
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, writeTokenRecord } from "@/lib/youtube-auth";

const SUCCESS_URL = "/analytics/channel";
const FAILURE_URL = "/settings?error=youtube_auth_failed";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // User denied access or Google returned an error
  if (error || !code) {
    console.warn(`[youtube/callback] OAuth denied or missing code: ${error ?? "no code"}`);
    return NextResponse.redirect(new URL(FAILURE_URL, req.url));
  }

  try {
    const oauth = getOAuthClient();
    const tokenResponse = await oauth.exchangeCode(code);

    if (!tokenResponse.access_token) {
      throw new Error("No access_token in token response");
    }
    if (!tokenResponse.refresh_token) {
      // This can happen if the user previously granted access and prompt=consent
      // was not respected. Log and continue — we can still use the access token
      // until it expires, but won't be able to auto-refresh without a refresh token.
      console.warn(
        `[youtube/callback] No refresh_token returned for user ${userId}. ` +
          "User may need to revoke and reconnect to get a refresh token."
      );
    }

    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;

    await writeTokenRecord({
      userId,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? "",
      expiresAt,
      connectedAt: new Date().toISOString(),
    });

    console.log(`[youtube/callback] Tokens stored for user ${userId}`);
    return NextResponse.redirect(new URL(SUCCESS_URL, req.url));
  } catch (err) {
    console.error(`[youtube/callback] Token exchange failed for user ${userId}:`, err);
    return NextResponse.redirect(new URL(FAILURE_URL, req.url));
  }
}

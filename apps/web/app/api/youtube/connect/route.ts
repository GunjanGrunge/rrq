/**
 * GET /api/youtube/connect
 *
 * Builds a Google OAuth2 authorization URL and redirects the user to it.
 * Scopes requested:
 *   - youtube.readonly       — channel stats, video data
 *   - yt-analytics.readonly  — analytics reports (views, watch time, subs gained)
 *   - adsense.readonly       — estimated revenue, RPM, CPM (only available if monetised)
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/youtube-auth";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/adsense.readonly",
];

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauth = getOAuthClient();
  const authUrl = oauth.buildAuthUrl(YOUTUBE_SCOPES);

  return NextResponse.redirect(authUrl);
}

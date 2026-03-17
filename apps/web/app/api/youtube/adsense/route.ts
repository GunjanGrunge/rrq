/**
 * GET /api/youtube/adsense
 *
 * Fetches real AdSense data for the authenticated user using the same
 * OAuth tokens stored in DynamoDB (adsense.readonly scope was requested
 * at YouTube connect time).
 *
 * Returns:
 *   { connected: false }                         — no YouTube/AdSense tokens
 *   { connected: true, accountId: null }         — tokens exist but no AdSense account
 *   { connected: true, accountId, ...metrics }   — full AdSense data
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  hasYouTubeConnected,
  getYouTubeClient,
} from "@/lib/youtube-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdSenseResponse {
  connected: boolean;
  accountId?: string;
  currentMonthEstimated?: number | null;
  lastMonthFinalised?: number | null;
  monthlyHistory?: Array<{
    month: string;
    estimated: number | null;
    finalised: number | null;
  }>;
  paymentThreshold?: number;
  currentBalance?: number | null;
}

// AdSense REST API v2 base URL
const ADSENSE_BASE = "https://adsense.googleapis.com/v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse the ESTIMATED_EARNINGS value from an AdSense report response.
 * The API returns totals as strings inside a nested structure.
 */
function parseEarnings(
  body: Record<string, unknown>
): number | null {
  try {
    const totals = body?.totals as Record<string, unknown> | undefined;
    const cells = totals?.cells as Array<{ value?: string }> | undefined;
    if (!cells || cells.length === 0) return null;
    const raw = cells[0]?.value;
    if (raw === undefined || raw === null) return null;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Build query-string parameters for an AdSense report request.
 * The v2 API accepts parameters as repeated query params (not a POST body).
 */
function buildReportParams(
  params: Record<string, string | string[]>
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<AdSenseResponse>> {
  // 1. Verify the user is signed in
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  // 2. Check whether YouTube/AdSense tokens exist
  const connected = await hasYouTubeConnected(userId);
  if (!connected) {
    return NextResponse.json({ connected: false });
  }

  // 3. Get the authed fetch client (handles transparent token refresh)
  const client = await getYouTubeClient(userId);

  // 4. Fetch the list of AdSense accounts linked to this Google account
  let accountId: string | null = null;
  try {
    const accountsRes = await client.get(`${ADSENSE_BASE}/accounts`);
    if (accountsRes.ok) {
      const accountsBody = (await accountsRes.json()) as {
        accounts?: Array<{ name: string }>;
      };
      const accounts = accountsBody.accounts ?? [];
      if (accounts.length === 0) {
        // Tokens are valid but the user hasn't set up AdSense yet
        return NextResponse.json({ connected: true, accountId: undefined });
      }
      // Use the first account (format: "accounts/pub-XXXXX")
      accountId = accounts[0].name;
    } else {
      // AdSense API returned an error (e.g. 403 scope not granted, no account)
      return NextResponse.json({ connected: true, accountId: undefined });
    }
  } catch {
    return NextResponse.json({ connected: true, accountId: undefined });
  }

  // 5. Fetch current month estimate (MONTH_TO_DATE)
  let currentMonthEstimated: number | null = null;
  try {
    const mtdParams = buildReportParams({
      dateRange: "MONTH_TO_DATE",
      metrics: "ESTIMATED_EARNINGS",
    });
    const mtdRes = await client.get(
      `${ADSENSE_BASE}/${accountId}/reports:generate?${mtdParams}`
    );
    if (mtdRes.ok) {
      const mtdBody = (await mtdRes.json()) as Record<string, unknown>;
      currentMonthEstimated = parseEarnings(mtdBody);
    }
  } catch {
    // Leave as null — non-fatal
  }

  // 6. Fetch last 3 months of history (CUSTOM date range, MONTH dimension)
  //    We compute the start date as 3 months ago (first day of that month).
  let monthlyHistory: Array<{
    month: string;
    estimated: number | null;
    finalised: number | null;
  }> = [];
  let lastMonthFinalised: number | null = null;

  try {
    const now = new Date();

    // End: last day of previous month
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    // Start: first day 3 months before current month
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const historyParams = buildReportParams({
      dateRange: "CUSTOM",
      "startDate.year": String(startDate.getFullYear()),
      "startDate.month": String(startDate.getMonth() + 1),
      "startDate.day": "1",
      "endDate.year": String(endDate.getFullYear()),
      "endDate.month": String(endDate.getMonth() + 1),
      "endDate.day": String(endDate.getDate()),
      metrics: "ESTIMATED_EARNINGS",
      dimensions: "MONTH",
    });

    const historyRes = await client.get(
      `${ADSENSE_BASE}/${accountId}/reports:generate?${historyParams}`
    );

    if (historyRes.ok) {
      const historyBody = (await historyRes.json()) as {
        rows?: Array<{
          cells?: Array<{ value?: string }>;
        }>;
      };

      const rows = historyBody.rows ?? [];
      monthlyHistory = rows.map((row) => {
        // cells[0] = MONTH dimension value (YYYYMM), cells[1] = ESTIMATED_EARNINGS
        const cells = row.cells ?? [];
        const monthLabel = cells[0]?.value ?? "";
        const earningsRaw = cells[1]?.value;
        const earnings =
          earningsRaw !== undefined && earningsRaw !== null
            ? parseFloat(earningsRaw)
            : null;

        return {
          month: monthLabel,
          estimated: earnings !== null && !isNaN(earnings) ? earnings : null,
          // AdSense v2 only surfaces estimated earnings in report dimensions;
          // finalised figures require a separate Payments API call — null for now
          finalised: null,
        };
      });

      // Last month finalised: use the most recent row's estimated value as a
      // best-available proxy (AdSense finalises ~15 days after month close)
      if (monthlyHistory.length > 0) {
        lastMonthFinalised =
          monthlyHistory[monthlyHistory.length - 1].estimated;
      }
    }
  } catch {
    // Leave monthlyHistory as [] — non-fatal
  }

  // 7. Assemble and return
  const response: AdSenseResponse = {
    connected: true,
    accountId,
    currentMonthEstimated,
    lastMonthFinalised,
    monthlyHistory,
    // paymentThreshold and currentBalance require the Payments API
    // (accounts/{accountId}/payments) — omitted here; can be added as a
    // follow-up when the payments scope is requested at connect time.
    paymentThreshold: undefined,
    currentBalance: null,
  };

  return NextResponse.json(response);
}

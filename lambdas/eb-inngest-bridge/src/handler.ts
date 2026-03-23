import type { Handler, EventBridgeEvent } from "aws-lambda";
import * as https from "https";
import * as http from "http";

/**
 * eb-inngest-bridge Lambda
 *
 * Receives EventBridge scheduled events and forwards them to Inngest
 * as named events. Each EventBridge rule maps to one Inngest event name.
 */

// Map EventBridge rule name → Inngest event name
const RULE_TO_EVENT: Record<string, string> = {
  "rrq-rex-scan":           "rex/scan.triggered",
  "rrq-zeus-comments":      "zeus/comments.triggered",
  "rrq-zeus-analytics":     "zeus/analytics.triggered",
  "rrq-oracle-run":         "oracle/run.triggered",
  "rrq-the-line-morning":   "the-line/morning.triggered",
  "rrq-the-line-eod":       "the-line/eod.triggered",
  "rrq-theo-daily":         "theo/daily.triggered",
  "rrq-theo-weekly":        "theo/weekly.triggered",
  "rrq-jason-standup":      "jason/standup.triggered",
  "rrq-jason-sprint-check": "jason/sprint-check.triggered",
  "rrq-autopilot-cron":     "rrq/autopilot.triggered",
  "rrq-queue-low-check":    "rex/queue-low.triggered",
};

function postJson(url: string, body: string, apiKey: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "Authorization": `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export const handler: Handler = async (event: EventBridgeEvent<string, unknown>) => {
  const appUrl = process.env.APP_URL;
  const inngestEventKey = process.env.INNGEST_EVENT_KEY;

  if (!appUrl || !inngestEventKey) {
    console.error("[eb-inngest-bridge] Missing APP_URL or INNGEST_EVENT_KEY env vars");
    throw new Error("Missing required env vars: APP_URL, INNGEST_EVENT_KEY");
  }

  // Extract rule name from the event source ARN in the resources array
  // EventBridge sets source to "aws.events" and detail-type to "Scheduled Event"
  // The rule name is in event.resources[0]: "arn:aws:events:...:rule/RULE_NAME"
  const ruleArn = (event.resources ?? [])[0] ?? "";
  const ruleName = ruleArn.split("/").pop() ?? "";

  const inngestEventName = RULE_TO_EVENT[ruleName];
  if (!inngestEventName) {
    console.warn(`[eb-inngest-bridge] No mapping for rule: ${ruleName} — skipping`);
    return { statusCode: 200, body: "no mapping" };
  }

  console.log(`[eb-inngest-bridge] ${ruleName} → ${inngestEventName}`);

  const payload = JSON.stringify([
    {
      name: inngestEventName,
      data: {
        triggeredBy: "eventbridge",
        ruleName,
        scheduledAt: event.time,
      },
    },
  ]);

  // POST to Inngest event API
  const inngestUrl = `${appUrl}/api/inngest`;
  const result = await postJson(inngestUrl, payload, inngestEventKey);

  console.log(`[eb-inngest-bridge] Inngest response: ${result.status} — ${result.body}`);

  if (result.status >= 400) {
    throw new Error(`[eb-inngest-bridge] Inngest rejected event: ${result.status} ${result.body}`);
  }

  return { statusCode: 200, body: "ok" };
};

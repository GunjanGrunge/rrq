// infrastructure/eventbridge/inngest-target.ts
// EventBridge → Inngest bridge configuration.
//
// EventBridge fires on schedule → calls /api/inngest-trigger (Next.js API route)
// → route forwards the event to Inngest with the correct event name.
//
// For production, you need an API Gateway HTTP endpoint or Lambda that receives
// the EventBridge HTTP target call and proxies to the Vercel deployment.
// The NEXT_PUBLIC_APP_URL must be the publicly reachable Vercel URL.

export const INNGEST_EVENTBRIDGE_TARGET = {
  /**
   * Next.js API route that receives EventBridge HTTP target calls.
   * EventBridge calls this URL when a scheduled rule fires.
   */
  apiRouteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app"}/api/inngest-trigger`,

  /**
   * HTTP parameters passed with every EventBridge target invocation.
   * EventBridge HTTP targets require a Content-Type header.
   */
  httpParameters: {
    HeaderParameters: {
      "Content-Type": "application/json",
    },
  },
} as const;

// ─── EventBridge → Inngest event name mapping ─────────────────────────────────
// Maps each EventBridge rule's targetEventName to the corresponding Inngest
// function ID it should trigger. Used for documentation and runtime validation.

export const EVENT_NAME_MAP: Record<string, string> = {
  "rex/scan.triggered": "rex-scan-workflow",
  "zeus/comments.triggered": "zeus-comment-workflow",
  "zeus/analytics.triggered": "zeus-analytics-workflow",
  "oracle/run.triggered": "oracle-run-workflow",
  "the-line/morning.triggered": "the-line-morning-workflow",
  "the-line/eod.triggered": "the-line-eod-workflow",
  "theo/daily.triggered": "theo-daily-workflow",
  "theo/weekly.triggered": "theo-weekly-workflow",
  "jason/standup.triggered": "jason-standup-workflow",
  "jason/sprint-check.triggered": "jason-sprint-check-workflow",
  "rrq/cron.triggered": "rrq-autopilot-cron-workflow",
  "rrq/queue-low.triggered": "rrq-queue-low-workflow",
};

// ─── Setup notes ──────────────────────────────────────────────────────────────
//
// EventBridge HTTP targets require:
//   1. A connection resource (auth + URL) in EventBridge → API Destinations
//   2. An API Destination pointing to INNGEST_EVENTBRIDGE_TARGET.apiRouteUrl
//   3. A Lambda or API Gateway that relays the call (EventBridge can't call Vercel directly
//      from scheduled rules — it needs an API Destination or Lambda intermediary)
//
// Recommended architecture:
//   EventBridge Rule
//     → Lambda "eb-inngest-bridge" (tiny Node.js, just an HTTP POST to Vercel)
//         → POST https://{your-vercel-app}/api/inngest-trigger
//             → inngest.send({ name: eventName, data: detail })
//
// The eb-inngest-bridge Lambda only needs:
//   - INNGEST_TRIGGER_URL env var = NEXT_PUBLIC_APP_URL + /api/inngest-trigger
//   - INNGEST_BRIDGE_SECRET env var = shared secret validated in route.ts
//   - IAM: no special permissions needed (just outbound HTTPS)
//
// See: apps/web/app/api/inngest-trigger/route.ts for the receiving end.

// infrastructure/eventbridge/rules.ts
// EventBridge scheduled rules for all RRQ agent cron triggers.
// Rules fire EventBridge events → forwarded to Inngest via the inngest-trigger API route.

import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  type PutRuleCommandInput,
} from "@aws-sdk/client-eventbridge";

// ─── Rule config type ─────────────────────────────────────────────────────────

export interface EventBridgeRuleConfig {
  ruleName: string;
  /** AWS rate() or cron() expression */
  scheduleExpression: string;
  description: string;
  /** Inngest event name to fire — becomes the "detail-type" in EventBridge payload */
  targetEventName: string;
  /** false = rule is created but disabled (used for Autopilot-only rules) */
  enabled: boolean;
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

export const EVENTBRIDGE_RULES: EventBridgeRuleConfig[] = [
  // ── Rex ──────────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-rex-scan",
    scheduleExpression: process.env.REX_SCAN_RULE ?? "rate(30 minutes)",
    description: "Rex trend scan — runs every 30 minutes to surface ranked video opportunities",
    targetEventName: "rex/scan.triggered",
    enabled: true,
  },

  // ── Zeus ─────────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-zeus-comments",
    scheduleExpression: process.env.ZEUS_COMMENT_RULE ?? "rate(6 hours)",
    description: "Zeus comment analysis — classifies + attributes + scores every 6 hours",
    targetEventName: "zeus/comments.triggered",
    enabled: true,
  },
  {
    ruleName: "rrq-zeus-analytics",
    scheduleExpression: process.env.ZEUS_ANALYTICS_RULE ?? "rate(24 hours)",
    description: "Zeus analytics review — 24hr and 72hr video health checks",
    targetEventName: "zeus/analytics.triggered",
    enabled: true,
  },

  // ── Oracle ───────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-oracle-run",
    scheduleExpression: process.env.ORACLE_RUN_RULE ?? "cron(0 9 ? * TUE,FRI *)",
    description: "Oracle L&D run — Tuesdays and Fridays at 9am (format discovery + CVE audit)",
    targetEventName: "oracle/run.triggered",
    enabled: true,
  },

  // ── The Line ──────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-the-line-morning",
    scheduleExpression: process.env.THE_LINE_MORNING_RULE ?? "cron(45 8 * * ? *)",
    description: "The Line morning brief synthesis — 8:45am daily, delivered to Zeus",
    targetEventName: "the-line/morning.triggered",
    enabled: true,
  },
  {
    ruleName: "rrq-the-line-eod",
    scheduleExpression: process.env.THE_LINE_EOD_RULE ?? "cron(0 21 * * ? *)",
    description: "The Line end-of-day brief — 9pm daily",
    targetEventName: "the-line/eod.triggered",
    enabled: true,
  },

  // ── Theo ──────────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-theo-daily",
    scheduleExpression: process.env.THEO_DAILY_RULE ?? "cron(0 9 * * ? *)",
    description: "Theo daily channel management — comment triage + community post + A/B checks",
    targetEventName: "theo/daily.triggered",
    enabled: true,
  },
  {
    ruleName: "rrq-theo-weekly",
    scheduleExpression: process.env.THEO_WEEKLY_RULE ?? "cron(0 8 ? * SUN *)",
    description: "Theo weekly synthesis report — Sundays at 8am",
    targetEventName: "theo/weekly.triggered",
    enabled: true,
  },

  // ── Jason ─────────────────────────────────────────────────────────────────────
  {
    ruleName: "rrq-jason-standup",
    scheduleExpression: process.env.JASON_STANDUP_RULE ?? "cron(0 9 * * ? *)",
    description: "Jason daily standup — kanban status + blockers, 9am daily",
    targetEventName: "jason/standup.triggered",
    enabled: true,
  },
  {
    ruleName: "rrq-jason-sprint-check",
    scheduleExpression: process.env.JASON_SPRINT_CHECK_RULE ?? "cron(0 18 * * ? *)",
    description: "Jason sprint check — velocity + burndown review, 6pm daily",
    targetEventName: "jason/sprint-check.triggered",
    enabled: true,
  },

  // ── RRQ Autopilot cron (off by default — enabled only in Autopilot Mode) ─────
  {
    ruleName: "rrq-autopilot-cron",
    scheduleExpression: process.env.RRQ_CRON_RULE ?? "rate(6 hours)",
    description:
      "RRQ Autopilot cron trigger — fires the full autonomous pipeline. Disabled by default; enabled only when channel enters Autopilot Mode.",
    targetEventName: "rrq/cron.triggered",
    enabled: false,
  },

  // ── RRQ queue-low check (off by default — enabled only in Rex Mode) ───────────
  {
    ruleName: "rrq-queue-low-check",
    scheduleExpression: process.env.RRQ_QUEUE_LOW_CHECK_RULE ?? "rate(30 minutes)",
    description:
      "RRQ queue-low check — fires Rex scan when pending clip count drops below threshold. Disabled by default; enabled in Rex Mode.",
    targetEventName: "rrq/queue-low.triggered",
    enabled: false,
  },
];

// ─── Rule provisioning ────────────────────────────────────────────────────────

/**
 * Creates or updates all EventBridge rules, then wires each to the Inngest
 * trigger target (API Gateway URL or Lambda ARN).
 *
 * @param ebClient     Initialized EventBridgeClient
 * @param inngestTargetArn  ARN of the API Gateway HTTP endpoint or Lambda that
 *                          forwards events to Inngest. Typically the
 *                          /api/inngest-trigger API Gateway endpoint ARN.
 *                          If using API Gateway HTTP API, use a Lambda proxy ARN.
 */
export async function createEventBridgeRules(
  ebClient: EventBridgeClient,
  inngestTargetArn: string
): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const rule of EVENTBRIDGE_RULES) {
    // PutRule is idempotent — creates or updates
    const ruleInput: PutRuleCommandInput = {
      Name: rule.ruleName,
      ScheduleExpression: rule.scheduleExpression,
      Description: rule.description,
      State: rule.enabled ? "ENABLED" : "DISABLED",
    };

    const { RuleArn } = await ebClient.send(new PutRuleCommand(ruleInput));

    if (!RuleArn) {
      throw new Error(`EventBridge PutRule returned no ARN for rule: ${rule.ruleName}`);
    }

    // Wire rule → Inngest target
    // EventBridge sends the scheduled event; our bridge API route reads detail-type
    // and forwards the matching Inngest event name.
    if (inngestTargetArn) {
      await ebClient.send(
        new PutTargetsCommand({
          Rule: rule.ruleName,
          Targets: [
            {
              Id: `inngest-${rule.ruleName}`,
              Arn: inngestTargetArn,
              // Inject targetEventName into the event detail so the bridge
              // knows which Inngest event to fire
              Input: JSON.stringify({
                "detail-type": rule.targetEventName,
                ruleName: rule.ruleName,
                detail: {},
              }),
            },
          ],
        })
      );
    } else {
      console.warn(
        `  Warning: no inngestTargetArn provided — rule ${rule.ruleName} created without target. Wire manually.`
      );
    }

    // Determine if it was a create or update by whether we got a new ARN
    const wasUpdated = RuleArn.includes(rule.ruleName);
    if (wasUpdated) updated++;
    else created++;

    const stateLabel = rule.enabled ? "ENABLED" : "DISABLED";
    console.log(`    ${stateLabel.toLowerCase() === "enabled" ? "+" : "-"} ${rule.ruleName} [${stateLabel}]`);
  }

  console.log(
    `  EventBridge rules: ${created + updated} upserted (${EVENTBRIDGE_RULES.filter((r) => r.enabled).length} enabled, ${EVENTBRIDGE_RULES.filter((r) => !r.enabled).length} disabled)`
  );
}

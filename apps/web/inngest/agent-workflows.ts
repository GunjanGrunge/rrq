import { inngest } from "@/lib/inngest";
import { handleCronTrigger, handleQueueLowTrigger } from "@/lib/rex/rrq-trigger";
import { runRexScan } from "@/lib/rex/rex-scan";
import type { RexOpportunity } from "@/lib/rex/rex-scan";
import type { ChannelPhase } from "@/lib/mission/phase-engine";
import { runRegumStrategy } from "@/lib/regum/regum-strategy";
import {
  runZeusCommentAnalysis,
  runZeusAnalyticsReview,
} from "@/lib/zeus/zeus-agent";

// ─── Rex Scan Workflow ────────────────────────────────────────────────────────

export const rexScanWorkflow = inngest.createFunction(
  { id: "rex-scan-workflow", name: "Rex — Trend Scan" },
  { event: "rex/scan.triggered" },
  async ({ event, step }) => {
    const {
      channelId = "default",
      userId = "default",
      phase = "COLD_START",
      channelMode = "AUTOPILOT_MODE",
      niche,
    } = event.data as {
      channelId?: string;
      userId?: string;
      phase?: ChannelPhase;
      channelMode?: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE";
      niche?: string;
    };

    const triggerCtx = await step.run("rex-handle-cron-trigger", () =>
      handleCronTrigger(channelId)
    );

    const greenlights = await step.run("rex-scan-signals", () =>
      runRexScan(channelId, userId, phase, channelMode, niche)
    );

    return {
      status: "complete",
      triggeredAt: new Date().toISOString(),
      trigger: triggerCtx.mode,
      greenlights: greenlights.length,
      topTopics: greenlights
        .slice(0, 3)
        .map(g => ({ topic: g.topic, confidence: g.confidenceScore })),
    };
  }
);

// ─── Queue-Low Check Workflow ─────────────────────────────────────────────────

export const rrqQueueLowWorkflow = inngest.createFunction(
  { id: "rrq-queue-low-workflow", name: "RRQ — Queue Low Check" },
  { event: "rrq/queue-low.triggered" },
  async ({ event, step }) => {
    const {
      channelId = "default",
      userId = "default",
      phase = "COLD_START",
      channelMode = "AUTOPILOT_MODE",
    } = event.data as {
      channelId?: string;
      userId?: string;
      phase?: ChannelPhase;
      channelMode?: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE";
    };

    const triggerCtx = await step.run("queue-low-check", () =>
      handleQueueLowTrigger(channelId)
    );

    if (!triggerCtx) {
      return { status: "queue_healthy", skipped: true };
    }

    const greenlights = await step.run("rex-scan-queue-low", () =>
      runRexScan(channelId, userId, phase, channelMode)
    );

    return {
      status: "complete",
      trigger: "QUEUE_LOW",
      greenlights: greenlights.length,
    };
  }
);

// ─── Zeus Comment Workflow ────────────────────────────────────────────────────

export const zeusCommentWorkflow = inngest.createFunction(
  { id: "zeus-comment-workflow", name: "Zeus — Comment Analysis" },
  { event: "zeus/comments.triggered" },
  async ({ event, step }) => {
    const {
      channelId = "default",
      userId = "default",
    } = event.data as {
      channelId?: string;
      userId?: string;
    };

    const result = await step.run("zeus-fetch-and-classify-comments", () =>
      runZeusCommentAnalysis(channelId, userId)
    );

    return {
      status: "complete",
      triggeredAt: new Date().toISOString(),
      videosProcessed: result.videosProcessed,
      totalComments: result.totalComments,
      genuineComments: result.genuineComments,
      viewerRequests: result.viewerRequests.length,
      pointsApplied: result.pointsApplied,
      episodesWritten: result.episodesWritten,
    };
  }
);

// ─── Zeus Analytics Workflow ──────────────────────────────────────────────────

export const zeusAnalyticsWorkflow = inngest.createFunction(
  { id: "zeus-analytics-workflow", name: "Zeus — Analytics Review" },
  { event: "zeus/analytics.triggered" },
  async ({ event, step }) => {
    const {
      channelId = "default",
      userId = "default",
    } = event.data as {
      channelId?: string;
      userId?: string;
    };

    const result = await step.run("zeus-analytics-and-health-review", () =>
      runZeusAnalyticsReview(channelId, userId)
    );

    return {
      status: "complete",
      triggeredAt: new Date().toISOString(),
      channelHealthUpdated: result.channelHealthUpdated,
      videosHealthChecked: result.videosHealthChecked,
      adReviewsCompleted: result.adReviewsCompleted,
      episodesWritten: result.episodesWritten,
      weeklyRankingComputed: result.weeklyRankingComputed,
      agentScoreSummary: result.agentScoreSummary,
    };
  }
);

// ─── Oracle Run Workflow (stub) ───────────────────────────────────────────────

export const oracleRunWorkflow = inngest.createFunction(
  { id: "oracle-run-workflow", name: "Oracle — L&D Run" },
  { event: "oracle/run.triggered" },
  async ({ event: _event, step }) => {
    await step.run("oracle-run-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── The Line Morning Workflow (stub) ─────────────────────────────────────────

export const theLineMorningWorkflow = inngest.createFunction(
  { id: "the-line-morning-workflow", name: "The Line — Morning Brief" },
  { event: "the-line/morning.triggered" },
  async ({ event: _event, step }) => {
    await step.run("the-line-morning-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── The Line EOD Workflow (stub) ─────────────────────────────────────────────

export const theLineEodWorkflow = inngest.createFunction(
  { id: "the-line-eod-workflow", name: "The Line — End of Day" },
  { event: "the-line/eod.triggered" },
  async ({ event: _event, step }) => {
    await step.run("the-line-eod-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── Theo Daily Workflow (stub) ───────────────────────────────────────────────

export const theoDailyWorkflow = inngest.createFunction(
  { id: "theo-daily-workflow", name: "Theo — Daily Channel Management" },
  { event: "theo/daily.triggered" },
  async ({ event: _event, step }) => {
    await step.run("theo-daily-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── Theo Weekly Workflow (stub) ──────────────────────────────────────────────

export const theoWeeklyWorkflow = inngest.createFunction(
  { id: "theo-weekly-workflow", name: "Theo — Weekly Synthesis" },
  { event: "theo/weekly.triggered" },
  async ({ event: _event, step }) => {
    await step.run("theo-weekly-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── Jason Standup Workflow (stub) ────────────────────────────────────────────

export const jasonStandupWorkflow = inngest.createFunction(
  { id: "jason-standup-workflow", name: "Jason — Daily Standup" },
  { event: "jason/standup.triggered" },
  async ({ event: _event, step }) => {
    await step.run("jason-standup-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── Jason Sprint Check Workflow (stub) ───────────────────────────────────────

export const jasonSprintCheckWorkflow = inngest.createFunction(
  { id: "jason-sprint-check-workflow", name: "Jason — Sprint Check" },
  { event: "jason/sprint-check.triggered" },
  async ({ event: _event, step }) => {
    await step.run("jason-sprint-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Future phase" };
  }
);

// ─── RRQ Autopilot Cron Workflow (stub — Autopilot Mode only) ─────────────────

export const rrqCronWorkflow = inngest.createFunction(
  { id: "rrq-cron-workflow", name: "RRQ — Autopilot Cron" },
  { event: "rrq/cron.triggered" },
  async ({ event: _event, step }) => {
    await step.run("rrq-cron-stub", async () => ({
      status: "stub",
      triggeredAt: new Date().toISOString(),
    }));
    return { status: "stub", phase: "Autopilot Mode" };
  }
);

// ─── Regum Schedule Workflow ──────────────────────────────────────────────────

export const regumScheduleWorkflow = inngest.createFunction(
  { id: "regum-schedule-workflow", name: "Regum — Schedule & Strategy" },
  { event: "regum/schedule.triggered" },
  async ({ event, step }) => {
    const {
      channelId = "default",
      userId = "default",
      phase = "COLD_START",
      channelMode = "AUTOPILOT_MODE",
      opportunities = [],
    } = event.data as {
      channelId?: string;
      userId?: string;
      phase?: ChannelPhase;
      channelMode?: "AUTOPILOT_MODE" | "REX_MODE" | "STUDIO_MODE";
      opportunities?: RexOpportunity[];
    };

    const briefs = await step.run("regum-evaluate-and-brief", () =>
      runRegumStrategy(opportunities, channelId, userId, phase, channelMode)
    );

    return {
      status: "complete",
      triggeredAt: new Date().toISOString(),
      briefs: briefs.length,
      topics: briefs.map(b => ({
        topic: b.topic,
        angle: b.angle,
        scheduledPublish: b.scheduledPublish,
      })),
    };
  }
);

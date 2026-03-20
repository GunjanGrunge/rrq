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
import { runCouncilSession } from "@/lib/council/run-council";
import { runVeraQA } from "@/lib/vera/run-vera";
import { runDay2EarlyRead } from "@/lib/retro/day2-check";
import { runDailyRetroCheck } from "@/lib/retro/daily-monitor";
import { runFullRetro } from "@/lib/retro/full-retro";
import { getDynamoClient } from "@/lib/aws-clients";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { sendNotification } from "@/lib/notifications/index";

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

// ─── Council Session Workflow ─────────────────────────────────────────────────

export const councilSessionWorkflow = inngest.createFunction(
  { id: "council-session-workflow", name: "On The Line — Council Session" },
  { event: "council/session.triggered" },
  async ({ event, step }) => {
    const { jobId, qeonBrief } = event.data as {
      jobId: string;
      qeonBrief: {
        topic: string;
        angle: string;
        niche: string;
        tone: string;
        contentType: string;
        competitorGap: string;
        keywordFocus: string[];
        confidenceScore: number;
      };
    };

    const session = await step.run("run-council-session", () =>
      runCouncilSession(jobId, qeonBrief)
    );

    await step.run("update-qeon-job-status", async () => {
      const dynamo = getDynamoClient();
      const councilStatus = session.status === "APPROVED" ? "COUNCIL_CLEARED" : "COUNCIL_DEFERRED";
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: "production-jobs",
            Key: { jobId },
            UpdateExpression:
              "SET councilStatus = :status, councilSessionId = :sessionId, councilResolvedAt = :resolvedAt",
            ExpressionAttributeValues: {
              ":status": councilStatus,
              ":sessionId": session.sessionId,
              ":resolvedAt": session.resolvedAt ?? new Date().toISOString(),
            },
          })
        );
      } catch (err) {
        console.error(`[council-workflow:${jobId}] Job status update failed:`, err);
      }
    });

    if (session.status === "DEFERRED" || session.status === "DEADLOCKED") {
      await step.run("notify-council-deferred", async () => {
        try {
          await sendNotification({
            type: "COUNCIL_DEFERRED",
            title: `Council: "${qeonBrief.topic}" deferred`,
            body: session.zeusVerdict,
            data: { jobId, sessionId: session.sessionId, status: session.status },
          });
        } catch (err) {
          console.error(`[council-workflow:${jobId}] Notification failed:`, err);
        }
      });
    }

    return {
      status: "complete",
      sessionId: session.sessionId,
      councilOutcome: session.status,
      topic: qeonBrief.topic,
      votes: session.votes.length,
    };
  }
);

// ─── Vera QA Workflow ─────────────────────────────────────────────────────────

export const veraQAWorkflow = inngest.createFunction(
  { id: "vera-qa-workflow", name: "Vera — QA Gate" },
  { event: "vera/qa.triggered" },
  async ({ event, step }) => {
    const { jobId, retryDomains } = event.data as {
      jobId: string;
      retryDomains?: Array<"AUDIO" | "VISUAL" | "STANDARDS">;
    };

    const result = await step.run("run-vera-qa", () =>
      runVeraQA(jobId, retryDomains)
    );

    await step.run("notify-vera-outcome", async () => {
      if (result.status === "CLEARED") {
        // Trigger Theo handoff
        try {
          await inngest.send({
            name: "theo/handoff.triggered",
            data: { jobId, veraResult: result },
          });
        } catch (err) {
          console.error(`[vera-workflow:${jobId}] Theo handoff trigger failed:`, err);
        }
      } else if (result.status === "HOLD") {
        // 3+ domains failed — escalate
        try {
          await sendNotification({
            type: "VERA_HOLD",
            title: `Vera HOLD: job ${jobId}`,
            body: `${result.failedDomains.join(", ")} failed QA. Manual review required.`,
            data: { jobId, failedDomains: result.failedDomains },
          });
        } catch (err) {
          console.error(`[vera-workflow:${jobId}] Notification failed:`, err);
        }
      }
    });

    return {
      status: "complete",
      jobId,
      veraStatus: result.status,
      failedDomains: result.failedDomains,
    };
  }
);

// ─── RRQ Retro Day 2 Workflow ─────────────────────────────────────────────────

export const rrqRetroDay2Workflow = inngest.createFunction(
  { id: "rrq-retro-day2-workflow", name: "RRQ Retro — Day 2 Early Read" },
  { event: "retro/day2.triggered" },
  async ({ event, step }) => {
    const { sessionId, videoId, channelId } = event.data as {
      sessionId: string;
      videoId: string;
      channelId: string;
    };

    const day2Result = await step.run("run-day2-early-read", () =>
      runDay2EarlyRead(videoId, sessionId, channelId)
    );

    return {
      status: "complete",
      sessionId,
      videoId,
      day2State: day2Result.state,
      ctr: day2Result.ctr,
      impressions: day2Result.impressions,
    };
  }
);

// ─── RRQ Retro Daily Monitor Workflow ─────────────────────────────────────────

export const rrqRetroDailyWorkflow = inngest.createFunction(
  { id: "rrq-retro-daily-workflow", name: "RRQ Retro — Daily Monitor" },
  { event: "retro/daily.check" },
  async ({ event, step }) => {
    const { sessionId } = event.data as { sessionId: string };

    const result = await step.run("run-daily-retro-check", () =>
      runDailyRetroCheck(sessionId)
    );

    return {
      status: "complete",
      sessionId,
      action: result.action,
      reason: result.reason,
    };
  }
);

// ─── RRQ Retro Full Council Workflow ──────────────────────────────────────────

export const rrqRetroFullWorkflow = inngest.createFunction(
  { id: "rrq-retro-full-workflow", name: "RRQ Retro — Full Council" },
  { event: "retro/full.triggered" },
  async ({ event, step }) => {
    const { sessionId, reason } = event.data as {
      sessionId: string;
      reason: "TARGET_HIT" | "DAY_7";
    };

    const completedSession = await step.run("run-full-retro", () =>
      runFullRetro(sessionId, reason)
    );

    return {
      status: "complete",
      sessionId,
      outcome: completedSession.outcome,
      topic: completedSession.topic,
      targetHit: completedSession.targetHit,
      currentDay: completedSession.currentDay,
    };
  }
);

// ─── Council Emergency Workflow (stub — routes to Zeus) ──────────────────────

export const councilEmergencyWorkflow = inngest.createFunction(
  { id: "council-emergency-workflow", name: "Council — Emergency Review" },
  { event: "council/emergency.triggered" },
  async ({ event, step }) => {
    const { sessionId, videoId } = event.data as {
      sessionId: string;
      videoId: string;
    };

    await step.run("notify-emergency", async () => {
      try {
        await sendNotification({
          type: "RETRO_EMERGENCY",
          title: "RRQ Retro: Emergency signal",
          body: `Video ${videoId} showing emergency performance at 48h. Council review triggered.`,
          data: { sessionId, videoId },
        });
      } catch (err) {
        console.error(`[council-emergency:${sessionId}] Notification failed:`, err);
      }
    });

    return { status: "complete", sessionId, videoId, action: "emergency_notified" };
  }
);

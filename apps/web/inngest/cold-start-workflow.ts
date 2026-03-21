// ─── Inngest Workflow — Cold Start Deep Research Sprint ─────────────────────
// 6-phase sprint: Rex + SNIPER (parallel) → Oracle → Synthesis → Shortlist → Seeding

import { inngest } from "@/lib/inngest";
import { rexDeepScan } from "@/lib/cold-start/rex-scan";
import { sniperCompetitorAudit } from "@/lib/cold-start/sniper-audit";
import { oraclePatternAnalysis } from "@/lib/cold-start/oracle-patterns";
import { theLineSynthesise } from "@/lib/cold-start/synthesise";
import { seedCouncilIndex } from "@/lib/cold-start/seed-index";
import {
  updateSprintPhase,
  markSprintComplete,
  markSprintFailed,
} from "@/lib/cold-start/trigger";

export const coldStartWorkflow = inngest.createFunction(
  {
    id: "cold-start-workflow",
    name: "Cold Start — Deep Research Sprint",
    timeouts: { finish: "30m" },
    retries: 1,
  },
  { event: "cold-start/sprint.triggered" },
  async ({ event, step }) => {
    const { userId, sprintId, channelMode, selectedNiches } = event.data;

    try {
      // ── Phase 1a + 1b — Rex scan + SNIPER audit in PARALLEL ──────────────
      await step.run("update-phase-rex-sniper", () =>
        updateSprintPhase(userId, "REX_SCAN"),
      );

      const [rexResult, sniperResult] = await Promise.all([
        step.run("rex-deep-scan", () =>
          rexDeepScan(selectedNiches, channelMode),
        ),
        step.run("sniper-competitor-audit", () =>
          sniperCompetitorAudit(selectedNiches),
        ),
      ]);

      await step.run("update-phase-oracle", () =>
        updateSprintPhase(userId, "ORACLE_PATTERNS", {
          rexScanSummary: `${rexResult.openWindowCount} open narrative windows across ${selectedNiches.length} niche(s)`,
          sniperAuditSummary: `${sniperResult.totalChannelsProfiled} competitor channels profiled`,
        }),
      );

      // ── Phase 2 — Oracle historical pattern analysis ──────────────────────
      const oracleResult = await step.run("oracle-pattern-analysis", () =>
        oraclePatternAnalysis(selectedNiches, rexResult, sniperResult),
      );

      await step.run("update-phase-synthesis", () =>
        updateSprintPhase(userId, "THE_LINE_SYNTHESIS"),
      );

      // ── Phase 3 — The Line synthesis + content gap map + shortlist ────────
      const synthesis = await step.run("the-line-synthesise", () =>
        theLineSynthesise(selectedNiches, rexResult, sniperResult, oracleResult),
      );

      await step.run("update-phase-seeding", () =>
        updateSprintPhase(userId, "COUNCIL_SEEDING"),
      );

      // ── Phase 4 — Seed council index with synthetic baseline records ──────
      const seeded = await step.run("seed-council-index", () =>
        seedCouncilIndex(synthesis, sniperResult, selectedNiches, userId),
      );

      // ── Complete ──────────────────────────────────────────────────────────
      await step.run("mark-complete", () =>
        markSprintComplete(userId, {
          contentGapMap: synthesis.contentGapMap,
          oversaturatedAngles: synthesis.oversaturatedAngles,
          firstVideoShortlist: synthesis.firstVideoShortlist,
          coldStartStrategy: synthesis.coldStartStrategy,
          syntheticRecordsSeeded: seeded,
        }),
      );

      return {
        status: "COMPLETE",
        sprintId,
        userId,
        openWindows: rexResult.openWindowCount,
        channelsProfiled: sniperResult.totalChannelsProfiled,
        contentGaps: synthesis.contentGapMap.length,
        syntheticRecordsSeeded: seeded,
        firstVideoCandidate: synthesis.firstVideoShortlist[0]?.angle ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cold-start:workflow:${userId}] Sprint failed:`, err);
      await markSprintFailed(userId, message).catch(() => {});
      throw err;
    }
  },
);

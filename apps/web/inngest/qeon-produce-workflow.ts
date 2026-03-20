import { inngest } from "@/lib/inngest";
import type {
  AudioGenOutputType,
  AvSyncOutputType,
  ShortsGenOutputType,
  UploaderOutputType,
} from "@rrq/lambda-types";
import {
  getQeonBriefById,
  updateJobStep,
  updateJobStatus,
  markJobComplete,
  markJobFailed,
} from "@/lib/qeon/job-state";
import {
  injectZeusMemory,
  runMuseBlueprint,
  rewriteWeakSections,
  reportToZeus,
} from "@/lib/qeon/qeon-agent";
import {
  runResearchStep,
  runScriptStep,
  runSeoStep,
  runQualityStep,
} from "./steps/research-steps";
import {
  runAudioStep,
  runParallelMediaStep,
  runAvSyncStep,
} from "./steps/production-steps";
import {
  runVeraQAStep,
  runShortsStep,
  runUploadStep,
} from "./steps/distribution-steps";

/**
 * Qeon Produce Workflow — autonomous 13-step pipeline.
 *
 * Triggered by: "agent/qeon.produce" with { briefId }
 * Source: Regum writes QeonBrief to production-jobs, fires this event.
 *
 * Each step.run() wraps one external call for Inngest durability.
 * Quality gate allows 1 rewrite attempt before hard failure.
 *
 * TODO Phase 12: Add On The Line council approval gate after quality passes,
 * before step-7-audio fires. Gate: all 7 agents sign off. Block until cleared.
 */
export const qeonProduceWorkflow = inngest.createFunction(
  {
    id: "qeon-produce-workflow",
    name: "Qeon — Autonomous Production Pipeline",
    retries: 1,
  },
  { event: "agent/qeon.produce" },
  async ({ event, step }) => {
    const { briefId } = event.data as { briefId: string };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // ── Step 0: Fetch Brief ───────────────────────────────────────────
    const brief = await step.run("step-0-fetch-brief", async () => {
      const b = await getQeonBriefById(briefId);
      await updateJobStatus(briefId, "in_progress");
      return b;
    });

    // ── Step 1: Zeus Memory Injection ─────────────────────────────────
    const zeusMemory = await step.run("step-1-zeus-memory", () =>
      injectZeusMemory(brief.topic, brief.niche)
    );

    // ── Step 2: Muse Blueprint ────────────────────────────────────────
    const museBlueprint = await step.run("step-2-muse-blueprint", async () => {
      await updateJobStep(briefId, 2, "muse-blueprint", "in_progress");
      const blueprint = await runMuseBlueprint(brief, zeusMemory);
      await updateJobStep(briefId, 2, "muse-blueprint", "complete");
      return blueprint;
    });

    // ── Step 3: Research ──────────────────────────────────────────────
    const researchOutput = await step.run("step-3-research", async () => {
      await updateJobStep(briefId, 3, "research", "in_progress");
      const out = await runResearchStep(appUrl, brief.topic, {
        angle: brief.angle,
        niche: brief.niche,
        competitorGap: brief.competitorGap,
        zeusMemory,
      });
      await updateJobStep(briefId, 3, "research", "complete");
      return out;
    });

    // ── Step 4: Script ────────────────────────────────────────────────
    const scriptOutput = await step.run("step-4-script", async () => {
      await updateJobStep(briefId, 4, "script", "in_progress");
      const out = await runScriptStep(
        appUrl,
        researchOutput,
        brief.targetDuration,
        brief.tone,
        {
          angle: brief.angle,
          niche: brief.niche,
          zeusMemory,
          museBlueprint,
        }
      );
      await updateJobStep(briefId, 4, "script", "complete");
      return out;
    });

    // ── Step 5: SEO ───────────────────────────────────────────────────
    const seoOutput = await step.run("step-5-seo", async () => {
      await updateJobStep(briefId, 5, "seo", "in_progress");
      const out = await runSeoStep(appUrl, researchOutput, scriptOutput);
      await updateJobStep(briefId, 5, "seo", "complete");
      return out;
    });

    // ── Step 6: Quality Gate (attempt 1) ──────────────────────────────
    let finalScriptOutput = scriptOutput;
    let qualityOutput = await step.run("step-6-quality-gate", async () => {
      await updateJobStep(briefId, 6, "quality-gate", "in_progress");
      const out = await runQualityStep(
        appUrl,
        researchOutput,
        scriptOutput,
        seoOutput,
        1,
        brief.qualityThreshold
      );
      await updateJobStep(briefId, 6, "quality-gate", "complete");
      return out;
    });

    // ── Step 6b: Rewrite weak sections if quality recommends ──────────
    if (qualityOutput.recommendation === "REWRITE" && qualityOutput.weakSections?.length) {
      finalScriptOutput = await step.run("step-6b-rewrite", async () => {
        await updateJobStep(briefId, 6, "quality-rewrite", "in_progress");
        const rewritten = await rewriteWeakSections(
          scriptOutput,
          seoOutput,
          qualityOutput.weakSections!
        );
        await updateJobStep(briefId, 6, "quality-rewrite", "complete");
        return rewritten;
      });

      // ── Step 6c: Quality re-check after rewrite ───────────────────
      qualityOutput = await step.run("step-6c-quality-retry", async () => {
        await updateJobStep(briefId, 6, "quality-retry", "in_progress");
        const out = await runQualityStep(
          appUrl,
          researchOutput,
          finalScriptOutput,
          seoOutput,
          2,
          brief.qualityThreshold
        );
        await updateJobStep(briefId, 6, "quality-retry", "complete");
        return out;
      });

      // Hard failure on second REJECT
      if (qualityOutput.recommendation === "REJECT") {
        const errMsg = `Quality gate REJECTED after rewrite: ${qualityOutput.overall}/10`;
        await step.run("step-6c-fail", async () => {
          await markJobFailed(briefId, "quality-gate-retry", errMsg);
          await reportToZeus(briefId, brief.topic, "failed", {
            failedStep: "quality-gate-retry",
            error: errMsg,
          });
        });
        return { briefId, status: "failed", reason: errMsg };
      }
    }

    // TODO: Phase 12 — On The Line council approval gate fires here.
    // All 7 agents (Rex → Zara → Aria → Qeon → Muse → Regum → Zeus) sign off.
    // step.waitForEvent("council-approved", { event: "council/approved", timeout: "2h" })
    // Block until council clears. DEFERRED → fail with reason.

    // ── Step 7: Audio Generation ──────────────────────────────────────
    const audioOutput: AudioGenOutputType = await step.run("step-7-audio", async () => {
      await updateJobStep(briefId, 7, "audio", "in_progress");
      const out = await runAudioStep(briefId, finalScriptOutput);
      await updateJobStep(briefId, 7, "audio", "complete");
      return out;
    });

    // ── Steps 8–9: Parallel Media (SkyReels + Wan2 + TONY + Visuals) ──
    const mediaResults = await step.run("step-8-9-parallel-media", async () => {
      await updateJobStep(briefId, 8, "parallel-media", "in_progress");
      const out = await runParallelMediaStep(
        briefId,
        brief.topic,
        finalScriptOutput,
        audioOutput,
        brief.presenterId ?? "avatar_1"
      );
      await updateJobStep(briefId, 8, "parallel-media", "complete");
      return out;
    });

    // ── Step 10: AV Sync ──────────────────────────────────────────────
    const avSyncOutput: AvSyncOutputType = await step.run("step-10-av-sync", async () => {
      await updateJobStep(briefId, 10, "av-sync", "in_progress");
      const out = await runAvSyncStep(briefId, finalScriptOutput, audioOutput, mediaResults);
      await updateJobStep(briefId, 10, "av-sync", "complete");
      return out;
    });

    // ── Step 11: Vera QA ──────────────────────────────────────────────
    const veraOutput = await step.run("step-11-vera-qa", async () => {
      await updateJobStep(briefId, 11, "vera-qa", "in_progress");
      const out = await runVeraQAStep();
      await updateJobStep(briefId, 11, "vera-qa", "complete");
      return out;
    });

    if (!veraOutput.cleared) {
      const errMsg = `Vera QA failed: ${veraOutput.message}`;
      await step.run("step-11-fail", async () => {
        await markJobFailed(briefId, "vera-qa", errMsg);
        await reportToZeus(briefId, brief.topic, "failed", {
          failedStep: "vera-qa",
          error: errMsg,
        });
      });
      return { briefId, status: "failed", reason: errMsg };
    }

    // ── Step 12: Shorts ───────────────────────────────────────────────
    const shortsOutput: ShortsGenOutputType = await step.run("step-12-shorts", async () => {
      await updateJobStep(briefId, 12, "shorts", "in_progress");
      const out = await runShortsStep(briefId, finalScriptOutput, avSyncOutput, brief.topic);
      await updateJobStep(briefId, 12, "shorts", "complete");
      return out;
    });

    // ── Step 13: Upload to YouTube ────────────────────────────────────
    const uploadOutput: UploaderOutputType = await step.run("step-13-upload", async () => {
      await updateJobStep(briefId, 13, "upload", "in_progress");
      const out = await runUploadStep(
        briefId,
        brief.userId,
        finalScriptOutput,
        seoOutput,
        avSyncOutput,
        shortsOutput
      );
      await updateJobStep(briefId, 13, "upload", "complete");
      return out;
    });

    // ── Step 14: Report success to Zeus ──────────────────────────────
    await step.run("step-14-report", async () => {
      await markJobComplete(briefId, uploadOutput.videoId);
      await reportToZeus(briefId, brief.topic, "success", {
        videoId: uploadOutput.videoId,
        youtubeUrl: uploadOutput.youtubeUrl,
      });
    });

    return {
      briefId,
      status: "complete",
      videoId: uploadOutput.videoId,
      youtubeUrl: uploadOutput.youtubeUrl,
    };
  }
);

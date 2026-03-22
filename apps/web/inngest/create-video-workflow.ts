import { inngest } from "@/lib/inngest";
import type {
  AudioGenOutputType,
  AvSyncOutputType,
  ShortsGenOutputType,
  UploaderOutputType,
} from "@rrq/lambda-types";
import { runResearchStep, runScriptStep, runSeoStep, runQualityStep } from "./steps/research-steps";
import { runAudioStep, runParallelMediaStep, runAvSyncStep } from "./steps/production-steps";
import { runVeraQAStep, runShortsStep, runUploadStep } from "./steps/distribution-steps";

/**
 * 13-step video production pipeline.
 *
 * Steps 1–4: Bedrock LLM routes (research, script, SEO, quality gate)
 * Step 5: audio-gen Lambda (ElevenLabs + Edge-TTS fallback)
 * Steps 6+7+8: EC2 GPU workers — Step 6 SkyReels (Phase 4a LIVE), Step 7 Wan2.2 stub, Step 8 FLUX stub
 * Step 9: visual-gen Lambda (Puppeteer + Chart.js + Mermaid)
 *         + research-visual Lambda (paper figures, screenshots, stock)
 * Step 10: av-sync Lambda (FFmpeg stitch all segments + subtitles)
 * Step 11: Vera QA — Phase 12 stub
 * Step 12: shorts-gen Lambda (FFmpeg convert or fresh Haiku + Edge-TTS)
 * Step 13: uploader Lambda (YouTube Data API v3)
 */
export const createVideoWorkflow = inngest.createFunction(
  {
    id: "create-video-workflow",
    name: "Create Video — 13 Step Pipeline",
    retries: 2,
  },
  { event: "pipeline/job.started" },
  async ({ event, step }) => {
    const { jobId, userId, topic, avatarId = "avatar_1" } = event.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // ── Step 1: Research ──────────────────────────────────────────────
    const researchOutput = await step.run("step-1-research", () =>
      runResearchStep(appUrl, topic)
    );

    // ── Step 2: Script ────────────────────────────────────────────────
    const scriptOutput = await step.run("step-2-script", () =>
      runScriptStep(appUrl, researchOutput, 10, "informative")
    );

    // ── Step 3: SEO ───────────────────────────────────────────────────
    const seoOutput = await step.run("step-3-seo", () =>
      runSeoStep(appUrl, researchOutput, scriptOutput)
    );

    // ── Step 4: Quality Gate ──────────────────────────────────────────
    const qualityOutput = await step.run("step-4-quality", () =>
      runQualityStep(appUrl, researchOutput, scriptOutput, seoOutput, 1, 7)
    );

    // ── Step 5: Audio Generation ──────────────────────────────────────
    const audioOutput: AudioGenOutputType = await step.run("step-5-audio", () =>
      runAudioStep(jobId, scriptOutput)
    );

    // ── Sanitize scriptOutput.visualAssets before media step ─────────
    // Guards against Muse hallucinating invalid asset types or non-string citations
    const VALID_VISUAL_TYPES = new Set([
      "comparison-table", "bar-chart", "line-chart", "radar-chart",
      "flow-diagram", "infographic-card", "personality-card",
      "news-timeline", "stat-callout", "animated-infographic", "geo-map",
    ]);
    const sanitizedScriptOutput = await step.run("step-sanitize-visual-assets", () => ({
      ...scriptOutput,
      visualAssets: (scriptOutput.visualAssets ?? [])
        .filter((a) => VALID_VISUAL_TYPES.has(a.type))
        .map((a) => ({ ...a, citations: (a.citations ?? []).map((c) => String(c)) })),
    }));

    // ── Steps 6+7+8+9: Media Generation (parallel) ───────────────────
    const mediaResults = await step.run("step-6-7-8-9-parallel-media", () =>
      runParallelMediaStep(jobId, topic, sanitizedScriptOutput, audioOutput, avatarId)
    );

    // ── Step 10: AV Sync ──────────────────────────────────────────────
    const avSyncOutput: AvSyncOutputType = await step.run("step-10-av-sync", () =>
      runAvSyncStep(jobId, sanitizedScriptOutput, audioOutput, mediaResults)
    );

    // ── Step 11: Vera QA (Phase 12 stub) ──────────────────────────────
    const veraOutput = await step.run("step-11-vera-qa", () =>
      runVeraQAStep()
    );

    // ── Step 12: Shorts Generation ────────────────────────────────────
    const shortsOutput: ShortsGenOutputType = await step.run("step-12-shorts", () =>
      runShortsStep(jobId, scriptOutput, avSyncOutput, topic)
    );

    // ── Step 13: Upload to YouTube ────────────────────────────────────
    const uploadOutput: UploaderOutputType = await step.run("step-13-upload", () =>
      runUploadStep(jobId, userId, scriptOutput, seoOutput, avSyncOutput, shortsOutput)
    );

    return {
      jobId,
      userId,
      topic,
      researchOutput,
      scriptOutput,
      seoOutput,
      qualityOutput,
      audioOutput,
      mediaResults,
      avSyncOutput,
      veraOutput,
      shortsOutput,
      uploadOutput,
    };
  }
);

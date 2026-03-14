import { inngest } from "@/lib/inngest";
import {
  invokeAudioGen,
  invokeResearchVisual,
  invokeVisualGen,
  invokeAvSync,
  invokeShortsGen,
  invokeUploader,
  invokeCodeAgent,
} from "@rrq/lambda-client";
import type {
  AudioGenOutputType,
  VisualGenOutputType,
  ResearchVisualOutputType,
  AvSyncOutputType,
  ShortsGenOutputType,
  UploaderOutputType,
  CodeAgentOutputType,
} from "@rrq/lambda-types";

/**
 * 13-step video production pipeline.
 *
 * Steps 1–4: Bedrock LLM routes (research, script, SEO, quality gate)
 * Step 5: audio-gen Lambda (ElevenLabs + Edge-TTS fallback)
 * Steps 6+7+8: EC2 GPU workers — Phase 4 stubs (SkyReels, Wan2.2, FLUX)
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
    const { jobId, userId, topic } = event.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // ── Step 1: Research ──────────────────────────────────────────────
    const researchOutput = await step.run("step-1-research", async () => {
      const res = await fetch(`${appUrl}/api/pipeline/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, duration: 10, tone: "informative" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Research failed");
      return data.data;
    });

    // ── Step 2: Script ────────────────────────────────────────────────
    const scriptOutput = await step.run("step-2-script", async () => {
      const res = await fetch(`${appUrl}/api/pipeline/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchOutput, duration: 10, tone: "informative" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Script failed");
      return data.data;
    });

    // ── Step 3: SEO ───────────────────────────────────────────────────
    const seoOutput = await step.run("step-3-seo", async () => {
      const res = await fetch(`${appUrl}/api/pipeline/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchOutput, scriptOutput, generateShorts: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "SEO failed");
      return data.data;
    });

    // ── Step 4: Quality Gate ──────────────────────────────────────────
    const qualityOutput = await step.run("step-4-quality", async () => {
      const res = await fetch(`${appUrl}/api/pipeline/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchOutput, scriptOutput, seoOutput,
          attempt: 1, qualityThreshold: 7,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Quality gate failed");
      if (data.data.recommendation === "REJECT") {
        throw new Error(`Quality gate REJECTED: overall ${data.data.overall}/10`);
      }
      return data.data;
    });

    // ── Step 5: Audio Generation ──────────────────────────────────────
    const audioOutput: AudioGenOutputType = await step.run(
      "step-5-audio",
      async () => {
        return invokeAudioGen({
          jobId,
          sections: scriptOutput.sections.map(
            (s: { id: string; script: string; toneNote: string }) => ({
              id: s.id,
              script: s.script,
              toneNote: s.toneNote,
            })
          ),
          voiceConfig: scriptOutput.voiceConfig,
        });
      }
    );

    // ── Steps 6+7+8+9: Media Generation (parallel) ───────────────────
    // EC2 GPU workers (6, 7, 8) are Phase 4 stubs.
    // Lambda workers (9 visual-gen, research-visual) are live.
    const mediaResults = await step.run(
      "step-6-7-8-9-parallel-media",
      async () => {
        const results = await Promise.allSettled([
          // Step 6: Avatar — SkyReels EC2 (Phase 4a stub)
          Promise.resolve({
            status: "stub" as const,
            message: "Avatar generation requires Phase 4a SkyReels EC2",
            segments: [] as string[],
          }),

          // Step 7: B-Roll — Wan2.2 EC2 (Phase 4b stub)
          Promise.resolve({
            status: "stub" as const,
            message: "B-Roll generation requires Phase 4b Wan2.2 EC2",
            segments: [] as string[],
          }),

          // Step 8: Images — FLUX EC2 (Phase 4c stub)
          Promise.resolve({
            status: "stub" as const,
            message: "Image generation requires Phase 4c FLUX EC2",
            images: [] as string[],
          }),

          // Step 9: Visual Gen Lambda (Chart.js / Mermaid / HTML)
          scriptOutput.visualAssets && scriptOutput.visualAssets.length > 0
            ? invokeVisualGen({ jobId, assets: scriptOutput.visualAssets })
            : Promise.resolve({ assets: [] } as VisualGenOutputType),

          // Research Visual Lambda (paper figures, screenshots, stock)
          invokeResearchVisual({
            jobId,
            niche: "TECH_GENERAL",
            beats: scriptOutput.sections
              .filter(
                (s: { displayMode: string }) =>
                  s.displayMode === "visual-asset" || s.displayMode === "broll-only"
              )
              .map((s: { id: string; visualNote: string }) => ({
                id: s.id,
                visualType: "IMAGE" as const,
                visualNote: s.visualNote,
                topicContext: topic,
              })),
          }),

          // TONY — Code Agent (forward-compatible: activates when MUSE sets tonyTasks in Phase 9)
          // When scriptOutput.tonyTasks is present, TONY executes on-demand computation for MUSE.
          scriptOutput.tonyTasks && scriptOutput.tonyTasks.length > 0
            ? invokeCodeAgent({
                jobId,
                agentId: "MUSE",
                task: scriptOutput.tonyTasks[0].task,
                context: scriptOutput.tonyTasks[0].context,
                outputType: scriptOutput.tonyTasks[0].outputType,
              })
            : Promise.resolve(null),
        ]);

        return {
          avatar: results[0].status === "fulfilled"
            ? results[0].value
            : { status: "error" as const, error: String((results[0] as PromiseRejectedResult).reason) },
          broll: results[1].status === "fulfilled"
            ? results[1].value
            : { status: "error" as const, error: String((results[1] as PromiseRejectedResult).reason) },
          images: results[2].status === "fulfilled"
            ? results[2].value
            : { status: "error" as const, error: String((results[2] as PromiseRejectedResult).reason) },
          visuals: results[3].status === "fulfilled"
            ? (results[3].value as VisualGenOutputType)
            : { assets: [] as VisualGenOutputType["assets"] },
          researchVisuals: results[4].status === "fulfilled"
            ? (results[4].value as ResearchVisualOutputType)
            : { assets: [] as ResearchVisualOutputType["assets"] },
          tony: results[5].status === "fulfilled"
            ? (results[5].value as CodeAgentOutputType | null)
            : null,
        };
      }
    );

    // ── Step 10: AV Sync ──────────────────────────────────────────────
    const avSyncOutput: AvSyncOutputType = await step.run(
      "step-10-av-sync",
      async () => {
        // Build segment timeline from audio sections
        let cumulativeMs = 0;
        const segments = scriptOutput.sections.map(
          (section: { id: string; displayMode: string }) => {
            const audioSection = audioOutput.sectionAudioUrls.find(
              (a: { sectionId: string; s3Key: string; durationMs: number }) => a.sectionId === section.id
            );
            const durationMs = audioSection?.durationMs ?? 5000;
            const startMs = cumulativeMs;
            const endMs = cumulativeMs + durationMs;
            cumulativeMs = endMs;

            return {
              sectionId: section.id,
              displayMode: section.displayMode as
                | "avatar-fullscreen"
                | "broll-with-corner-avatar"
                | "broll-only"
                | "visual-asset",
              startMs,
              endMs,
              // EC2 segment keys will be populated in Phase 4
              avatarS3Key: undefined,
              brollS3Key: undefined,
              visualS3Key: undefined,
            };
          }
        );

        const srtContent = buildSRT(scriptOutput.sections, audioOutput);

        return invokeAvSync({
          jobId,
          voiceoverS3Key: audioOutput.voiceoverUrl,
          segments,
          subtitles: { srtContent },
          resolution: "720p",
        });
      }
    );

    // ── Step 11: Vera QA (Phase 12 stub) ──────────────────────────────
    const veraOutput = await step.run("step-11-vera-qa", async () => {
      return {
        status: "stub" as const,
        message: "Vera QA requires Phase 12 implementation",
        cleared: true, // pass-through for now
      };
    });

    // ── Step 12: Shorts Generation ────────────────────────────────────
    const shortsOutput: ShortsGenOutputType = await step.run(
      "step-12-shorts",
      async () => {
        if (scriptOutput.shortsScript) {
          return invokeShortsGen({
            jobId,
            mode: "fresh",
            freshScript: scriptOutput.shortsScript,
            voiceConfig: scriptOutput.voiceConfig,
            topicContext: topic,
          });
        }
        return invokeShortsGen({
          jobId,
          mode: "convert",
          mainVideoS3Key: avSyncOutput.finalVideoS3Key,
        });
      }
    );

    // ── Step 13: Upload to YouTube ────────────────────────────────────
    const uploadOutput: UploaderOutputType = await step.run(
      "step-13-upload",
      async () => {
        return invokeUploader({
          jobId,
          userId,
          mainVideo: {
            s3Key: avSyncOutput.finalVideoS3Key,
            title: seoOutput.finalTitle,
            description: seoOutput.description,
            tags: seoOutput.tags,
            category: seoOutput.category,
            scheduledTime: seoOutput.scheduledTime,
            thumbnailS3Key: `jobs/${jobId}/final/thumbnail.png`,
          },
          short: seoOutput.shortsTitle
            ? {
                s3Key: shortsOutput.shortsS3Key,
                title: seoOutput.shortsTitle,
                description: seoOutput.shortsDescription ?? "",
                hashtags: seoOutput.shortsHashtags ?? [],
                scheduledTime: seoOutput.shortsScheduledTime ?? seoOutput.scheduledTime,
              }
            : undefined,
          pinnedComment: scriptOutput.endScreenSuggestion
            ? `${scriptOutput.endScreenSuggestion}\n\n🔔 Subscribe for more`
            : undefined,
        });
      }
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

// ─── Helper: Build SRT subtitles from script + audio timing ─────────────────

function buildSRT(
  sections: Array<{ id: string; script: string }>,
  audioOutput: AudioGenOutputType
): string {
  const lines: string[] = [];
  let index = 1;
  let cumulativeMs = 0;

  for (const section of sections) {
    const audioSection = audioOutput.sectionAudioUrls.find(
      (a: { sectionId: string; s3Key: string; durationMs: number }) => a.sectionId === section.id
    );
    const durationMs = audioSection?.durationMs ?? 5000;

    // Split into ~10-word subtitle chunks
    const words = section.script.replace(/\[.*?\]/g, "").split(/\s+/).filter(Boolean);
    const chunkSize = 10;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      const chunkStartRatio = i / words.length;
      const chunkEndRatio = Math.min((i + chunkSize) / words.length, 1);

      const startMs = cumulativeMs + Math.round(chunkStartRatio * durationMs);
      const endMs = cumulativeMs + Math.round(chunkEndRatio * durationMs);

      lines.push(String(index++));
      lines.push(`${fmtSRT(startMs)} --> ${fmtSRT(endMs)}`);
      lines.push(chunk);
      lines.push("");
    }

    cumulativeMs += durationMs;
  }

  return lines.join("\n");
}

function fmtSRT(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const ml = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ml).padStart(3, "0")}`;
}

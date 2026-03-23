import {
  invokeAudioGen,
  invokeResearchVisual,
  invokeVisualGen,
  invokeAvSync,
  invokeCodeAgent,
} from "@rrq/lambda-client";
import type {
  AudioGenOutputType,
  VisualGenOutputType,
  ResearchVisualOutputType,
  AvSyncOutputType,
  CodeAgentOutputType,
  SkyReelsOutputType,
  Wan2OutputType,
} from "@rrq/lambda-types";
import type { ScriptOutput } from "@/lib/types/pipeline";
import { runSkyReelsInstance } from "@/lib/video-pipeline/skyreels";
import { runWan2Instance } from "@/lib/video-pipeline/wan2";
import { buildSegments } from "./helpers/segment-builder";
import { buildSRT } from "./helpers/srt-builder";

export interface MediaResults {
  avatar: SkyReelsOutputType | { status: "error"; error: string };
  broll: Wan2OutputType;
  images: { status: "stub"; message: string; images: string[] } | { status: "error"; error: string };
  visuals: VisualGenOutputType;
  researchVisuals: ResearchVisualOutputType;
  tony: CodeAgentOutputType | null;
}

export async function runAudioStep(
  jobId: string,
  scriptOutput: ScriptOutput
): Promise<AudioGenOutputType> {
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

export async function runParallelMediaStep(
  jobId: string,
  topic: string,
  scriptOutput: ScriptOutput,
  audioOutput: AudioGenOutputType,
  avatarId: string
): Promise<MediaResults> {
  // Build SkyReels input: one beat per section that uses avatar
  const avatarBeats = scriptOutput.sections
    .filter(
      (s) =>
        s.displayMode === "avatar-fullscreen" ||
        s.displayMode === "broll-with-corner-avatar"
    )
    .map((s) => {
      const audioSection = audioOutput.sectionAudioUrls.find(
        (a) => a.sectionId === s.id
      );
      return {
        sectionId: s.id,
        audioS3Key: audioSection?.s3Key ?? audioOutput.voiceoverUrl,
        durationMs: audioSection?.durationMs ?? 5000,
        displayMode: s.displayMode as "avatar-fullscreen" | "broll-with-corner-avatar",
        cueMap: [] as { timestamp: number; cue: "RISE" | "PEAK" | "DROP" | "WARM" | "QUESTION" | "PIVOT" | "EMPHASIS"; expressionHint: string }[],
      };
    });

  // Build Wan2 input: one beat per section routed to b-roll
  const brollBeats = scriptOutput.sections
    .filter(
      (s) => s.displayMode === "broll-only" || s.displayMode === "broll-with-corner-avatar"
    )
    .map((s) => {
      const audioSection = audioOutput.sectionAudioUrls.find(
        (a) => a.sectionId === s.id
      );
      return {
        sectionId: s.id,
        prompt: s.visualNote ?? `${topic} atmospheric cinematic b-roll`,
        durationMs: audioSection?.durationMs ?? 5000,
        visualNote: s.visualNote,
        topicContext: topic,
      };
    });

  // Verify Replicate token is available before firing (helps diagnose env issues)
  console.log(`[production][${jobId}] REPLICATE_API_TOKEN set: ${!!process.env.REPLICATE_API_TOKEN}, avatarBeats: ${avatarBeats.length}, brollBeats: ${brollBeats.length}`);

  const results = await Promise.allSettled([
    // Step 6: Avatar — SadTalker via Replicate (EC2 deferred — quota pending)
    avatarBeats.length > 0
      ? runSkyReelsInstance(jobId, {
          jobId,
          avatarId,
          voiceoverS3Key: audioOutput.voiceoverUrl,
          beats: avatarBeats,
          resolution: "720p",
        })
      : Promise.resolve({
          segments: [],
          totalDurationMs: 0,
          instanceId: "skipped",
          renderTimeMs: 0,
        } satisfies SkyReelsOutputType),

    // Step 7: B-Roll — Wan2.2 via Replicate (EC2 deferred — quota pending; non-critical, falls back on failure)
    brollBeats.length > 0
      ? runWan2Instance(jobId, {
          jobId,
          beats: brollBeats,
          resolution: "720p",
        })
      : Promise.resolve({
          segments: [],
          totalDurationMs: 0,
          instanceId: "skipped",
          renderTimeMs: 0,
        } satisfies Wan2OutputType),

    // Step 8: Images — TONY Lambda handles thumbnails/infographics (EC2 FLUX deferred — quota pending)
    Promise.resolve({
      status: "stub" as const,
      message: "TONY Lambda handles image generation via /api/pipeline/images in Studio Mode",
      images: [] as string[],
    }),

    // Step 9: Visual Gen Lambda (Chart.js / Mermaid / HTML)
    // Sanitize assets: drop invalid types + coerce citations to strings (guards against Muse hallucinations)
    (() => {
      const VALID_TYPES = new Set([
        "comparison-table", "bar-chart", "line-chart", "radar-chart",
        "flow-diagram", "infographic-card", "personality-card",
        "news-timeline", "stat-callout", "animated-infographic", "geo-map",
      ]);
      const sanitized = (scriptOutput.visualAssets ?? [])
        .filter((a) => VALID_TYPES.has(a.type))
        .map((a) => ({
          ...a,
          citations: (a.citations ?? []).map((c) => String(c)),
        }));
      return sanitized.length > 0
        ? invokeVisualGen({ jobId, assets: sanitized })
        : Promise.resolve({ assets: [] } as VisualGenOutputType);
    })(),

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
    scriptOutput.tonyTasks && scriptOutput.tonyTasks.length > 0
      ? invokeCodeAgent({
          jobId,
          agentId: "MUSE",
          task: scriptOutput.tonyTasks[0].task,
          context: scriptOutput.tonyTasks[0].context,
          outputType: scriptOutput.tonyTasks[0].outputType,
          timeoutMs: 30_000,
        })
      : Promise.resolve(null),
  ]);

  // Log any failures so they appear in Inngest dashboard + CloudWatch
  if (results[0].status === "rejected") {
    console.error(`[production][${jobId}] SkyReels/avatar FAILED:`, (results[0] as PromiseRejectedResult).reason);
  }
  if (results[1].status === "rejected") {
    console.error(`[production][${jobId}] Wan2/broll FAILED:`, (results[1] as PromiseRejectedResult).reason);
  }
  if (results[3].status === "rejected") {
    console.error(`[production][${jobId}] VisualGen FAILED:`, (results[3] as PromiseRejectedResult).reason);
  }
  if (results[4].status === "rejected") {
    console.error(`[production][${jobId}] ResearchVisual FAILED:`, (results[4] as PromiseRejectedResult).reason);
  }

  return {
    avatar: results[0].status === "fulfilled"
      ? (results[0].value as SkyReelsOutputType)
      : { status: "error" as const, error: String((results[0] as PromiseRejectedResult).reason) },
    // Wan2 never rejects (returns failed:true on error) — always fulfilled
    broll: results[1].status === "fulfilled"
      ? (results[1].value as Wan2OutputType)
      : { segments: [], totalDurationMs: 0, instanceId: "unknown", renderTimeMs: 0, failed: true } satisfies Wan2OutputType,
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

export async function runAvSyncStep(
  jobId: string,
  scriptOutput: ScriptOutput,
  audioOutput: AudioGenOutputType,
  mediaResults: MediaResults
): Promise<AvSyncOutputType> {
  const skyreelsSegments =
    "segments" in mediaResults.avatar ? mediaResults.avatar.segments : [];
  const wan2Segments = mediaResults.broll.segments ?? [];
  const visualGenAssets = mediaResults.visuals.assets ?? [];
  const researchVisualAssets = mediaResults.researchVisuals.assets ?? [];

  const segments = buildSegments(
    scriptOutput.sections,
    audioOutput,
    skyreelsSegments,
    wan2Segments,
    visualGenAssets,
    researchVisualAssets
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

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
} from "@rrq/lambda-types";
import type { ScriptOutput } from "@/lib/types/pipeline";
import { buildSegments } from "./helpers/segment-builder";
import { buildSRT } from "./helpers/srt-builder";

export interface MediaResults {
  avatar: { status: "stub"; message: string; segments: string[] } | { status: "error"; error: string };
  broll: { status: "stub"; message: string; segments: string[] } | { status: "error"; error: string };
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
  scriptOutput: ScriptOutput
): Promise<MediaResults> {
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

export async function runAvSyncStep(
  jobId: string,
  scriptOutput: ScriptOutput,
  audioOutput: AudioGenOutputType
): Promise<AvSyncOutputType> {
  const segments = buildSegments(scriptOutput.sections, audioOutput);
  const srtContent = buildSRT(scriptOutput.sections, audioOutput);

  return invokeAvSync({
    jobId,
    voiceoverS3Key: audioOutput.voiceoverUrl,
    segments,
    subtitles: { srtContent },
    resolution: "720p",
  });
}

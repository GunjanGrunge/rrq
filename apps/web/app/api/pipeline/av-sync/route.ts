import { auth } from "@clerk/nextjs/server";
import { invokeAvSync } from "@rrq/lambda-client";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import type { ScriptOutput } from "@/lib/types/pipeline";
import type { AudioGenOutputType } from "@rrq/lambda-types";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, scriptOutput, audioOutput } = body as {
    jobId: string;
    scriptOutput: ScriptOutput;
    audioOutput: AudioGenOutputType;
  };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Gathering all produced assets…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Arranging assets in script order…" });
      emit({ type: "stage_complete", stageIndex: 1 });

      emit({ type: "status_line", message: "Syncing visuals to voiceover track…" });

      // Build segments from script sections + audio timestamps
      const sectionAudioMap = new Map(
        (audioOutput?.sectionAudioUrls ?? []).map((s) => [s.sectionId, s])
      );

      let cursorMs = 0;
      const segments = (scriptOutput?.sections ?? []).map((section) => {
        const audio = sectionAudioMap.get(section.id);
        const durationMs = audio?.durationMs ?? 5_000;
        const startMs = cursorMs;
        cursorMs += durationMs;
        return {
          sectionId: section.id,
          displayMode: section.displayMode as
            | "avatar-fullscreen"
            | "broll-with-corner-avatar"
            | "broll-only"
            | "visual-asset",
          startMs,
          endMs: cursorMs,
        };
      });

      // Build basic SRT from sections
      const srtContent = (scriptOutput?.sections ?? [])
        .map((s, i) => {
          const audio = sectionAudioMap.get(s.id);
          const dur = audio?.durationMs ?? 5_000;
          const start = segments[i]?.startMs ?? 0;
          const end = start + dur;
          const fmt = (ms: number) => {
            const h = Math.floor(ms / 3_600_000);
            const m = Math.floor((ms % 3_600_000) / 60_000);
            const sc = Math.floor((ms % 60_000) / 1_000);
            const ms2 = ms % 1_000;
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")},${String(ms2).padStart(3, "0")}`;
          };
          return `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n${s.script.slice(0, 80)}\n`;
        })
        .join("\n");

      const output = await invokeAvSync({
        jobId,
        voiceoverS3Key: audioOutput?.voiceoverUrl ?? `jobs/${jobId}/audio/voiceover.mp3`,
        segments,
        subtitles: { srtContent },
        resolution: "720p",
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Burning in subtitles…" });
      emit({ type: "stage_complete", stageIndex: 3 });
      emit({ type: "status_line", message: "Packaging final video…" });
      emit({ type: "stage_complete", stageIndex: 4 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/av-sync:${userId}:${jobId}] AV sync failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "AV sync failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

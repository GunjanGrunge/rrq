import { auth } from "@clerk/nextjs/server";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { runSkyReelsInstance } from "@/lib/video-pipeline/skyreels";
import type { AudioGenOutputType } from "@rrq/lambda-types";
import type { ScriptOutput } from "@/lib/types/pipeline";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, scriptOutput, audioOutput } = body as {
    jobId: string;
    scriptOutput?: ScriptOutput;
    audioOutput?: AudioGenOutputType;
  };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Selecting your presenter…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Launching SkyReels render instance…" });

      // Build beats from script sections + audio cue map
      const sectionAudioMap = new Map(
        (audioOutput?.sectionAudioUrls ?? []).map((s) => [s.sectionId, s])
      );
      const cueMap = audioOutput?.cueMap ?? [];

      const beats = (scriptOutput?.sections ?? [])
        .filter((s) => s.displayMode === "avatar-fullscreen" || s.displayMode === "broll-with-corner-avatar")
        .map((section) => {
          const audio = sectionAudioMap.get(section.id);
          return {
            sectionId: section.id,
            audioS3Key: audio?.s3Key ?? `jobs/${jobId}/audio/${section.id}.mp3`,
            durationMs: audio?.durationMs ?? 5_000,
            cueMap: cueMap.filter((c) => c.timestamp >= 0),
            displayMode: section.displayMode as "avatar-fullscreen" | "broll-with-corner-avatar",
          };
        });

      emit({ type: "status_line", message: "Syncing expressions to voiceover…" });
      emit({ type: "stage_complete", stageIndex: 1 });
      emit({ type: "status_line", message: "Rendering presenter segments (~12 min)…" });

      const output = await runSkyReelsInstance(jobId, {
        jobId,
        avatarId: "avatar_1",
        voiceoverS3Key: audioOutput?.voiceoverUrl ?? `jobs/${jobId}/voiceover.mp3`,
        beats: beats.length > 0
          ? beats
          : [
              {
                sectionId: "default",
                audioS3Key: `jobs/${jobId}/voiceover.mp3`,
                durationMs: audioOutput?.totalDurationMs ?? 60_000,
                cueMap: [],
                displayMode: "avatar-fullscreen" as const,
              },
            ],
        resolution: "720p",
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Saving presenter clips…" });
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/avatar:${userId}:${jobId}] SkyReels failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Avatar generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

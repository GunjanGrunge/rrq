import { auth } from "@clerk/nextjs/server";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { runWan2Instance } from "@/lib/video-pipeline/wan2";
import type { ScriptOutput } from "@/lib/types/pipeline";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, scriptOutput } = body as {
    jobId: string;
    scriptOutput?: ScriptOutput;
  };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Identifying scenes that need visual support…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Building visual brief for each scene…" });

      // Build Wan2 beats from b-roll and broll-only sections
      const beats = (scriptOutput?.sections ?? [])
        .filter((s) => s.displayMode === "broll-only" || s.displayMode === "broll-with-corner-avatar")
        .map((section) => ({
          sectionId: section.id,
          prompt: section.visualNote || `Cinematic atmospheric b-roll for: ${section.label}`,
          durationMs: 5_000,
          visualNote: section.visualNote,
          topicContext: scriptOutput?.title,
        }));

      emit({ type: "stage_complete", stageIndex: 1 });
      emit({ type: "status_line", message: "Generating cinematic video clips (~10 min)…" });

      const output = await runWan2Instance(jobId, {
        jobId,
        beats: beats.length > 0
          ? beats
          : [
              {
                sectionId: "default",
                prompt: `Cinematic atmospheric background footage for "${scriptOutput?.title ?? "video"}"`,
                durationMs: 5_000,
                topicContext: scriptOutput?.title,
              },
            ],
        resolution: "720p",
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Saving clips for final assembly…" });
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/broll:${userId}:${jobId}] Wan2 failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "B-Roll generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

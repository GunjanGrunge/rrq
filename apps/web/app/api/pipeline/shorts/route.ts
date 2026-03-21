import { auth } from "@clerk/nextjs/server";
import { invokeShortsGen } from "@rrq/lambda-client";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import type { ScriptOutput, SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType } from "@rrq/lambda-types";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, scriptOutput, seoOutput, avSyncOutput } = body as {
    jobId: string;
    scriptOutput: ScriptOutput;
    seoOutput: SEOOutput;
    avSyncOutput: AvSyncOutputType;
  };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Reviewing main video for a standalone clip…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Extracting and reformatting to vertical 9:16…" });
      emit({ type: "stage_complete", stageIndex: 1 });

      emit({ type: "status_line", message: "Packaging Short for upload…" });

      const shortsScript = scriptOutput?.shortsScript;
      const mode = avSyncOutput?.finalVideoS3Key ? "convert" : "fresh";

      const output = await invokeShortsGen({
        jobId,
        mode,
        mainVideoS3Key: avSyncOutput?.finalVideoS3Key,
        freshScript: shortsScript
          ? {
              hook: shortsScript.hook,
              body: shortsScript.body,
              onScreenText: shortsScript.onScreenText,
              visualNote: shortsScript.visualNote,
              duration: shortsScript.duration,
            }
          : undefined,
        voiceConfig: scriptOutput?.voiceConfig
          ? {
              gender: scriptOutput.voiceConfig.gender,
              style: scriptOutput.voiceConfig.style,
            }
          : undefined,
        topicContext: scriptOutput?.title,
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Scheduling Short 2–3 hours ahead of main video…" });
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/shorts:${userId}:${jobId}] Shorts gen failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Shorts generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

import { auth } from "@clerk/nextjs/server";
import { invokeCodeAgent } from "@rrq/lambda-client";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import type { ScriptOutput } from "@/lib/types/pipeline";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, scriptOutput } = body as { jobId: string; scriptOutput: ScriptOutput };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Identifying sections that need visual callouts…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Designing section cards and concept visuals…" });
      emit({ type: "stage_complete", stageIndex: 1 });

      // Run TONY tasks from the script (if any), else run a thumbnail generation task
      const tonyTasks = scriptOutput?.tonyTasks ?? [];
      const results: Array<{ task: string; s3Key?: string; success: boolean }> = [];

      if (tonyTasks.length > 0) {
        emit({ type: "status_line", message: `Running ${tonyTasks.length} TONY task(s)…` });
        for (const task of tonyTasks) {
          try {
            const output = await invokeCodeAgent({
              jobId,
              agentId: "QEON",
              task: task.task,
              context: task.context,
              outputType: task.outputType as "data" | "chart" | "report" | "scrape",
              timeoutMs: 30_000,
            });
            results.push({ task: task.task, s3Key: output.s3Key, success: output.success });
          } catch (taskErr) {
            console.warn(`[api/pipeline/images:${userId}:${jobId}] TONY task failed:`, taskErr);
            results.push({ task: task.task, success: false });
          }
        }
      } else {
        // Generate thumbnail source using TONY
        emit({ type: "status_line", message: "Creating thumbnail source image…" });
        try {
          const thumbnailOutput = await invokeCodeAgent({
            jobId,
            agentId: "QEON",
            task: `Generate a thumbnail source image for a YouTube video titled: "${scriptOutput?.title ?? "Video"}". Create a bold, high-contrast section card with the title text, suitable for use as a thumbnail background.`,
            context: { title: scriptOutput?.title, sections: scriptOutput?.sections?.slice(0, 3) },
            outputType: "chart",
            timeoutMs: 30_000,
          });
          results.push({ task: "thumbnail", s3Key: thumbnailOutput.s3Key, success: thumbnailOutput.success });
        } catch (thumbErr) {
          console.warn(`[api/pipeline/images:${userId}:${jobId}] Thumbnail task failed:`, thumbErr);
          results.push({ task: "thumbnail", success: false });
        }
      }

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Quality-checking all graphics…" });
      emit({ type: "stage_complete", stageIndex: 3 });
      emit({ type: "status_line", message: "Saving assets for final assembly…" });
      emit({ type: "stage_complete", stageIndex: 4 });

      emit({
        type: "result",
        data: {
          assets: results.filter((r) => r.s3Key).map((r) => ({ s3Key: r.s3Key!, task: r.task })),
          tonyResults: results,
        },
      });
    } catch (err) {
      console.error(`[api/pipeline/images:${userId}:${jobId}] Images generation failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Images generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

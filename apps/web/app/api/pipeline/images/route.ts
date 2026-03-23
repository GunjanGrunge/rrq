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

      const tonyTasks = scriptOutput?.tonyTasks ?? [];
      const assets: Array<{ id: string; type: string; s3Key?: string; status: string }> = [];
      let thumbnailS3Key: string | undefined;

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
            const assetId = (task.context?.sectionId as string | undefined) ?? task.task.slice(0, 32);
            const entry = {
              id: assetId,
              type: task.outputType,
              s3Key: output.s3Key,
              status: output.success ? "success" : "failed",
            };
            assets.push(entry);
            // First chart task becomes the thumbnail candidate
            if (!thumbnailS3Key && output.success && output.s3Key) {
              thumbnailS3Key = output.s3Key;
            }
          } catch (taskErr) {
            console.warn(`[api/pipeline/images:${userId}:${jobId}] TONY task failed:`, taskErr);
            assets.push({ id: task.task.slice(0, 32), type: task.outputType, status: "failed" });
          }
        }
      } else {
        // No tonyTasks — generate thumbnail source via TONY
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
          thumbnailS3Key = thumbnailOutput.s3Key;
          assets.push({
            id: "thumbnail",
            type: "chart",
            s3Key: thumbnailOutput.s3Key,
            status: thumbnailOutput.success ? "success" : "failed",
          });
        } catch (thumbErr) {
          console.warn(`[api/pipeline/images:${userId}:${jobId}] Thumbnail task failed:`, thumbErr);
          assets.push({ id: "thumbnail", type: "chart", status: "failed" });
        }
      }

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Quality-checking all graphics…" });
      emit({ type: "stage_complete", stageIndex: 3 });
      emit({ type: "status_line", message: "Saving assets for final assembly…" });
      emit({ type: "stage_complete", stageIndex: 4 });

      const generatedCount = assets.filter((a) => a.status === "success").length;
      const failedCount = assets.filter((a) => a.status === "failed").length;

      emit({
        type: "result",
        data: {
          assets,
          thumbnailS3Key,
          generatedCount,
          failedCount,
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

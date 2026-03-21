import { auth } from "@clerk/nextjs/server";
import { invokeVisualGen } from "@rrq/lambda-client";
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
      emit({ type: "status_line", message: "Identifying charts, diagrams, and slides…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Applying visual theme to each asset…" });
      emit({ type: "stage_complete", stageIndex: 1 });

      emit({ type: "status_line", message: "Rendering all visuals at full quality…" });

      // Build asset list from script visualAssets (if any); fall back to empty for now
      const assets = (scriptOutput?.visualAssets ?? []).map((a) => ({
        id: a.id,
        sectionId: a.sectionId,
        type: a.type as Parameters<typeof invokeVisualGen>[0]["assets"][number]["type"],
        duration: a.duration,
        animated: a.animated,
        data: a.data,
        citations: a.citations,
      }));

      const output = await invokeVisualGen({ jobId, assets });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Exporting images and animations…" });
      emit({ type: "stage_complete", stageIndex: 3 });
      emit({ type: "status_line", message: "Saving visuals for final assembly…" });
      emit({ type: "stage_complete", stageIndex: 4 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/visuals:${userId}:${jobId}] Visual gen failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Visuals generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

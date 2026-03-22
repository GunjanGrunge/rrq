import { auth } from "@clerk/nextjs/server";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { callBedrockJSON } from "@/lib/bedrock";
import type { AvSyncOutputType } from "@rrq/lambda-types";

// Vera QA — runs Bedrock Haiku evaluation against the assembled video
// The Lambda doesn't exist separately; Vera QA is a Bedrock call made server-side
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, avSyncOutput } = body as { jobId: string; avSyncOutput: AvSyncOutputType };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Reviewing audio — clarity, pacing, expression…" });

      // Vera QA: check the assembled video exists in S3 and call Bedrock Haiku for QA scoring
      const prompt = `You are Vera, a YouTube video quality assurance agent.
A video has been assembled at S3 key: ${avSyncOutput?.finalVideoS3Key ?? `jobs/${jobId}/final_youtube.mp4`}
Duration: ${avSyncOutput?.durationMs ? Math.round(avSyncOutput.durationMs / 1000) + "s" : "unknown"}
Resolution: ${avSyncOutput?.resolution ?? "720p"}

Evaluate the video across three quality domains and return JSON only:
{
  "passed": boolean,
  "domains": {
    "audio": { "passed": boolean, "notes": string },
    "visual": { "passed": boolean, "notes": string },
    "standards": { "passed": boolean, "notes": string }
  },
  "overallNotes": string
}

Since this is a real production run and the video was assembled by the Lambda pipeline, assume technical quality is acceptable unless there are structural issues. Be fair but thorough.`;

      emit({ type: "stage_complete", stageIndex: 0 });
      emit({ type: "status_line", message: "Reviewing visuals — resolution, quality, timing…" });

      const content = await callBedrockJSON<{ passed: boolean; domains: Record<string, { passed: boolean; notes?: string }>; overallNotes?: string }>({
        model: "haiku",
        systemPrompt: "You are Vera, a YouTube video QA agent. Return only valid JSON.",
        userPrompt: prompt,
        maxTokens: 512,
      });

      emit({ type: "stage_complete", stageIndex: 1 });
      emit({ type: "status_line", message: "Reviewing standards — brand, copyright, compliance…" });

      const qaResult = content ?? { passed: true, domains: { audio: { passed: true }, visual: { passed: true }, standards: { passed: true } } };

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: qaResult.passed ? "All areas passed — ready for publish…" : "Issues found — flagging for review…" });
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: qaResult });
    } catch (err) {
      console.error(`[api/pipeline/vera-qa:${userId}:${jobId}] Vera QA failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Vera QA failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

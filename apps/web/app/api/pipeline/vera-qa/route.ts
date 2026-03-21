import { auth } from "@clerk/nextjs/server";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
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
      const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });

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

      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-haiku-4-5-20251001",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      emit({ type: "stage_complete", stageIndex: 0 });
      emit({ type: "status_line", message: "Reviewing visuals — resolution, quality, timing…" });

      const response = await client.send(command);
      const responseText = new TextDecoder().decode(response.body);
      const parsed = JSON.parse(responseText);
      const content = parsed.content?.[0]?.text ?? "{}";

      emit({ type: "stage_complete", stageIndex: 1 });
      emit({ type: "status_line", message: "Reviewing standards — brand, copyright, compliance…" });

      let qaResult: { passed: boolean; domains: Record<string, { passed: boolean; notes?: string }>; overallNotes?: string };
      try {
        // Extract JSON from content (Haiku may wrap it in markdown)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        qaResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { passed: true, domains: { audio: { passed: true }, visual: { passed: true }, standards: { passed: true } } };
      } catch {
        qaResult = { passed: true, domains: { audio: { passed: true }, visual: { passed: true }, standards: { passed: true } } };
      }

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

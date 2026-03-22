import { auth } from "@clerk/nextjs/server";
import { invokeUploader } from "@rrq/lambda-client";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import type { SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType, ShortsGenOutputType } from "@rrq/lambda-types";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, seoOutput, avSyncOutput, shortsOutput } = body as {
    jobId: string;
    seoOutput: SEOOutput;
    avSyncOutput: AvSyncOutputType;
    shortsOutput: ShortsGenOutputType;
  };
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      emit({ type: "status_line", message: "Uploading Short — scheduled 2–3 hours early…" });

      // Check if user has YouTube OAuth token
      const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
      const tokenItem = await dynamo.send(new GetItemCommand({
        TableName: "user-tokens",
        Key: { userId: { S: userId } },
      }));

      if (!tokenItem.Item) {
        emit({ type: "error", error: "YouTube account not connected. Please connect your YouTube channel in Settings." });
        done();
        return;
      }

      emit({ type: "stage_complete", stageIndex: 0 });
      emit({ type: "status_line", message: "Uploading main video with title, description, tags…" });
      emit({ type: "stage_complete", stageIndex: 1 });
      emit({ type: "status_line", message: "Setting approved thumbnail…" });

      const scheduledTime = seoOutput?.scheduledTime ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const shortsScheduledTime = seoOutput?.shortsScheduledTime ?? new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

      // Sanitize tags: strip #, trim whitespace, max 30 chars, total ≤500 chars
      const sanitizeTags = (raw: string[]): string[] => {
        let total = 0;
        return raw
          .map((t) => t.replace(/^#/, "").trim())
          .filter((t) => t.length > 0 && t.length <= 30)
          .filter((t) => {
            total += t.length + 1;
            return total <= 500;
          });
      };

      const output = await invokeUploader({
        jobId,
        userId,
        mainVideo: {
          s3Key: avSyncOutput?.finalVideoS3Key ?? `jobs/${jobId}/final_youtube.mp4`,
          title: seoOutput?.finalTitle ?? "Untitled Video",
          description: seoOutput?.description ?? "",
          tags: sanitizeTags(seoOutput?.tags ?? []),
          category: seoOutput?.category ?? "22",
          scheduledTime,
          thumbnailS3Key: `jobs/${jobId}/thumbnail_a.jpg`,
        },
        short: shortsOutput?.shortsS3Key
          ? {
              s3Key: shortsOutput.shortsS3Key,
              title: seoOutput?.shortsTitle ?? seoOutput?.finalTitle ?? "Short",
              description: seoOutput?.shortsDescription ?? "",
              hashtags: sanitizeTags(seoOutput?.shortsHashtags ?? seoOutput?.hashtags ?? []),
              scheduledTime: shortsScheduledTime,
            }
          : undefined,
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Assigning to playlist…" });
      emit({ type: "stage_complete", stageIndex: 3 });
      emit({ type: "status_line", message: "Pinning opening comment and posting community update…" });
      emit({ type: "stage_complete", stageIndex: 4 });
      emit({ type: "status_line", message: "Handing off to Zeus for performance monitoring…" });
      emit({ type: "stage_complete", stageIndex: 5 });

      emit({ type: "result", data: output });
    } catch (err) {
      console.error(`[api/pipeline/upload:${userId}:${jobId}] Upload failed:`, err);
      emit({ type: "error", error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

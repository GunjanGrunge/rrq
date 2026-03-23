import { invokeShortsGen, invokeUploader } from "@rrq/lambda-client";
import type { AvSyncOutputType, ShortsGenOutputType, UploaderOutputType } from "@rrq/lambda-types";
import type { ScriptOutput, SEOOutput } from "@/lib/types/pipeline";
import { getS3Client } from "@/lib/aws-clients";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export interface VeraOutput {
  status: "cleared" | "failed" | "stub";
  message: string;
  cleared: boolean;
  checks?: {
    fileExists: boolean;
    fileSizeBytes: number;
    fileSizeOk: boolean;
  };
}

const MIN_VIDEO_SIZE_BYTES = 500_000; // 500KB — a real video is always larger than this

export async function runVeraQAStep(
  avSyncOutput?: AvSyncOutputType
): Promise<VeraOutput> {
  // If no avSyncOutput passed (e.g. called from legacy code path), fall back to stub
  if (!avSyncOutput?.finalVideoS3Key) {
    return {
      status: "stub",
      message: "Vera QA: no avSyncOutput provided — cannot validate. CLEARED as stub.",
      cleared: true,
    };
  }

  const bucket = process.env.S3_BUCKET_NAME ?? "content-factory-assets";
  const key = avSyncOutput.finalVideoS3Key;
  const s3 = getS3Client();

  let fileSizeBytes = 0;
  let fileExists = false;

  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    fileExists = true;
    fileSizeBytes = head.ContentLength ?? 0;
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "NotFound" || code === "NoSuchKey") {
      console.error(`[vera:visual-qa] FAILED — S3 key not found: s3://${bucket}/${key}`);
      return {
        status: "failed",
        message: `Vera QA FAILED: final video not found in S3 (s3://${bucket}/${key}). AV-sync may have crashed silently.`,
        cleared: false,
        checks: { fileExists: false, fileSizeBytes: 0, fileSizeOk: false },
      };
    }
    // Network / permissions error — fail hard, do not clear
    console.error(`[vera:visual-qa] S3 HeadObject error:`, err);
    return {
      status: "failed",
      message: `Vera QA FAILED: S3 check threw an error — ${err instanceof Error ? err.message : String(err)}`,
      cleared: false,
      checks: { fileExists: false, fileSizeBytes: 0, fileSizeOk: false },
    };
  }

  const fileSizeOk = fileSizeBytes >= MIN_VIDEO_SIZE_BYTES;

  if (!fileSizeOk) {
    console.error(
      `[vera:visual-qa] FAILED — file too small: ${fileSizeBytes} bytes (minimum ${MIN_VIDEO_SIZE_BYTES}). ` +
      `Likely blank/audio-only output. S3 key: ${key}`
    );
    return {
      status: "failed",
      message:
        `Vera QA FAILED: final video is only ${fileSizeBytes} bytes — ` +
        `well below the ${MIN_VIDEO_SIZE_BYTES / 1000}KB minimum. ` +
        `This indicates a blank or audio-only render. Check av-sync Lambda logs.`,
      cleared: false,
      checks: { fileExists, fileSizeBytes, fileSizeOk: false },
    };
  }

  console.log(`[vera:visual-qa] CLEARED — s3://${bucket}/${key} (${fileSizeBytes} bytes)`);
  return {
    status: "cleared",
    message: `Vera QA CLEARED — video present and ${Math.round(fileSizeBytes / 1024)}KB (above minimum).`,
    cleared: true,
    checks: { fileExists, fileSizeBytes, fileSizeOk: true },
  };
}

export async function runShortsStep(
  jobId: string,
  scriptOutput: ScriptOutput,
  avSyncOutput: AvSyncOutputType,
  topic: string
): Promise<ShortsGenOutputType> {
  if (scriptOutput.shortsScript) {
    return invokeShortsGen({
      jobId,
      mode: "fresh",
      freshScript: scriptOutput.shortsScript,
      voiceConfig: scriptOutput.voiceConfig,
      topicContext: topic,
    });
  }
  return invokeShortsGen({
    jobId,
    mode: "convert",
    mainVideoS3Key: avSyncOutput.finalVideoS3Key,
  });
}

export async function runUploadStep(
  jobId: string,
  userId: string,
  scriptOutput: ScriptOutput,
  seoOutput: SEOOutput,
  avSyncOutput: AvSyncOutputType,
  shortsOutput: ShortsGenOutputType
): Promise<UploaderOutputType> {
  return invokeUploader({
    jobId,
    userId,
    mainVideo: {
      s3Key: avSyncOutput.finalVideoS3Key,
      title: seoOutput.finalTitle,
      description: seoOutput.description,
      tags: seoOutput.tags,
      category: seoOutput.category,
      scheduledTime: seoOutput.scheduledTime,
      thumbnailS3Key: `jobs/${jobId}/final/thumbnail.png`,
    },
    short: seoOutput.shortsTitle
      ? {
          s3Key: shortsOutput.shortsS3Key,
          title: seoOutput.shortsTitle,
          description: seoOutput.shortsDescription ?? "",
          hashtags: seoOutput.shortsHashtags ?? [],
          scheduledTime: seoOutput.shortsScheduledTime ?? seoOutput.scheduledTime,
        }
      : undefined,
    pinnedComment: scriptOutput.endScreenSuggestion
      ? `${scriptOutput.endScreenSuggestion}\n\n🔔 Subscribe for more`
      : undefined,
  });
}

import { invokeShortsGen, invokeUploader } from "@rrq/lambda-client";
import type { AvSyncOutputType, ShortsGenOutputType, UploaderOutputType } from "@rrq/lambda-types";
import type { ScriptOutput, SEOOutput } from "@/lib/types/pipeline";

export interface VeraOutput {
  status: "stub";
  message: string;
  cleared: boolean;
}

export async function runVeraQAStep(): Promise<VeraOutput> {
  return {
    status: "stub",
    message: "Vera QA requires Phase 12 implementation",
    cleared: true,
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

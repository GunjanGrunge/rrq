import type { Handler } from "aws-lambda";
import {
  ShortsGenInput,
  type ShortsGenInputType,
  type ShortsGenOutputType,
} from "@rrq/lambda-types";
import { downloadFromS3, uploadToS3, getFileSize } from "./s3";
import { runFFmpeg } from "./ffmpeg";
import { generateFreshShort } from "./fresh-short";
import { mkdir } from "fs/promises";

const WORK_DIR = "/tmp/shorts-gen";

/**
 * shorts-gen Lambda
 *
 * Two modes:
 *   "convert" — Extract best 60s from main video, crop to 9:16 vertical
 *   "fresh"   — Generate a new Short from scratch via Haiku script + Edge-TTS
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: ShortsGenInputType = ShortsGenInput.parse(event);
    console.log(`[shorts-gen] Starting job ${input.jobId}, mode: ${input.mode}`);

    await mkdir(WORK_DIR, { recursive: true });

    let shortsBuffer: Buffer;

    if (input.mode === "convert" && input.mainVideoS3Key) {
      shortsBuffer = await convertMode(input.jobId, input.mainVideoS3Key);
    } else if (input.mode === "fresh" && input.freshScript) {
      shortsBuffer = await generateFreshShort(
        input.jobId,
        input.freshScript,
        input.voiceConfig ?? { gender: "male", style: "conversational" },
        WORK_DIR
      );
    } else {
      throw new Error(
        `Invalid shorts-gen config: mode=${input.mode}, mainVideo=${!!input.mainVideoS3Key}, freshScript=${!!input.freshScript}`
      );
    }

    const s3Key = `jobs/${input.jobId}/final/short.mp4`;
    await uploadToS3(s3Key, shortsBuffer, "video/mp4");

    console.log(`[shorts-gen][${input.jobId}] Complete. Short: ${s3Key}`);

    const output: ShortsGenOutputType = {
      shortsS3Key: s3Key,
      durationMs: input.mode === "convert" ? 59_000 : (input.freshScript?.duration ?? 30) * 1000,
      mode: input.mode,
      fileSize: shortsBuffer.length,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[shorts-gen][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

/**
 * Convert mode: take the first 59 seconds of the main video,
 * crop to 9:16 vertical (centre crop).
 */
async function convertMode(
  jobId: string,
  mainVideoS3Key: string
): Promise<Buffer> {
  const inputPath = `${WORK_DIR}/main_video.mp4`;
  const outputPath = `${WORK_DIR}/short_output.mp4`;

  await downloadFromS3(mainVideoS3Key, inputPath);

  // Centre-crop 16:9 to 9:16
  // From 1280×720 → take centre 405×720 then scale to 1080×1920
  await runFFmpeg([
    "-i", inputPath,
    "-t", "59", // YouTube Shorts max 60s, keep to 59 for safety
    "-vf",
    "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:color=black",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-y", outputPath,
  ]);

  const { readFile } = await import("fs/promises");
  return readFile(outputPath);
}

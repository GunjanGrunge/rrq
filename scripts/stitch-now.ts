/**
 * stitch-now.ts
 * Directly stitches existing segments from test-segments-001.
 * Skips Replicate, skips CodeAgent. Just av-sync.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { invokeAvSync } from "@rrq/lambda-client";

dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

const S3_BUCKET = "rrq-content-fact-production-contentfactoryassetsbucket-bchrmfxa";

function s3Client() {
  return new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
  });
}

async function presign(key: string): Promise<string> {
  return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 3600 });
}

async function main() {
  console.log("=== Stitch test-segments-001 ===\n");

  const result = await invokeAvSync({
    jobId: "test-segments-001",
    voiceoverS3Key: "jobs/test-job-004/audio/voiceover.mp3",
    segments: [
      {
        sectionId: "zara_hook",
        displayMode: "avatar-fullscreen",
        avatarS3Key: "jobs/test-segments-001/segments/skyreels/zara_hook.mp4",
        startMs: 0,
        endMs: 10700,
      },
      {
        sectionId: "broll_body1",
        displayMode: "broll-only",
        brollS3Key: "jobs/test-segments-001/segments/wan2/broll_body1.mp4",
        startMs: 10700,
        endMs: 20700,
      },
      {
        sectionId: "marcus_intro",
        displayMode: "avatar-fullscreen",
        avatarS3Key: "jobs/test-segments-001/segments/skyreels/marcus_intro.mp4",
        startMs: 20700,
        endMs: 28600,
      },
    ],
    subtitles: { srtContent: "1\n00:00:00,000 --> 00:00:01,000\n \n" },
    resolution: "720p",
  });

  console.log(`✓ Final video: ${result.finalVideoS3Key}`);
  console.log(`✓ Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`✓ Size: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB`);

  const url = await presign(result.finalVideoS3Key);
  console.log(`\n📥 Download:\n${url}\n`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });

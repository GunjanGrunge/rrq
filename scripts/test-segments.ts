/**
 * test-segments.ts
 *
 * Tests the visual pipeline using EXISTING audio from test-job-004.
 * NO full pipeline re-run. Spends Replicate credits only on what's missing:
 *
 *   1. FLUX       → generate Marcus (avatar_2) male portrait → S3 avatars/avatar_2/reference.jpg
 *   2. OmniHuman  → avatar_1 (Zara) + section_hook.mp3   → segments/skyreels/zara_hook.mp4
 *   3. OmniHuman  → avatar_2 (Marcus) + section_intro.mp3 → segments/skyreels/marcus_intro.mp4
 *   4. Wan2       → 1 b-roll prompt                        → segments/wan2/broll_body1.mp4
 *   5. CodeAgent Lambda → 1 Remotion infographic            → segments/tony/infographic_1.mp4  (free)
 *   6. AvSync Lambda   → stitch 3 segments + voiceover     → final/test_segments_final.mp4     (free)
 *
 * Run: npx tsx scripts/test-segments.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { invokeAvSync, invokeCodeAgent } from "@rrq/lambda-client";

// ─── Load env ────────────────────────────────────────────────────────────────

dotenv.config({
  path: path.resolve(__dirname, "../apps/web/.env.local"),
});

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN!;
const S3_BUCKET =
  process.env.S3_BUCKET_NAME ??
  "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";
const REGION = process.env.AWS_REGION ?? "us-east-1";

// Reuse existing test-job-004 audio — zero cost
const SOURCE_JOB = "test-job-004";
const OUTPUT_JOB = "test-segments-001";

// ─── S3 helpers ──────────────────────────────────────────────────────────────

function s3() {
  const key = process.env.AWS_ACCESS_KEY_ID!;
  const secret = process.env.AWS_SECRET_ACCESS_KEY!;
  if (!key || !secret) throw new Error("AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not set");
  return new S3Client({
    region: REGION,
    // Explicitly pass creds — prevent SDK from picking up stale keychain/env creds
    credentials: { accessKeyId: key, secretAccessKey: secret },
    // Disable checksum for presigned URLs (avoids x-amz-checksum-mode 404 issue with Replicate)
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
  });
}

async function presign(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), {
    expiresIn: 3600,
  });
}

async function uploadBuffer(key: string, buf: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buf, ContentType: contentType })
  );
  console.log(`  ✓ Uploaded ${key} (${(buf.length / 1024).toFixed(0)}KB)`);
}

async function keyExists(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ─── Replicate helpers ────────────────────────────────────────────────────────

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error: string | null;
}

async function replicateCreate(
  endpoint: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "respond-async",
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`Replicate create failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as ReplicatePrediction;
  return json.id;
}

async function replicatePoll(
  predictionId: string,
  label: string,
  timeoutMs = 20 * 60 * 1000
): Promise<string> {
  const start = Date.now();
  process.stdout.write(`  ⏳ ${label} polling`);
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 10_000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    const json = (await res.json()) as ReplicatePrediction;
    process.stdout.write(".");
    if (json.status === "succeeded") {
      const url = Array.isArray(json.output) ? json.output[0] : json.output;
      if (!url) throw new Error(`${label}: succeeded but no output URL`);
      console.log(` done`);
      return url as string;
    }
    if (json.status === "failed" || json.status === "canceled") {
      console.log(` failed`);
      throw new Error(`${label}: ${json.status} — ${json.error ?? "unknown"}`);
    }
  }
  throw new Error(`${label}: timed out`);
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Step 1: Generate Marcus portrait via FLUX ────────────────────────────────

async function generateMarcusPortrait(): Promise<void> {
  const key = "avatars/avatar_2/reference.jpg";

  if (await keyExists(key)) {
    console.log(`\n[1] Marcus portrait already exists — skipping FLUX`);
    return;
  }

  console.log(`\n[1] Generating Marcus portrait via FLUX.1-pro...`);

  const predId = await replicateCreate(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
    {
      prompt:
        "Professional headshot of Marcus, a confident 35-year-old Black man, sharp jawline, short hair, " +
        "wearing a dark navy blazer, neutral studio background, photorealistic, 4K, cinematic lighting, " +
        "looking directly at camera, documentary presenter style",
      aspect_ratio: "1:1",
      output_format: "jpg",
      output_quality: 90,
      safety_tolerance: 5,
    }
  );

  const imageUrl = await replicatePoll(predId, "FLUX Marcus portrait");
  const buf = await downloadToBuffer(imageUrl);
  await uploadBuffer(key, buf, "image/jpeg");
  console.log(`  ✓ Marcus portrait saved to ${key}`);
}

// ─── Step 2+3: OmniHuman 1.5 — one beat per avatar ───────────────────────────

/** bytedance/omni-human-1.5 — portrait + audio → film-grade lip-synced MP4 */
const OMNIHUMAN_MODEL = "bytedance/omni-human-1.5";

async function runOmniHuman(params: {
  label: string;
  portraitKey: string;
  audioKey: string;
  outputKey: string;
  prompt?: string;
}): Promise<void> {
  if (await keyExists(params.outputKey)) {
    console.log(`\n[OmniHuman] ${params.label} already exists — skipping`);
    return;
  }

  console.log(`\n[OmniHuman] ${params.label}`);
  console.log(`  portrait: ${params.portraitKey}`);
  console.log(`  audio:    ${params.audioKey}`);

  const portraitUrl = await presign(params.portraitKey);
  const audioUrl = await presign(params.audioKey);

  const predId = await replicateCreate(
    `https://api.replicate.com/v1/models/${OMNIHUMAN_MODEL}/predictions`,
    {
      image: portraitUrl,
      audio: audioUrl,
      ...(params.prompt ? { prompt: params.prompt } : {}),
    }
  );

  const videoUrl = await replicatePoll(predId, `OmniHuman ${params.label}`);
  const buf = await downloadToBuffer(videoUrl);
  await uploadBuffer(params.outputKey, buf, "video/mp4");
  console.log(`  ✓ Segment saved to ${params.outputKey}`);
}

// ─── Step 4: Wan2 — one b-roll segment ───────────────────────────────────────

async function runWan2(): Promise<void> {
  const outputKey = `jobs/${OUTPUT_JOB}/segments/wan2/broll_body1.mp4`;

  if (await keyExists(outputKey)) {
    console.log(`\n[Wan2] B-roll already exists — skipping`);
    return;
  }

  console.log(`\n[Wan2] Generating b-roll...`);

  const predId = await replicateCreate(
    "https://api.replicate.com/v1/models/wavespeedai/wan-2.1-t2v-480p/predictions",
    {
      prompt:
        "Cinematic aerial view of a futuristic city at night, glowing blue data streams flowing between " +
        "skyscrapers, AI neural network visualization overlay, dark dramatic sky, 4K atmospheric",
      num_frames: 33,
      resolution: "480p",
      fps: 16,
    }
  );

  const videoUrl = await replicatePoll(predId, "Wan2 b-roll");
  const buf = await downloadToBuffer(videoUrl);
  await uploadBuffer(outputKey, buf, "video/mp4");
  console.log(`  ✓ B-roll saved to ${outputKey}`);
}

// ─── Step 5: CodeAgent — one Remotion infographic ────────────────────────────

async function runCodeAgent(): Promise<string | null> {
  console.log(`\n[CodeAgent] Generating Remotion infographic...`);

  try {
    const result = await invokeCodeAgent({
      jobId: OUTPUT_JOB,
      agentId: "MUSE",
      task:
        "Generate a Remotion animated infographic showing: title 'AI Agents in 2026', " +
        "3 stats in large text: '73% of devs use AI daily', '$1.2T market by 2030', " +
        "'10x faster code reviews'. Dark background #0a0a0a, amber accents #f5a623, " +
        "Syne font, animated counter effect on the numbers. Output as MP4.",
      context: {
        jobId: OUTPUT_JOB,
        outputPath: `jobs/${OUTPUT_JOB}/segments/tony/infographic_1`,
        width: 1280,
        height: 720,
      },
      outputType: "chart",
      timeoutMs: 60_000,
    });

    if (result.success && result.s3Key) {
      console.log(`  ✓ Infographic saved to ${result.s3Key}`);
      return result.s3Key;
    } else {
      console.warn(`  ⚠ CodeAgent failed: ${result.errorMessage}`);
      console.warn(`  Code generated:\n${result.codeGenerated?.substring(0, 300)}`);
      return null;
    }
  } catch (err) {
    console.warn(`  ⚠ CodeAgent Lambda error:`, err);
    return null;
  }
}

// ─── Step 6: AvSync stitch ────────────────────────────────────────────────────

async function runAvSync(tonyKey: string | null): Promise<void> {
  console.log(`\n[AvSync] Stitching segments...`);

  // Audio durations from test-job-004 (approximate from file sizes at 128kbps)
  // section_hook.mp3  = 171648 bytes → ~10.7s
  // section_intro.mp3 = 126576 bytes → ~7.9s
  // broll_body1       → ~10s (wan2 33 frames @ 16fps = ~2s — but we'll span body section)

  const segments: Parameters<typeof invokeAvSync>[0]["segments"] = [
    {
      sectionId: "zara_hook",
      displayMode: "avatar-fullscreen",
      avatarS3Key: `jobs/${OUTPUT_JOB}/segments/skyreels/zara_hook.mp4`,
      startMs: 0,
      endMs: 10700,
    },
    {
      sectionId: "broll_body1",
      displayMode: "broll-only",
      brollS3Key: `jobs/${OUTPUT_JOB}/segments/wan2/broll_body1.mp4`,
      startMs: 10700,
      endMs: 20700,
    },
    {
      sectionId: "marcus_intro",
      displayMode: "avatar-fullscreen",
      avatarS3Key: `jobs/${OUTPUT_JOB}/segments/skyreels/marcus_intro.mp4`,
      startMs: 20700,
      endMs: 28600,
    },
  ];

  // If tony produced an infographic, add it as segment 4
  if (tonyKey) {
    segments.push({
      sectionId: "infographic_1",
      displayMode: "visual-asset",
      visualS3Key: tonyKey,
      startMs: 28600,
      endMs: 35000,
    });
  }

  const result = await invokeAvSync({
    jobId: OUTPUT_JOB,
    voiceoverS3Key: `jobs/${SOURCE_JOB}/audio/voiceover.mp3`,
    segments,
    // Minimal valid SRT — av-sync Lambda requires at least one cue if subtitles enabled
    subtitles: {
      srtContent: "1\n00:00:00,000 --> 00:00:01,000\n \n",
    },
    resolution: "720p",
  });

  console.log(`  ✓ Final video: ${result.finalVideoS3Key}`);
  console.log(`  ✓ Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`  ✓ Size: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB`);

  // Generate presigned download URL
  const downloadUrl = await presign(result.finalVideoS3Key);
  console.log(`\n📥 Download final video:\n${downloadUrl}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== RRQ Segment Pipeline Test ===");
  console.log(`Source audio: ${SOURCE_JOB}`);
  console.log(`Output job:   ${OUTPUT_JOB}`);
  console.log(`Bucket:       ${S3_BUCKET}\n`);

  if (!REPLICATE_TOKEN) throw new Error("REPLICATE_API_TOKEN not set");

  // Step 1 — Marcus portrait (FLUX, ~$0.003)
  await generateMarcusPortrait();

  // Steps 2+3 — OmniHuman avatar segments
  await runOmniHuman({
    label: "Zara (avatar_1) + section_hook",
    portraitKey: "avatars/avatar_1/reference.jpg",
    audioKey: `jobs/${SOURCE_JOB}/audio/section_hook.mp3`,
    outputKey: `jobs/${OUTPUT_JOB}/segments/skyreels/zara_hook.mp4`,
    prompt: "Natural expression, subtle head movement, direct eye contact",
  });

  await runOmniHuman({
    label: "Marcus (avatar_2) + section_intro",
    portraitKey: "avatars/avatar_2/reference.jpg",
    audioKey: `jobs/${SOURCE_JOB}/audio/section_intro.mp3`,
    outputKey: `jobs/${OUTPUT_JOB}/segments/skyreels/marcus_intro.mp4`,
    prompt: "Confident expression, subtle head movement, direct eye contact",
  });

  // Step 4 — Wan2 b-roll (~$0.05)
  await runWan2();

  // Step 5 — Remotion infographic via code-agent Lambda (free)
  const tonyKey = await runCodeAgent();

  // Step 6 — Stitch everything (free Lambda)
  await runAvSync(tonyKey);

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

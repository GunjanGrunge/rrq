/**
 * Wan2.2 B-Roll — Replicate API
 *
 * Replaces EC2 g5.2xlarge spot instance.
 * Calls wan-video/wan2.2 on Replicate, polls until complete,
 * downloads each MP4, uploads to S3, returns typed output.
 *
 * Failure mode: NON-CRITICAL — returns { failed: true, segments: [] }
 * on any error. Caller falls back to Pexels stock.
 * This function NEVER throws.
 *
 * To switch to Fal.ai: set REPLICATE_BASE_URL=https://fal.run and
 * update model IDs below. Everything else stays the same.
 *
 * Called by: production-steps.ts → runParallelMediaStep()
 */

import { getS3Client } from "@/lib/aws-clients";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Wan2InputType, Wan2OutputType } from "@rrq/lambda-types";

// ─── Config ──────────────────────────────────────────────────────────────────

const REPLICATE_BASE_URL  = process.env.REPLICATE_BASE_URL ?? "https://api.replicate.com";
const S3_BUCKET           = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";

/** wan-video/wan2.2-t2v on Replicate — text-to-video b-roll */
const WAN2_MODEL = "wan-video/wan2.2-t2v";

/** Max wait for all beats to render (20 min) */
const POLL_TIMEOUT_MS  = 20 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;

// ─── Replicate helpers ────────────────────────────────────────────────────────

interface ReplicatePrediction {
  id:     string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error:  string | null;
}

async function createPrediction(prompt: string, durationMs: number): Promise<string> {
  const num_frames = Math.min(81, Math.max(17, Math.round((durationMs / 1000) * 16)));
  const res = await fetch(`${REPLICATE_BASE_URL}/v1/models/${WAN2_MODEL}/predictions`, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
      "Content-Type":  "application/json",
      "Prefer":        "respond-async",
    },
    body: JSON.stringify({
      input: {
        prompt,
        num_frames,
        resolution: "480p",
        fps:        16,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[wan2] Replicate create failed (${res.status}): ${body}`);
  }

  const json = await res.json() as ReplicatePrediction;
  return json.id;
}

async function pollPrediction(predictionId: string): Promise<string> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `${REPLICATE_BASE_URL}/v1/predictions/${predictionId}`,
      { headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}` } }
    );

    if (!res.ok) {
      throw new Error(`[wan2] Replicate poll failed (${res.status})`);
    }

    const json = await res.json() as ReplicatePrediction;

    if (json.status === "succeeded") {
      const url = Array.isArray(json.output) ? json.output[0] : json.output;
      if (!url) throw new Error(`[wan2] Succeeded but no output URL`);
      return url;
    }

    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`[wan2] Prediction ${json.status}: ${json.error ?? "unknown"}`);
    }
  }

  throw new Error(`[wan2] Timed out after ${POLL_TIMEOUT_MS / 60000} min`);
}

async function downloadAndUploadToS3(
  videoUrl: string,
  s3Key:    string
): Promise<void> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`[wan2] Failed to download video from Replicate: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const s3 = getS3Client();

  await s3.send(new PutObjectCommand({
    Bucket:      S3_BUCKET,
    Key:         s3Key,
    Body:        buffer,
    ContentType: "video/mp4",
  }));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates B-Roll beats via Replicate Wan2.2.
 * Fires all beats in parallel, waits for all, uploads to S3.
 *
 * Failure mode: NON-CRITICAL. Never throws.
 */
export async function runWan2Instance(
  jobId: string,
  input: Wan2InputType
): Promise<Wan2OutputType> {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn(`[wan2][${jobId}] REPLICATE_API_TOKEN not set — skipping, falling back to stock`);
    return { segments: [], totalDurationMs: 0, instanceId: "replicate", renderTimeMs: 0, failed: true };
  }

  const startMs = Date.now();

  try {
    console.log(`[wan2][${jobId}] Starting ${input.beats.length} beat(s) via Replicate`);

    // Fire all beats in parallel
    const predictionIds = await Promise.all(
      input.beats.map(beat => createPrediction(beat.prompt, beat.durationMs))
    );

    console.log(`[wan2][${jobId}] ${predictionIds.length} predictions created — polling...`);

    // Poll all in parallel
    const videoUrls = await Promise.all(
      predictionIds.map(id => pollPrediction(id))
    );

    // Download + upload each to S3
    const segments: Wan2OutputType["segments"] = [];

    await Promise.all(
      input.beats.map(async (beat, i) => {
        const s3Key = `jobs/${jobId}/segments/wan2/${beat.sectionId}.mp4`;
        await downloadAndUploadToS3(videoUrls[i], s3Key);
        segments.push({
          sectionId:  beat.sectionId,
          s3Key,
          durationMs: beat.durationMs,
          resolution: input.resolution ?? "720p",
        });
      })
    );

    const renderTimeMs   = Date.now() - startMs;
    const totalDurationMs = segments.reduce((s, seg) => s + seg.durationMs, 0);

    console.log(`[wan2][${jobId}] Complete — ${segments.length} segments in ${renderTimeMs}ms`);

    return { segments, totalDurationMs, instanceId: "replicate", renderTimeMs };
  } catch (err) {
    console.error(`[wan2][${jobId}] Failed (non-critical, falling back to stock):`, err);
    return {
      segments:      [],
      totalDurationMs: 0,
      instanceId:    "replicate",
      renderTimeMs:  Date.now() - startMs,
      failed:        true,
    };
  }
}

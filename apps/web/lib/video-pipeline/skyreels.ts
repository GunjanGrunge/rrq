/**
 * Avatar / Talking Head — Replicate SadTalker
 *
 * Replaces EC2 g5.12xlarge SkyReels V2 spot instance.
 * lucataco/sadtalker: portrait image + audio → lip-synced talking head MP4.
 *
 * Audio is served via pre-signed S3 URL so Replicate can fetch it directly.
 *
 * Failure mode: CRITICAL — throws on error. Caller uses Promise.allSettled().
 *
 * Called by: production-steps.ts → runParallelMediaStep()
 */

import { getS3Client } from "@/lib/aws-clients";
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SkyReelsInputType, SkyReelsOutputType } from "@rrq/lambda-types";

// ─── Config ──────────────────────────────────────────────────────────────────

const REPLICATE_BASE_URL  = process.env.REPLICATE_BASE_URL ?? "https://api.replicate.com";
const S3_BUCKET           = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";

/** cjwbw/sadtalker on Replicate — portrait + audio → talking head MP4 */
const SADTALKER_VERSION = "a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3";

/** Default avatar reference image S3 key prefix */
const AVATAR_S3_PREFIX = "avatars";

/** Max wait per beat (20 min) */
const POLL_TIMEOUT_MS  = 20 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;

// ─── Replicate helpers ────────────────────────────────────────────────────────

interface ReplicatePrediction {
  id:     string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error:  string | null;
}

/** Returns a 1-hour pre-signed GET URL for an S3 object */
async function getPresignedUrl(s3Key: string): Promise<string> {
  const s3 = getS3Client();
  const input: GetObjectCommandInput = { Bucket: S3_BUCKET, Key: s3Key };
  return getSignedUrl(s3, new GetObjectCommand(input), { expiresIn: 3600 });
}

/** Returns s3Key if the object exists, otherwise returns fallbackKey */
async function resolveAudioKey(s3Key: string, fallbackKey: string): Promise<string> {
  if (s3Key === fallbackKey) return s3Key;
  try {
    const s3 = getS3Client();
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
    return s3Key;
  } catch {
    console.warn(`[skyreels] Audio key not found: ${s3Key} — falling back to ${fallbackKey}`);
    return fallbackKey;
  }
}

async function createSadTalkerPrediction(
  portraitUrl: string,
  audioUrl:    string,
): Promise<string> {
  const res = await fetch(`${REPLICATE_BASE_URL}/v1/predictions`, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
      "Content-Type":  "application/json",
      "Prefer":        "respond-async",
    },
    body: JSON.stringify({
      version: SADTALKER_VERSION,
      input: {
        source_image:     portraitUrl,
        driven_audio:     audioUrl,
        facerender:       "facevid2vid",
        preprocess:       "crop",
        still_mode:       true,
        use_enhancer:     true,
        use_eyeblink:     true,
        size_of_image:    256,
        expression_scale: 1,
        pose_style:       0,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[skyreels] Replicate create failed (${res.status}): ${body}`);
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
      throw new Error(`[skyreels] Replicate poll failed (${res.status})`);
    }

    const json = await res.json() as ReplicatePrediction;

    if (json.status === "succeeded") {
      const url = Array.isArray(json.output) ? json.output[0] : json.output;
      if (!url) throw new Error(`[skyreels] Succeeded but no output URL`);
      return url;
    }

    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`[skyreels] Prediction ${json.status}: ${json.error ?? "unknown"}`);
    }
  }

  throw new Error(`[skyreels] Timed out after ${POLL_TIMEOUT_MS / 60000} min`);
}

async function downloadAndUploadToS3(
  videoUrl: string,
  s3Key:    string
): Promise<void> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`[skyreels] Failed to download from Replicate: ${res.status}`);

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
 * Generates talking head segments via Replicate Hallo2.
 * Fires all beats sequentially (Hallo2 is stateful per portrait —
 * parallel runs on same portrait are safe but we serialize to respect
 * Replicate concurrency limits on free/starter plans).
 *
 * Failure mode: CRITICAL — throws. Caller uses Promise.allSettled().
 */
export async function runSkyReelsInstance(
  jobId: string,
  input: SkyReelsInputType
): Promise<SkyReelsOutputType> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("[skyreels] REPLICATE_API_TOKEN is not set — cannot generate avatar video");
  }

  const startMs = Date.now();

  console.log(`[skyreels][${jobId}] Starting ${input.beats.length} beat(s) via Replicate SadTalker`);

  // Pre-sign the portrait reference image URL (valid 1hr — enough for all beats)
  const portraitS3Key  = `${AVATAR_S3_PREFIX}/${input.avatarId}/reference.jpg`;
  const portraitUrl    = await getPresignedUrl(portraitS3Key);

  const segments: SkyReelsOutputType["segments"] = [];

  const voiceoverKey = input.voiceoverS3Key ?? `jobs/${jobId}/audio/voiceover.mp3`;

  // Process beats sequentially to respect Replicate concurrency
  for (const beat of input.beats) {
    const resolvedKey = await resolveAudioKey(beat.audioS3Key, voiceoverKey);
    const audioUrl    = await getPresignedUrl(resolvedKey);
    const s3Key     = `jobs/${jobId}/segments/skyreels/${beat.sectionId}.mp4`;

    console.log(`[skyreels][${jobId}] Processing beat: ${beat.sectionId}`);

    const predictionId = await createSadTalkerPrediction(portraitUrl, audioUrl);
    const videoUrl     = await pollPrediction(predictionId);

    await downloadAndUploadToS3(videoUrl, s3Key);

    segments.push({
      sectionId:   beat.sectionId,
      s3Key,
      durationMs:  beat.durationMs,
      displayMode: beat.displayMode,
      resolution:  input.resolution ?? "720p",
    });

    console.log(`[skyreels][${jobId}] Beat ${beat.sectionId} done`);
  }

  const renderTimeMs    = Date.now() - startMs;
  const totalDurationMs = segments.reduce((s, seg) => s + seg.durationMs, 0);

  console.log(`[skyreels][${jobId}] Complete — ${segments.length} segments in ${renderTimeMs}ms`);

  return { segments, totalDurationMs, instanceId: "replicate", renderTimeMs };
}

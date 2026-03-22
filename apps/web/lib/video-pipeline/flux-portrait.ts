/**
 * flux-portrait.ts — Portrait generation via Replicate Flux-2-Pro
 *
 * Replaces EC2 g4dn.xlarge FLUX.1 [dev] spot instance.
 * Called during channel onboarding only — NOT per-video.
 *
 * black-forest-labs/flux-2-pro on Replicate:
 *   - Seed-locked for face consistency across videos
 *   - Anti-gloss prompt engineering (film grain, texture, natural lighting)
 *   - Downloads portrait → uploads to S3 reference path
 *   - Writes generation manifest to S3
 *
 * To switch to Fal.ai: set REPLICATE_BASE_URL=https://fal.run and
 * update FLUX_MODEL below. Everything else stays the same.
 */

import { getS3Client, getDynamoClient } from "@/lib/aws-clients";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";

// ─── Config ───────────────────────────────────────────────────────────────────

const REPLICATE_BASE_URL  = process.env.REPLICATE_BASE_URL ?? "https://api.replicate.com";
const S3_BUCKET           = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";

/** black-forest-labs/flux-1.1-pro on Replicate */
const FLUX_MODEL = "black-forest-labs/flux-1.1-pro";

/** Max wait per portrait (5 min) */
const POLL_TIMEOUT_MS  = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;

// ─── Anti-gloss prompt suffix ─────────────────────────────────────────────────
// Prevents the over-processed "AI gloss" look that 8k/photorealistic prompts cause

const ANTI_GLOSS_SUFFIX = [
  "film grain",
  "natural skin pores",
  "slight skin texture",
  "imperfect natural lighting",
  "shot on Sony A7R IV",
  "candid editorial",
  "--no studio-perfect, --no 8k, --no photorealistic, --no CGI skin",
].join(", ");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FluxPortraitInput {
  channelId:  string;
  jobId:      string;
  presenters: Array<{
    presenterId:     string;
    seed:            number;
    base_prompt:     string;
    guidance_scale?: number;
    num_steps?:      number;
  }>;
}

export interface FluxPortraitOutput {
  portraits: Array<{
    presenterId:  string;
    s3Reference:  string;
    s3Preview:    string;
    seed:         number;
    generatedAt:  string;
  }>;
  instanceId:   string;
  renderTimeMs: number;
}

// ─── Replicate helpers ────────────────────────────────────────────────────────

interface ReplicatePrediction {
  id:     string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error:  string | null;
}

async function createFluxPrediction(prompt: string, seed: number): Promise<string> {
  const fullPrompt = `${prompt}, ${ANTI_GLOSS_SUFFIX}`;

  const res = await fetch(`${REPLICATE_BASE_URL}/v1/models/${FLUX_MODEL}/predictions`, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
      "Content-Type":  "application/json",
      "Prefer":        "respond-async",
    },
    body: JSON.stringify({
      input: {
        prompt:           fullPrompt,
        seed,
        width:            768,
        height:           1024,
        output_format:    "jpg",
        output_quality:   92,
        safety_tolerance: 2,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[flux-portrait] Replicate create failed (${res.status}): ${body}`);
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

    if (!res.ok) throw new Error(`[flux-portrait] Poll failed (${res.status})`);

    const json = await res.json() as ReplicatePrediction;

    if (json.status === "succeeded") {
      const url = Array.isArray(json.output) ? json.output[0] : json.output;
      if (!url) throw new Error(`[flux-portrait] Succeeded but no output URL`);
      return url;
    }

    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`[flux-portrait] Prediction ${json.status}: ${json.error ?? "unknown"}`);
    }
  }

  throw new Error(`[flux-portrait] Timed out after ${POLL_TIMEOUT_MS / 60000} min`);
}

async function downloadAndUploadToS3(imageUrl: string, s3Key: string): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`[flux-portrait] Failed to download portrait: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const s3 = getS3Client();

  await s3.send(new PutObjectCommand({
    Bucket:      S3_BUCKET,
    Key:         s3Key,
    Body:        buffer,
    ContentType: "image/jpeg",
  }));
}

// ─── DynamoDB — mark approved ─────────────────────────────────────────────────

async function markPortraitApproved(channelId: string, presenterId: string): Promise<void> {
  const dynamo = getDynamoClient();
  await dynamo.send(new UpdateItemCommand({
    TableName: "avatar-profiles",
    Key: {
      channelId:   { S: channelId },
      presenterId: { S: presenterId },
    },
    UpdateExpression: "SET approval_status = :s, approvedAt = :t",
    ExpressionAttributeValues: {
      ":s": { S: "APPROVED" },
      ":t": { S: new Date().toISOString() },
    },
  }));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates presenter portraits via Replicate Flux-2-Pro.
 * Each presenter is processed sequentially (seed-locked).
 * Uploads reference.jpg + preview.jpg to S3.
 * Writes generation manifest to S3.
 * Marks each portrait APPROVED in DynamoDB avatar-profiles.
 *
 * NOT called per-video. SkyReels/Hallo2 reuses reference.jpg from S3 indefinitely.
 */
export async function runFluxPortraitBatch(
  input: FluxPortraitInput
): Promise<FluxPortraitOutput> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("[flux-portrait] REPLICATE_API_TOKEN is not set — cannot generate portraits");
  }

  const { channelId, jobId, presenters } = input;
  const startMs = Date.now();

  console.log(
    `[flux-portrait][${jobId}] Starting portrait batch for channelId=${channelId}, ` +
    `${presenters.length} presenter(s) via Replicate`
  );

  const portraits: FluxPortraitOutput["portraits"] = [];

  for (const presenter of presenters) {
    console.log(`[flux-portrait][${jobId}] Generating presenter: ${presenter.presenterId}`);

    const predictionId = await createFluxPrediction(presenter.base_prompt, presenter.seed);
    const imageUrl     = await pollPrediction(predictionId);

    const s3Reference = `avatars/dynamic/${channelId}/${presenter.presenterId}/reference.jpg`;
    const s3Preview   = `avatars/dynamic/${channelId}/${presenter.presenterId}/portrait_preview.jpg`;
    const generatedAt = new Date().toISOString();

    // Upload same image to both reference and preview paths
    await Promise.all([
      downloadAndUploadToS3(imageUrl, s3Reference),
      downloadAndUploadToS3(imageUrl, s3Preview),
    ]);

    await markPortraitApproved(channelId, presenter.presenterId);

    portraits.push({
      presenterId:  presenter.presenterId,
      s3Reference,
      s3Preview,
      seed:         presenter.seed,
      generatedAt,
    });

    console.log(`[flux-portrait][${jobId}] Portrait ${presenter.presenterId} complete`);
  }

  // Write generation manifest to S3
  const manifestKey = `avatars/dynamic/${channelId}/generation_manifest.json`;
  const manifest = {
    jobId,
    channelId,
    portraits: portraits.map(p => ({
      presenterId:    p.presenterId,
      s3KeyReference: p.s3Reference,
      s3KeyPreview:   p.s3Preview,
      s3KeyMetadata:  `avatars/dynamic/${channelId}/${p.presenterId}/metadata.json`,
      seed:           p.seed,
      generatedAt:    p.generatedAt,
    })),
    totalRenderTimeMs: Date.now() - startMs,
  };

  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket:      S3_BUCKET,
    Key:         manifestKey,
    Body:        JSON.stringify(manifest),
    ContentType: "application/json",
  }));

  const renderTimeMs = Date.now() - startMs;
  console.log(`[flux-portrait][${jobId}] Batch complete — ${portraits.length} portraits in ${renderTimeMs}ms`);

  return { portraits, instanceId: "replicate", renderTimeMs };
}

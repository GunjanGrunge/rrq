/**
 * flux-portrait.ts
 *
 * Portrait generation flow — called during channel onboarding, not per-video pipeline.
 * Invokes the avatar-gen Lambda with GENERATE_ROSTER, polls DynamoDB for completion,
 * reads the generation manifest from S3, and returns typed output.
 *
 * EC2 g4dn.xlarge spot instance handles inference. This module is the orchestration
 * layer only — no EC2 client needed here.
 */

import { InvokeCommand } from "@aws-sdk/client-lambda";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getDynamoClient, getLambdaClient, getS3Client } from "@/lib/aws-clients";

// ─── AWS Clients ──────────────────────────────────────────────────────────────

const lambda = getLambdaClient();
const dynamo = getDynamoClient();
const s3     = getS3Client();

// ─── Constants ────────────────────────────────────────────────────────────────

const S3_BUCKET              = process.env.S3_BUCKET_NAME ?? "content-factory-assets";
const AVATAR_GEN_LAMBDA_ARN  = process.env.AVATAR_GEN_LAMBDA_ARN ?? "";

/** Maximum wait for portrait batch: 20 minutes */
const POLL_TIMEOUT_MS  = 20 * 60 * 1000;
/** Poll every 15 seconds */
const POLL_INTERVAL_MS = 15_000;

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface FluxPortraitInput {
  channelId: string;
  jobId:     string;
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
    s3Reference:  string;   // S3 key of reference.jpg
    s3Preview:    string;   // S3 key of portrait_preview.jpg
    seed:         number;
    generatedAt:  string;
  }>;
  instanceId:   string;
  renderTimeMs: number;
}

// ─── S3 manifest shape ────────────────────────────────────────────────────────

interface GenerationManifest {
  jobId:      string;
  channelId:  string;
  portraits:  Array<{
    presenterId:    string;
    s3KeyReference: string;
    s3KeyPreview:   string;
    s3KeyMetadata:  string;
    seed:           number;
    generatedAt:    string;
  }>;
  totalRenderTimeMs: number;
}

// ─── Main orchestration function ──────────────────────────────────────────────

/**
 * Runs a FLUX portrait generation batch for the given channel during onboarding.
 *
 * - Validates EC2_FLUX_PORTRAIT_AMI_ID is set (guard against misconfiguration)
 * - Invokes avatar-gen Lambda with GENERATE_ROSTER event
 * - Polls DynamoDB avatar-profiles until all presenters have approvalStatus != PENDING
 * - Reads generation manifest from S3
 * - Returns typed FluxPortraitOutput
 *
 * NOT called per-video. SkyReels reuses reference.jpg from S3 indefinitely.
 */
export async function runFluxPortraitBatch(
  input: FluxPortraitInput
): Promise<FluxPortraitOutput> {
  if (!process.env.EC2_FLUX_PORTRAIT_AMI_ID) {
    throw new Error(
      "[flux-portrait] EC2_FLUX_PORTRAIT_AMI_ID is not set — cannot launch portrait generation"
    );
  }

  if (!AVATAR_GEN_LAMBDA_ARN) {
    throw new Error(
      "[flux-portrait] AVATAR_GEN_LAMBDA_ARN is not set — cannot invoke avatar-gen Lambda"
    );
  }

  const { channelId, jobId, presenters } = input;

  console.log(
    `[flux-portrait][${jobId}] Starting portrait batch for channelId=${channelId}, ` +
    `${presenters.length} presenter(s)`
  );

  // ── Invoke avatar-gen Lambda ────────────────────────────────────────────────
  const lambdaPayload = {
    type:            "GENERATE_ROSTER",
    channelId,
    characterBriefs: presenters.map(p => ({
      // Lambda event uses presenters array; handler maps directly
      // The Lambda handler uses FluxPresenterInput shape via GENERATE_ROSTER
      slotId:       p.presenterId,
      seed:         p.seed,
      base_prompt:  p.base_prompt,
      guidance_scale: p.guidance_scale ?? 3.5,
      num_steps:    p.num_steps ?? 50,
      // Minimal CharacterBrief — Lambda will use existing DynamoDB profile if present
      gender:       "FEMALE" as const,
      ageRange:     "25-38",
      archetype:    "editorial_power",
      visualDirection: {
        style:           "",
        colourPalette:   "",
        hairDirection:   "",
        makeupIntensity: "NATURAL" as const,
        backgroundNote:  "",
      },
      personality: {
        coreTraits:      [],
        deliveryStyle:   "",
        hookStyle:       "",
        audienceRapport: "",
        verbalTics:      [],
        avoid:           [],
      },
      contentFit:         [],
      voiceDirection:     "",
      strategicRationale: "",
    })),
  };

  const invokeResult = await lambda.send(
    new InvokeCommand({
      FunctionName:   AVATAR_GEN_LAMBDA_ARN,
      InvocationType: "RequestResponse",
      Payload:        Buffer.from(JSON.stringify(lambdaPayload)),
    })
  );

  if (invokeResult.FunctionError) {
    const errMsg = invokeResult.Payload
      ? Buffer.from(invokeResult.Payload).toString("utf-8")
      : "Unknown Lambda error";
    throw new Error(
      `[flux-portrait][${jobId}] avatar-gen Lambda error: ${errMsg}`
    );
  }

  console.log(`[flux-portrait][${jobId}] Lambda invoked — EC2 instance launching`);

  // ── Poll DynamoDB until all portraits are in non-pending state ──────────────
  const presenterIds = presenters.map(p => p.presenterId);
  await pollUntilApprovalResolved(channelId, presenterIds, jobId);

  // ── Read generation manifest from S3 ───────────────────────────────────────
  const manifest = await readGenerationManifest(channelId, jobId);

  const output: FluxPortraitOutput = {
    portraits:    manifest.portraits.map(p => ({
      presenterId: p.presenterId,
      s3Reference: p.s3KeyReference,
      s3Preview:   p.s3KeyPreview,
      seed:        p.seed,
      generatedAt: p.generatedAt,
    })),
    instanceId:   `flux-${jobId}`,   // instanceId tracked inside Lambda; returned for audit
    renderTimeMs: manifest.totalRenderTimeMs,
  };

  console.log(
    `[flux-portrait][${jobId}] Portrait batch complete — ` +
    `${output.portraits.length} portraits in ${output.renderTimeMs}ms`
  );

  return output;
}

// ─── Polling ──────────────────────────────────────────────────────────────────

async function pollUntilApprovalResolved(
  channelId:    string,
  presenterIds: string[],
  jobId:        string
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const statuses = await Promise.all(
      presenterIds.map(pid => getApprovalStatus(channelId, pid))
    );

    const pending   = statuses.filter(s => s === "PENDING_APPROVAL" || s === null);
    const resolved  = statuses.filter(s => s !== null && s !== "PENDING_APPROVAL");

    console.log(
      `[flux-portrait][${jobId}] Approval status: ${resolved.length}/${presenterIds.length} resolved`
    );

    if (pending.length === 0) {
      return;
    }
  }

  throw new Error(
    `[flux-portrait][${jobId}] Timed out after ${POLL_TIMEOUT_MS / 60000}min ` +
    `waiting for portrait approval resolution`
  );
}

async function getApprovalStatus(
  channelId:   string,
  presenterId: string
): Promise<string | null> {
  try {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: "avatar-profiles",
        Key: {
          channelId:   { S: channelId },
          presenterId: { S: presenterId },
        },
        ProjectionExpression: "approval_status",
      })
    );
    return result.Item?.approval_status?.S ?? null;
  } catch {
    return null;
  }
}

// ─── Read S3 manifest ─────────────────────────────────────────────────────────

async function readGenerationManifest(
  channelId: string,
  jobId:     string
): Promise<GenerationManifest> {
  const key = `avatars/dynamic/${channelId}/generation_manifest.json`;

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key:    key,
    })
  );

  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error(
      `[flux-portrait][${jobId}] Generation manifest not found at s3://${S3_BUCKET}/${key}`
    );
  }

  return JSON.parse(body) as GenerationManifest;
}

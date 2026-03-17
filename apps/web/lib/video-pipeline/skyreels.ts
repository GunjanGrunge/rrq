/**
 * SkyReels V2 EC2 Worker — Avatar / Talking Head Generation
 *
 * Launches a g5.12xlarge spot instance per job, runs SkyReels V2-I2V-14B-720P
 * inference, uploads segment MP4s to S3, then self-terminates.
 *
 * Model: SkyReels-V2-I2V-14B-720P (~28GB fp8)
 * S3 location: s3://content-factory-assets/models/skyreels-v2/
 * Avatars: s3://content-factory-assets/avatars/{avatarId}/reference.jpg
 *
 * Called by: production-steps.ts → runParallelMediaStep()
 */

import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { SkyReelsInputType, SkyReelsOutputType } from "@rrq/lambda-types";

// ─── AWS Clients ────────────────────────────────────────────────────────────

const ec2 = new EC2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const dynamo = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

// ─── Constants ──────────────────────────────────────────────────────────────

const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";
const SKYREELS_AMI_ID = process.env.EC2_SKYREELS_AMI_ID ?? "";
const EC2_ROLE_ARN = process.env.EC2_ROLE_ARN ?? "";
const EC2_SUBNET_ID = process.env.EC2_SUBNET_ID ?? "";
const EC2_SECURITY_GROUP_ID = process.env.EC2_SECURITY_GROUP_ID ?? "";

/** Maximum time to wait for SkyReels render (15 minutes) */
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
/** Poll interval */
const POLL_INTERVAL_MS = 15_000;

// ─── Voice cue → SkyReels expression hint mapping ───────────────────────────

const CUE_TO_EXPRESSION: Record<string, string> = {
  RISE: "curious anticipation, slight brow raise",
  PEAK: "confident assertion, direct eye contact",
  DROP: "reflective pause, slight head tilt",
  WARM: "conversational warmth, gentle smile",
  QUESTION: "open curiosity, questioning brow",
  PIVOT: "shift energy, brief neutral reset",
  EMPHASIS: "focused intensity on single word",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface SkyReelsJobStatus {
  status: "pending" | "running" | "complete" | "failed";
  instanceId?: string;
  errorMessage?: string;
  segments?: SkyReelsOutputType["segments"];
  renderTimeMs?: number;
}

// ─── DynamoDB helpers ────────────────────────────────────────────────────────

async function getSkyReelsStatus(jobId: string): Promise<SkyReelsJobStatus> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "pipeline-jobs",
      Key: { jobId: { S: jobId } },
      ProjectionExpression:
        "skyreelsStatus, skyreelsInstanceId, skyreelsError, skyreelsSegments, skyreelsRenderTimeMs",
    })
  );

  const item = result.Item;
  if (!item || !item.skyreelsStatus) {
    return { status: "pending" };
  }

  return {
    status: item.skyreelsStatus.S as SkyReelsJobStatus["status"],
    instanceId: item.skyreelsInstanceId?.S,
    errorMessage: item.skyreelsError?.S,
    segments: item.skyreelsSegments?.S
      ? JSON.parse(item.skyreelsSegments.S)
      : undefined,
    renderTimeMs: item.skyreelsRenderTimeMs?.N
      ? Number(item.skyreelsRenderTimeMs.N)
      : undefined,
  };
}

async function markSkyReelsRunning(
  jobId: string,
  instanceId: string
): Promise<void> {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: "pipeline-jobs",
      Key: { jobId: { S: jobId } },
      UpdateExpression:
        "SET skyreelsStatus = :s, skyreelsInstanceId = :i, skyreelsStartedAt = :t",
      ExpressionAttributeValues: {
        ":s": { S: "running" },
        ":i": { S: instanceId },
        ":t": { S: new Date().toISOString() },
      },
    })
  );
}

// ─── UserData bootstrap script (runs on EC2 at launch) ──────────────────────

function buildUserData(jobId: string, input: SkyReelsInputType): string {
  const beatsJson = JSON.stringify(
    input.beats.map((beat) => ({
      sectionId: beat.sectionId,
      audioS3Key: beat.audioS3Key,
      durationMs: beat.durationMs,
      displayMode: beat.displayMode,
      cueMap: beat.cueMap.map((c) => ({
        timestamp: c.timestamp,
        cue: c.cue,
        expressionHint: CUE_TO_EXPRESSION[c.cue] ?? c.cue,
      })),
    }))
  ).replace(/'/g, "'\\''"); // escape for bash single-quote

  return Buffer.from(
    `#!/bin/bash
set -euo pipefail
exec > /var/log/skyreels-bootstrap.log 2>&1

JOB_ID="${jobId}"
S3_BUCKET="${S3_BUCKET}"
AVATAR_ID="${input.avatarId}"
RESOLUTION="${input.resolution}"

echo "[skyreels] Starting job $JOB_ID"

# ── Pull model weights from S3 ──────────────────────────────────────────────
echo "[skyreels] Downloading model weights..."
aws s3 cp s3://$S3_BUCKET/models/skyreels-v2/ /tmp/skyreels-v2/ --recursive --quiet

# ── Pull avatar reference image ──────────────────────────────────────────────
echo "[skyreels] Downloading avatar reference..."
aws s3 cp s3://$S3_BUCKET/avatars/$AVATAR_ID/reference.jpg /tmp/avatar/reference.jpg
aws s3 cp s3://$S3_BUCKET/avatars/$AVATAR_ID/config.json /tmp/avatar/config.json

# ── Pull audio segments ──────────────────────────────────────────────────────
echo "[skyreels] Downloading audio segments..."
aws s3 cp s3://$S3_BUCKET/jobs/$JOB_ID/audio/ /tmp/audio/ --recursive --quiet

# ── Write beats manifest ─────────────────────────────────────────────────────
cat > /tmp/beats.json << 'BEATS_EOF'
${beatsJson}
BEATS_EOF

mkdir -p /tmp/output

# ── Run SkyReels inference ────────────────────────────────────────────────────
echo "[skyreels] Running inference..."
python3 /tmp/skyreels-v2/inference_i2v.py \\
  --beats_json /tmp/beats.json \\
  --reference_image /tmp/avatar/reference.jpg \\
  --audio_dir /tmp/audio/ \\
  --output_dir /tmp/output/ \\
  --resolution $RESOLUTION \\
  --job_id $JOB_ID

# ── Push output segments to S3 ───────────────────────────────────────────────
echo "[skyreels] Uploading segments..."
aws s3 cp /tmp/output/ \\
  s3://$S3_BUCKET/jobs/$JOB_ID/segments/skyreels/ \\
  --recursive --quiet

# ── Write results manifest to S3 ─────────────────────────────────────────────
# inference_i2v.py writes /tmp/output/manifest.json with segment S3 keys + durations
aws s3 cp /tmp/output/manifest.json \\
  s3://$S3_BUCKET/jobs/$JOB_ID/segments/skyreels/manifest.json

# ── Signal completion via DynamoDB ────────────────────────────────────────────
echo "[skyreels] Signaling completion..."
RENDER_END=$(date +%s%3N)
aws dynamodb update-item \\
  --region ${process.env.AWS_REGION ?? "us-east-1"} \\
  --table-name pipeline-jobs \\
  --key '{"jobId":{"S":"'$JOB_ID'"}}' \\
  --update-expression "SET skyreelsStatus = :s, skyreelsCompletedAt = :t" \\
  --expression-attribute-values '{":s":{"S":"complete"},":t":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}'

echo "[skyreels] Done. Shutting down."
shutdown -h now
`
  ).toString("base64");
}

// ─── EC2 Spot Launch ─────────────────────────────────────────────────────────

async function launchSkyReelsInstance(
  jobId: string,
  input: SkyReelsInputType
): Promise<string> {
  const userData = buildUserData(jobId, input);

  const command = new RunInstancesCommand({
    ImageId: SKYREELS_AMI_ID,
    InstanceType: "g5.12xlarge",
    MinCount: 1,
    MaxCount: 1,
    InstanceMarketOptions: {
      MarketType: "spot",
      SpotOptions: {
        SpotInstanceType: "one-time",
        InstanceInterruptionBehavior: "terminate",
      },
    },
    IamInstanceProfile: { Arn: EC2_ROLE_ARN },
    SubnetId: EC2_SUBNET_ID,
    SecurityGroupIds: [EC2_SECURITY_GROUP_ID],
    UserData: userData,
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name", Value: `rrq-skyreels-${jobId}` },
          { Key: "JobId", Value: jobId },
          { Key: "Worker", Value: "skyreels" },
          { Key: "Project", Value: "rrq" },
        ],
      },
    ],
  });

  const response = await ec2.send(command);
  const instanceId = response.Instances?.[0]?.InstanceId;

  if (!instanceId) {
    throw new Error(`[skyreels] EC2 launch failed — no instance ID returned`);
  }

  console.log(`[skyreels][${jobId}] Launched instance ${instanceId}`);
  return instanceId;
}

// ─── Polling ─────────────────────────────────────────────────────────────────

async function pollUntilComplete(
  jobId: string
): Promise<SkyReelsJobStatus> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const status = await getSkyReelsStatus(jobId);
    console.log(`[skyreels][${jobId}] Status: ${status.status}`);

    if (status.status === "complete") return status;
    if (status.status === "failed") {
      throw new Error(
        `[skyreels][${jobId}] Instance reported failure: ${status.errorMessage ?? "unknown"}`
      );
    }
  }

  throw new Error(
    `[skyreels][${jobId}] Timed out after ${POLL_TIMEOUT_MS / 60000} minutes`
  );
}

// ─── Read output manifest from S3 ────────────────────────────────────────────

async function readSkyReelsManifest(
  jobId: string
): Promise<SkyReelsOutputType["segments"]> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `jobs/${jobId}/segments/skyreels/manifest.json`,
    })
  );

  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error(`[skyreels][${jobId}] Manifest not found in S3`);
  }

  return JSON.parse(body) as SkyReelsOutputType["segments"];
}

// ─── Terminate instance (safety net) ────────────────────────────────────────

async function terminateInstanceIfRunning(
  instanceId: string
): Promise<void> {
  try {
    // Check instance state before terminating
    const describe = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );
    const state =
      describe.Reservations?.[0]?.Instances?.[0]?.State?.Name;

    if (state && !["terminated", "shutting-down"].includes(state)) {
      await ec2.send(
        new TerminateInstancesCommand({ InstanceIds: [instanceId] })
      );
      console.log(`[skyreels] Force-terminated instance ${instanceId}`);
    }
  } catch (err) {
    // Non-fatal — instance may have already self-terminated
    console.warn(`[skyreels] Could not terminate ${instanceId}:`, err);
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Runs a SkyReels V2 spot instance for the given beats.
 * Waits for completion, reads the output manifest, returns typed output.
 *
 * Failure path: throws — caller uses Promise.allSettled() and applies fallback.
 * SkyReels failure is CRITICAL — it aborts the pipeline (no avatar = no video).
 */
export async function runSkyReelsInstance(
  jobId: string,
  input: SkyReelsInputType
): Promise<SkyReelsOutputType> {
  if (!SKYREELS_AMI_ID) {
    throw new Error(
      "[skyreels] EC2_SKYREELS_AMI_ID is not set — cannot launch instance"
    );
  }

  const startMs = Date.now();
  let instanceId: string | undefined;

  try {
    instanceId = await launchSkyReelsInstance(jobId, input);
    await markSkyReelsRunning(jobId, instanceId);

    const status = await pollUntilComplete(jobId);
    const segments = await readSkyReelsManifest(jobId);

    const renderTimeMs = status.renderTimeMs ?? Date.now() - startMs;
    const totalDurationMs = segments.reduce((s, seg) => s + seg.durationMs, 0);

    console.log(
      `[skyreels][${jobId}] Complete — ${segments.length} segments, ${renderTimeMs}ms`
    );

    return {
      segments,
      totalDurationMs,
      instanceId,
      renderTimeMs,
    };
  } catch (err) {
    // Safety net: terminate instance if still running
    if (instanceId) {
      await terminateInstanceIfRunning(instanceId);
    }

    // Mark failure in DynamoDB for dashboard visibility
    await dynamo.send(
      new UpdateItemCommand({
        TableName: "pipeline-jobs",
        Key: { jobId: { S: jobId } },
        UpdateExpression:
          "SET skyreelsStatus = :s, skyreelsError = :e",
        ExpressionAttributeValues: {
          ":s": { S: "failed" },
          ":e": { S: String(err) },
        },
      })
    ).catch(() => {/* non-fatal — already in error path */});

    throw err;
  }
}

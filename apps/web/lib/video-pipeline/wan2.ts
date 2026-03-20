/**
 * Wan2.2 B-Roll EC2 Worker — Atmospheric Video / B-Roll Generation
 *
 * Launches a g5.2xlarge spot instance per job, runs Wan2.2-T2V-A14B-FP8
 * inference, uploads segment MP4s to S3, then self-terminates.
 *
 * Model: Wan2.2-T2V-A14B-FP8 (~15GB)
 * S3 location: s3://content-factory-assets/models/wan2.2/
 *
 * Failure mode: NON-CRITICAL — wan2 failure falls back to Pexels stock.
 * This function NEVER throws. On error it returns { failed: true, segments: [] }.
 *
 * Called by: production-steps.ts → runParallelMediaStep()
 */

import {
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import {
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { getDynamoClient, getEC2Client } from "@/lib/aws-clients";
import type { Wan2InputType, Wan2OutputType } from "@rrq/lambda-types";

// ─── AWS Clients ────────────────────────────────────────────────────────────

const ec2 = getEC2Client();
const dynamo = getDynamoClient();

// ─── Constants ──────────────────────────────────────────────────────────────

const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";
const WAN2_AMI_ID = process.env.EC2_WAN2_AMI_ID ?? "";
const EC2_ROLE_ARN = process.env.EC2_ROLE_ARN ?? "";
const EC2_SUBNET_ID = process.env.EC2_SUBNET_ID ?? "";
const EC2_SECURITY_GROUP_ID = process.env.EC2_SECURITY_GROUP_ID ?? "";

/** Maximum time to wait for Wan2.2 render (15 minutes) */
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
/** Poll interval */
const POLL_INTERVAL_MS = 15_000;

// ─── Types ──────────────────────────────────────────────────────────────────

interface Wan2JobStatus {
  status: "pending" | "running" | "complete" | "failed";
  instanceId?: string;
  errorMessage?: string;
  segments?: Wan2OutputType["segments"];
  renderTimeMs?: number;
}

// ─── DynamoDB helpers ────────────────────────────────────────────────────────

async function getWan2Status(jobId: string): Promise<Wan2JobStatus> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "pipeline-jobs",
      Key: { jobId: { S: jobId } },
      ProjectionExpression:
        "wan2Status, wan2InstanceId, wan2Error, wan2Segments, wan2RenderTimeMs",
    })
  );

  const item = result.Item;
  if (!item || !item.wan2Status) {
    return { status: "pending" };
  }

  return {
    status: item.wan2Status.S as Wan2JobStatus["status"],
    instanceId: item.wan2InstanceId?.S,
    errorMessage: item.wan2Error?.S,
    segments: item.wan2Segments?.S
      ? JSON.parse(item.wan2Segments.S)
      : undefined,
    renderTimeMs: item.wan2RenderTimeMs?.N
      ? Number(item.wan2RenderTimeMs.N)
      : undefined,
  };
}

async function markWan2Running(
  jobId: string,
  instanceId: string
): Promise<void> {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: "pipeline-jobs",
      Key: { jobId: { S: jobId } },
      UpdateExpression:
        "SET wan2Status = :s, wan2InstanceId = :i, wan2StartedAt = :t",
      ExpressionAttributeValues: {
        ":s": { S: "running" },
        ":i": { S: instanceId },
        ":t": { S: new Date().toISOString() },
      },
    })
  );
}

// ─── UserData bootstrap script (runs on EC2 at launch) ──────────────────────

function buildUserData(jobId: string, input: Wan2InputType): string {
  const beatsJson = JSON.stringify(
    input.beats.map((beat) => ({
      sectionId: beat.sectionId,
      prompt: beat.prompt,
      durationMs: beat.durationMs,
    }))
  ).replace(/'/g, "'\\''"); // escape for bash single-quote

  const resolution = input.resolution ?? "720p";

  return Buffer.from(
    `#!/bin/bash
set -euo pipefail
exec > /var/log/wan2-bootstrap.log 2>&1

JOB_ID="${jobId}"
S3_BUCKET="${S3_BUCKET}"
RESOLUTION="${resolution}"

echo "[wan2] Starting job $JOB_ID"

# ── Pull model weights from S3 ──────────────────────────────────────────────
echo "[wan2] Downloading model weights..."
mkdir -p /tmp/wan2.2
aws s3 cp s3://$S3_BUCKET/models/wan2.2/ /tmp/wan2.2/ --recursive --quiet

# ── Write prompts manifest ───────────────────────────────────────────────────
cat > /tmp/prompts.json << 'PROMPTS_EOF'
${beatsJson}
PROMPTS_EOF

mkdir -p /tmp/output

# ── Run Wan2.2 inference ─────────────────────────────────────────────────────
echo "[wan2] Running inference..."
python3 /tmp/wan2.2/generate_broll.py \\
  --prompts_json /tmp/prompts.json \\
  --output_dir /tmp/output/ \\
  --resolution $RESOLUTION \\
  --job_id $JOB_ID \\
  --model_dir /tmp/wan2.2/Wan2.2-T2V-A14B-FP8

# ── Push output segments to S3 ───────────────────────────────────────────────
echo "[wan2] Uploading segments..."
aws s3 cp /tmp/output/ \\
  s3://$S3_BUCKET/jobs/$JOB_ID/segments/wan2/ \\
  --recursive --quiet

# ── Write results manifest to S3 ─────────────────────────────────────────────
# generate_broll.py writes /tmp/output/manifest.json with segment S3 keys + durations
aws s3 cp /tmp/output/manifest.json \\
  s3://$S3_BUCKET/jobs/$JOB_ID/segments/wan2/manifest.json

# ── Signal completion via DynamoDB ────────────────────────────────────────────
echo "[wan2] Signaling completion..."
aws dynamodb update-item \\
  --region ${process.env.AWS_REGION ?? "us-east-1"} \\
  --table-name pipeline-jobs \\
  --key '{"jobId":{"S":"'$JOB_ID'"}}' \\
  --update-expression "SET wan2Status = :s, wan2CompletedAt = :t" \\
  --expression-attribute-values '{":s":{"S":"complete"},":t":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}'

echo "[wan2] Done. Shutting down."
shutdown -h now
`
  ).toString("base64");
}

// ─── EC2 Spot Launch ─────────────────────────────────────────────────────────

async function launchWan2Instance(
  jobId: string,
  input: Wan2InputType
): Promise<string> {
  const userData = buildUserData(jobId, input);

  const command = new RunInstancesCommand({
    ImageId: WAN2_AMI_ID,
    InstanceType: "g5.2xlarge",
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
          { Key: "Name", Value: `rrq-wan2-${jobId}` },
          { Key: "JobId", Value: jobId },
          { Key: "Worker", Value: "wan2" },
          { Key: "Project", Value: "rrq" },
        ],
      },
    ],
  });

  const response = await ec2.send(command);
  const instanceId = response.Instances?.[0]?.InstanceId;

  if (!instanceId) {
    throw new Error(`[wan2] EC2 launch failed — no instance ID returned`);
  }

  console.log(`[wan2][${jobId}] Launched instance ${instanceId}`);
  return instanceId;
}

// ─── Polling ─────────────────────────────────────────────────────────────────

async function pollUntilComplete(jobId: string): Promise<Wan2JobStatus> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const status = await getWan2Status(jobId);
    console.log(`[wan2][${jobId}] Status: ${status.status}`);

    if (status.status === "complete") return status;
    if (status.status === "failed") {
      throw new Error(
        `[wan2][${jobId}] Instance reported failure: ${status.errorMessage ?? "unknown"}`
      );
    }
  }

  throw new Error(
    `[wan2][${jobId}] Timed out after ${POLL_TIMEOUT_MS / 60000} minutes`
  );
}

// ─── Read output manifest from S3 ────────────────────────────────────────────

async function readWan2Manifest(
  jobId: string
): Promise<Wan2OutputType["segments"]> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getS3Client } = await import("@/lib/aws-clients");
  const s3 = getS3Client();

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `jobs/${jobId}/segments/wan2/manifest.json`,
    })
  );

  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error(`[wan2][${jobId}] Manifest not found in S3`);
  }

  const manifest = JSON.parse(body) as {
    segments: Wan2OutputType["segments"];
  };
  return manifest.segments;
}

// ─── Terminate instance (safety net) ─────────────────────────────────────────

async function terminateInstanceIfRunning(instanceId: string): Promise<void> {
  try {
    const describe = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );
    const state =
      describe.Reservations?.[0]?.Instances?.[0]?.State?.Name;

    if (state && !["terminated", "shutting-down"].includes(state)) {
      await ec2.send(
        new TerminateInstancesCommand({ InstanceIds: [instanceId] })
      );
      console.log(`[wan2] Force-terminated instance ${instanceId}`);
    }
  } catch (err) {
    // Non-fatal — instance may have already self-terminated
    console.warn(`[wan2] Could not terminate ${instanceId}:`, err);
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Runs a Wan2.2 spot instance for the given B-Roll beats.
 * Waits for completion, reads the output manifest, returns typed output.
 *
 * Failure mode: NON-CRITICAL.
 * On error, marks wan2Status=failed in DynamoDB, terminates the instance,
 * and returns { failed: true, segments: [] } — caller falls back to Pexels stock.
 * This function NEVER throws.
 */
export async function runWan2Instance(
  jobId: string,
  input: Wan2InputType
): Promise<Wan2OutputType> {
  if (!WAN2_AMI_ID) {
    console.warn(
      `[wan2][${jobId}] EC2_WAN2_AMI_ID is not set — skipping Wan2.2, falling back to stock`
    );
    return {
      segments: [],
      totalDurationMs: 0,
      instanceId: "unknown",
      renderTimeMs: 0,
      failed: true,
    };
  }

  const startMs = Date.now();
  let instanceId: string | undefined;

  try {
    instanceId = await launchWan2Instance(jobId, input);
    await markWan2Running(jobId, instanceId);

    const status = await pollUntilComplete(jobId);
    const segments = await readWan2Manifest(jobId);

    const renderTimeMs = status.renderTimeMs ?? Date.now() - startMs;
    const totalDurationMs = segments.reduce((s, seg) => s + seg.durationMs, 0);

    console.log(
      `[wan2][${jobId}] Complete — ${segments.length} segments, ${renderTimeMs}ms`
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
    await dynamo
      .send(
        new UpdateItemCommand({
          TableName: "pipeline-jobs",
          Key: { jobId: { S: jobId } },
          UpdateExpression: "SET wan2Status = :s, wan2Error = :e",
          ExpressionAttributeValues: {
            ":s": { S: "failed" },
            ":e": { S: String(err) },
          },
        })
      )
      .catch(() => {
        /* non-fatal — already in error path */
      });

    console.error(
      `[wan2][${jobId}] Failed (non-critical, falling back to stock):`,
      err
    );

    // NON-CRITICAL: return fallback result instead of throwing
    return {
      segments: [],
      totalDurationMs: 0,
      instanceId: instanceId ?? "unknown",
      renderTimeMs: Date.now() - startMs,
      failed: true,
    };
  }
}

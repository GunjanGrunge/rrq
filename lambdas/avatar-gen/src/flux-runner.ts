/**
 * flux-runner.ts
 *
 * EC2 spot instance launch and FLUX.1 [dev] portrait batch coordination.
 * Launches a g4dn.xlarge spot instance, runs generate_portraits.py,
 * waits for all portraits to be uploaded, then returns.
 *
 * Instance self-terminates after S3 upload + DynamoDB signaling is complete.
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
} from "@aws-sdk/client-dynamodb";

// ─── AWS Clients ──────────────────────────────────────────────────────────────

const ec2 = new EC2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// ─── Constants ────────────────────────────────────────────────────────────────

const S3_BUCKET           = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";
const FLUX_PORTRAIT_AMI   = process.env.EC2_FLUX_PORTRAIT_AMI_ID ?? "";
const EC2_ROLE_ARN        = process.env.EC2_ROLE_ARN ?? "";
const EC2_SUBNET_ID       = process.env.EC2_SUBNET_ID ?? "";
const EC2_SECURITY_GROUP  = process.env.EC2_SECURITY_GROUP_ID ?? "";
const AWS_REGION          = process.env.AWS_REGION ?? "us-east-1";

/** Maximum wait for portrait batch (~15 min for 4 presenters + overhead) */
const POLL_TIMEOUT_MS  = 20 * 60 * 1000;
/** Poll every 15 seconds */
const POLL_INTERVAL_MS = 15_000;

// ─── Presenter input type ─────────────────────────────────────────────────────

export interface FluxPresenterInput {
  presenterId:    string;
  seed:           number;
  base_prompt:    string;
  guidance_scale?: number;
  num_steps?:     number;
}

// ─── UserData bootstrap script ────────────────────────────────────────────────

function buildUserData(
  channelId: string,
  jobId: string,
  presenters: FluxPresenterInput[]
): string {
  const presentersJson = JSON.stringify(presenters).replace(/'/g, "'\\''");
  const presenterIds   = presenters.map(p => p.presenterId);

  return Buffer.from(
    `#!/bin/bash
set -euo pipefail
exec > /var/log/flux-portrait-bootstrap.log 2>&1

JOB_ID="${jobId}"
CHANNEL_ID="${channelId}"
S3_BUCKET="${S3_BUCKET}"
AWS_REGION="${AWS_REGION}"

echo "[flux-portrait] Starting job $JOB_ID for channel $CHANNEL_ID"

# ── Pull model weights + inference script from S3 ──────────────────────────
echo "[flux-portrait] Downloading model weights..."
aws s3 cp s3://$S3_BUCKET/models/flux-krea-dev/ /tmp/flux-krea-dev/ --recursive --quiet

# ── Write presenters manifest ──────────────────────────────────────────────
cat > /tmp/presenters.json << 'PRESENTERS_EOF'
${presentersJson}
PRESENTERS_EOF

mkdir -p /tmp/output

# ── Run FLUX inference ─────────────────────────────────────────────────────
echo "[flux-portrait] Running portrait generation..."
source /opt/flux-env/bin/activate
python3 /tmp/flux-krea-dev/generate_portraits.py \\
  --presenters_json /tmp/presenters.json \\
  --output_dir /tmp/output/ \\
  --model_dir /tmp/flux-krea-dev/ \\
  --channel_id $CHANNEL_ID \\
  --job_id $JOB_ID

# ── Upload portraits to S3 ─────────────────────────────────────────────────
echo "[flux-portrait] Uploading portraits to S3..."
${presenterIds.map(id => `aws s3 cp /tmp/output/${id}/ s3://$S3_BUCKET/avatars/dynamic/$CHANNEL_ID/${id}/ --recursive --quiet`).join("\n")}

# ── Upload manifest ────────────────────────────────────────────────────────
aws s3 cp /tmp/output/manifest.json \\
  s3://$S3_BUCKET/avatars/dynamic/$CHANNEL_ID/generation_manifest.json

# ── Signal DynamoDB: all presenters uploaded ───────────────────────────────
echo "[flux-portrait] Signaling upload completion to DynamoDB..."
${presenterIds
  .map(
    id => `aws dynamodb update-item \\
  --region $AWS_REGION \\
  --table-name avatar-profiles \\
  --key '{"channelId":{"S":"'$CHANNEL_ID'"},"presenterId":{"S":"${id}"}}' \\
  --update-expression "SET portraitStatus = :s, updatedAt = :t" \\
  --expression-attribute-values '{":s":{"S":"uploaded"},":t":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}'`
  )
  .join("\n")}

echo "[flux-portrait] Done. Shutting down."
shutdown -h now
`
  ).toString("base64");
}

// ─── EC2 spot launch ──────────────────────────────────────────────────────────

/**
 * Launches a g4dn.xlarge spot instance to run FLUX portrait generation.
 * Returns the instance ID immediately — use pollUntilPortraitsUploaded() to wait.
 */
export async function launchFluxInstance(
  channelId: string,
  presenters: FluxPresenterInput[],
  jobId: string
): Promise<string> {
  if (!FLUX_PORTRAIT_AMI) {
    throw new Error(
      "[flux-runner] EC2_FLUX_PORTRAIT_AMI_ID is not set — cannot launch portrait instance"
    );
  }

  const userData = buildUserData(channelId, jobId, presenters);

  const command = new RunInstancesCommand({
    ImageId:      FLUX_PORTRAIT_AMI,
    InstanceType: "g4dn.xlarge",
    MinCount:     1,
    MaxCount:     1,
    InstanceMarketOptions: {
      MarketType:  "spot",
      SpotOptions: {
        SpotInstanceType:              "one-time",
        InstanceInterruptionBehavior:  "terminate",
      },
    },
    IamInstanceProfile: { Arn: EC2_ROLE_ARN },
    SubnetId:           EC2_SUBNET_ID,
    SecurityGroupIds:   [EC2_SECURITY_GROUP],
    UserData:           userData,
    BlockDeviceMappings: [
      {
        DeviceName: "/dev/sda1",
        Ebs: {
          VolumeSize: 200,   // 200GB gp3 — model weights + output
          VolumeType: "gp3",
          DeleteOnTermination: true,
        },
      },
    ],
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          { Key: "Name",      Value: `rrq-flux-portrait-${jobId}` },
          { Key: "JobId",     Value: jobId },
          { Key: "ChannelId", Value: channelId },
          { Key: "Worker",    Value: "flux-portrait" },
          { Key: "Project",   Value: "rrq" },
        ],
      },
    ],
  });

  const response   = await ec2.send(command);
  const instanceId = response.Instances?.[0]?.InstanceId;

  if (!instanceId) {
    throw new Error(`[flux-runner][${jobId}] EC2 launch failed — no instance ID returned`);
  }

  console.log(
    `[flux-runner][${jobId}] Launched g4dn.xlarge spot instance ${instanceId} ` +
    `for ${presenters.length} portrait(s) (channelId=${channelId})`
  );

  return instanceId;
}

// ─── Poll until all portraits are uploaded ────────────────────────────────────

/**
 * Polls DynamoDB avatar-profiles until every presenter has portraitStatus = "uploaded".
 * Times out after POLL_TIMEOUT_MS.
 */
export async function pollUntilPortraitsUploaded(
  channelId: string,
  presenterIds: string[]
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const uploadedStatuses = await Promise.all(
      presenterIds.map(pid => getPortraitStatus(channelId, pid))
    );

    const allUploaded = uploadedStatuses.every(s => s === "uploaded");
    const anyFailed   = uploadedStatuses.some(s => s === "failed");

    if (anyFailed) {
      const failedIds = presenterIds.filter((_, i) => uploadedStatuses[i] === "failed");
      throw new Error(
        `[flux-runner] Portrait generation failed for: ${failedIds.join(", ")}`
      );
    }

    console.log(
      `[flux-runner] Portrait status: ${uploadedStatuses.join(", ")} ` +
      `(${uploadedStatuses.filter(s => s === "uploaded").length}/${presenterIds.length} uploaded)`
    );

    if (allUploaded) {
      console.log(`[flux-runner] All ${presenterIds.length} portraits uploaded.`);
      return;
    }
  }

  throw new Error(
    `[flux-runner] Timed out after ${POLL_TIMEOUT_MS / 60000}min waiting for portraits`
  );
}

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────

async function getPortraitStatus(
  channelId: string,
  presenterId: string
): Promise<string | undefined> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      ProjectionExpression: "portraitStatus",
    })
  );

  return result.Item?.portraitStatus?.S;
}

// ─── Safety net: terminate if still running ───────────────────────────────────

export async function terminateFluxInstanceIfRunning(
  instanceId: string
): Promise<void> {
  try {
    const describe = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );
    const state = describe.Reservations?.[0]?.Instances?.[0]?.State?.Name;

    if (state && !["terminated", "shutting-down"].includes(state)) {
      await ec2.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
      console.log(`[flux-runner] Force-terminated instance ${instanceId}`);
    }
  } catch (err) {
    // Non-fatal — instance may have already self-terminated
    console.warn(`[flux-runner] Could not terminate ${instanceId}: ${err}`);
  }
}

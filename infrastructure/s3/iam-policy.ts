// infrastructure/s3/iam-policy.ts
// IAM policy documents as plain JSON objects (no CDK).
// Attach these to the relevant Lambda execution roles and EC2 instance profiles
// via the AWS Console or CLI after running setup.ts.
//
// ARN formats use env vars so the same file works across regions/accounts.
// AWS_REGION and AWS_ACCOUNT_ID must be set in the environment.

const region = process.env.AWS_REGION ?? "us-east-1";
const accountId = process.env.AWS_ACCOUNT_ID ?? "REPLACE_WITH_ACCOUNT_ID";
const contentBucket = process.env.S3_BUCKET_NAME ?? "content-factory-assets";
const memoryBucket = process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory";

// ─── Helper ───────────────────────────────────────────────────────────────────

function dynamoArn(tableName: string): string {
  return `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`;
}

function dynamoGsiArn(tableName: string): string {
  return `${dynamoArn(tableName)}/index/*`;
}

// ─── Lambda S3 policy ─────────────────────────────────────────────────────────
// Lambda workers (audio-gen, visual-gen, av-sync, shorts-gen, uploader, code-agent)
// need read/write on job artifacts and read on static assets.

export const LAMBDA_S3_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "LambdaReadWriteJobArtifacts",
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/jobs/*`],
    },
    {
      Sid: "LambdaReadModels",
      Effect: "Allow",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/models/*`],
    },
    {
      Sid: "LambdaReadAvatars",
      Effect: "Allow",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/avatars/*`],
    },
    {
      Sid: "LambdaReadTmp",
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/tmp/*`],
    },
    {
      Sid: "LambdaListBucket",
      Effect: "Allow",
      Action: ["s3:ListBucket"],
      Resource: [`arn:aws:s3:::${contentBucket}`],
      Condition: {
        StringLike: {
          "s3:prefix": ["jobs/*", "models/*", "avatars/*", "tmp/*"],
        },
      },
    },
  ],
};

// ─── EC2 S3 policy ────────────────────────────────────────────────────────────
// EC2 GPU instances (SkyReels, Wan2.2, FLUX portrait) need:
//   - read model weights
//   - read static avatar references
//   - write job outputs + dynamic avatar portraits

export const EC2_S3_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "EC2ReadModels",
      Effect: "Allow",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/models/*`],
    },
    {
      Sid: "EC2ReadStaticAvatars",
      Effect: "Allow",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/avatars/*`],
    },
    {
      Sid: "EC2WriteJobOutputs",
      Effect: "Allow",
      Action: ["s3:PutObject", "s3:GetObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/jobs/*`],
    },
    {
      Sid: "EC2WriteDynamicAvatars",
      Effect: "Allow",
      Action: ["s3:PutObject"],
      Resource: [`arn:aws:s3:::${contentBucket}/avatars/dynamic/*`],
    },
    {
      Sid: "EC2ListBucket",
      Effect: "Allow",
      Action: ["s3:ListBucket"],
      Resource: [`arn:aws:s3:::${contentBucket}`],
      Condition: {
        StringLike: {
          "s3:prefix": ["models/*", "avatars/*", "jobs/*"],
        },
      },
    },
  ],
};

// ─── Lambda DynamoDB policy ───────────────────────────────────────────────────
// Lambda workers need access to the tables they read/write during job execution.

export const LAMBDA_DYNAMO_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "LambdaReadWritePipelineJobs",
      Effect: "Allow",
      Action: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ],
      Resource: [
        dynamoArn("production-jobs"),
        dynamoArn("pipeline-state"),
        dynamoArn("agent-decision-log"),
        dynamoGsiArn("production-jobs"),
        dynamoGsiArn("pipeline-state"),
        dynamoGsiArn("agent-decision-log"),
      ],
    },
    {
      Sid: "LambdaReadWriteAgentStatus",
      Effect: "Allow",
      Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
      Resource: [dynamoArn("agent-status")],
    },
    {
      Sid: "LambdaWriteNotifications",
      Effect: "Allow",
      Action: ["dynamodb:PutItem"],
      Resource: [dynamoArn("notifications")],
    },
    {
      Sid: "LambdaReadWriteElevenLabsUsage",
      Effect: "Allow",
      Action: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      Resource: [dynamoArn("elevenlabs-usage")],
    },
    {
      Sid: "LambdaReadUserSettings",
      Effect: "Allow",
      Action: ["dynamodb:GetItem"],
      Resource: [dynamoArn("user-settings"), dynamoArn("user-tokens")],
    },
    {
      Sid: "LambdaReadWriteAvatarProfiles",
      Effect: "Allow",
      Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
      Resource: [dynamoArn("avatar-profiles")],
    },
    {
      Sid: "LambdaReadAgentPolicies",
      Effect: "Allow",
      Action: ["dynamodb:GetItem", "dynamodb:Query"],
      Resource: [dynamoArn("agent-policies"), dynamoGsiArn("agent-policies")],
    },
  ],
};

// ─── EC2 DynamoDB policy ──────────────────────────────────────────────────────
// EC2 GPU instances only need to update job status fields.
// Narrow scope — they poll job queue and write completion status.

export const EC2_DYNAMO_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "EC2UpdateProductionJobs",
      Effect: "Allow",
      Action: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      Resource: [
        dynamoArn("production-jobs"),
        dynamoGsiArn("production-jobs"),
      ],
    },
    {
      Sid: "EC2ReadAgentPolicies",
      Effect: "Allow",
      Action: ["dynamodb:GetItem"],
      Resource: [dynamoArn("agent-policies")],
    },
  ],
};

// ─── Bedrock KB policy ────────────────────────────────────────────────────────
// Used by Zeus and agents that query/ingest the RRQ episodic memory KB.

export const BEDROCK_KB_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "BedrockKBRetrieve",
      Effect: "Allow",
      Action: ["bedrock:RetrieveAndGenerate", "bedrock:Retrieve"],
      Resource: [
        `arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`,
      ],
    },
    {
      Sid: "BedrockKBIngest",
      Effect: "Allow",
      Action: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"],
      Resource: [
        `arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`,
      ],
    },
    {
      Sid: "BedrockInvokeModel",
      Effect: "Allow",
      Action: ["bedrock:InvokeModel"],
      Resource: [
        `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-opus-4-5`,
        `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-sonnet-4-5`,
        `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-haiku-4-5-20251001`,
        `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`,
      ],
    },
    {
      Sid: "BedrockReadMemoryBucket",
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:ListBucket"],
      Resource: [
        `arn:aws:s3:::${memoryBucket}`,
        `arn:aws:s3:::${memoryBucket}/*`,
      ],
    },
    {
      Sid: "BedrockWriteMemoryBucket",
      Effect: "Allow",
      Action: ["s3:PutObject"],
      Resource: [`arn:aws:s3:::${memoryBucket}/episodes/*`],
    },
  ],
};

// ─── SES notification policy ──────────────────────────────────────────────────
// Agents (Zeus primarily) send stuck/failed/approval email via SES.

export const SES_SEND_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "SESSendEmail",
      Effect: "Allow",
      Action: ["ses:SendEmail", "ses:SendRawEmail"],
      Resource: [`arn:aws:ses:${process.env.SES_REGION ?? region}:${accountId}:identity/*`],
    },
  ],
};

// ─── Secrets Manager policy ───────────────────────────────────────────────────
// All workers read API keys from Secrets Manager, never from env vars directly.

export const SECRETS_MANAGER_POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "ReadRRQSecrets",
      Effect: "Allow",
      Action: ["secretsmanager:GetSecretValue"],
      Resource: [
        `arn:aws:secretsmanager:${region}:${accountId}:secret:rrq/*`,
      ],
    },
  ],
};

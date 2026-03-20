/**
 * AWS Client Singletons
 *
 * All AWS SDK clients used across lib/ are created here once.
 * Import from this file instead of instantiating new clients per-module.
 *
 * Why: AWS SDK clients hold connection pools and credential caches.
 * Creating 19+ instances wastes memory within a single Vercel invocation.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION ?? "us-east-1";

// ── DynamoDB ──────────────────────────────────────────────────────────────────

let _dynamo: DynamoDBClient | null = null;

export function getDynamoClient(): DynamoDBClient {
  if (!_dynamo) {
    _dynamo = new DynamoDBClient({ region: REGION });
  }
  return _dynamo;
}

// ── Bedrock Runtime ───────────────────────────────────────────────────────────

let _bedrock: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!_bedrock) {
    _bedrock = new BedrockRuntimeClient({ region: REGION });
  }
  return _bedrock;
}

// ── EC2 (lazy — @aws-sdk/client-ec2 installed in Phase 4) ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ec2: any = null;

export async function getEC2Client() {
  if (!_ec2) {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    _ec2 = new EC2Client({ region: REGION });
  }
  return _ec2;
}

// ── Lambda ────────────────────────────────────────────────────────────────────

let _lambda: LambdaClient | null = null;

export function getLambdaClient(): LambdaClient {
  if (!_lambda) {
    _lambda = new LambdaClient({ region: REGION });
  }
  return _lambda;
}

// ── S3 ────────────────────────────────────────────────────────────────────────

let _s3: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({ region: REGION });
  }
  return _s3;
}

// Re-export commands that are commonly imported alongside clients
export {
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
};

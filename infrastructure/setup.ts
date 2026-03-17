// infrastructure/setup.ts
// Master Phase 5 infrastructure provisioning script.
// Run once to create all DynamoDB tables, seed initial data, and create EventBridge rules.
//
// Usage:
//   npx ts-node --esm infrastructure/setup.ts
//   OR (from project root):
//   npm run infra:phase5
//
// Prerequisites:
//   - AWS credentials configured (IAM role or env vars: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
//   - AWS_REGION set (default: us-east-1)
//   - EVENTBRIDGE_INNGEST_TARGET_ARN set (Lambda or API GW ARN that forwards to Inngest)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { createAllTables } from "./dynamodb/create-tables";
import { seedAllTables } from "./dynamodb/seed";
import { createEventBridgeRules } from "./eventbridge/rules";

export async function setupPhase5Infrastructure(): Promise<void> {
  const region = process.env.AWS_REGION ?? "us-east-1";

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   RRQ Phase 5 — Infrastructure Setup             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Region: ${region}`);
  console.log("");

  // ── Validate required env vars ────────────────────────────────────────────
  const warnings: string[] = [];
  if (!process.env.AWS_REGION) {
    warnings.push("AWS_REGION not set — defaulting to us-east-1");
  }
  if (!process.env.EVENTBRIDGE_INNGEST_TARGET_ARN) {
    warnings.push(
      "EVENTBRIDGE_INNGEST_TARGET_ARN not set — EventBridge rules will be created without targets"
    );
  }
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  ⚠  ${w}`);
    console.log("");
  }

  // ── Initialize AWS clients ────────────────────────────────────────────────
  const dynamo = new DynamoDBClient({ region });
  const eb = new EventBridgeClient({ region });

  // ── Step 1: DynamoDB tables ───────────────────────────────────────────────
  console.log("[1/3] Creating DynamoDB tables...");
  await createAllTables(dynamo);
  console.log("");

  // ── Step 2: Seed data ─────────────────────────────────────────────────────
  console.log("[2/3] Seeding initial data...");
  await seedAllTables(dynamo);
  console.log("");

  // ── Step 3: EventBridge rules ─────────────────────────────────────────────
  console.log("[3/3] Creating EventBridge rules...");
  const targetArn = process.env.EVENTBRIDGE_INNGEST_TARGET_ARN ?? "";
  await createEventBridgeRules(eb, targetArn);
  console.log("");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Phase 5 Setup Complete                         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
  console.log("Manual steps remaining (cannot be scripted without CDK):");
  console.log("");
  console.log("  S3 Buckets (create in AWS Console or via CLI):");
  console.log(`    aws s3 mb s3://${process.env.S3_BUCKET_NAME ?? "content-factory-assets"} --region ${region}`);
  console.log(`    aws s3 mb s3://${process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory"} --region ${region}`);
  console.log(
    `    aws s3api put-bucket-versioning --bucket ${process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory"} --versioning-configuration Status=Enabled`
  );
  console.log("");
  console.log("  Bedrock Knowledge Base (AWS Console → Amazon Bedrock → Knowledge Bases):");
  console.log("    See infrastructure/bedrock/knowledge-base.ts for step-by-step instructions");
  console.log("    After creation: set BEDROCK_KB_ID + BEDROCK_DS_ID env vars");
  console.log("");
  console.log("  IAM Policies (attach to Lambda execution role + EC2 instance profile):");
  console.log("    infrastructure/s3/iam-policy.ts — LAMBDA_S3_POLICY, LAMBDA_DYNAMO_POLICY");
  console.log("    infrastructure/s3/iam-policy.ts — EC2_S3_POLICY, EC2_DYNAMO_POLICY");
  console.log("    infrastructure/s3/iam-policy.ts — BEDROCK_KB_POLICY (Zeus role)");
  console.log("");
  console.log("  EventBridge → Inngest wiring:");
  console.log("    1. Deploy a small Lambda bridge (eb-inngest-bridge)");
  console.log(
    "       that POSTs to: ${NEXT_PUBLIC_APP_URL}/api/inngest-trigger"
  );
  console.log("    2. Set EVENTBRIDGE_INNGEST_TARGET_ARN to that Lambda ARN");
  console.log("    3. Re-run: npx ts-node infrastructure/setup.ts");
  console.log("");
  console.log("  Verify setup:");
  console.log("    aws dynamodb list-tables --region", region);
  console.log("    aws events list-rules --region", region);
}

// ─── Direct execution ─────────────────────────────────────────────────────────
// Run with: npx ts-node --esm infrastructure/setup.ts

const isMain =
  process.argv[1] != null &&
  (process.argv[1].endsWith("setup.ts") || process.argv[1].endsWith("setup.js"));

if (isMain) {
  setupPhase5Infrastructure().catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
}

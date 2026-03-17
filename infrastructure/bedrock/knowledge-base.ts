// infrastructure/bedrock/knowledge-base.ts
// Bedrock Knowledge Base configuration for RRQ agent episodic memory.
// The KB indexes s3://rrq-memory/episodes/ via Amazon Titan Embeddings v2.
// Zeus writes episodes to S3; syncKnowledgeBase() triggers re-ingestion.

import {
  BedrockAgentClient,
  StartIngestionJobCommand,
  GetIngestionJobCommand,
} from "@aws-sdk/client-bedrock-agent";
import type {
  RetrieveCommandInput,
} from "@aws-sdk/client-bedrock-agent-runtime";

// ─── Knowledge Base configuration ────────────────────────────────────────────

export const BEDROCK_KB_CONFIG = {
  /** Human-readable name for the KB — used in AWS Console */
  name: "rrq-agent-memory",
  description:
    "RRQ agent episodic memory — lessons, decisions, and outcomes written by Zeus and indexed for all agents to query before major decisions.",

  /** IAM role ARN that Bedrock assumes to access S3 and OpenSearch */
  roleArn: process.env.BEDROCK_KB_ROLE_ARN ?? "",

  /** Embedding model — Titan v2 produces 1024-dim vectors */
  embeddingModel: "amazon.titan-embed-text-v2:0",

  /**
   * Vector store: Bedrock-managed OpenSearch Serverless.
   * Bedrock creates and manages the AOSS collection — no manual setup needed.
   */
  storageConfig: {
    type: "OPENSEARCH_SERVERLESS" as const,
  },

  /** Data source — S3 prefix for Zeus-written episode files */
  dataSourceConfig: {
    type: "S3" as const,
    bucketArn: `arn:aws:s3:::${process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory"}`,
    /** Only index episode files — exclude agent-versions/ etc. */
    inclusionPrefixes: ["episodes/"],
    chunkingStrategy: "FIXED_SIZE" as const,
    /** ~300 tokens per chunk balances retrieval precision with context */
    maxTokens: 300,
    overlapPercentage: 20,
  },
} as const;

// ─── KB retrieval input builder ───────────────────────────────────────────────

/**
 * Builds the input object for a Bedrock KB RetrieveCommand.
 * Agents call this before every major decision to load relevant past lessons.
 *
 * @param query   Natural-language question (e.g. "What worked for AI news topics?")
 * @param topK    Number of results to return (default: 5, max: 10)
 */
export function buildKBRetrievalInput(
  query: string,
  topK: number = 5
): RetrieveCommandInput {
  return {
    knowledgeBaseId: process.env.BEDROCK_KB_ID ?? "",
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: { numberOfResults: Math.min(topK, 10) },
    },
  };
}

// ─── KB sync ──────────────────────────────────────────────────────────────────

/**
 * Triggers a Bedrock KB ingestion job to re-index the S3 data source.
 * Zeus calls this after writing a new episode file to rrq-memory.
 *
 * @param kbId   Bedrock Knowledge Base ID (BEDROCK_KB_ID env var)
 * @param dsId   Bedrock Data Source ID (BEDROCK_DS_ID env var)
 */
export async function syncKnowledgeBase(kbId: string, dsId: string): Promise<void> {
  const client = new BedrockAgentClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  // Start ingestion job
  const { ingestionJob } = await client.send(
    new StartIngestionJobCommand({
      knowledgeBaseId: kbId,
      dataSourceId: dsId,
    })
  );

  if (!ingestionJob?.ingestionJobId) {
    throw new Error("Bedrock KB sync: no ingestionJobId returned");
  }

  const jobId = ingestionJob.ingestionJobId;
  console.log(`  Bedrock KB sync started — jobId: ${jobId}`);

  // Poll until COMPLETE or FAILED (max 5 minutes)
  const maxWaitMs = 5 * 60 * 1000;
  const pollIntervalMs = 10_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const { ingestionJob: job } = await client.send(
      new GetIngestionJobCommand({
        knowledgeBaseId: kbId,
        dataSourceId: dsId,
        ingestionJobId: jobId,
      })
    );

    const status = job?.status;
    if (status === "COMPLETE") {
      console.log(`  Bedrock KB sync complete — jobId: ${jobId}`);
      return;
    }
    if (status === "FAILED") {
      const reasons = job?.failureReasons?.join("; ") ?? "unknown";
      throw new Error(`Bedrock KB sync failed — jobId: ${jobId}, reasons: ${reasons}`);
    }

    console.log(`  Bedrock KB sync status: ${status ?? "UNKNOWN"} — waiting...`);
  }

  // Timed out — log warning but don't throw (sync will eventually complete async)
  console.warn(
    `  Bedrock KB sync timed out after ${maxWaitMs / 1000}s — jobId: ${jobId}. Sync continues in background.`
  );
}

// ─── Console setup instructions ──────────────────────────────────────────────
// Bedrock Knowledge Bases cannot be fully provisioned via SDK alone (no CreateKnowledgeBase
// in the public SDK as of this writing — it requires the AWS Console or CloudFormation).
//
// Manual steps to create the KB:
//
//  1. AWS Console → Amazon Bedrock → Knowledge Bases → Create
//  2. Name: "rrq-agent-memory"
//  3. IAM role: create new or use existing with the BEDROCK_KB_POLICY from iam-policy.ts
//  4. Embedding model: amazon.titan-embed-text-v2:0
//  5. Vector store: Amazon OpenSearch Serverless (Bedrock creates it automatically)
//  6. Data source → S3:
//       Bucket: rrq-memory
//       Prefix filter: episodes/
//       Chunking: Fixed size, 300 tokens, 20% overlap
//  7. Save KB ID → set BEDROCK_KB_ID env var
//  8. Save Data Source ID → set BEDROCK_DS_ID env var

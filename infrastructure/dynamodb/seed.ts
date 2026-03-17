// infrastructure/dynamodb/seed.ts
// Seeds required initial data into DynamoDB tables after creation.
// Run as part of setup.ts — safe to re-run (uses conditional writes where possible).

import {
  DynamoDBClient,
  BatchWriteItemCommand,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

// ─── Agent roster seed data ───────────────────────────────────────────────────

interface AgentSeedRecord {
  agentId: string;
  humanName: string;
  publicTitle: string;
  model: string;
}

const AGENT_STATUS_SEED: AgentSeedRecord[] = [
  {
    agentId: "zeus",
    humanName: "Marcus",
    publicTitle: "Chief Operating Officer",
    model: "Opus 4",
  },
  {
    agentId: "rex",
    humanName: "Hunter",
    publicTitle: "Head of Research & Intelligence",
    model: "Opus 4",
  },
  {
    agentId: "aria",
    humanName: "Sofia",
    publicTitle: "Portfolio Director",
    model: "Sonnet 4",
  },
  {
    agentId: "regum",
    humanName: "Victor",
    publicTitle: "Editorial Strategy Director",
    model: "Sonnet 4",
  },
  {
    agentId: "qeon",
    humanName: "Felix",
    publicTitle: "Head of Production",
    model: "Mixed",
  },
  {
    agentId: "muse",
    humanName: "Muse",
    publicTitle: "Video Architect",
    model: "Opus 4",
  },
  {
    agentId: "sniper",
    humanName: "Sniper",
    publicTitle: "Geo-Linguistic Strategist",
    model: "Sonnet 4",
  },
  {
    agentId: "oracle",
    humanName: "Oracle",
    publicTitle: "Learning & Development",
    model: "Sonnet 4",
  },
  {
    agentId: "theo",
    humanName: "Theo",
    publicTitle: "Channel Manager",
    model: "Sonnet 4",
  },
  {
    agentId: "jason",
    humanName: "Jason",
    publicTitle: "Scrum Master",
    model: "Sonnet 4",
  },
  {
    agentId: "vera",
    humanName: "Vera",
    publicTitle: "QA & Standards",
    model: "Haiku 4",
  },
  {
    agentId: "tony",
    humanName: "Tony",
    publicTitle: "Code Agent",
    model: "Haiku 4",
  },
  {
    agentId: "harvy",
    humanName: "Harvey",
    publicTitle: "ROI Analyst",
    model: "Sonnet 4",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Splits an array into chunks of at most `size` elements.
 * DynamoDB BatchWriteItem accepts at most 25 requests per call.
 */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── Seed functions ───────────────────────────────────────────────────────────

/**
 * Seeds the agent-status table with all 13 RRQ agents.
 * Each record is written with status = "IDLE".
 */
export async function seedAgentStatus(dynamoClient: DynamoDBClient): Promise<void> {
  const now = new Date().toISOString();

  const writeRequests: WriteRequest[] = AGENT_STATUS_SEED.map((agent) => ({
    PutRequest: {
      Item: marshall(
        {
          agentId: agent.agentId,
          humanName: agent.humanName,
          publicTitle: agent.publicTitle,
          model: agent.model,
          status: "IDLE",
          currentJobId: null,
          lastActiveAt: null,
          totalJobsCompleted: 0,
          totalJobsFailed: 0,
          createdAt: now,
          updatedAt: now,
        },
        { removeUndefinedValues: true }
      ),
    },
  }));

  // DynamoDB BatchWrite max 25 items per call
  for (const batch of chunks(writeRequests, 25)) {
    await dynamoClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          "agent-status": batch,
        },
      })
    );
  }

  console.log(`  ✓ agent-status: seeded ${AGENT_STATUS_SEED.length} agents`);
}

/**
 * Seeds default RRQ trigger state for a placeholder "system" channel.
 * Real channels will overwrite this on onboarding.
 */
export async function seedRrqState(dynamoClient: DynamoDBClient): Promise<void> {
  const now = new Date().toISOString();

  const writeRequests: WriteRequest[] = [
    {
      PutRequest: {
        Item: marshall({
          channelId: "system",
          triggerMode: "MANUAL",
          lastRunAt: null,
          queueDepth: 0,
          sourceRotationIndex: 0,
          createdAt: now,
          updatedAt: now,
        }),
      },
    },
  ];

  await dynamoClient.send(
    new BatchWriteItemCommand({
      RequestItems: { rrq_state: writeRequests },
    })
  );

  console.log("  ✓ rrq_state: seeded system placeholder");
}

/**
 * Seeds Rex signal source weights with equal starting weights.
 * Rex will update these over time based on clip performance.
 */
export async function seedSourceWeights(dynamoClient: DynamoDBClient): Promise<void> {
  const now = new Date().toISOString();

  const sources = [
    "youtube_trending",
    "reddit_rising",
    "twitter_trending",
    "google_trends",
    "news_api",
    "tiktok_creative_center",
  ];

  const writeRequests: WriteRequest[] = sources.map((sourceId) => ({
    PutRequest: {
      Item: marshall({
        sourceId,
        avgConfidence: 0.5,
        clipPerformanceScore: 0.5,
        combinedWeight: 0.5,
        sampleCount: 0,
        createdAt: now,
        updatedAt: now,
      }),
    },
  }));

  await dynamoClient.send(
    new BatchWriteItemCommand({
      RequestItems: { source_weights: writeRequests },
    })
  );

  console.log(`  ✓ source_weights: seeded ${sources.length} signal sources`);
}

// ─── Master seed entry point ──────────────────────────────────────────────────

/**
 * Runs all seed functions in sequence.
 * Safe to call multiple times — seeds use PutRequest which overwrites on re-run.
 */
export async function seedAllTables(dynamoClient: DynamoDBClient): Promise<void> {
  console.log("  Seeding agent-status...");
  await seedAgentStatus(dynamoClient);

  console.log("  Seeding rrq_state...");
  await seedRrqState(dynamoClient);

  console.log("  Seeding source_weights...");
  await seedSourceWeights(dynamoClient);

  console.log("  All seed data written.");
}

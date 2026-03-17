// infrastructure/dynamodb/create-tables.ts
// Provisions all DynamoDB tables defined in tables.ts.
// Handles ResourceInUseException gracefully (table already exists = skip).
// After creating each table, polls DescribeTable until ACTIVE (max 60s).

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
  type CreateTableCommandInput,
  type GlobalSecondaryIndex,
  type AttributeDefinition,
  type KeySchemaElement,
} from "@aws-sdk/client-dynamodb";
import { DYNAMO_TABLES, type DynamoTableConfig } from "./tables";

// ─── Table builder helpers ────────────────────────────────────────────────────

/**
 * Converts our DynamoTableConfig into a CreateTableCommandInput.
 * Collects all attribute definitions from PK, SK, and GSI keys (no duplicates).
 */
function buildCreateInput(config: DynamoTableConfig): CreateTableCommandInput {
  const attributeMap = new Map<string, "S" | "N" | "B">();
  const keySchema: KeySchemaElement[] = [];

  // Partition key
  attributeMap.set(config.partitionKey.name, config.partitionKey.type);
  keySchema.push({ AttributeName: config.partitionKey.name, KeyType: "HASH" });

  // Sort key (optional)
  if (config.sortKey) {
    attributeMap.set(config.sortKey.name, config.sortKey.type);
    keySchema.push({ AttributeName: config.sortKey.name, KeyType: "RANGE" });
  }

  // GSI keys
  const globalSecondaryIndexes: GlobalSecondaryIndex[] = [];
  if (config.gsi && config.gsi.length > 0) {
    for (const gsi of config.gsi) {
      attributeMap.set(gsi.partitionKey.name, gsi.partitionKey.type);
      const gsiKeySchema: KeySchemaElement[] = [
        { AttributeName: gsi.partitionKey.name, KeyType: "HASH" },
      ];
      if (gsi.sortKey) {
        attributeMap.set(gsi.sortKey.name, gsi.sortKey.type);
        gsiKeySchema.push({ AttributeName: gsi.sortKey.name, KeyType: "RANGE" });
      }
      globalSecondaryIndexes.push({
        IndexName: gsi.indexName,
        KeySchema: gsiKeySchema,
        Projection: { ProjectionType: gsi.projectionType },
      });
    }
  }

  const attributeDefinitions: AttributeDefinition[] = Array.from(attributeMap.entries()).map(
    ([name, type]) => ({ AttributeName: name, AttributeType: type })
  );

  const input: CreateTableCommandInput = {
    TableName: config.tableName,
    KeySchema: keySchema,
    AttributeDefinitions: attributeDefinitions,
    BillingMode: "PAY_PER_REQUEST",
    ...(globalSecondaryIndexes.length > 0 && {
      GlobalSecondaryIndexes: globalSecondaryIndexes,
    }),
    ...(config.streamEnabled && {
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: "NEW_AND_OLD_IMAGES",
      },
    }),
    ...(config.ttlAttribute && {
      // TTL must be enabled separately via UpdateTimeToLive after table creation,
      // but we store the attribute name here for reference.
      // See: enableTtl() called after create.
    }),
  };

  return input;
}

// ─── TTL enablement ───────────────────────────────────────────────────────────

async function enableTtl(
  dynamoClient: DynamoDBClient,
  tableName: string,
  ttlAttribute: string
): Promise<void> {
  const { UpdateTimeToLiveCommand } = await import("@aws-sdk/client-dynamodb");
  try {
    await dynamoClient.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: ttlAttribute,
        },
      })
    );
  } catch (err: unknown) {
    // ValidationException is thrown if TTL is already enabled — safe to ignore
    const error = err as { name?: string; message?: string };
    if (error.name === "ValidationException" && error.message?.includes("already enabled")) {
      return;
    }
    throw err;
  }
}

// ─── Wait for ACTIVE ──────────────────────────────────────────────────────────

async function waitForActive(
  dynamoClient: DynamoDBClient,
  tableName: string,
  maxWaitMs = 60_000
): Promise<void> {
  const pollIntervalMs = 2_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const { Table } = await dynamoClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    if (Table?.TableStatus === "ACTIVE") return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Table ${tableName} did not become ACTIVE within ${maxWaitMs}ms`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates all tables defined in DYNAMO_TABLES.
 * Skips tables that already exist (ResourceInUseException).
 * Waits for each table to become ACTIVE before moving on.
 */
export async function createAllTables(dynamoClient: DynamoDBClient): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const config of DYNAMO_TABLES) {
    const input = buildCreateInput(config);

    try {
      await dynamoClient.send(new CreateTableCommand(input));
      console.log(`    + created: ${config.tableName}`);

      // Wait for the table to be ready
      await waitForActive(dynamoClient, config.tableName);

      // Enable TTL if required (must be done after ACTIVE)
      if (config.ttlAttribute) {
        await enableTtl(dynamoClient, config.tableName, config.ttlAttribute);
        console.log(`      TTL enabled on '${config.ttlAttribute}'`);
      }

      created++;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "ResourceInUseException") {
        console.log(`    ~ exists:  ${config.tableName} (skipped)`);
        skipped++;
      } else {
        console.error(`    ✗ failed:  ${config.tableName}`, err);
        throw err;
      }
    }
  }

  console.log(
    `  DynamoDB tables: ${created} created, ${skipped} already existed, ${DYNAMO_TABLES.length} total`
  );
}

/**
 * Deletes a single table by name.
 * Used for dev environment resets — do NOT call in production.
 */
export async function dropTable(
  dynamoClient: DynamoDBClient,
  tableName: string
): Promise<void> {
  try {
    await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
    console.log(`  Dropped table: ${tableName}`);
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === "ResourceNotFoundException") {
      console.log(`  Table not found (already gone): ${tableName}`);
    } else {
      throw err;
    }
  }
}

/**
 * Drops ALL tables defined in DYNAMO_TABLES.
 * DEV USE ONLY — irreversible data loss.
 */
export async function dropAllTables(dynamoClient: DynamoDBClient): Promise<void> {
  console.warn("WARNING: Dropping ALL tables. This is irreversible.");
  for (const config of DYNAMO_TABLES) {
    await dropTable(dynamoClient, config.tableName);
  }
}

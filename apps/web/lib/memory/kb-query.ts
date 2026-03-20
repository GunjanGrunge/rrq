import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const kbClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

/**
 * Query the RRQ agent memory Knowledge Base.
 * Returns top-K relevant past lessons/episodes.
 * Used by every agent before making decisions.
 */
export async function queryAgentMemory(
  query: string,
  topK: number = 5
): Promise<Array<{ text: string; score: number; sourceUri: string }>> {
  const knowledgeBaseId = process.env.BEDROCK_KB_ID;
  if (!knowledgeBaseId) {
    console.warn("[memory] BEDROCK_KB_ID not set — skipping KB query");
    return [];
  }

  try {
    const response = await kbClient.send(
      new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: topK },
        },
      })
    );

    return (response.retrievalResults ?? []).map((r) => ({
      text: r.content?.text ?? "",
      score: r.score ?? 0,
      sourceUri: r.location?.s3Location?.uri ?? "",
    }));
  } catch (err) {
    console.error("[memory] KB query failed:", err);
    return [];
  }
}

/**
 * Write a new episode to S3 (rrq-memory bucket).
 * After writing, call syncKnowledgeBase() to re-index.
 * Zeus is the only agent that writes episodes.
 */
export async function writeEpisode(
  agentId: string,
  episodeId: string,
  content: {
    decision: string;
    context: string;
    outcome: string;
    lesson: string;
    signalType: "HIGH_CONFIDENCE_SIGNAL" | "STANDARD_LESSON" | "WARNING" | "CORRECTION";
  }
): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getS3Client } = await import("@/lib/aws-clients");
  const s3 = getS3Client();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const s3Key = `episodes/${agentId}/${year}/${month}/${episodeId}.json`;

  const episode = {
    episodeId,
    agentId,
    createdAt: now.toISOString(),
    ...content,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory",
      Key: s3Key,
      Body: JSON.stringify(episode, null, 2),
      ContentType: "application/json",
    })
  );

  console.log(`[memory] Episode written: ${s3Key}`);
  return s3Key;
}

/**
 * Trigger Bedrock KB re-sync after new episodes are written.
 * Call after writeEpisode() to make new lessons queryable.
 */
export async function syncKnowledgeBase(): Promise<void> {
  const kbId = process.env.BEDROCK_KB_ID;
  const dsId = process.env.BEDROCK_DS_ID;

  if (!kbId || !dsId) {
    console.warn("[memory] BEDROCK_KB_ID or BEDROCK_DS_ID not set — skipping KB sync");
    return;
  }

  const { BedrockAgentClient, StartIngestionJobCommand } = await import(
    "@aws-sdk/client-bedrock-agent"
  );
  const client = new BedrockAgentClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  await client.send(
    new StartIngestionJobCommand({
      knowledgeBaseId: kbId,
      dataSourceId: dsId,
    })
  );

  console.log("[memory] KB sync job started");
}

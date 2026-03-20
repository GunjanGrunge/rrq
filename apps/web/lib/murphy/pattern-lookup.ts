import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import type { MurphyPattern } from "./types";

const db = getDynamoClient();

const kbClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

// ─── Step 2: DynamoDB token-overlap lookup ────────────────────────────────────

export async function loadActivePatterns(): Promise<MurphyPattern[]> {
  try {
    const result = await db.send(
      new QueryCommand({
        TableName: "murphy-patterns",
        IndexName: "category-status",
        KeyConditionExpression: "#st = :active",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":active": { S: "ACTIVE" } },
      })
    );
    return (result.Items ?? []).map(i => unmarshall(i) as MurphyPattern);
  } catch (err) {
    console.error("[murphy:pattern-lookup] Failed to load active patterns:", err);
    return [];
  }
}

export interface PatternMatch {
  pattern:    MurphyPattern;
  confidence: number;
  arcMatch:   boolean;  // true if arcContext condition was checked and matched
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[3@$1!0]/g, c => ({ "3": "e", "@": "a", "$": "s", "1": "i", "!": "i", "0": "o" }[c] ?? c));
}

function tokenOverlap(normalisedMessage: string, triggerTokens: string[]): number {
  if (triggerTokens.length === 0) return 0;
  const msgTokens = new Set(normalisedMessage.split(/\s+/).filter(w => w.length > 2));
  const hits = triggerTokens.filter(t => normalisedMessage.includes(t.toLowerCase())).length;
  return hits / triggerTokens.length;
}

export function checkPatternDynamoDB(
  normalisedMessage: string,
  sessionArcText: string,
  activePatterns: MurphyPattern[]
): PatternMatch | null {
  for (const pattern of activePatterns) {
    const overlap = tokenOverlap(normalisedMessage, pattern.triggerTokens);
    if (overlap < 0.6) continue;

    // If pattern has arcContext, verify arc contains qualifier tokens
    if (pattern.arcContext) {
      const arcTokens = pattern.arcContext.split(/[,\s]+/).filter(Boolean);
      const arcContainsContext = arcTokens.some(t =>
        sessionArcText.toLowerCase().includes(t.toLowerCase())
      );
      if (!arcContainsContext) continue;
    }

    return {
      pattern,
      confidence: Math.min(overlap, 1),
      arcMatch: !!pattern.arcContext,
    };
  }
  return null;
}

// ─── Step 5: murphy-knowledge-base semantic search ────────────────────────────

export interface KBMatch {
  text:       string;
  score:      number;
  sourceUri:  string;
}

export async function searchMurphyKB(
  normalisedMessage: string,
  sessionContext: string
): Promise<KBMatch[]> {
  const kbId = process.env.MURPHY_KB_ID;
  if (!kbId) {
    console.warn("[murphy:pattern-lookup] MURPHY_KB_ID not set — skipping KB search");
    return [];
  }

  try {
    const query = `${normalisedMessage}\n\nConversation context: ${sessionContext}`.slice(0, 500);
    const response = await kbClient.send(
      new RetrieveCommand({
        knowledgeBaseId: kbId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: 3 },
        },
      })
    );
    return (response.retrievalResults ?? []).map(r => ({
      text:      r.content?.text ?? "",
      score:     r.score ?? 0,
      sourceUri: r.location?.s3Location?.uri ?? "",
    }));
  } catch (err) {
    console.error("[murphy:pattern-lookup] KB search failed:", err);
    return [];
  }
}

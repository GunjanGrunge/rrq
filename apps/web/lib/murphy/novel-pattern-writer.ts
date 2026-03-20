import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getS3Client } from "@/lib/aws-clients";
import type { NovelPattern, SessionMessage } from "./types";

const db = getDynamoClient();
const s3 = getS3Client();
const MEMORY_BUCKET = process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory";

// ─── Write novel pattern to DynamoDB (PENDING_ORACLE) + S3 conversation ───────

export async function writeNovelPattern(
  draft: NovelPattern,
  userId: string,
  sessionId: string,
  sessionMessages: SessionMessage[],
  murphyVersion: string
): Promise<void> {
  const now = new Date().toISOString();

  // Write to murphy-patterns (status: PENDING_ORACLE — awaits Oracle Domain 15 approval)
  try {
    await db.send(
      new PutItemCommand({
        TableName: "murphy-patterns",
        Item: marshall(
          {
            ...draft,
            status:     "PENDING_ORACLE",
            version:    murphyVersion,
            createdFrom: "HAIKU_NOVEL",
            createdAt:  now,
            approvedAt: null,
            approvedBy: null,
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  } catch (err) {
    console.error(`[murphy:novel-pattern-writer:${draft.patternId}] DynamoDB write failed:`, err);
  }

  // Write full conversation to S3 for murphy-knowledge-base indexing
  try {
    const s3Key = `murphy/flagged-conversations/${draft.patternId}.json`;
    const payload = {
      patternId:     draft.patternId,
      intentLabel:   draft.intentLabel,
      category:      draft.category,
      confidence:    draft.confidence,
      userId,
      sessionId,
      flaggedAt:     now,
      conversation:  sessionMessages.map(m => ({ text: m.text, timestamp: m.timestamp })),
    };

    await s3.send(
      new PutObjectCommand({
        Bucket:      MEMORY_BUCKET,
        Key:         s3Key,
        Body:        JSON.stringify(payload, null, 2),
        ContentType: "application/json",
      })
    );
  } catch (err) {
    console.error(`[murphy:novel-pattern-writer:${draft.patternId}] S3 write failed:`, err);
  }
}

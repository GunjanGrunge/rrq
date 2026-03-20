import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import type { QeonBrief } from "@/lib/regum/types";

const db = getDynamoClient();
const TABLE = "production-jobs";

// ─── Fetch QeonBrief by ID ────────────────────────────────────────────────────

export async function getQeonBriefById(briefId: string): Promise<QeonBrief> {
  const result = await db.send(
    new GetItemCommand({
      TableName: TABLE,
      Key: marshall({ pk: "JOB", sk: briefId }),
    })
  );
  if (!result.Item) {
    throw new Error(`[qeon:job-state] Brief not found: ${briefId}`);
  }
  return unmarshall(result.Item) as QeonBrief;
}

// ─── Update step progress ─────────────────────────────────────────────────────

export async function updateJobStep(
  briefId: string,
  step: number,
  stepName: string,
  status: "in_progress" | "complete" | "failed",
  data?: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: "JOB", sk: briefId }),
        UpdateExpression:
          "SET #currentStep = :step, #currentStepName = :stepName, #stepStatus = :status, lastUpdatedAt = :now" +
          (data ? ", lastStepData = :data" : ""),
        ExpressionAttributeNames: {
          "#currentStep": "currentStep",
          "#currentStepName": "currentStepName",
          "#stepStatus": "stepStatus",
        },
        ExpressionAttributeValues: marshall({
          ":step": step,
          ":stepName": stepName,
          ":status": status,
          ":now": now,
          ...(data ? { ":data": JSON.stringify(data) } : {}),
        }),
      })
    );
  } catch (err) {
    console.error(`[qeon:job-state:${briefId}] updateJobStep failed:`, err);
  }
}

// ─── Mark job complete ────────────────────────────────────────────────────────

export async function markJobComplete(
  briefId: string,
  videoId: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: "JOB", sk: briefId }),
        UpdateExpression:
          "SET #status = :status, videoId = :videoId, completedAt = :now, lastUpdatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": "complete",
          ":videoId": videoId,
          ":now": now,
        }),
      })
    );
  } catch (err) {
    console.error(`[qeon:job-state:${briefId}] markJobComplete failed:`, err);
  }
}

// ─── Mark job failed ──────────────────────────────────────────────────────────

export async function markJobFailed(
  briefId: string,
  failedStep: string,
  error: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: "JOB", sk: briefId }),
        UpdateExpression:
          "SET #status = :status, failedStep = :failedStep, failureReason = :error, failedAt = :now, lastUpdatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": "failed",
          ":failedStep": failedStep,
          ":error": error.slice(0, 500),
          ":now": now,
        }),
      })
    );
  } catch (err) {
    console.error(`[qeon:job-state:${briefId}] markJobFailed failed:`, err);
  }
}

// ─── Update job status ────────────────────────────────────────────────────────

export async function updateJobStatus(
  briefId: string,
  status: QeonBrief["status"]
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ pk: "JOB", sk: briefId }),
        UpdateExpression: "SET #status = :status, lastUpdatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": status,
          ":now": now,
        }),
      })
    );
  } catch (err) {
    console.error(`[qeon:job-state:${briefId}] updateJobStatus failed:`, err);
  }
}

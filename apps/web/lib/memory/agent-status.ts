import { UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";

const dynamo = getDynamoClient();

export type AgentStatusValue = "IDLE" | "RUNNING" | "STUCK" | "ERROR" | "DISABLED";

export async function setAgentStatus(
  agentId: string,
  status: AgentStatusValue,
  detail?: string
): Promise<void> {
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: "agent-status",
        Key: { agentId: { S: agentId } },
        UpdateExpression: "SET #s = :s, updatedAt = :t" + (detail ? ", statusDetail = :d" : ""),
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": { S: status },
          ":t": { S: new Date().toISOString() },
          ...(detail ? { ":d": { S: detail } } : {}),
        },
      })
    );
  } catch (err) {
    console.error(`[agent-status:${agentId}] Failed to set status=${status}:`, err);
    // Don't throw — status updates are best-effort, don't block agent work
  }
}

export async function getAgentStatus(agentId: string): Promise<AgentStatusValue> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "agent-status",
      Key: { agentId: { S: agentId } },
      ProjectionExpression: "#s",
      ExpressionAttributeNames: { "#s": "status" },
    })
  );
  return (result.Item?.status?.S as AgentStatusValue) ?? "IDLE";
}

export async function getAllAgentStatuses(): Promise<Record<string, AgentStatusValue>> {
  const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
  const result = await dynamo.send(
    new ScanCommand({
      TableName: "agent-status",
      ProjectionExpression: "agentId, #s",
      ExpressionAttributeNames: { "#s": "status" },
    })
  );
  const statuses: Record<string, AgentStatusValue> = {};
  for (const item of result.Items ?? []) {
    if (item.agentId?.S && item.status?.S) {
      statuses[item.agentId.S] = item.status.S as AgentStatusValue;
    }
  }
  return statuses;
}

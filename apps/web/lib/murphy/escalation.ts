import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import { sendAgentMessage } from "@/lib/mission/messaging";

const db = getDynamoClient();

// ─── Write SAFETY_ESCALATION to agent-messages bus ───────────────────────────

export async function writeSafetyEscalation(
  userId: string,
  sessionId: string,
  arcScore: number,
  trigger: string,
  conversationSummary: string,
  recommendedAction: "WARN" | "BLOCK" | "MONITOR",
  murphyVersion: string
): Promise<void> {
  try {
    await sendAgentMessage("MURPHY", "ZEUS", "SAFETY_ESCALATION", {
      userId,
      sessionId,
      arcScore,
      trigger,
      conversationSummary,
      recommendedAction,
      murphyVersion,
    });
  } catch (err) {
    console.error(`[murphy:escalation:${sessionId}] Failed to write SAFETY_ESCALATION:`, err);
  }
}

// ─── Read pending ZEUS_ESCALATION_DECISION for this session ──────────────────

export interface ZeusEscalationDecision {
  decision:  "WARN_USER" | "CONTINUE_MONITORING" | "RETROACTIVE_BLOCK";
  sessionId: string;
  userId:    string;
  reason:    string;
}

export async function readPendingZeusDecision(
  sessionId: string
): Promise<ZeusEscalationDecision | null> {
  try {
    // agent-messages: PK=messageId, GSI by recipient+type — scan is acceptable
    // since this only fires on message load, not on every evaluation
    const result = await db.send(
      new QueryCommand({
        TableName: "agent-messages",
        IndexName: "to-type-index",
        KeyConditionExpression: "#to = :murphy AND #type = :type",
        FilterExpression: "payload.sessionId = :sessionId AND #read = :unread",
        ExpressionAttributeNames: {
          "#to":   "to",
          "#type": "type",
          "#read": "read",
        },
        ExpressionAttributeValues: {
          ":murphy":    { S: "MURPHY" },
          ":type":      { S: "ZEUS_ESCALATION_DECISION" },
          ":sessionId": { S: sessionId },
          ":unread":    { BOOL: false },
        },
        Limit: 1,
      })
    );

    const item = result.Items?.[0];
    if (!item) return null;

    const msg = unmarshall(item);
    return msg.payload as ZeusEscalationDecision;
  } catch (err) {
    console.error(`[murphy:escalation:${sessionId}] Failed to read Zeus decision:`, err);
    return null;
  }
}

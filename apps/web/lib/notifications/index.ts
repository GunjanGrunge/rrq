import { getDynamoClient } from "@/lib/aws-clients";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendNotification(input: NotificationInput): Promise<void> {
  const dynamo = getDynamoClient();
  const notificationId = randomUUID();

  try {
    await dynamo.send(
      new PutCommand({
        TableName: "notifications",
        Item: {
          notificationId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data ?? {},
          read: false,
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    console.error(`[notifications:send] DynamoDB write failed:`, err);
    // Non-fatal — notification failure should never block pipeline
  }
}

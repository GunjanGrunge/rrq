import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDynamoClient } from "@/lib/aws-clients";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { RetroSession } from "@/lib/retro/types";

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");

  const dynamo = getDynamoClient();

  try {
    if (videoId) {
      // Lookup by videoId — scan with filter (small table)
      const result = await dynamo.send(
        new ScanCommand({
          TableName: "retro-sessions",
          FilterExpression: "videoId = :videoId",
          ExpressionAttributeValues: { ":videoId": videoId },
          Limit: 1,
        })
      );
      const session = result.Items?.[0] as RetroSession | undefined;
      if (!session) {
        return NextResponse.json({ status: "not_started", videoId });
      }
      return NextResponse.json({ session });
    }

    // Return all active (non-completed) retro sessions
    const result = await dynamo.send(
      new ScanCommand({
        TableName: "retro-sessions",
        FilterExpression: "#status <> :completed",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":completed": "COMPLETED" },
        Limit: 20,
      })
    );

    const sessions = (result.Items ?? []) as RetroSession[];
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[api/retro/status] Failed:", err);
    // Graceful empty response if table not provisioned
    return NextResponse.json({ sessions: [] });
  }
}

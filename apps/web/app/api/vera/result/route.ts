import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDynamoClient } from "@/lib/aws-clients";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { VeraQAResult } from "@/lib/vera/types";

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  try {
    const dynamo = getDynamoClient();
    const result = await dynamo.send(
      new GetCommand({
        TableName: "production-jobs",
        Key: { jobId },
        ProjectionExpression: "jobId, veraQAResult, veraStatus, veraCompletedAt",
      })
    );

    if (!result.Item) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const veraResult = result.Item.veraQAResult as VeraQAResult | undefined;
    if (!veraResult) {
      return NextResponse.json({ status: "pending", jobId });
    }

    return NextResponse.json({ result: veraResult });
  } catch (err) {
    console.error(`[api/vera/result:${jobId}] Failed:`, err);
    return NextResponse.json(
      { error: "Failed to load Vera result" },
      { status: 500 }
    );
  }
}

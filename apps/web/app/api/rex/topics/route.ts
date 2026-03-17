import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPendingTopics } from "@/lib/rex/topic-queue";

export async function GET(req: NextRequest) {
  void req; // userId from auth header, no query params needed
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topics = await getPendingTopics(userId);
  return NextResponse.json({ topics });
}

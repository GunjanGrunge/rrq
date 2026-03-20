import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import type { MurphySession, SessionMessage } from "./types";

const db = getDynamoClient();
const TABLE = "murphy-sessions";
const MAX_MESSAGES = 20;
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function loadSession(sessionId: string): Promise<MurphySession | null> {
  try {
    const result = await db.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: { sessionId: { S: sessionId } },
      })
    );
    if (!result.Item) return null;
    return unmarshall(result.Item) as MurphySession;
  } catch (err) {
    console.error(`[murphy:session:${sessionId}] Load failed:`, err);
    return null;
  }
}

export async function updateSession(
  sessionId: string,
  userId: string,
  newMessage: SessionMessage,
  newArcScore: number,
  watchFlag: boolean
): Promise<void> {
  try {
    // Load existing to preserve sliding window
    const existing = await loadSession(sessionId);
    const existingMessages: SessionMessage[] = existing?.messages ?? [];

    // FIFO: append new, trim to MAX_MESSAGES
    const messages = [...existingMessages, newMessage].slice(-MAX_MESSAGES);

    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    const session: MurphySession & { ttl: number } = {
      sessionId,
      userId,
      messages,
      arcScore: newArcScore,
      watchFlag,
      lastEvaluatedAt: now,
      ttl,
    };

    await db.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: marshall(session, { removeUndefinedValues: true }),
      })
    );
  } catch (err) {
    console.error(`[murphy:session:${sessionId}] Update failed:`, err);
  }
}

export function getSessionBaseline(session: MurphySession | null): number {
  if (!session || session.messages.length === 0) return 0;
  const scores = session.messages.slice(0, 3).map(m => m.harmScore);
  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

export function getLastNMessages(session: MurphySession | null, n: number): SessionMessage[] {
  if (!session) return [];
  return session.messages.slice(-n);
}

export function getSessionArcText(session: MurphySession | null): string {
  if (!session) return "";
  return session.messages.map(m => m.text).join(" ");
}

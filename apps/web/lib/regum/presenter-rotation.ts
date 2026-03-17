import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/lib-dynamodb";
import { sendAgentMessage } from "@/lib/mission/messaging";
import type { AvatarProfile } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export async function getAvatarRoster(): Promise<AvatarProfile[]> {
  const result = await db.send(
    new ScanCommand({ TableName: "avatar-profiles" })
  );
  return (result.Items ?? []).map(i => unmarshall(i) as AvatarProfile);
}

export async function getRecentPresenterHistory(limit = 5): Promise<string[]> {
  // Read last N entries from regum-schedule by timestamp desc
  const result = await db.send(
    new ScanCommand({
      TableName: "regum-schedule",
      ProjectionExpression: "presenterId, #ts",
      ExpressionAttributeNames: { "#ts": "timestamp" },
    })
  );
  const sorted = (result.Items ?? [])
    .map(i => unmarshall(i))
    .filter(i => i.presenterId)
    .sort((a, b) => (b.timestamp as string).localeCompare(a.timestamp as string))
    .slice(0, limit);
  return sorted.map(i => i.presenterId as string);
}

export function selectPresenter(
  contentType: string,
  roster: AvatarProfile[],
  recentHistory: string[]
): AvatarProfile | null {
  if (roster.length === 0) return null;

  // 1. Filter by content type fit
  const eligible = roster.filter(p =>
    p.contentAssignment.primaryTypes.includes(contentType)
  );
  const pool = eligible.length > 0 ? eligible : roster;

  // 2. Apply recovery penalty (used in last 2 videos → 0.5× weight)
  const withWeights = pool.map(p => ({
    presenter: p,
    weight: recentHistory.slice(0, 2).includes(p.presenterId) ? 0.5 : 1.0,
  }));

  // 3. Apply performance score for content type
  const scored = withWeights
    .map(p => ({
      ...p,
      weight: p.weight * (p.presenter.performanceScores[contentType] ?? 0.5),
    }))
    .sort((a, b) => b.weight - a.weight);

  // 4. 20% controlled randomness
  const pick = Math.random() < 0.8 ? scored[0] : (scored[1] ?? scored[0]);
  return pick?.presenter ?? null;
}

export async function runRosterHealthCheck(): Promise<void> {
  const roster = await getAvatarRoster();
  if (roster.length === 0) return;

  const now = Date.now();

  // Get 30-day video counts per presenter from regum-schedule
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.send(
    new ScanCommand({
      TableName: "regum-schedule",
      FilterExpression: "#ts >= :cutoff",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: { ":cutoff": { S: thirtyDaysAgo } },
    })
  );
  const recentSlots = (result.Items ?? []).map(i => unmarshall(i));
  const totalVideos = recentSlots.length;

  const countByPresenter: Record<string, number> = {};
  for (const slot of recentSlots) {
    if (slot.presenterId) {
      countByPresenter[slot.presenterId as string] =
        (countByPresenter[slot.presenterId as string] ?? 0) + 1;
    }
  }

  for (const presenter of roster) {
    const daysSinceUsed = (now - (presenter.lastUsedAt ?? 0)) / (1000 * 60 * 60 * 24);

    // Unused flag
    if (daysSinceUsed >= 14) {
      await sendAgentMessage({
        from: "regum",
        to: "zeus",
        type: "PUSH_ALERT",
        priority: "MEDIUM",
        requiresResponse: false,
        payload: {
          subject: "PRESENTER_UNUSED",
          body: `Presenter ${presenter.presenterId} (${presenter.name}) has not been used for ${Math.round(daysSinceUsed)} days.`,
          presenterId: presenter.presenterId,
          daysSinceUsed,
        },
      });
    }

    // Low performance escalation
    const lowScoringTypes = Object.values(presenter.performanceScores ?? {}).filter(
      s => s < 0.3
    ).length;
    if (lowScoringTypes >= 3) {
      await sendAgentMessage({
        from: "regum",
        to: "oracle",
        type: "PUSH_ALERT",
        priority: "MEDIUM",
        requiresResponse: false,
        payload: {
          subject: "DOMAIN_10_CHARACTER_REVIEW",
          body: `Presenter ${presenter.presenterId} has ${lowScoringTypes} content types scoring below 0.3. Requesting character review.`,
          presenterId: presenter.presenterId,
          lowScoringTypes,
        },
      });
    }

    // Rotation balance cap
    const count = countByPresenter[presenter.presenterId] ?? 0;
    const ratio = totalVideos > 0 ? count / totalVideos : 0;
    if (ratio > 0.6) {
      // Apply weight cap via presenter profile update
      await db.send(
        new UpdateItemCommand({
          TableName: "avatar-profiles",
          Key: { presenterId: { S: presenter.presenterId } },
          UpdateExpression: "SET weightCap = :cap, updatedAt = :t",
          ExpressionAttributeValues: {
            ":cap": { N: "0.2" },
            ":t": { S: new Date().toISOString() },
          },
        })
      );
      await sendAgentMessage({
        from: "regum",
        to: "zeus",
        type: "PUSH_ALERT",
        priority: "HIGH",
        requiresResponse: false,
        payload: {
          subject: "PRESENTER_ROTATION_IMBALANCE",
          body: `Presenter ${presenter.presenterId} is at ${Math.round(ratio * 100)}% of 30-day videos. Weight capped at 0.2.`,
          presenterId: presenter.presenterId,
          ratio,
        },
      });
    }
  }
}

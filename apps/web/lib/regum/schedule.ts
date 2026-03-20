import {
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient } from "@/lib/aws-clients";
import type { ScheduleSlot, UploadUrgency } from "./types";

const db = getDynamoClient();

// Optimal upload windows — Tue/Thu/Sat 7AM & 7PM IST, Mon/Wed/Fri noon
const UPLOAD_WINDOWS = {
  primary:   { days: [2, 4, 6], hours: [7, 19] },  // Tue/Thu/Sat 7AM & 7PM
  secondary: { days: [1, 3, 5], hours: [12] },      // Mon/Wed/Fri noon
};

const CADENCE_RULES = {
  maxPerDay: 2,
  minHoursBetween: 6,
  maxSameNichePerWeek: 3,
  shortsBefore: 2.5, // hrs before main video
};

export async function getScheduledUploads(dateStr: string): Promise<ScheduleSlot[]> {
  const result = await db.send(
    new ScanCommand({
      TableName: "regum-schedule",
      FilterExpression: "begins_with(#ts, :date)",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: { ":date": { S: dateStr } },
    })
  );
  return (result.Items ?? []).map(i => unmarshall(i) as ScheduleSlot);
}

export async function getNicheCountThisWeek(niche: string): Promise<number> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);

  const result = await db.send(
    new ScanCommand({
      TableName: "regum-schedule",
      FilterExpression: "#ts >= :weekStart AND niche = :niche",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: {
        ":weekStart": { S: weekStart.toISOString() },
        ":niche": { S: niche },
      },
    })
  );
  return (result.Items ?? []).length;
}

export async function getNicheRatioLast7Days(niche: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.send(
    new ScanCommand({
      TableName: "regum-schedule",
      FilterExpression: "#ts >= :cutoff",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: { ":cutoff": { S: sevenDaysAgo } },
    })
  );
  const all = result.Items ?? [];
  const nicheCount = all.filter(i => i.niche?.S === niche).length;
  return all.length === 0 ? 0 : nicheCount / all.length;
}

export async function findNextUploadSlot(urgency: UploadUrgency): Promise<Date> {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todaySlots = await getScheduledUploads(todayStr);

  if (urgency === "now") {
    // Find next slot at least minHoursBetween from last scheduled
    const sorted = todaySlots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const lastSlot = sorted[sorted.length - 1];
    if (!lastSlot || todaySlots.length < CADENCE_RULES.maxPerDay) {
      const candidate = new Date(now.getTime() + 30 * 60 * 1000); // +30 min buffer
      return candidate;
    }
    // Push to tomorrow primary window
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(UPLOAD_WINDOWS.primary.hours[0], 0, 0, 0);
    return tomorrow;
  }

  if (urgency === "today") {
    // Find next primary window today
    for (const hour of UPLOAD_WINDOWS.primary.hours) {
      const candidate = new Date(now);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate > now && todaySlots.length < CADENCE_RULES.maxPerDay) {
        return candidate;
      }
    }
    // Fall through to thisweek
  }

  // "thisweek" — find next optimal primary window
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysAhead);
    const dayOfWeek = candidate.getDay();
    if (UPLOAD_WINDOWS.primary.days.includes(dayOfWeek)) {
      const hour = UPLOAD_WINDOWS.primary.hours[0];
      candidate.setHours(hour, 0, 0, 0);
      const dayStr = candidate.toISOString().split("T")[0];
      const daySlots = await getScheduledUploads(dayStr);
      if (daySlots.length < CADENCE_RULES.maxPerDay) {
        return candidate;
      }
    }
  }

  // Fallback: 24h from now
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function calculateShortsPublish(mainPublish: Date): Date {
  return new Date(mainPublish.getTime() - CADENCE_RULES.shortsBefore * 60 * 60 * 1000);
}

export async function writeToSchedule(slot: ScheduleSlot): Promise<void> {
  await db.send(
    new PutItemCommand({
      TableName: "regum-schedule",
      Item: marshall(slot),
    })
  );
}

import {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/lib-dynamodb";
import type { PlaylistRecord } from "./types";

const db = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// Keyword-based niche → playlist mapping
const NICHE_PLAYLIST_MAP: Record<string, string> = {
  technology:    "tech-reviews",
  tech:          "tech-reviews",
  ai:            "tech-reviews",
  news:          "world-news",
  world:         "world-news",
  sports:        "sports-breakdown",
  finance:       "finance-markets",
  markets:       "finance-markets",
  crypto:        "finance-markets",
  science:       "science-space",
  space:         "science-space",
  politics:      "politics-power",
  entertainment: "entertainment",
  culture:       "entertainment",
};

export async function getAllPlaylists(): Promise<PlaylistRecord[]> {
  const result = await db.send(
    new ScanCommand({ TableName: "regum-playlists" })
  );
  return (result.Items ?? []).map(i => unmarshall(i) as PlaylistRecord);
}

export async function getPlaylist(playlistId: string): Promise<PlaylistRecord | null> {
  const result = await db.send(
    new GetItemCommand({
      TableName: "regum-playlists",
      Key: { playlistId: { S: playlistId } },
    })
  );
  if (!result.Item) return null;
  return unmarshall(result.Item) as PlaylistRecord;
}

export function findBestPlaylistKey(topic: string, niche: string): string {
  // Check niche map first
  const nicheKey = niche.toLowerCase();
  for (const [keyword, playlistKey] of Object.entries(NICHE_PLAYLIST_MAP)) {
    if (nicheKey.includes(keyword)) return playlistKey;
  }

  // Fall back to topic keyword scan
  const topicLower = topic.toLowerCase();
  for (const [keyword, playlistKey] of Object.entries(NICHE_PLAYLIST_MAP)) {
    if (topicLower.includes(keyword)) return playlistKey;
  }

  return "world-news"; // default
}

export async function upsertPlaylistRecord(record: PlaylistRecord): Promise<void> {
  await db.send(
    new PutItemCommand({
      TableName: "regum-playlists",
      Item: marshall(record),
    })
  );
}

export function detectSeries(
  topic: string,
  urgency: string,
  targetDuration: number,
  maturityLevel: string
): string | null {
  const topicLower = topic.toLowerCase();

  if (
    topicLower.includes("launch") ||
    topicLower.includes("release") ||
    topicLower.includes("announced")
  ) {
    return "first-look";
  }
  if (
    maturityLevel === "developing" ||
    topicLower.includes("claim") ||
    topicLower.includes("viral")
  ) {
    return "fact-check";
  }
  if (targetDuration >= 15) {
    return "deep-dive";
  }

  return null;
}

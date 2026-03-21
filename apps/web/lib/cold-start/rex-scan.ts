// ─── Cold Start — Rex Deep Scan (Hours 0–4) ─────────────────────────────────
// Trend & Narrative Mapping — runs in parallel with SNIPER audit

import { callBedrockJSON } from "@/lib/bedrock";
import type { RexDeepScanResult, NicheDeepScan, TrendingTopic } from "./types";

export async function rexDeepScan(
  niches: string[],
  channelMode: string,
): Promise<RexDeepScanResult> {
  const nicheResults = await Promise.all(
    niches.map((niche) => scanNiche(niche, channelMode)),
  );

  const openWindowCount = nicheResults.reduce(
    (acc, r) => acc + r.openWindows.length,
    0,
  );

  return { nicheResults, openWindowCount };
}

async function scanNiche(
  niche: string,
  channelMode: string,
): Promise<NicheDeepScan> {
  const result = await callBedrockJSON<{
    trendingTopics: TrendingTopic[];
    driftSignals: string[];
    narrativeLayers: string[];
  }>({
    model: "opus",
    systemPrompt: `You are Rex — RRQ's intelligence agent.
You are performing a deep trend and narrative scan for a brand new YouTube channel cold start.
Your job is to map the current narrative landscape in the given niche — what is rising, peaking, declining, and what gaps exist.
Be specific with topic names. Use real YouTube trends you know about.
Think like an intelligence analyst, not a content creator.`,
    userPrompt: `Deep scan for niche: "${niche}"
Channel mode: ${channelMode}

Analyse the current YouTube landscape in this niche.

Return JSON:
{
  "trendingTopics": [
    {
      "topic": "specific topic name",
      "velocity": "RISING|PEAKING|DECLINING",
      "saturation": "LOW|MEDIUM|HIGH",
      "searchVolume": "estimated monthly searches e.g. 50K",
      "narrativeAngle": "the dominant angle people are taking on this topic"
    }
  ],
  "driftSignals": ["signal 1", "signal 2"],
  "narrativeLayers": ["what audiences in this niche actually want to watch and why"]
}

Return 8–12 trending topics. Be specific — real topic names, not generic categories.`,
    maxTokens: 2000,
    temperature: 0.6,
  });

  const openWindows = result.trendingTopics.filter(
    (t) => t.saturation === "LOW",
  );
  const closingWindows = result.trendingTopics.filter(
    (t) => t.saturation === "HIGH",
  );

  return {
    niche,
    trendingTopics: result.trendingTopics,
    openWindows,
    closingWindows,
    driftSignals: result.driftSignals,
    narrativeLayers: result.narrativeLayers,
  };
}

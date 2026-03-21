// ─── Cold Start — SNIPER Competitor & Market Audit (Hours 0–4 parallel) ─────

import { callBedrockJSON } from "@/lib/bedrock";
import type { SniperAuditResult, NicheAudit, ChannelProfile } from "./types";

export async function sniperCompetitorAudit(
  niches: string[],
): Promise<SniperAuditResult> {
  const auditResults = await Promise.all(
    niches.map((niche) => auditNiche(niche)),
  );

  const totalChannelsProfiled = auditResults.reduce(
    (acc, r) => acc + r.topChannels.length,
    0,
  );

  return { auditResults, totalChannelsProfiled };
}

async function auditNiche(niche: string): Promise<NicheAudit> {
  const result = await callBedrockJSON<{
    topChannels: ChannelProfile[];
    dominantFormats: string[];
    oversaturatedAngles: string[];
    geoOpportunities: string[];
    avgCPM: string;
  }>({
    model: "opus",
    systemPrompt: `You are SNIPER — RRQ's geo-linguistic market intelligence agent.
You are performing a cold start competitor audit for a new YouTube channel.
Your job is to profile the competitive landscape — who dominates the niche, what formats they use, where the gaps are.
Be realistic and specific. Profile channels you actually know about in this niche.
Think like a market strategist on day one.`,
    userPrompt: `Competitor audit for niche: "${niche}"

Profile the competitive landscape on YouTube for this niche.

Return JSON:
{
  "topChannels": [
    {
      "name": "channel name",
      "subscribers": "e.g. 2.3M",
      "avgViewsPerVideo": "e.g. 150K",
      "uploadFrequency": "e.g. 3x/week",
      "dominantFormats": ["list-style", "comparison", "tutorial"],
      "topAngles": ["angle 1", "angle 2"],
      "weaknesses": ["what they miss or do poorly"]
    }
  ],
  "dominantFormats": ["top 3-5 formats that dominate this niche"],
  "oversaturatedAngles": ["angles that are overplayed — avoid these at launch"],
  "geoOpportunities": ["markets underserved in this niche e.g. Hindi, Spanish, Brazilian Portuguese"],
  "avgCPM": "estimated CPM range for this niche e.g. $4–8"
}

Profile 5–8 real or representative channels. Be specific about their weaknesses — those are our opportunities.`,
    maxTokens: 2000,
    temperature: 0.6,
  });

  return {
    niche,
    topChannels: result.topChannels,
    dominantFormats: result.dominantFormats,
    oversaturatedAngles: result.oversaturatedAngles,
    geoOpportunities: result.geoOpportunities,
    avgCPM: result.avgCPM,
  };
}

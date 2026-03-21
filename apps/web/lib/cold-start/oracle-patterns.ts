// ─── Cold Start — Oracle Historical Pattern Analysis (Hours 4–8) ────────────

import { callBedrockJSON } from "@/lib/bedrock";
import type {
  OraclePatternResult,
  RexDeepScanResult,
  SniperAuditResult,
} from "./types";

export async function oraclePatternAnalysis(
  niches: string[],
  rexScan: RexDeepScanResult,
  sniperAudit: SniperAuditResult,
): Promise<OraclePatternResult> {
  const patterns = await Promise.all(
    niches.map((niche, i) =>
      analyseNichePatterns(
        niche,
        rexScan.nicheResults[i],
        sniperAudit.auditResults[i],
      ),
    ),
  );

  return { patterns };
}

async function analyseNichePatterns(
  niche: string,
  rexResult: RexDeepScanResult["nicheResults"][number] | undefined,
  sniperResult: SniperAuditResult["auditResults"][number] | undefined,
): Promise<OraclePatternResult["patterns"][number]> {
  const openWindows = rexResult?.openWindows.map((t) => t.topic).join(", ") ?? "none";
  const competitorWeaknesses = sniperResult?.topChannels
    .flatMap((c) => c.weaknesses)
    .slice(0, 6)
    .join("; ") ?? "none";

  const result = await callBedrockJSON<{
    historicalFormats: string;
    coldStartPatterns: string;
  }>({
    model: "sonnet",
    systemPrompt: `You are ORACLE — RRQ's learning and development agent.
You analyse historical YouTube channel growth patterns to inform cold start strategy.
Your job is to synthesise what is known about successful channel launches in a given niche.
Be specific about patterns, timelines, and what separates channels that grow from those that plateau.`,
    userPrompt: `Historical pattern analysis for niche: "${niche}"

Current open narrative windows (from Rex scan): ${openWindows}
Competitor weaknesses identified (from SNIPER): ${competitorWeaknesses}

Answer these two questions with specific, actionable patterns:

1. Historical formats: What video formats have historically performed best for NEW channels launching in "${niche}"?
   What retention patterns work? What thumbnail styles convert? What title structures get clicked?

2. Cold start patterns: What does the growth curve of a successful new channel in "${niche}" look like in the first 90 days?
   What types of first videos gain initial traction? What upload cadence works at launch?
   What mistakes do new channels in this niche most commonly make?

Return JSON:
{
  "historicalFormats": "detailed paragraph about winning formats, thumbnails, titles for new channels in this niche",
  "coldStartPatterns": "detailed paragraph about 90-day growth curve, first video strategy, cadence, common mistakes"
}`,
    maxTokens: 1500,
    temperature: 0.5,
  });

  return {
    niche,
    historicalFormats: result.historicalFormats,
    coldStartPatterns: result.coldStartPatterns,
  };
}

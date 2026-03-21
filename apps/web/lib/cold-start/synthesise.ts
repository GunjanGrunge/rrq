// ─── Cold Start — The Line Synthesis (Hours 8–16) ───────────────────────────
// Produces content gap map + ranked first video shortlist

import { callBedrockJSON } from "@/lib/bedrock";
import type {
  SprintSynthesis,
  RexDeepScanResult,
  SniperAuditResult,
  OraclePatternResult,
} from "./types";

export async function theLineSynthesise(
  niches: string[],
  rexScan: RexDeepScanResult,
  sniperAudit: SniperAuditResult,
  oraclePatterns: OraclePatternResult,
): Promise<SprintSynthesis> {
  // Condense inputs to fit context efficiently
  const rexSummary = rexScan.nicheResults
    .map(
      (r) =>
        `${r.niche}: ${r.openWindows.length} open windows. Topics: ${r.openWindows
          .slice(0, 5)
          .map((t) => t.topic)
          .join(", ")}. Drift: ${r.driftSignals.slice(0, 2).join("; ")}`,
    )
    .join("\n");

  const sniperSummary = sniperAudit.auditResults
    .map(
      (a) =>
        `${a.niche}: ${a.topChannels.length} channels profiled. Formats: ${a.dominantFormats.join(", ")}. Gaps: ${a.topChannels
          .flatMap((c) => c.weaknesses)
          .slice(0, 4)
          .join("; ")}. Oversaturated: ${a.oversaturatedAngles.slice(0, 3).join(", ")}`,
    )
    .join("\n");

  const oracleSummary = oraclePatterns.patterns
    .map(
      (p) =>
        `${p.niche} — Formats: ${p.historicalFormats.slice(0, 200)}… | Cold start: ${p.coldStartPatterns.slice(0, 200)}…`,
    )
    .join("\n");

  const result = await callBedrockJSON<SprintSynthesis>({
    model: "opus",
    systemPrompt: `You are The Line — RRQ's synthesis layer.
You have just completed a 24-hour cold start deep research sprint.
Your job is to synthesise the findings into an actionable content gap map and first video shortlist.
The first video is a SMART TEST — not a banger. It tests a hypothesis. It sets a baseline.
Think like a studio head on day one: informed, strategic, calculated.
Be specific with topic angles. Give real, usable video ideas — not generic suggestions.`,
    userPrompt: `Cold start synthesis for niches: ${niches.join(", ")}

REX TREND SCAN:
${rexSummary}

SNIPER COMPETITOR AUDIT:
${sniperSummary}

ORACLE HISTORICAL PATTERNS:
${oracleSummary}

Synthesise all findings. Return JSON:
{
  "contentGapMap": [
    {
      "gap": "specific content angle that is missing from the niche",
      "why": "why this gap exists and why it's an opportunity",
      "opportunity": "HIGH|MEDIUM|LOW",
      "competitors": ["channels missing this"]
    }
  ],
  "oversaturatedAngles": ["angle 1 to avoid", "angle 2 to avoid"],
  "firstVideoShortlist": [
    {
      "rank": 1,
      "angle": "specific video angle — a real title idea",
      "format": "e.g. Comparison, Tutorial, Opinion, Explainer",
      "whyThisFirst": "why this is the right first video — be specific",
      "estimatedCTR": "e.g. 6–9%",
      "riskLevel": "LOW|MEDIUM|HIGH",
      "testHypothesis": "what we are testing with this video — what question it answers"
    }
  ],
  "coldStartStrategy": "2–3 paragraph strategy for the first 30 days. Specific, actionable.",
  "nicheInsights": {
    "keyObservation": "most important single insight from the entire sprint",
    "firstMoverOpportunity": "the best content gap to own first",
    "avoidAtAllCosts": "the biggest mistake to avoid at launch"
  }
}

Produce 4–7 content gaps. Produce exactly 3 first video candidates ranked 1–3.
Candidate #1 gets the RECOMMENDED badge. Make it the safest, smartest test.`,
    maxTokens: 3000,
    temperature: 0.7,
  });

  return result;
}

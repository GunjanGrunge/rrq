import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import type {
  ResearchOutput,
  ScriptOutput,
  SEOOutput,
  QualityGateOutput,
} from "@/lib/types/pipeline";

// ─── Quality Gate system prompt ─────────────────────────────────────────────

const QUALITY_SYSTEM_PROMPT = `You are a YouTube content quality analyst. You score content across 7 dimensions to determine whether it should proceed to expensive audio/video production or be rejected to save budget.

## Scoring Dimensions (each 0–10)

### 1. Hook Strength
Does the opening 30 seconds create an irresistible curiosity gap?
- 9-10: Genuinely surprising, specific, makes you need to know more
- 7-8: Strong but slightly predictable
- 5-6: Generic, could apply to any video on this topic
- Below 5: Starts with "In this video" or equivalent

### 2. Retention Structure
Is the script engineered to keep people watching?
- Re-engagement hooks every 2-3 minutes?
- Each section ends with a bridge to the next?
- Payoff delivered late enough to justify watch time?
- CTA specific and earned?

### 3. Title CTR Prediction
Will the title make someone stop scrolling?
- Primary keyword in first 4 words?
- Curiosity gap without giving everything away?
- Specific enough to feel credible?
- Under 60 characters?

### 4. Keyword Coverage
Are SEO keywords naturally embedded throughout?
- Primary keyword in title, first 100 words of description, script intro?
- Long-tail phrases in description?
- Tags cover exact, broad, and question-based variations?

### 5. Competitor Differentiation
Does this video offer a unique angle compared to top existing videos on this topic?

### 6. Muse Blueprint Adherence
Does the script follow proper YouTube script architecture?
- 4 retention walls present and correctly timed?
- Beat structure matches the blueprint?
- Visual variety across sections?

### 7. Uniqueness Score
Does this video add something the viewer cannot get from reading the source?
- 9-10: Original test, framework, comparison, or perspective not found elsewhere
- 7-8: Clear angle differentiation, builds meaningfully on source material
- 5-6: Repackages existing content with minor additions
- Below 5: Could be replaced by linking to the source article — DO NOT PUBLISH

CRITICAL: If uniquenessScore < 5.0, set uniquenessAutoReject to true regardless of overall score.

## Output Contract
Return a JSON object with these exact keys:
- scores: { hookStrength, retentionStructure, titleCTR, keywordCoverage, competitorDiff, museBlueprintAdherence, uniquenessScore } (all numbers 0-10)
- overall: weighted average (number 0-10)
- weakSections: string[] of dimension names scoring below 7
- feedback: Record<string, string> with one-line feedback per dimension
- uniquenessAutoReject: boolean
- recommendation: "PROCEED" | "REWRITE" | "REJECT"
- sprintCritical: false (always false in manual pipeline)

Return ONLY the JSON object, no markdown fences.`;

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const internalSecret = process.env.INNGEST_SIGNING_KEY;
  const isInternal = internalSecret && req.headers.get("x-rrq-internal") === internalSecret;
  if (!isInternal) {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json();
  const { researchOutput, scriptOutput, seoOutput, attempt, qualityThreshold } =
    body as {
      researchOutput: ResearchOutput;
      scriptOutput: ScriptOutput;
      seoOutput: SEOOutput;
      attempt: number;
      qualityThreshold: number;
    };

  if (!researchOutput || !scriptOutput || !seoOutput) {
    return Response.json(
      { error: "Research, script, and SEO outputs are required" },
      { status: 400 }
    );
  }

  const threshold = qualityThreshold ?? 7;
  const currentAttempt = attempt ?? 1;

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      // Stage 0 — read the content + live search to verify recency
      emit({ type: "status_line", message: "Vera is reading everything…" });
      const verifyResults = await webSearch(
        `${researchOutput.topic} ${currentYear} facts latest`,
        5
      );
      const verifyContext = formatSearchResults(verifyResults, "Live fact-check context");
      emit({ type: "stage_complete", stageIndex: 0 });

      // Stage 1 — build scoring prompt
      emit({ type: "status_line", message: "Vera is scoring each dimension…" });

      const userPrompt = `Score this YouTube video content across all 7 quality dimensions.

## Current Date
Today is ${currentDate}. The current year is ${currentYear}.
CHECK: Does the title or script reference a past year (e.g. ${currentYear - 1} instead of ${currentYear})? If so, penalise titleCTR and flag it in feedback.

${verifyContext ? `## Live Web Context (fetched right now)\n${verifyContext}\n\nUse this to cross-check whether facts in the script are still accurate and current as of today.` : ""}

## Quality Threshold
User's minimum acceptable score: ${threshold}/10
This is attempt ${currentAttempt} of 2 maximum.

## Research Brief
Topic: ${researchOutput.topic}
Video Type: ${researchOutput.videoType}
Target Audience: ${researchOutput.targetAudience}
Hook: ${researchOutput.hook}
Competitor Gap: ${researchOutput.competitorGap}
Keywords: ${JSON.stringify(researchOutput.keywords)}

## Script
Title: ${scriptOutput.title}
Duration: ${scriptOutput.duration} minutes
Total Words: ${scriptOutput.totalWordCount}
Sections: ${scriptOutput.sections.map((s) => `[${s.label}] ${s.script.substring(0, 200)}...`).join("\n")}

## SEO Metadata
Final Title: ${seoOutput.finalTitle}
Description (first 300 chars): ${seoOutput.description.substring(0, 300)}
Tags: ${seoOutput.tags.join(", ")}
Expected CTR: ${seoOutput.expectedCTR}

## Instructions
1. Score each of the 7 dimensions from 0-10
2. Calculate weighted average as overall score
3. List any dimensions scoring below 7 as weakSections
4. If uniquenessScore < 5.0, set uniquenessAutoReject: true
5. Set recommendation:
   - overall >= ${threshold} AND NOT uniquenessAutoReject → "PROCEED"
   - overall < ${threshold} AND attempt 1 → "REWRITE"
   - overall < ${threshold} AND attempt 2 → "REJECT"
   - uniquenessAutoReject → "REJECT" (regardless of attempt)

Score now.`;
      emit({ type: "stage_complete", stageIndex: 1 });

      // Stage 2 — Bedrock score
      emit({ type: "status_line", message: "Vera is writing her verdict…" });
      const result = await callBedrockJSON<QualityGateOutput>({
        model: "haiku",
        systemPrompt: QUALITY_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 2048,
        temperature: 0.3,
        enableCache: true,
      });
      emit({ type: "stage_complete", stageIndex: 2 });

      // Stage 3 — server-side enforcement
      emit({ type: "status_line", message: "Vera is reviewing the final call…" });
      if (result.scores.uniquenessScore < 5.0) {
        result.uniquenessAutoReject = true;
        result.recommendation = "REJECT";
      }
      if (!result.uniquenessAutoReject) {
        if (result.overall >= threshold) {
          result.recommendation = "PROCEED";
        } else if (currentAttempt >= 2) {
          result.recommendation = "REJECT";
        } else {
          result.recommendation = "REWRITE";
        }
      }
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: result });
    } catch (error) {
      console.error("[quality] Pipeline error:", error);
      emit({ type: "error", error: error instanceof Error ? error.message : "Quality gate scoring failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

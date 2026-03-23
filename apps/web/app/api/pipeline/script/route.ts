import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import type { ResearchOutput, ScriptOutput } from "@/lib/types/pipeline";

// ─── Script system prompt ───────────────────────────────────────────────────

const SCRIPT_SYSTEM_PROMPT = `You are a professional YouTube script writer. You transform research briefs into watch-time-maximising scripts engineered around YouTube's retention curve.

## Script Architecture — Follow This Exact Sequence
1. HOOK (0:00–0:30, ~65 words) — most surprising fact, counterintuitive claim, or vivid scenario. Never start with "In this video". Create a knowledge gap.
2. INTRO / CREDIBILITY (0:30–1:00, ~65 words) — who this is for, what they'll know by the end.
3. BODY SECTIONS (variable) — 2-4 min segments with mini-hooks, substance, and bridge transitions. Include re-engagement hooks every 2-3 minutes.
4. COMPARISON / PROS & CONS (if applicable) — narrative, not bullets. Surface the controversial angle.
5. CALL TO ACTION (final 30-60 seconds) — earned CTA, specific to video content, tease next video.

## Word Count Calibration
YouTube delivery pace is 130-150 words/minute:
- 3 min: ~400 words | 5 min: ~700 | 8 min: ~1100 | 10 min: ~1350 | 15 min: ~2050

## Voice Selection Rules
Male voice: tech, cars, finance, history, gaming — authority tone
Female voice: beauty, skincare, lifestyle, wellness, fashion — warmth tone
Either: travel, cooking, education — pick based on tone

## displayMode per section
- avatar-fullscreen: hook, intro, CTA (face builds trust)
- broll-with-corner-avatar: body sections (B-roll illustrates)
- broll-only: external footage/images
- visual-asset: charts, tables, cards, diagrams

## Writing Style
- Conversational over formal. Short sentences. Contractions. Direct "you".
- Vary sentence length. Punch short after complex.
- Signpost transitions verbally.
- Never read numbers cold: "67.3%" → "nearly 7 in 10"
- Add [PAUSE] markers where silence helps the point land.

## Output Contract
Return a JSON object with these exact keys:
- title: final title
- duration: target minutes (number)
- totalWordCount: number
- youtubeDescription: full optimised description
- chapters: [{ timestamp, label }]
- sections: [{ id, label, timestampStart, timestampEnd, wordCount, script, visualNote, toneNote, displayMode, visualAssetId? }]
- endScreenSuggestion: string
- cardSuggestions: [{ timestamp, text, linkTarget }]
- visualAssets: [{ id (string), sectionId (string), type (MUST be exactly one of: "comparison-table"|"bar-chart"|"line-chart"|"radar-chart"|"flow-diagram"|"infographic-card"|"personality-card"|"news-timeline"|"stat-callout"), insertAt (timestamp string e.g. "0:45"), duration (number, seconds), animated (boolean), data (object with chart/table data), citations (array of strings — source text like "Reuters, 2024" or full URL — NEVER numbers) }]
- voiceConfig: { gender: "male"|"female", style: "analytical"|"enthusiastic"|"documentary"|"conversational", reasoning: string }
- tonyTasks: [{ task (string — clear instruction for a code agent, e.g. "Generate a bar chart comparing X vs Y"), context (object — include sectionId, title, any data needed), outputType ("chart"|"data"|"report") }] — generate 1-3 tasks for sections that would benefit from a data-driven chart, infographic, or stat callout. Always include one task for the thumbnail (outputType "chart", context.sectionId "thumbnail", describing the key hook visually). Leave empty array [] if topic has no data to visualise.
- shortsScript?: { hook, body, onScreenText, visualNote, duration } (only if requested)

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
  const { researchOutput, duration, tone, generateShorts, shortsType } = body as {
    researchOutput: ResearchOutput;
    duration: number;
    tone: string;
    generateShorts?: boolean;
    shortsType?: "convert" | "fresh";
  };

  if (!researchOutput) {
    return Response.json({ error: "Research output is required" }, { status: 400 });
  }

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      // Stage 0 — review the research + live search for freshness
      emit({ type: "status_line", message: "MUSE is studying Rex's brief…" });
      const targetWords = Math.round(duration * 140);
      const freshResults = await webSearch(
        `${researchOutput.topic} ${new Date().getFullYear()} update latest`,
        5
      );
      const freshContext = formatSearchResults(freshResults, "Live freshness check");
      emit({ type: "stage_complete", stageIndex: 0 });

      // Stage 1 — build the prompt (structure design)
      emit({ type: "status_line", message: "MUSE is mapping the story arc…" });
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const userPrompt = `Write a complete YouTube script based on this research brief.

TODAY: ${currentDate} — use ${currentYear} in all titles, statistics, and comparisons. Never reference ${currentYear - 1} or earlier as "current" or "latest".

TARGET DURATION: ${duration} minutes (~${targetWords} words)
TONE: ${tone}

${freshContext ? `## Live Web Context (fetched right now)\n${freshContext}\n\nUse this to verify recency of facts and add any breaking updates not in the research brief.` : ""}
${generateShorts && shortsType === "fresh" ? "ALSO GENERATE: A fresh YouTube Shorts script (45-60 seconds, ~100 words)" : ""}

## Research Brief
${JSON.stringify(researchOutput, null, 2)}

Write the full script now. Ensure:
- Total word count is within 5% of ${targetWords}
- Hook does NOT begin with "In this video"
- Every body section ends with a bridge line
- CTA mentions something specific from the video
- visualNote on each section is concrete enough for stock footage search
- Chapter timestamps match section lengths
- Include [PAUSE] markers at impactful moments
- Select voice gender and style based on topic context`;
      emit({ type: "stage_complete", stageIndex: 1 });

      // Stage 2 — Bedrock write
      emit({ type: "status_line", message: "MUSE is writing…" });
      const script = await callBedrockJSON<ScriptOutput>({
        model: "opus",
        systemPrompt: SCRIPT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 12000,
        temperature: 0.7,
        enableCache: true,
      });
      emit({ type: "stage_complete", stageIndex: 2 });

      emit({ type: "result", data: script });
    } catch (error) {
      console.error("[script] Pipeline error:", error);
      emit({ type: "error", error: error instanceof Error ? error.message : "Script generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

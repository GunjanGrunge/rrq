import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
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
- visualAssets: [{ id, sectionId, type, insertAt, duration, animated, data, citations }]
- voiceConfig: { gender, style, reasoning }
- shortsScript?: { hook, body, onScreenText, visualNote, duration } (only if requested)

Return ONLY the JSON object, no markdown fences.`;

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      // Stage 0 — review the research
      emit({ type: "status_line", message: "MUSE is studying Rex's brief…" });
      const targetWords = Math.round(duration * 140);
      // Small async yield so the client receives the first status line before the heavy work
      await new Promise(r => setTimeout(r, 50));
      emit({ type: "stage_complete", stageIndex: 0 });

      // Stage 1 — build the prompt (structure design)
      emit({ type: "status_line", message: "MUSE is mapping the story arc…" });
      const userPrompt = `Write a complete YouTube script based on this research brief.

TARGET DURATION: ${duration} minutes (~${targetWords} words)
TONE: ${tone}
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

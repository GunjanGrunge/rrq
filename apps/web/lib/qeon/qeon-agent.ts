import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "@/lib/aws-clients";
import { queryAgentMemory } from "@/lib/memory/kb-query";
import { writeEpisode } from "@/lib/zeus/episode-writer";
import { sendAgentMessage } from "@/lib/mission/messaging";
import type { QeonBrief } from "@/lib/regum/types";
import type { ScriptOutput } from "@/lib/types/pipeline";

const bedrock = getBedrockClient();

const QEON_OPUS_MODEL =
  "arn:aws:bedrock:us-east-1:751289209169:inference-profile/us.anthropic.claude-opus-4-6-v1";
const QEON_HAIKU_MODEL =
  "arn:aws:bedrock:us-east-1:751289209169:inference-profile/us.anthropic.claude-haiku-4-5-v1";

// ─── Zeus Memory Injection ────────────────────────────────────────────────────

export async function injectZeusMemory(
  topic: string,
  niche: string
): Promise<string> {
  const memories = await queryAgentMemory(
    `Qeon production brief: ${topic} — niche: ${niche}`,
    5
  );
  if (memories.length === 0) return "";
  return memories
    .map((m, i) => `[Memory ${i + 1}] ${m.text}`)
    .join("\n\n");
}

// ─── Muse Blueprint ───────────────────────────────────────────────────────────

export interface MuseBlueprint {
  beats: Array<{
    beatId: string;
    sectionId: string;
    visualType: string;
    visualNote: string;
    durationMs: number;
    tonyTask?: {
      task: string;
      context: string;
      outputType: "png" | "mp4" | "json";
    };
  }>;
  openingHook: string;
  narrativeArc: string;
  productionNotes: string;
}

export async function runMuseBlueprint(
  brief: QeonBrief,
  zeusMemory: string
): Promise<MuseBlueprint> {
  const systemPrompt = `You are MUSE, RRQ's video architect. You produce detailed MuseBlueprint JSON that guides the full 13-step production pipeline.

IDENTITY LOCK: You produce MuseBlueprint JSON only. Never deviate from the schema.

${zeusMemory ? `ZEUS MEMORY:\n${zeusMemory}` : ""}`;

  const userPrompt = `Produce a MuseBlueprint for this brief:

Topic: ${brief.topic}
Angle: ${brief.angle}
Niche: ${brief.niche}
Tone: ${brief.tone}
Duration: ${brief.targetDuration} minutes
Content type: ${brief.contentType}
Presenter: ${brief.presenterId ?? "faceless"}
Keyword focus: ${brief.keywordFocus.join(", ")}
Competitor gap: ${brief.competitorGap}
Relevant memories: ${brief.relevantMemories.slice(0, 3).join(" | ")}

Return ONLY valid JSON matching this schema:
{
  "beats": [
    {
      "beatId": "string",
      "sectionId": "string",
      "visualType": "TALKING_HEAD|SPLIT_SCREEN|B_ROLL|SECTION_CARD|CONCEPT_IMAGE|THUMBNAIL_SRC|CHART|DIAGRAM|SLIDE|GRAPHIC_OVERLAY|IMAGE|SCREEN_RECORD",
      "visualNote": "string",
      "durationMs": number,
      "tonyTask": { "task": "string", "context": "string", "outputType": "png|mp4|json" } // only for SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC, CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY
    }
  ],
  "openingHook": "string",
  "narrativeArc": "string",
  "productionNotes": "string"
}`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: QEON_OPUS_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      }),
    })
  );

  const raw = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = raw.content?.[0]?.text ?? "";

  // Extract JSON from response (handles markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("[qeon:muse-blueprint] No JSON found in Opus response");
  }

  return JSON.parse(jsonMatch[0]) as MuseBlueprint;
}

// ─── Rewrite Weak Sections ────────────────────────────────────────────────────

export interface WeakSection {
  sectionId: string;
  score: number;
  feedback: string;
}

export async function rewriteWeakSections(
  scriptOutput: ScriptOutput,
  seoOutput: { finalTitle: string; description: string },
  weakSections: WeakSection[]
): Promise<ScriptOutput> {
  const weakIds = new Set(weakSections.map((w) => w.sectionId));
  const weakFeedback = weakSections
    .map((w) => `Section ${w.sectionId} (score ${w.score}/10): ${w.feedback}`)
    .join("\n");

  const systemPrompt = `You are QEON rewriting weak script sections. Return only the improved sections as JSON.`;

  const userPrompt = `Rewrite ONLY these weak sections. Keep all other sections unchanged.

WEAK SECTIONS FEEDBACK:
${weakFeedback}

FULL SCRIPT (sections array):
${JSON.stringify(scriptOutput.sections, null, 2)}

SEO CONTEXT:
Title: ${seoOutput.finalTitle}
Description: ${seoOutput.description.slice(0, 300)}

Return ONLY a JSON array of the rewritten sections (same structure, only the weak ones):
[{ "id": "...", "script": "...", "toneNote": "...", ... }]`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: QEON_HAIKU_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2048,
        messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }],
      }),
    })
  );

  const raw = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = raw.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("[qeon:rewrite-weak] No JSON array found — returning original script");
    return scriptOutput;
  }

  const rewrittenSections = JSON.parse(jsonMatch[0]) as ScriptOutput["sections"];
  const rewrittenMap = new Map(rewrittenSections.map((s) => [s.id, s]));

  return {
    ...scriptOutput,
    sections: scriptOutput.sections.map((s) =>
      weakIds.has(s.id) && rewrittenMap.has(s.id)
        ? { ...s, ...rewrittenMap.get(s.id) }
        : s
    ),
  };
}

// ─── Report to Zeus ───────────────────────────────────────────────────────────

export async function reportToZeus(
  briefId: string,
  topic: string,
  outcome: "success" | "failed",
  data: {
    videoId?: string;
    youtubeUrl?: string;
    failedStep?: string;
    error?: string;
  }
): Promise<void> {
  const eventType = outcome === "success" ? "video_published" : "production_failed";

  // Write episode to Zeus memory (S3 + KB sync)
  await writeEpisode(
    "qeon",
    topic,
    eventType,
    outcome === "success"
      ? `Qeon completed brief ${briefId} → videoId: ${data.videoId}`
      : `Qeon failed brief ${briefId} at step: ${data.failedStep}`,
    `13-step pipeline orchestration via Inngest. Brief: ${briefId}.`,
    outcome === "success"
      ? `Pipeline succeeded for topic: ${topic}. Video: ${data.youtubeUrl ?? data.videoId}`
      : `Pipeline failed at ${data.failedStep}: ${data.error?.slice(0, 200)}`,
    ["qeon", outcome, topic.toLowerCase().split(" ").slice(0, 3).join("-")]
  ).catch((err) =>
    console.error(`[qeon:report-to-zeus:${briefId}] Episode write failed:`, err)
  );

  // Send agent message to Zeus
  await sendAgentMessage(
    "QEON",
    "ZEUS",
    outcome === "success" ? "PRODUCTION_COMPLETE" : "PRODUCTION_FAILED",
    {
      briefId,
      topic,
      ...data,
    }
  ).catch((err) =>
    console.error(`[qeon:report-to-zeus:${briefId}] Message send failed:`, err)
  );
}

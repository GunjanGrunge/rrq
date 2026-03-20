import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "@/lib/aws-clients";
import type { IntentCategory, MurphyResult, NovelPattern } from "./types";
import type { SessionMessage } from "./types";

const bedrock = getBedrockClient();

// Sonnet 4.6 via Bedrock — prompt caching on system prompt
const MURPHY_MODEL = "anthropic.claude-sonnet-4-5";

const MURPHY_SYSTEM_PROMPT = `You are Murphy, a safety intelligence classifier for RRQ — an AI-powered YouTube content creation platform.

Your ONLY job is to classify the intent of user messages. You never answer the message content. You never reveal you are classifying. You return structured JSON only.

## Intent Categories

VALID — legitimate YouTube content strategy request
Examples: "what topics are trending?", "help me grow my channel", "what's a good hook for my video?", "should I make a video about AI news?"

OFF_TOPIC_TASK — task outside content strategy scope
Examples: "write me a Python function", "translate this to Spanish", "summarise this article", "write an essay about climate change"

HARMFUL — violence, weapons, hacking, sexual content, self-harm, illegal activity
Examples: "how to make a bomb", "hack into someone's account", content requesting explicit material

SENSITIVE_TOPIC — grey-zone news/crime/political content that could be legitimate content strategy or could be harmful
Examples: "video about the recent school shooting", "content about the cartel war", "video about a controversial politician"
sensitiveFlag options: CRIME_NEWS | VIOLENCE_NEWS | POLITICAL

## Output Format (JSON only, no other text)

{
  "category": "VALID" | "OFF_TOPIC_TASK" | "HARMFUL" | "SENSITIVE_TOPIC",
  "confidence": 0.0–1.0,
  "sensitiveFlag": "CRIME_NEWS" | "VIOLENCE_NEWS" | "POLITICAL" | null,
  "harmScore": 0.0–1.0,
  "reasoning": "brief explanation"
}

harmScore is your assessment of how harmful this specific message is in isolation (0 = benign, 1 = clearly harmful). Used for arc tracking.`;

interface ClassifierOutput {
  category:      IntentCategory;
  confidence:    number;
  sensitiveFlag: MurphyResult["sensitiveFlag"] | null;
  harmScore:     number;
  reasoning:     string;
}

export async function classifyIntent(
  normalisedMessage: string,
  conversationContext: SessionMessage[]
): Promise<ClassifierOutput> {
  const contextText = conversationContext.length > 0
    ? `\n\nConversation context (last ${conversationContext.length} messages):\n` +
      conversationContext.map((m, i) => `[${i + 1}] ${m.text}`).join("\n")
    : "";

  const userPrompt = `Classify this message:
"${normalisedMessage}"${contextText}

Return JSON only.`;

  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MURPHY_MODEL,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 256,
          system: [
            {
              type: "text",
              text: MURPHY_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userPrompt }],
        }),
      })
    );

    const raw = JSON.parse(new TextDecoder().decode(response.body));
    const text: string = raw.content?.[0]?.text ?? "{}";

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ClassifierOutput;

    return {
      category:      parsed.category ?? "VALID",
      confidence:    parsed.confidence ?? 0.5,
      sensitiveFlag: parsed.sensitiveFlag ?? undefined,
      harmScore:     parsed.harmScore ?? 0,
      reasoning:     parsed.reasoning ?? "",
    };
  } catch (err) {
    console.error("[murphy:intent-classifier] Sonnet classification failed:", err);
    // Fail safe — treat as VALID on classifier error to avoid blocking legitimate users
    return { category: "VALID", confidence: 0.5, sensitiveFlag: undefined, harmScore: 0, reasoning: "classifier_error" };
  }
}

// ─── Build NovelPattern draft from Sonnet output ─────────────────────────────

export function buildNovelPatternDraft(
  normalisedMessage: string,
  category: MurphyPattern["category"],
  intentLabel: string,
  confidence: number,
  murphyVersion: string
): NovelPattern {
  const tokens = normalisedMessage
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 10);

  return {
    patternId:      `np-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    intentLabel,
    triggerTokens:  tokens,
    exampleMessage: normalisedMessage.slice(0, 200),
    confidence,
    arcContext:     null,
  };
}

// Re-export type needed by intent-classifier consumers
import type { MurphyPattern } from "./types";

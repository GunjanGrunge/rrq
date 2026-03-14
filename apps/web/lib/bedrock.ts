import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// ─── Model IDs ──────────────────────────────────────────────────────────────

export const MODELS = {
  opus: "anthropic.claude-opus-4-5",
  sonnet: "anthropic.claude-sonnet-4-5",
  haiku: "anthropic.claude-haiku-4-5-20251001",
} as const;

export type ModelKey = keyof typeof MODELS;

// ─── Client (singleton) ─────────────────────────────────────────────────────

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return client;
}

// ─── Core call helper ───────────────────────────────────────────────────────

export interface BedrockCallOptions {
  model: ModelKey;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  enableCache?: boolean;
}

export async function callBedrock({
  model,
  systemPrompt,
  userPrompt,
  maxTokens = 8192,
  temperature = 0.7,
  enableCache = true,
}: BedrockCallOptions): Promise<string> {
  const bedrock = getClient();

  const systemBlock: Record<string, unknown> = {
    type: "text",
    text: systemPrompt,
  };

  // Enable prompt caching on system prompt for repeated context
  if (enableCache) {
    systemBlock.cache_control = { type: "ephemeral" };
  }

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    system: [systemBlock],
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: MODELS[model],
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Extract text from the response content blocks
  const textBlocks = responseBody.content?.filter(
    (block: { type: string }) => block.type === "text"
  );

  if (!textBlocks?.length) {
    throw new Error("No text content in Bedrock response");
  }

  return textBlocks.map((b: { text: string }) => b.text).join("");
}

// ─── JSON extraction helper ────────────────────────────────────────────────

export async function callBedrockJSON<T>(
  options: BedrockCallOptions
): Promise<T> {
  const raw = await callBedrock(options);

  // Extract JSON from the response — may be wrapped in markdown code fence
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  return JSON.parse(jsonStr) as T;
}

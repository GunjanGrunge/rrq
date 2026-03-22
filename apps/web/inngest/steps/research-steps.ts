import type { ResearchOutput, ScriptOutput, SEOOutput, QualityGateOutput } from "@/lib/types/pipeline";

export interface ResearchContext {
  angle?: string;
  niche?: string;
  competitorGap?: string;
  zeusMemory?: string;
}

export interface ScriptContext {
  angle?: string;
  niche?: string;
  zeusMemory?: string;
  museBlueprint?: unknown;
}

/**
 * Consumes an SSE stream from a pipeline API route and extracts the final result.
 * Pipeline routes emit: stage_complete events → then a final `type: "result"` event.
 */
async function consumeSSEResult<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${label} HTTP ${res.status}: ${text}`);
  }
  if (!res.body) throw new Error(`${label}: response body is null`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      let payload: { type: string; data?: T; error?: string };
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      if (payload.type === "result" && payload.data !== undefined) {
        return payload.data;
      }
      if (payload.type === "error") {
        throw new Error(`${label} error: ${payload.error ?? "unknown"}`);
      }
    }
  }
  throw new Error(`${label}: SSE stream ended without a result event`);
}

export async function runResearchStep(
  appUrl: string,
  topic: string,
  ctx: ResearchContext = {}
): Promise<ResearchOutput> {
  const res = await fetch(`${appUrl}/api/pipeline/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, duration: 10, tone: "informative", ...ctx }),
  });
  return consumeSSEResult<ResearchOutput>(res, "Research");
}

export async function runScriptStep(
  appUrl: string,
  researchOutput: ResearchOutput,
  duration: number,
  tone: string,
  ctx: ScriptContext = {}
): Promise<ScriptOutput> {
  const res = await fetch(`${appUrl}/api/pipeline/script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ researchOutput, duration, tone, ...ctx }),
  });
  return consumeSSEResult<ScriptOutput>(res, "Script");
}

export async function runSeoStep(
  appUrl: string,
  researchOutput: ResearchOutput,
  scriptOutput: ScriptOutput
): Promise<SEOOutput> {
  const res = await fetch(`${appUrl}/api/pipeline/seo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ researchOutput, scriptOutput, generateShorts: true }),
  });
  return consumeSSEResult<SEOOutput>(res, "SEO");
}

export async function runQualityStep(
  appUrl: string,
  researchOutput: ResearchOutput,
  scriptOutput: ScriptOutput,
  seoOutput: SEOOutput,
  attempt: number,
  qualityThreshold: number
): Promise<QualityGateOutput> {
  const res = await fetch(`${appUrl}/api/pipeline/quality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      researchOutput, scriptOutput, seoOutput,
      attempt, qualityThreshold,
    }),
  });
  const result = await consumeSSEResult<QualityGateOutput>(res, "Quality Gate");
  if (result.recommendation === "REJECT") {
    throw new Error(`Quality gate REJECTED: overall ${result.overall}/10`);
  }
  return result;
}

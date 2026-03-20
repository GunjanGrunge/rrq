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
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Research failed");
  return data.data;
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Script failed");
  return data.data;
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "SEO failed");
  return data.data;
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Quality gate failed");
  if (data.data.recommendation === "REJECT") {
    throw new Error(`Quality gate REJECTED: overall ${data.data.overall}/10`);
  }
  return data.data;
}

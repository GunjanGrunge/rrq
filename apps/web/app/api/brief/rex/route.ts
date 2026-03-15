import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";

const REX_SYSTEM = `You are Rex, the intelligence and scouting agent for RRQ. You evaluate content opportunities before production begins.

Given a topic and brief context, score it across 5 dimensions and give an overall confidence score.

Return ONLY a JSON object with this exact shape:
{
  "overall": number (0-100),
  "verdict": "STRONG" | "SOLID" | "RISKY",
  "dimensions": {
    "trendStrength": { "score": number (0-100), "note": string (max 12 words) },
    "competitionLevel": { "score": number (0-100), "note": string (max 12 words) },
    "audienceDemand": { "score": number (0-100), "note": string (max 12 words) },
    "nicheRelevance": { "score": number (0-100), "note": string (max 12 words) },
    "contentUniqueness": { "score": number (0-100), "note": string (max 12 words) }
  },
  "recommendation": string (1 sentence — what angle Rex recommends or what to watch out for)
}

For competitionLevel: higher score = lower competition (better). It represents the opportunity gap, not how crowded it is.
Be honest. Do not inflate scores. A RISKY verdict is useful — it helps the creator decide before spending production budget.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, niche, tone, chatSummary } = await req.json() as {
    topic: string;
    niche: string[];
    tone: string[];
    chatSummary: string;
  };

  const userPrompt = `Evaluate this content opportunity:

Topic: ${topic}
Niche: ${niche.length > 0 ? niche.join(", ") : "general"}
Tone: ${tone.length > 0 ? tone.join(", ") : "not specified"}
Brief context from Zeus conversation: ${chatSummary || "none"}

Score it now.`;

  const result = await callBedrockJSON<{
    overall: number;
    verdict: "STRONG" | "SOLID" | "RISKY";
    dimensions: Record<string, { score: number; note: string }>;
    recommendation: string;
  }>({
    model: "sonnet",
    systemPrompt: REX_SYSTEM,
    userPrompt,
    maxTokens: 600,
    temperature: 0.4,
    enableCache: true,
  });

  return Response.json(result);
}

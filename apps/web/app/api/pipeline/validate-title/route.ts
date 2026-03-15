import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";

interface ValidateTitleRequest {
  customTitle: string;
  topic: string;
  targetAudience: string;
  viralPotential: string;
  rexPickTitle: string;
  rexPickScore: number;
}

interface ValidateTitleResponse {
  rexScore: number;
  verdict: "BETTER" | "ON_PAR" | "WEAKER";
  reasoning: string;
}

const SYSTEM_PROMPT = `You are Rex, RRQ's intelligence agent. You evaluate YouTube titles using the same scoring rubric you apply to every title you generate.

Score titles on a 0–100 scale considering:
- Curiosity gap strength (does it tease without giving everything away?)
- Keyword placement (primary keyword in first 4 words?)
- Specificity (concrete vs vague — specific scores higher)
- Emotional pull (does it create urgency, fear, excitement, or curiosity?)
- Formula fit for the topic (is this the right formula for this subject matter?)

Return a single JSON object: { rexScore, verdict, reasoning }
- rexScore: integer 0–100
- verdict: "BETTER" if rexScore >= rexPickScore, "ON_PAR" if within 10 points below, "WEAKER" if more than 10 points below
- reasoning: one concise sentence explaining the score

Return ONLY the JSON object, no markdown fences.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as ValidateTitleRequest;
  const { customTitle, topic, targetAudience, viralPotential, rexPickTitle, rexPickScore } = body;

  if (!customTitle?.trim()) {
    return Response.json({ error: "customTitle is required" }, { status: 400 });
  }

  const userPrompt = `Evaluate this user-submitted YouTube title.

TOPIC: ${topic}
TARGET AUDIENCE: ${targetAudience}
VIRAL POTENTIAL: ${viralPotential}

REX'S PICK: "${rexPickTitle}" (rexScore: ${rexPickScore})
USER'S TITLE: "${customTitle}"

Score the user's title using the rubric. Set verdict based on how it compares to Rex's pick score of ${rexPickScore}.`;

  const result = await callBedrockJSON<ValidateTitleResponse>({
    model: "haiku",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 256,
    temperature: 0.3,
    enableCache: false,
  });

  return Response.json(result);
}

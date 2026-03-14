import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";
import type { ResearchOutput, ScriptOutput, SEOOutput } from "@/lib/types/pipeline";

// ─── SEO system prompt (Sonnet for titles + descriptions) ───────────────────

const SEO_SYSTEM_PROMPT = `You are a YouTube SEO specialist. Your job is to produce metadata that maximises impressions, CTR, and average view duration.

## Title Engineering
- 50-60 characters ideal (truncated on mobile)
- Primary keyword in first 5 words
- Never write the whole story — preserve curiosity gap
- Capitalise major words for visual weight
- Numbers outperform adjectives
- Year in title signals freshness
- Generate 5+ title variants with different formulas

## Description Structure
Line 1-2: Hook (first 150 chars shown without "show more") — NOT "In this video"
Line 3: Blank
Lines 4-8: Timestamps/Chapters
Lines 9-15: Keyword-rich paragraph (3-5 sentences, natural)
Lines 17-20: Links placeholder
Lines 21-25: 3-5 hashtags

## Tags (15-20 total)
- Exact title tags (2-3)
- Primary topic (3-4)
- Long-tail question phrases (5-6)
- Related channel tags (3)
- Branded (2)
Order: most specific → most broad

## Shorts SEO (if applicable)
- Title under 40 chars, no clickbait
- Description: one sentence + "Full breakdown → link" + hashtags including #Shorts
- Schedule 2-3 hours BEFORE main video

## Upload Timing (IST primary)
Tier 1: Thursday-Saturday 7:00-9:00 PM IST
Tier 2: Sunday 10:00 AM-12:00 PM IST
Tier 3 (avoid): Monday-Wednesday

## Output Contract
Return a JSON object with these exact keys:
- finalTitle: winning title (max 60 chars)
- titleVariants: [{ title, formula, rationale }]
- description: full formatted description with \\n line breaks
- tags: string array (15-20)
- chapters: [{ timestamp, label }]
- hashtags: string array (3-5)
- category: YouTube category name
- madeForKids: boolean
- scheduledTime: ISO 8601 datetime
- thumbnailABVariants: [{ concept, emotion, textOverlay }]
- expectedCTR: "low" | "medium" | "high"
- seoStrengthScore: 1-10
- seoNotes: brief explanation
- shortsTitle?: string (under 40 chars, if Shorts)
- shortsDescription?: string
- shortsHashtags?: string[]
- shortsScheduledTime?: string (2-3 hrs before main)

Return ONLY the JSON object, no markdown fences.`;

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { researchOutput, scriptOutput, generateShorts } = body as {
    researchOutput: ResearchOutput;
    scriptOutput: ScriptOutput;
    generateShorts?: boolean;
  };

  if (!researchOutput || !scriptOutput) {
    return Response.json(
      { error: "Research and script outputs are required" },
      { status: 400 }
    );
  }

  try {
    const userPrompt = `Optimise YouTube SEO for this video.

## Research Brief (keywords, audience, competitor gap)
${JSON.stringify(
  {
    topic: researchOutput.topic,
    videoType: researchOutput.videoType,
    targetAudience: researchOutput.targetAudience,
    keywords: researchOutput.keywords,
    seoTitles: researchOutput.seoTitles,
    competitorGap: researchOutput.competitorGap,
    thumbnailConcept: researchOutput.thumbnailConcept,
  },
  null,
  2
)}

## Script Summary
Title: ${scriptOutput.title}
Duration: ${scriptOutput.duration} minutes
Sections: ${scriptOutput.sections.map((s) => s.label).join(", ")}
Chapters: ${scriptOutput.chapters.map((c) => `${c.timestamp} ${c.label}`).join(" | ")}

${generateShorts ? "ALSO GENERATE: Shorts SEO metadata (title < 40 chars, description, hashtags including #Shorts, schedule 2-3 hrs before main)" : "No Shorts metadata needed."}

Generate the complete SEO metadata now.`;

    const seo = await callBedrockJSON<SEOOutput>({
      model: "sonnet",
      systemPrompt: SEO_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.6,
      enableCache: true,
    });

    return Response.json({ success: true, data: seo });
  } catch (error) {
    console.error("[seo] Pipeline error:", error);
    return Response.json(
      {
        error: "SEO generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

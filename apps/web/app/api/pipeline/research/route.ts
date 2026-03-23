import { auth } from "@clerk/nextjs/server";
import { callBedrockJSON } from "@/lib/bedrock";
import { fetchPagesInParallel, pickBestUrls } from "@/lib/crawler";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import type { ResearchOutput } from "@/lib/types/pipeline";

// ─── Research system prompt ─────────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `You are an expert YouTube content researcher. Your job is to produce a structured, insight-rich research brief that becomes the foundation for a video script, SEO metadata, and thumbnail.

## Output Requirements
Return a single JSON object with these exact keys:
- topic: cleaned canonical topic name
- videoType: one of "howto" | "comparison" | "explainer" | "story" | "opinion" | "list"
- targetAudience: specific description
- summary: 2-3 sentences, core insight
- hook: single sentence, most surprising/provocative angle — must make someone stop scrolling
- keyFacts: array of { fact, source, recency: "recent"|"evergreen" }
- pros: array of { point, detail }
- cons: array of { point, detail }
- commonMisconceptions: string array
- controversialAngle: a take that challenges conventional wisdom
- reEngagementMoments: mid-video revelations that justify watching past 50%
- seoTitles: array of { title, formula, estimatedCTR, rexScore } where rexScore is an integer 0–100 reflecting Rex's confidence this title will outperform competitors — factor in curiosity gap strength, keyword placement in first 4 words, specificity, emotional pull, and formula fit for the topic. The title with the highest rexScore is Rex's genuine recommendation.
- keywords: { primary: [], secondary: [], longTail: [] } — longTail must include 3+ full question phrases
- thumbnailConcept: { emotion, textOverlay (max 4 words), visualIdea, colorScheme }
- competitorGap: what existing top videos are missing
- comparativeData: array of subject objects with verified attributes and source URLs
- timeline: array of { date, event, significance, sourceUrl }
- citations: array of { id, title, url, fetchedAt }
- viralPotential: { score: "LOW"|"MEDIUM"|"HIGH", reasoning, shareTrigger }
- geoContext: null (unless specified)

## Quality Standards
- Hook must NOT start with "In this video" — must be specific and provocative
- Pros/cons must be genuinely balanced, not promotional
- Keywords must include at least 3 long-tail question phrases
- Controversial angle must be defensible, not clickbait
- All data points must have source attribution

Return ONLY the JSON object, no markdown fences.`;

// ─── Free API helpers ───────────────────────────────────────────────────────

async function fetchReddit(topic: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(topic);
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encoded}&sort=top&limit=10`,
      { headers: { "User-Agent": "RRQ-ContentFactory/1.0" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const posts = (data as { data?: { children?: Array<{ data: { title: string; selftext: string; score: number } }> } }).data?.children ?? [];
    return posts
      .slice(0, 5)
      .map(
        (p: { data: { title: string; selftext: string; score: number } }) =>
          `[Score: ${p.data.score}] ${p.data.title}\n${p.data.selftext?.slice(0, 300) ?? ""}`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

async function fetchNewsAPI(topic: string): Promise<string> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return "";
  try {
    const encoded = encodeURIComponent(topic);
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${encoded}&pageSize=5&apiKey=${apiKey}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const articles = (data as { articles?: Array<{ title: string; description: string; url: string }> }).articles ?? [];
    return articles
      .map(
        (a: { title: string; description: string; url: string }) =>
          `${a.title}\n${a.description ?? ""}\nSource: ${a.url}`
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

async function fetchWikipedia(topic: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(topic.replace(/ /g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return (data as { extract?: string }).extract ?? "";
  } catch {
    return "";
  }
}

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
  const { topic, duration, tone, videoType } = body as {
    topic: string;
    duration: number;
    tone: string;
    videoType?: string;
  };

  if (!topic?.trim()) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }

  const { stream, emit, done } = createSSEStream();

  (async () => {
    try {
      // Stage 0 — fetch external sources + live web search
      emit({ type: "status_line", message: "Rex is scouting the landscape…" });
      const now = new Date();
      const currentYear = now.getFullYear();
      const [redditData, newsData, wikiData, searchResults] = await Promise.all([
        fetchReddit(topic),
        fetchNewsAPI(topic),
        fetchWikipedia(topic),
        webSearch(`${topic} ${currentYear} latest news updates`, 8),
      ]);
      const webSearchData = formatSearchResults(searchResults, `Live Web Search — ${topic} (${currentYear})`);
      emit({ type: "stage_complete", stageIndex: 0 });

      // Stage 1 — crawl content
      emit({ type: "status_line", message: "Rex is reading the room…" });
      let crawledContent = "";
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_BROWSER_RENDERING_TOKEN) {
        const searchUrls = [
          `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/ /g, "_"))}`,
        ];
        const pages = await fetchPagesInParallel(
          pickBestUrls(
            searchUrls.map((url) => ({ url })),
            videoType ?? "explainer"
          )
        );
        crawledContent = pages
          .map((p) => `### Source: ${p.url}\n${p.content.slice(0, 3000)}`)
          .join("\n\n---\n\n");
      }
      emit({ type: "stage_complete", stageIndex: 1 });

      // Stage 2 — Bedrock synthesis
      emit({ type: "status_line", message: "Rex is putting it all together…" });
      const currentDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const userPrompt = `Research this topic thoroughly for a YouTube video.

TODAY: ${currentDate} (${currentYear}). Use only current information. Treat anything from before ${currentYear} as background context — not "latest".

TOPIC: ${topic}
TARGET DURATION: ${duration} minutes
TONE: ${tone}
${videoType ? `VIDEO TYPE: ${videoType}` : "Determine the best video type."}

## Available Research Data

${webSearchData || ""}

### Reddit Community Discussion
${redditData || "No Reddit data available."}

### News Coverage
${newsData || "No news data available."}

### Wikipedia Summary
${wikiData || "No Wikipedia data available."}

### Full Page Content (Cloudflare Crawl)
${crawledContent || "No crawled content available."}

Based on all available research data, produce the complete research brief JSON. Prioritise the most recent sources. Every data point must be attributed to a source. Generate at least 5 seoTitles each with a rexScore (0–100), 8+ keyFacts, and 3+ reEngagementMoments. The title with the highest rexScore is Rex's pick.`;

      const research = await callBedrockJSON<ResearchOutput>({
        model: "opus",
        systemPrompt: RESEARCH_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 8192,
        temperature: 0.7,
        enableCache: true,
      });
      emit({ type: "stage_complete", stageIndex: 2 });

      emit({ type: "result", data: research });
    } catch (error) {
      console.error("[research] Pipeline error:", error);
      emit({ type: "error", error: error instanceof Error ? error.message : "Research generation failed" });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

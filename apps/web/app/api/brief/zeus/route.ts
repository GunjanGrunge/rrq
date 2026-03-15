import { auth } from "@clerk/nextjs/server";
import { callBedrockStream } from "@/lib/bedrock";

const ZEUS_SYSTEM = `You are Zeus, the head of the RRQ content team. Your job is to sharpen a creator's video idea through a short, focused conversation — then hand off a clean brief to production.

You ask ONE question at a time. Never ask multiple questions in one message. Keep your tone sharp, direct, and confident — like a seasoned director, not a chatbot.

Your goals in this conversation:
1. Understand the exact angle they want (not just the topic)
2. Identify who this is for (audience specificity)
3. Understand what emotion or outcome they want the viewer to leave with
4. Flag any ambiguity that would make a bad video (too broad, too similar to existing content, no clear POV)

NICHE CORRECTION: If the topic the creator describes clearly belongs to a different niche than what they selected, point it out and ask if they want to switch. Example: if they selected "Entertainment" but describe F1 racing, say "That sounds like Sports territory — should I update your niche to Sports?" If they confirm, end your message with [NICHE_CHANGE: <exact niche value>]. If they say no, accept their intent and continue. Valid niche values: "AI & Technology", "Finance & Investing", "Health & Wellness", "Business & Entrepreneurship", "Gaming", "Science & Space", "News & Current Events", "Sports", "Entertainment & Pop Culture", "Politics & Society", "Education", "Lifestyle".

TONE RECOMMENDATION: When you are ready to confirm the brief, pick 1-2 tones that best fit the topic, niche, and angle. Briefly explain your reasoning in natural language (one sentence), then end your message with [BRIEF_READY] and [TONE: <values>] on the same line.
Valid tone values: "informative", "entertaining", "documentary", "controversial", "persuasive".
Example ending: "Going with Informative + Entertaining — data hook to pull them in, story structure to keep them. [BRIEF_READY] [TONE: informative, entertaining]"

Never say "Great!" or "That's interesting!" — just respond directly. No filler.
Return only your message text, nothing else. Never include both [NICHE_CHANGE] and [BRIEF_READY] in the same message.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, topic, niche, tone, isOpening } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    topic: string;
    niche: string[];
    tone: string[];
    isOpening?: boolean;
  };

  const context = `
Topic: ${topic || "not yet specified"}
Niche: ${niche.length > 0 ? niche.join(", ") : "not specified"}
Tone: ${tone.length > 0 ? tone.join(", ") : "not specified"}
`.trim();

  let userPrompt: string;

  if (isOpening) {
    userPrompt = `${context}

The creator just locked in their niche: ${niche.join(", ")}. Greet them and ask what kind of video they are planning. Keep it to one short greeting sentence and one direct question. No filler.`;
  } else {
    const conversationHistory = messages
      .map((m) => `${m.role === "zeus" ? "Zeus" : "Creator"}: ${m.content}`)
      .join("\n");

    userPrompt = `${context}

Conversation so far:
${conversationHistory}

Continue the conversation. One question only, unless ready to confirm the brief. If the topic doesn't match the selected niche, flag it and ask if they want to switch.`;
  }

  const stream = await callBedrockStream({
    model: "sonnet",
    systemPrompt: ZEUS_SYSTEM,
    userPrompt,
    maxTokens: 300,
    temperature: 0.8,
    enableCache: true,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

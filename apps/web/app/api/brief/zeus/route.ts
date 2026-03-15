import { auth } from "@clerk/nextjs/server";
import { callBedrock } from "@/lib/bedrock";

const ZEUS_SYSTEM = `You are Zeus, the head of the RRQ content team. Your job is to sharpen a creator's video idea through a short, focused conversation — then hand off a clean brief to production.

You ask ONE question at a time. Never ask multiple questions in one message. Keep your tone sharp, direct, and confident — like a seasoned director, not a chatbot.

Your goals in this conversation:
1. Understand the exact angle they want (not just the topic)
2. Identify who this is for (audience specificity)
3. Understand what emotion or outcome they want the viewer to leave with
4. Flag any ambiguity that would make a bad video (too broad, too similar to existing content, no clear POV)

When you have enough to brief the team (usually 2-3 exchanges), end your message with exactly: [BRIEF_READY]

Never say "Great!" or "That's interesting!" — just respond directly. No filler.
Return only your message text, nothing else.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, topic, niche, tone } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    topic: string;
    niche: string[];
    tone: string[];
  };

  const context = `
Topic: ${topic}
Niche: ${niche.length > 0 ? niche.join(", ") : "not specified"}
Tone: ${tone.length > 0 ? tone.join(", ") : "not specified"}
`.trim();

  const conversationHistory = messages
    .map((m) => `${m.role === "zeus" ? "Zeus" : "Creator"}: ${m.content}`)
    .join("\n");

  const userPrompt = `${context}

Conversation so far:
${conversationHistory}

Continue the conversation. Remember: one question only, unless you are ready to confirm the brief.`;

  const reply = await callBedrock({
    model: "sonnet",
    systemPrompt: ZEUS_SYSTEM,
    userPrompt,
    maxTokens: 300,
    temperature: 0.8,
    enableCache: true,
  });

  const briefReady = reply.includes("[BRIEF_READY]");
  const content = reply.replace("[BRIEF_READY]", "").trim();

  return Response.json({ content, briefReady });
}

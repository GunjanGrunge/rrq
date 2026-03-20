import { getDynamoClient } from "@/lib/aws-clients";
import { callBedrock, callBedrockJSON } from "@/lib/bedrock";
import { queryAgentMemory } from "@/lib/memory/kb-query";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CouncilSession, AgentVote, CouncilVerdict } from "./types";

// ─── Council agent personas ────────────────────────────────────────────────────

const COUNCIL_AGENTS: Array<{
  id: string;
  name: string;
  domain: string;
  focus: string;
}> = [
  {
    id: "rex",
    name: "REX",
    domain: "Intelligence",
    focus: "topic signal strength, confidence score, timing, and competitive gap",
  },
  {
    id: "zara",
    name: "ZARA",
    domain: "Audience",
    focus: "audience resonance, demographic fit, emotional hook, and retention risk",
  },
  {
    id: "aria",
    name: "ARIA",
    domain: "Distribution",
    focus: "algorithmic fit, SEO keyword strength, thumbnail viability, and discovery potential",
  },
  {
    id: "qeon",
    name: "QEON",
    domain: "Production",
    focus: "production feasibility, asset availability, timeline, and quality risk",
  },
  {
    id: "muse",
    name: "MUSE",
    domain: "Creative",
    focus: "narrative architecture, visual blueprint strength, originality, and creative risk",
  },
  {
    id: "regum",
    name: "REGUM",
    domain: "Strategy",
    focus: "channel strategy fit, schedule slot, series potential, and long-term value",
  },
];

// ─── Run council session ───────────────────────────────────────────────────────

export async function runCouncilSession(
  jobId: string,
  qeonBrief: {
    topic: string;
    angle: string;
    niche: string;
    tone: string;
    contentType: string;
    competitorGap: string;
    keywordFocus: string[];
    confidenceScore: number;
  }
): Promise<CouncilSession> {
  const dynamo = getDynamoClient();
  const sessionId = `council-${jobId}-${Date.now()}`;
  const createdAt = new Date().toISOString();

  // Load Zeus memory for context
  let zeusMemory = "";
  try {
    const memories = await queryAgentMemory(
      `Council session: ${qeonBrief.topic} — niche: ${qeonBrief.niche}`,
      3
    );
    if (memories.length > 0) {
      zeusMemory = memories.map((m, i) => `[Memory ${i + 1}] ${m.text}`).join("\n\n");
    }
  } catch (err) {
    console.error(`[council:run:${sessionId}] Memory query failed:`, err);
  }

  // Initialise session in DynamoDB
  const initialSession: CouncilSession = {
    sessionId,
    jobId,
    topic: qeonBrief.topic,
    status: "IN_PROGRESS",
    votes: [],
    theLineSynthesis: "",
    zeusVerdict: "",
    createdAt,
  };

  try {
    await dynamo.send(
      new PutCommand({
        TableName: "council-sessions",
        Item: initialSession,
      })
    );
  } catch (err) {
    console.error(`[council:run:${sessionId}] DynamoDB init failed:`, err);
  }

  const briefContext = `
Topic: ${qeonBrief.topic}
Angle: ${qeonBrief.angle}
Niche: ${qeonBrief.niche}
Tone: ${qeonBrief.tone}
Content type: ${qeonBrief.contentType}
Competitor gap: ${qeonBrief.competitorGap}
Keywords: ${qeonBrief.keywordFocus.join(", ")}
Confidence score: ${qeonBrief.confidenceScore}/100
${zeusMemory ? `\nRelevant Zeus memory:\n${zeusMemory}` : ""}`;

  // Run each agent vote in sequence
  const votes: AgentVote[] = [];
  let rejectCount = 0;

  for (const agent of COUNCIL_AGENTS) {
    try {
      const vote = await callBedrockJSON<{ verdict: CouncilVerdict; rationale: string }>({
        model: "sonnet",
        systemPrompt: `You are ${agent.name}, RRQ's ${agent.domain} agent on the On The Line pre-production council.

Your role: evaluate every production brief from your ${agent.domain} perspective, focusing on ${agent.focus}.

IDENTITY LOCK: You speak only as ${agent.name}. You assess only your domain. You return only the JSON schema provided.

Council rules:
- APPROVED = you are confident this is the right call in your domain
- FLAG = you have concerns but will not block — include specific improvement notes
- REJECT = you believe this brief should not enter production based on your domain assessment

Be direct. Be specific. Back your verdict with evidence from the brief. Max 120 words in rationale.`,
        userPrompt: `Evaluate this production brief and return ONLY valid JSON:

${briefContext}

Return exactly:
{"verdict": "APPROVED"|"FLAG"|"REJECT", "rationale": "your domain assessment"}`,
        maxTokens: 512,
        temperature: 0.4,
      });

      const agentVote: AgentVote = {
        agentId: agent.id,
        verdict: vote.verdict,
        rationale: vote.rationale,
        timestamp: new Date().toISOString(),
      };

      votes.push(agentVote);
      if (vote.verdict === "REJECT") rejectCount++;

      // Write each vote to DynamoDB as it arrives (live updates for UI)
      try {
        await dynamo.send(
          new UpdateCommand({
            TableName: "council-sessions",
            Key: { sessionId },
            UpdateExpression: "SET votes = :votes",
            ExpressionAttributeValues: { ":votes": votes },
          })
        );
      } catch (dbErr) {
        console.error(`[council:run:${sessionId}] Vote write failed for ${agent.id}:`, dbErr);
      }
    } catch (err) {
      console.error(`[council:run:${sessionId}] Agent ${agent.id} vote failed:`, err);
      // Add a default FLAG vote so pipeline doesn't stall
      votes.push({
        agentId: agent.id,
        verdict: "FLAG",
        rationale: "Vote failed — agent unavailable. Flagging for review.",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Detect deadlock: 2+ REJECT votes
  const isDeadlocked = rejectCount >= 2;

  // The Line synthesis (Opus)
  let theLineSynthesis = "";
  try {
    theLineSynthesis = await callBedrock({
      model: "opus",
      systemPrompt: `You are THE LINE, RRQ's synthesis layer. You read all council agent votes and produce a single clear recommendation for Zeus.

Be concise. Be surgical. Zeus has limited time. Max 200 words.`,
      userPrompt: `Synthesise this council session for Zeus.

Brief: ${qeonBrief.topic} — ${qeonBrief.angle} (${qeonBrief.niche})

Agent votes:
${votes.map((v) => `${v.agentId.toUpperCase()}: ${v.verdict} — "${v.rationale}"`).join("\n")}

Deadlock detected: ${isDeadlocked ? "YES — 2+ REJECT votes" : "NO"}

Provide: (1) overall picture, (2) key risks if any, (3) your recommendation to Zeus.`,
      maxTokens: 512,
      temperature: 0.5,
    });
  } catch (err) {
    console.error(`[council:run:${sessionId}] The Line synthesis failed:`, err);
    theLineSynthesis = "The Line synthesis unavailable. Zeus reviewing raw votes.";
  }

  // Zeus final sign-off (Opus)
  let zeusVerdict = "";
  let finalStatus: CouncilSession["status"] = "APPROVED";
  let deadlockReason: string | undefined;

  try {
    const zeusDecision = await callBedrockJSON<{
      decision: "APPROVED" | "DEFERRED";
      reasoning: string;
      deadlockResolution?: string;
    }>({
      model: "opus",
      systemPrompt: `You are ZEUS, head of RRQ. You make the final production go/no-go decision.

If deadlock detected: Zeus rules on domain conflicts, Jason rules on process conflicts. You break the deadlock.
If no deadlock: validate The Line's synthesis and make the call.

Return ONLY valid JSON.`,
      userPrompt: `Make the final council decision.

Brief: ${qeonBrief.topic} — ${qeonBrief.angle}
The Line synthesis: ${theLineSynthesis}

Votes (${rejectCount} REJECT, ${votes.filter((v) => v.verdict === "FLAG").length} FLAG, ${votes.filter((v) => v.verdict === "APPROVED").length} APPROVED):
${votes.map((v) => `${v.agentId.toUpperCase()}: ${v.verdict}`).join(" | ")}

Return: {"decision": "APPROVED"|"DEFERRED", "reasoning": "...", "deadlockResolution": "..." (only if deadlock)}`,
      maxTokens: 512,
      temperature: 0.3,
    });

    zeusVerdict = `${zeusDecision.decision}: ${zeusDecision.reasoning}`;
    finalStatus = zeusDecision.decision === "APPROVED" ? "APPROVED" : "DEFERRED";
    if (isDeadlocked && zeusDecision.deadlockResolution) {
      deadlockReason = zeusDecision.deadlockResolution;
      finalStatus = "DEADLOCKED";
    }
  } catch (err) {
    console.error(`[council:run:${sessionId}] Zeus verdict failed:`, err);
    zeusVerdict = "Zeus verdict unavailable — defaulting to DEFERRED pending manual review";
    finalStatus = "DEFERRED";
  }

  const resolvedAt = new Date().toISOString();

  const session: CouncilSession = {
    sessionId,
    jobId,
    topic: qeonBrief.topic,
    status: finalStatus,
    votes,
    theLineSynthesis,
    zeusVerdict,
    deadlockReason,
    createdAt,
    resolvedAt,
  };

  // Write final session to DynamoDB
  try {
    await dynamo.send(
      new PutCommand({
        TableName: "council-sessions",
        Item: session,
      })
    );
  } catch (err) {
    console.error(`[council:run:${sessionId}] Final DynamoDB write failed:`, err);
  }

  return session;
}

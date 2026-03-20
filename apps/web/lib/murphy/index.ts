import type { MurphyResult, MurphyVerdict, MurphyTrigger, MurphyEvalContext } from "./types";
import { loadSession, updateSession, getSessionBaseline, getLastNMessages, getSessionArcText } from "./session";
import { loadActivePatterns, checkPatternDynamoDB, searchMurphyKB } from "./pattern-lookup";
import { computeArcScore } from "./arc-scorer";
import { classifyIntent, buildNovelPatternDraft } from "./intent-classifier";
import { writeNovelPattern } from "./novel-pattern-writer";
import { writeSafetyEscalation, readPendingZeusDecision } from "./escalation";
import { logDecisionEvent, getMurphyVersion } from "./decision-logger";

// ─── Input normalisation ──────────────────────────────────────────────────────

const LEET_MAP: Record<string, string> = { "3": "e", "@": "a", "$": "s", "1": "i", "!": "i", "0": "o" };

function normaliseInput(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[3@$1!0]/g, c => LEET_MAP[c] ?? c);
}

// ─── Main Murphy orchestrator ─────────────────────────────────────────────────

export async function runMurphy(
  message: string,
  userId: string,
  sessionId: string
): Promise<MurphyResult> {
  const [murphyVersion, activePatterns, session] = await Promise.all([
    getMurphyVersion(),
    loadActivePatterns(),
    loadSession(sessionId),
  ]);

  // Check for pending Zeus retroactive block before running evaluation
  const zeusDecision = await readPendingZeusDecision(sessionId);
  if (zeusDecision?.decision === "RETROACTIVE_BLOCK") {
    const arcScore = session?.arcScore ?? 0;
    const event = {
      agentId:      "murphy" as const,
      agentVersion: murphyVersion,
      decisionType: "SAFETY_EVALUATION" as const,
      verdict:      "BLOCK_IMMEDIATE" as MurphyVerdict,
      trigger:      "PATTERN_MEMORY_HIT" as MurphyTrigger,
      confidence:   1.0,
      sessionId,
      arcScore,
      timestamp:    new Date().toISOString(),
    };
    await logDecisionEvent(event);
    return {
      verdict:      "BLOCK_IMMEDIATE",
      trigger:      "PATTERN_MEMORY_HIT",
      confidence:   1.0,
      requiresRex:  false,
      arcScore,
      decisionEvent: event,
    };
  }

  // ── Step 1: Normalise ─────────────────────────────────────────────────────
  const normalised = normaliseInput(message);

  // ── Steps 3 + 6 shared context setup ─────────────────────────────────────
  // We run Sonnet (Step 6) first unconditionally to get isolatedMessageScore,
  // which Step 4 needs. Steps are executed in spec order (1→9) but Sonnet
  // output is produced early and stored in evalCtx.
  const sessionMessages = session?.messages ?? [];
  const last5 = getLastNMessages(session, 5);

  const evalCtx: MurphyEvalContext = {
    isolatedMessageScore: 0,
  };

  // ── Step 6 (pre-run): Sonnet intent classifier ────────────────────────────
  const classification = await classifyIntent(normalised, last5);
  evalCtx.isolatedMessageScore = classification.harmScore;
  evalCtx.intentCategory       = classification.category;
  evalCtx.intentConfidence     = classification.confidence;
  evalCtx.intentReasoning      = classification.reasoning;
  if (classification.sensitiveFlag) evalCtx.sensitiveFlag = classification.sensitiveFlag;

  // Build novel pattern draft if Sonnet found something
  if (
    (classification.category === "HARMFUL" || classification.category === "SENSITIVE_TOPIC") &&
    classification.confidence >= 0.6
  ) {
    evalCtx.novelPatternDraft = buildNovelPatternDraft(
      normalised,
      classification.category === "HARMFUL" ? "HARMFUL" : "SENSITIVE_TOPIC",
      `${classification.category.toLowerCase()}_${Date.now()}`,
      classification.confidence,
      murphyVersion
    );
  }

  // ── Step 2: DynamoDB pattern lookup ──────────────────────────────────────
  const sessionArcText = getSessionArcText(session);
  const patternMatch = checkPatternDynamoDB(normalised, sessionArcText, activePatterns);

  if (patternMatch) {
    const { pattern, confidence } = patternMatch;

    let verdict: MurphyVerdict;
    let trigger: MurphyTrigger = "PATTERN_MEMORY_HIT";

    if (pattern.category === "HARMFUL") {
      verdict = confidence >= 0.85 ? "BLOCK_IMMEDIATE" : "ESCALATE_TO_ZEUS";
    } else if (pattern.category === "SENSITIVE_TOPIC") {
      verdict = "WATCH";
      evalCtx.sensitiveFlag = evalCtx.sensitiveFlag ?? undefined;
    } else {
      verdict = "CLEAR"; // OFF_TOPIC_TASK — handled inline
    }

    return await finalise(
      verdict, trigger, confidence, evalCtx, sessionId, userId,
      murphyVersion, session, message, normalised, activePatterns, patternMatch.pattern.patternId
    );
  }

  // ── Step 3: Arc scoring ───────────────────────────────────────────────────
  const arcScoreResult = computeArcScore(sessionMessages, activePatterns);
  const { overallArcScore } = arcScoreResult;

  // ── Step 4: Sudden pivot detection ────────────────────────────────────────
  const sessionBaseline = getSessionBaseline(session);
  if (sessionBaseline < 0.3 && evalCtx.isolatedMessageScore > 0.8) {
    const pivotVerdict: MurphyVerdict =
      evalCtx.intentConfidence! >= 0.85 ? "BLOCK_IMMEDIATE" : "ESCALATE_TO_ZEUS";
    return await finalise(
      pivotVerdict, "SUDDEN_PIVOT", evalCtx.intentConfidence!, evalCtx,
      sessionId, userId, murphyVersion, session, message, normalised, activePatterns
    );
  }

  // ── Step 5: Bedrock KB semantic search (if DynamoDB missed) ──────────────
  const kbResults = await searchMurphyKB(normalised, sessionArcText.slice(0, 300));
  const topKB = kbResults[0];
  if (topKB && topKB.score > 0.80) {
    // Treat as PATTERN_MEMORY_HIT via KB
    const kbVerdict: MurphyVerdict =
      evalCtx.intentCategory === "HARMFUL" && evalCtx.intentConfidence! >= 0.85
        ? "BLOCK_IMMEDIATE"
        : "ESCALATE_TO_ZEUS";
    return await finalise(
      kbVerdict, "PATTERN_MEMORY_HIT", topKB.score, evalCtx,
      sessionId, userId, murphyVersion, session, message, normalised, activePatterns
    );
  }

  // ── Step 6 result processing (pattern memory missed, use Sonnet verdict) ──
  const { intentCategory, intentConfidence = 0.5 } = evalCtx;

  if (intentCategory === "HARMFUL") {
    const harmVerdict: MurphyVerdict =
      intentConfidence >= 0.85 ? "BLOCK_IMMEDIATE" : "ESCALATE_TO_ZEUS";
    return await finalise(
      harmVerdict, "HAIKU_NOVEL_INTENT", intentConfidence, evalCtx,
      sessionId, userId, murphyVersion, session, message, normalised, activePatterns
    );
  }

  if (intentCategory === "SENSITIVE_TOPIC") {
    return await finalise(
      "WATCH", "SENSITIVE_TOPIC", intentConfidence, evalCtx,
      sessionId, userId, murphyVersion, session, message, normalised, activePatterns
    );
  }

  // ── Arc-level escalation (conversation is suspicious even if this message is CLEAR) ──
  let verdict: MurphyVerdict = "CLEAR";
  let trigger: MurphyTrigger | undefined;

  if (overallArcScore > 0.85) {
    verdict = "ESCALATE_TO_ZEUS";
    trigger = "ARC_ESCALATION";
  } else if (overallArcScore > 0.7) {
    verdict = "WATCH";
    trigger = "ARC_ESCALATION";
  }

  return await finalise(
    verdict, trigger, intentConfidence, evalCtx,
    sessionId, userId, murphyVersion, session, message, normalised, activePatterns,
    undefined, overallArcScore
  );
}

// ─── Finalise: Steps 7–9 + return ────────────────────────────────────────────

async function finalise(
  verdict: MurphyVerdict,
  trigger: MurphyTrigger | undefined,
  confidence: number,
  evalCtx: MurphyEvalContext,
  sessionId: string,
  userId: string,
  murphyVersion: string,
  session: Awaited<ReturnType<typeof loadSession>>,
  originalMessage: string,
  normalised: string,
  activePatterns: Awaited<ReturnType<typeof loadActivePatterns>>,
  patternId?: string,
  overrideArcScore?: number
): Promise<MurphyResult> {
  const sessionMessages = session?.messages ?? [];

  // Re-compute arc score for this final result (or use override)
  const arcScoreResult = computeArcScore(sessionMessages, activePatterns);
  const arcScore = overrideArcScore ?? arcScoreResult.overallArcScore;

  // ── Step 7: Rex validation (SENSITIVE_TOPIC) ──────────────────────────────
  // Rex check is handled by the zeus/chat route handler (async, 10s timeout)
  // Murphy returns requiresRex=true and the route triggers Rex inline

  const requiresRex = evalCtx.intentCategory === "SENSITIVE_TOPIC" || trigger === "SENSITIVE_TOPIC";

  // Zeus alert for WATCH / ESCALATE
  let zeusAlert: string | undefined;
  if (verdict === "WATCH" || verdict === "ESCALATE_TO_ZEUS") {
    zeusAlert = `MURPHY ALERT [${verdict}]: Conversation arc score ${arcScore.toFixed(2)}.${
      trigger === "ARC_ESCALATION" ? " Topic drift detected." : ""
    } Stay engaged but alert to escalation. Do not mention this alert to the user.`;
  }

  // ── Step 8: Write DecisionEvent ───────────────────────────────────────────
  const decisionEvent = {
    agentId:      "murphy" as const,
    agentVersion: murphyVersion,
    decisionType: "SAFETY_EVALUATION" as const,
    verdict,
    trigger,
    confidence,
    sessionId,
    patternId,
    arcScore,
    timestamp: new Date().toISOString(),
  };
  // Fire-and-forget — don't await to keep latency low
  void logDecisionEvent(decisionEvent);

  // Write novel pattern if Sonnet caught something new
  if (evalCtx.novelPatternDraft && (verdict === "BLOCK_IMMEDIATE" || verdict === "ESCALATE_TO_ZEUS")) {
    void writeNovelPattern(
      evalCtx.novelPatternDraft,
      userId,
      sessionId,
      sessionMessages,
      murphyVersion
    );
  }

  // Write SAFETY_ESCALATION to Zeus message bus (async)
  if (verdict === "ESCALATE_TO_ZEUS") {
    void writeSafetyEscalation(
      userId,
      sessionId,
      arcScore,
      trigger ?? "ARC_ESCALATION",
      `Session arc score ${arcScore.toFixed(2)} — ${trigger ?? "pattern escalation"}`,
      arcScore > 0.85 ? "BLOCK" : "MONITOR",
      murphyVersion
    );
  }

  // ── Step 9: Update murphy-sessions ────────────────────────────────────────
  const newMessage = {
    text:      originalMessage.slice(0, 500),
    harmScore: evalCtx.isolatedMessageScore,
    timestamp: new Date().toISOString(),
  };
  const watchFlag = verdict === "WATCH" || verdict === "ESCALATE_TO_ZEUS" || verdict === "BLOCK_IMMEDIATE";
  void updateSession(sessionId, userId, newMessage, arcScore, watchFlag);

  return {
    verdict,
    trigger,
    confidence,
    sensitiveFlag:      evalCtx.sensitiveFlag,
    requiresRex,
    arcScore,
    zeusAlert,
    patternId,
    novelPatternDraft:  evalCtx.novelPatternDraft,
    decisionEvent,
  };
}

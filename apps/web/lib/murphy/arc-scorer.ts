import type { ArcScore, SessionMessage, MurphyPattern } from "./types";

// ─── Arc Scoring Formula ──────────────────────────────────────────────────────
// Deterministic — no LLM call.
// topicDrift (0.25) + escalationVelocity (0.35) + sensitiveTermDensity (0.25) + patternSimilarity (0.15)

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(w => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function computeTopicDrift(messages: SessionMessage[]): number {
  if (messages.length < 2) return 0;
  const first = tokenise(messages[0].text);
  const current = tokenise(messages[messages.length - 1].text);
  return 1 - jaccardSimilarity(first, current);
}

function computeEscalationVelocity(messages: SessionMessage[]): number {
  // Guard: dormant until at least 3 messages
  if (messages.length < 3) return 0;

  const scores = messages.map(m => m.harmScore);
  const first3avg = scores.slice(0, 3).reduce((s, x) => s + x, 0) / 3;
  const last3avg = scores.slice(-3).reduce((s, x) => s + x, 0) / 3;
  const velocity = (last3avg - first3avg) / Math.max(first3avg, 0.01);
  return Math.min(Math.max(velocity, 0), 1);
}

function computeSensitiveTermDensity(
  messages: SessionMessage[],
  activePatterns: MurphyPattern[]
): number {
  if (messages.length === 0 || activePatterns.length === 0) return 0;

  const corpus = messages.map(m => m.text.toLowerCase()).join(" ");
  let matchCount = 0;
  for (const pattern of activePatterns) {
    for (const token of pattern.triggerTokens) {
      if (corpus.includes(token.toLowerCase())) matchCount++;
    }
  }
  return Math.min(matchCount / (messages.length * 2), 1.0);
}

function computePatternSimilarity(
  messages: SessionMessage[],
  activePatterns: MurphyPattern[]
): number {
  if (messages.length === 0 || activePatterns.length === 0) return 0;

  const sessionCorpus = tokenise(messages.map(m => m.text).join(" "));
  let maxSimilarity = 0;
  for (const pattern of activePatterns) {
    const patternTokens = new Set(pattern.triggerTokens);
    const sim = jaccardSimilarity(sessionCorpus, patternTokens);
    if (sim > maxSimilarity) maxSimilarity = sim;
  }
  return maxSimilarity;
}

export function computeArcScore(
  messages: SessionMessage[],
  activePatterns: MurphyPattern[]
): ArcScore {
  const topicDrift          = computeTopicDrift(messages);
  const escalationVelocity  = computeEscalationVelocity(messages);
  const sensitiveTermDensity = computeSensitiveTermDensity(messages, activePatterns);
  const patternSimilarity   = computePatternSimilarity(messages, activePatterns);

  const overallArcScore =
    topicDrift          * 0.25 +
    escalationVelocity  * 0.35 +
    sensitiveTermDensity * 0.25 +
    patternSimilarity   * 0.15;

  return {
    topicDrift,
    escalationVelocity,
    sensitiveTermDensity,
    patternSimilarity,
    overallArcScore: Math.min(overallArcScore, 1),
  };
}

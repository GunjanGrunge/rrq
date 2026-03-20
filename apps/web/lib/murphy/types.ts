// ─── Murphy Agent — Type Definitions ─────────────────────────────────────────

export type MurphyVerdict =
  | "CLEAR"              // message is clean, pass to Zeus
  | "WATCH"              // message passed but session is suspicious — Zeus on alert
  | "ESCALATE_TO_ZEUS"   // pattern detected — Zeus decides async, current = WATCH
  | "BLOCK_IMMEDIATE";   // clearly harmful — block now, log strike, warn user

export type MurphyTrigger =
  | "PATTERN_MEMORY_HIT"  // matched known pattern in DynamoDB or KB
  | "HAIKU_NOVEL_INTENT"  // Sonnet caught something pattern memory missed
  | "ARC_ESCALATION"      // conversation trajectory matches escalation arc
  | "SUDDEN_PIVOT"        // user was clean, suddenly injected harmful content
  | "SENSITIVE_TOPIC";    // grey-zone — Rex validation required

export type IntentCategory =
  | "VALID"
  | "OFF_TOPIC_TASK"
  | "HARMFUL"
  | "SENSITIVE_TOPIC";

export interface ArcScore {
  topicDrift:           number;  // 0–1
  escalationVelocity:   number;  // 0–1
  sensitiveTermDensity: number;  // 0–1
  patternSimilarity:    number;  // 0–1
  overallArcScore:      number;  // weighted composite
}

export interface SessionMessage {
  text:      string;
  harmScore: number;  // 0–1 — per-message Sonnet harm score
  timestamp: string;  // ISO
}

export interface MurphySession {
  sessionId:       string;
  userId:          string;
  messages:        SessionMessage[];  // sliding window, max 20, FIFO
  arcScore:        number;
  watchFlag:       boolean;
  lastEvaluatedAt: string;
}

export interface MurphyPattern {
  patternId:      string;
  category:       "HARMFUL" | "SENSITIVE_TOPIC" | "OFF_TOPIC_TASK";
  intentLabel:    string;
  triggerTokens:  string[];
  exampleMessage: string;
  confidence:     number;
  arcContext:     string | null;
  createdFrom:    "HAIKU_NOVEL" | "ZEUS_MANUAL" | "ORACLE_AUDIT";
  status:         "PENDING_ORACLE" | "ACTIVE" | "REJECTED" | "DEPRECATED";
  version:        string;
  createdAt:      string;
  approvedAt:     string | null;
  approvedBy:     "ORACLE" | null;
}

export interface NovelPattern {
  patternId:      string;
  category:       MurphyPattern["category"];
  intentLabel:    string;
  triggerTokens:  string[];
  exampleMessage: string;
  confidence:     number;
  arcContext:     string | null;
}

export interface MurphyDecisionEvent {
  agentId:       "murphy";
  agentVersion:  string;
  decisionType:  "SAFETY_EVALUATION";
  verdict:       MurphyVerdict;
  trigger?:      MurphyTrigger;
  confidence:    number;
  sessionId:     string;
  patternId?:    string;
  arcScore:      number;
  timestamp:     string;
}

export interface MurphyResult {
  verdict:            MurphyVerdict;
  trigger?:           MurphyTrigger;
  confidence:         number;
  sensitiveFlag?:     "CRIME_NEWS" | "VIOLENCE_NEWS" | "POLITICAL";
  requiresRex:        boolean;
  arcScore:           number;
  zeusAlert?:         string;
  patternId?:         string;
  novelPatternDraft?: NovelPattern;
  decisionEvent:      MurphyDecisionEvent;
}

// Shared context built during evaluation — avoids running Sonnet twice
export interface MurphyEvalContext {
  isolatedMessageScore: number;  // Sonnet single-message harm score (Step 6 → read by Step 4)
  intentCategory?:      IntentCategory;
  intentConfidence?:    number;
  intentReasoning?:     string;
  sensitiveFlag?:       MurphyResult["sensitiveFlag"];
  novelPatternDraft?:   NovelPattern;
}

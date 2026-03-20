// ─── On The Line Council — Types ──────────────────────────────────────────────

export type CouncilVerdict = "APPROVED" | "FLAG" | "REJECT";

export type CouncilSessionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "DEFERRED"
  | "DEADLOCKED";

export interface AgentVote {
  agentId: string;
  verdict: CouncilVerdict;
  rationale: string;
  timestamp: string;
}

export interface CouncilSession {
  sessionId: string;
  jobId: string;
  topic: string;
  status: CouncilSessionStatus;
  votes: AgentVote[];
  theLineSynthesis: string;
  zeusVerdict: string;
  deadlockReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

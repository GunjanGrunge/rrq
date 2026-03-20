// ─── RRQ Retro — Types ────────────────────────────────────────────────────────

export type RetroStatus =
  | "MONITORING"
  | "ON_TRACK"
  | "CONCERN"
  | "EMERGENCY"
  | "COMPLETED";

export type RetroOutcome = "WIN_RECORD" | "MISS_RECORD";

export interface Day2Result {
  ctr: number;
  impressions: number;
  retention: number;
  state: "ON_TRACK" | "CONCERN" | "EMERGENCY";
  evaluatedAt: string;
}

export interface RetroSession {
  sessionId: string;
  videoId: string;
  jobId: string;
  channelId: string;
  topic: string;
  status: RetroStatus;
  day2Result?: Day2Result;
  currentDay: number;
  targetHit: boolean;
  outcome?: RetroOutcome;
  theLineSynthesis?: string;
  completedAt?: string;
  createdAt: string;
}

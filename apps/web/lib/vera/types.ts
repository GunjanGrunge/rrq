// ─── Vera QA — Types ──────────────────────────────────────────────────────────

export type VeraDomain = "AUDIO" | "VISUAL" | "STANDARDS";

export type VeraVerdict = "PASS" | "FAIL";

export type VeraFinalStatus = "CLEARED" | "WARNING" | "HOLD";

export interface DomainResult {
  domain: VeraDomain;
  verdict: VeraVerdict;
  score: number;
  findings: string[];
}

export interface VeraQAResult {
  jobId: string;
  status: VeraFinalStatus;
  domains: DomainResult[];
  failedDomains: VeraDomain[];
  report: string;
  completedAt: string;
}

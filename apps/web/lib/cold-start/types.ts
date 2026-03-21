// ─── Cold Start Deep Research — Shared Types ────────────────────────────────

export type ColdStartStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETE"
  | "FAILED";

export type SprintPhase =
  | "REX_SCAN"
  | "SNIPER_AUDIT"
  | "ORACLE_PATTERNS"
  | "THE_LINE_SYNTHESIS"
  | "SHORTLIST"
  | "COUNCIL_SEEDING"
  | "COMPLETE";

export interface TrendingTopic {
  topic: string;
  velocity: "RISING" | "PEAKING" | "DECLINING";
  saturation: "LOW" | "MEDIUM" | "HIGH";
  searchVolume: string;
  narrativeAngle: string;
}

export interface NicheDeepScan {
  niche: string;
  trendingTopics: TrendingTopic[];
  openWindows: TrendingTopic[];      // saturation LOW
  closingWindows: TrendingTopic[];   // saturation HIGH
  driftSignals: string[];
  narrativeLayers: string[];
}

export interface RexDeepScanResult {
  nicheResults: NicheDeepScan[];
  openWindowCount: number;
}

export interface ChannelProfile {
  name: string;
  subscribers: string;
  avgViewsPerVideo: string;
  uploadFrequency: string;
  dominantFormats: string[];
  topAngles: string[];
  weaknesses: string[];
}

export interface NicheAudit {
  niche: string;
  topChannels: ChannelProfile[];
  dominantFormats: string[];
  oversaturatedAngles: string[];
  geoOpportunities: string[];
  avgCPM: string;
}

export interface SniperAuditResult {
  auditResults: NicheAudit[];
  totalChannelsProfiled: number;
}

export interface OraclePatternResult {
  patterns: Array<{
    niche: string;
    historicalFormats: string;
    coldStartPatterns: string;
  }>;
}

export interface ContentGap {
  gap: string;
  why: string;
  opportunity: "HIGH" | "MEDIUM" | "LOW";
  competitors: string[];
}

export interface VideoCandidate {
  rank: number;
  angle: string;
  format: string;
  whyThisFirst: string;
  estimatedCTR: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  testHypothesis: string;
}

export interface SprintSynthesis {
  contentGapMap: ContentGap[];
  oversaturatedAngles: string[];
  firstVideoShortlist: VideoCandidate[];
  coldStartStrategy: string;
  nicheInsights: Record<string, unknown>;
}

export interface ColdStartSprint {
  userId: string;
  sprintId: string;
  channelMode: "FULL_RRQ" | "MULTI_NICHE" | "SINGLE_NICHE";
  selectedNiches: string[];
  sprintStartedAt: string;
  sprintCompletedAt?: string;
  currentPhase: SprintPhase;
  status: ColdStartStatus;
  rexScanSummary?: string;
  sniperAuditSummary?: string;
  contentGapMap?: ContentGap[];
  oversaturatedAngles?: string[];
  firstVideoShortlist?: VideoCandidate[];
  coldStartStrategy?: string;
  syntheticRecordsSeeded?: number;
  error?: string;
}

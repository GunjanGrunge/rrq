import type { RexOpportunity } from "@/lib/rex/rex-scan";

export type RegumDecision = "greenlight" | "hold" | "reject";
export type ContentTone = "informative" | "entertaining" | "documentary" | "controversial";
export type UploadUrgency = "now" | "today" | "thisweek";

export interface QeonBrief {
  briefId: string;
  userId: string; // Clerk userId — required by upload step
  topicId: string;
  topic: string;
  niche: string;

  // Content direction
  angle: string;
  tone: ContentTone;
  targetDuration: number; // minutes
  urgency: UploadUrgency;
  contentType: string; // e.g. "tech-review", "explainer", "news-analysis"

  // Presenter
  presenterId: string | null; // null for faceless/autopilot mode

  // Scheduling
  scheduledPublish: string; // ISO timestamp
  shortsPublish: string; // ISO — 2-3 hrs before main

  // Channel management
  playlistId: string;
  playlistName: string;
  seriesId: string | null;
  endScreenVideoId: string | null;

  // SEO direction
  titleDirection: string;
  keywordFocus: string[];

  // Quality gate threshold
  qualityThreshold: number; // 7–9

  // Context from Zeus memory
  relevantMemories: string[];
  competitorGap: string;
  viewerRequestCount: number;

  // Metadata
  createdAt: string;
  status: "pending" | "picked_up" | "in_progress" | "complete" | "failed";
}

export interface RegumEvaluation {
  topicId: string;
  rexConfidence: number;
  rexUrgency: string;
  rexAngles: string[];
  channelFitScore: number;
  saturationScore: number;
  timingScore: number;
  revenueScore: number;
  audienceRequestScore: number;
  totalScore: number;
  decision: RegumDecision;
  chosenAngle: string;
  reasoning: string;
}

export interface PlaylistRecord {
  playlistId: string;
  name: string;
  niche: string;
  videoCount: number;
  lastUpdated: string;
}

export interface ScheduleSlot {
  timestamp: string; // ISO
  niche: string;
  topicId: string;
  briefId: string;
  urgency: UploadUrgency;
}

export interface AvatarProfile {
  presenterId: string;
  name: string;
  gender: "female" | "male";
  contentAssignment: {
    primaryTypes: string[];
  };
  performanceScores: Record<string, number>; // contentType → score 0–1
  lastUsedAt: number; // unix ms
  s3Key: string;
}

export interface RegumAnalyticsReview {
  whatWorked: string[];
  whatDidnt: string[];
  audienceInsights: string[];
  nicheToDoubleDown: string;
  nicheToReduce: string;
  formatRecommendation: string;
  timingAdjustment: string | null;
  lessonsForZeus: string[];
}

// Re-export to avoid unused import warning on RexOpportunity
export type { RexOpportunity };

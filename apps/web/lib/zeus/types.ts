// ─── Zeus Agent Types ─────────────────────────────────────────────────────────

export type CommentCategory =
  | "topic_quality"
  | "production_quality"
  | "research_accuracy"
  | "topic_timing"
  | "channel_strategy"
  | "viewer_request"
  | "general_praise"
  | "irrelevant";

export type CommentSentiment = "positive" | "negative" | "neutral" | "mixed";

export type CommentAttribution = "rex" | "regum" | "qeon" | "shared" | "none";

export interface CommentClassification {
  commentId: string;
  commentText: string;
  genuine: boolean;
  sentiment: CommentSentiment;
  category: CommentCategory;
  agentAttribution: CommentAttribution;
  pointsAward: number; // 0–3
  insight: string | null;
  isViewerRequest: boolean;
  requestTopic: string | null;
}

export interface VideoHealthScore {
  videoId: string;
  windowHours: 24 | 72;
  ctr: number; // percentage 0–100
  ctrVsChannelAvg: number; // delta vs channel average
  retentionPercent: number; // 0–100
  retentionVsChannelAvg: number;
  totalViews: number;
  subscriberDelta: number;
  commentSentimentAvg: number; // -1 to +1
  sharesAndSaves: number;
  healthScore: number; // 0–100 computed
  action: VideoAction;
  computedAt: string; // ISO
}

export type VideoAction =
  | "MONITOR"
  | "BOOST_SHORTS"
  | "FLAG_UNDERPERFORM"
  | "ARCHIVE";

export interface AgentPerformanceScore {
  agentId: string;
  dailyPoints: number;
  weeklyPoints: number;
  totalPoints: number;
  lastUpdated: string; // ISO
  recentWins: string[]; // last 5 positive events
  recentErrors: string[]; // last 5 negative events
  trend: "improving" | "stable" | "declining";
  overallScore: number; // 0–100
}

export interface ZeusEpisode {
  episodeId: string; // ep-{timestamp}-{topic-slug}
  timestamp: string; // ISO
  agent: "rex" | "regum" | "qeon" | "zeus";
  eventType:
    | "trend_flagged"
    | "content_greenlit"
    | "content_rejected"
    | "video_published"
    | "performance_reviewed"
    | "lesson_learned"
    | "comment_insight"
    | "agent_scored";
  topic: string;
  decision: string;
  reasoning: string;
  outcome: {
    views?: number;
    ctr?: number;
    watchTime?: string;
    commentSentiment?: number;
    subscriberDelta?: number;
  };
  lesson: string; // one sentence — what to do differently next time
  tags: string[];
}

export interface ZeusBrief {
  briefId: string;
  generatedAt: string; // ISO
  channelPhase: string;
  agentScoreSummary: Record<string, number>; // agentId → weekly points
  topInsight: string;
  priorityAction: string;
  watchlistAlerts: string[];
  videoHealthAlerts: string[];
  memoryInjections: Record<string, string>; // agentId → context string
}

export interface AdInsight {
  date: string; // ISO date
  campaignId: string;
  videoId: string;
  views: number;
  clicks: number;
  ctr: number;
  cpv: number; // cost per view
  viewRate: number; // percentage
  spend: number;
  revenueEstimate: number;
  signal: "SCALE" | "PAUSE" | "KILL" | "MONITOR";
  reasoning: string;
  reviewedAt: string; // ISO
}

export interface ZeusDecision {
  decisionId: string;
  decisionType:
    | "arbitration"
    | "agent_score_update"
    | "video_health"
    | "comment_analysis"
    | "ad_review"
    | "memory_write";
  subject: string;
  decision: string;
  reasoning: string;
  involvedAgents: string[];
  timestamp: string; // ISO
  outcome?: string;
}

export interface ChannelAnalytics {
  date: string;
  totalViews: number;
  subscriberCount: number;
  subscribersGained: number;
  avgCTR: number;
  avgWatchTime: number; // minutes
  estimatedRevenue: number;
  topPerformingVideoId: string | null;
  bottomPerformingVideoId: string | null;
}

export interface ZeusDashboard {
  agentScores: {
    rex: { score: number; trend: string; lastWin: string };
    regum: { score: number; trend: string; lastWin: string };
    qeon: { score: number; trend: string; lastWin: string };
    team: { score: number; trend: string };
  };
  channelHealth: {
    viewsToday: number;
    subsGained: number;
    avgCTR: number;
    avgWatchTime: string;
  };
  commentInsights: {
    analysed: number;
    genuine: number;
    topRequest: string;
    topPraise: string;
    topComplaint: string | null;
  };
  memoryLog: {
    agent: string;
    lesson: string;
    timestamp: string;
  }[];
  watchlist: {
    topic: string;
    confidence: number;
    status: string;
  }[];
  recentEpisodes: ZeusEpisode[];
}

export interface CommentBatch {
  videoId: string;
  comments: RawComment[];
}

export interface RawComment {
  commentId: string;
  text: string;
  authorDisplayName: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
}

export interface VideoMemoryRecord {
  videoId: string;
  topic: string;
  publishedAt: string;
  niche: string;
  agentScores: { rex: number; regum: number; qeon: number };
  performance: {
    views: number;
    ctr: number;
    watchTime: number;
    commentSentiment: number;
  };
  lessonsWritten: boolean;
}

// ─── Research Output ─────────────────────────────────────────────────────────

export interface KeyFact {
  fact: string;
  source: string;
  recency: "recent" | "evergreen";
}

export interface ProCon {
  point: string;
  detail: string;
}

export interface SEOTitle {
  title: string;
  formula:
    | "curiosity-gap"
    | "number-list"
    | "how-to"
    | "vs-comparison"
    | "warning";
  estimatedCTR: "high" | "medium" | "low";
  rexScore?: number; // 0–100 — Rex's confidence this title will outperform competitors
}

export interface ThumbnailConcept {
  emotion: string;
  textOverlay: string;
  visualIdea: string;
  colorScheme: string;
}

export interface ComparativeAttribute {
  key: string;
  value: string;
  unit?: string;
  winner?: boolean;
  sourceUrl: string;
  fetchedAt: string;
}

export interface ComparativeSubject {
  subject: string;
  subjectType: "product" | "person" | "event" | "company" | "place";
  imageUrl?: string;
  attributes: ComparativeAttribute[];
}

export interface TimelineEvent {
  date: string;
  event: string;
  significance: string;
  sourceUrl: string;
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  fetchedAt: string;
}

export interface ViralPotential {
  score: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  shareTrigger: string;
}

export interface ResearchOutput {
  topic: string;
  videoType: "howto" | "comparison" | "explainer" | "story" | "opinion" | "list";
  targetAudience: string;
  summary: string;
  hook: string;
  keyFacts: KeyFact[];
  pros: ProCon[];
  cons: ProCon[];
  commonMisconceptions: string[];
  controversialAngle: string;
  reEngagementMoments: string[];
  seoTitles: SEOTitle[];
  keywords: {
    primary: string[];
    secondary: string[];
    longTail: string[];
  };
  thumbnailConcept: ThumbnailConcept;
  competitorGap: string;
  comparativeData: ComparativeSubject[];
  timeline: TimelineEvent[];
  citations: Citation[];
  viralPotential: ViralPotential;
  geoContext: string | null;
  chosenTitleMeta?: {
    isRexPick: boolean;
    rexScore?: number;
    verdict?: "BETTER" | "ON_PAR" | "WEAKER";
    userOverrode: boolean;
  };
}

// ─── Script Output ──────────────────────────────────────────────────────────

export interface VoiceConfig {
  gender: "male" | "female";
  style: "analytical" | "enthusiastic" | "documentary" | "conversational";
  reasoning: string;
}

export type DisplayMode =
  | "avatar-fullscreen"
  | "broll-with-corner-avatar"
  | "broll-only"
  | "visual-asset";

export interface ScriptSection {
  id: string;
  label: string;
  timestampStart: string;
  timestampEnd: string;
  wordCount: number;
  script: string;
  visualNote: string;
  toneNote: string;
  displayMode: DisplayMode;
  visualAssetId?: string;
}

export interface Chapter {
  timestamp: string;
  label: string;
}

export interface CardSuggestion {
  timestamp: string;
  text: string;
  linkTarget: "subscribe" | "playlist" | "video";
}

export type VisualAssetType =
  | "comparison-table"
  | "bar-chart"
  | "line-chart"
  | "radar-chart"
  | "flow-diagram"
  | "infographic-card"
  | "personality-card"
  | "news-timeline"
  | "stat-callout"
  | "animated-infographic"
  | "geo-map";

export interface VisualAsset {
  id: string;
  sectionId: string;
  type: VisualAssetType;
  insertAt: string;
  duration: number;
  animated: boolean;
  data: Record<string, unknown>;
  citations: string[];
}

export interface ShortsScript {
  hook: string;
  body: string;
  onScreenText: string[];
  visualNote: string;
  duration: number;
}

export interface TonyTask {
  task: string;
  context: Record<string, unknown>;
  outputType: "data" | "chart" | "report" | "scrape";
}

export interface ScriptOutput {
  title: string;
  duration: number;
  totalWordCount: number;
  youtubeDescription: string;
  chapters: Chapter[];
  sections: ScriptSection[];
  endScreenSuggestion: string;
  cardSuggestions: CardSuggestion[];
  visualAssets: VisualAsset[];
  voiceConfig: VoiceConfig;
  shortsScript?: ShortsScript;
  /** TONY code-agent tasks — set by MUSE in Phase 9, optional until then */
  tonyTasks?: TonyTask[];
}

// ─── SEO Output ─────────────────────────────────────────────────────────────

export interface TitleVariant {
  title: string;
  formula: string;
  rationale: string;
}

export interface ThumbnailABVariant {
  concept: string;
  emotion: string;
  textOverlay: string;
}

export interface SEOOutput {
  finalTitle: string;
  titleVariants: TitleVariant[];
  description: string;
  tags: string[];
  chapters: Chapter[];
  hashtags: string[];
  category: string;
  madeForKids: boolean;
  scheduledTime: string;
  thumbnailABVariants: ThumbnailABVariant[];
  expectedCTR: "low" | "medium" | "high";
  seoStrengthScore: number;
  seoNotes: string;
  // Shorts SEO
  shortsTitle?: string;
  shortsDescription?: string;
  shortsHashtags?: string[];
  shortsScheduledTime?: string;
}

// ─── Quality Gate Output ────────────────────────────────────────────────────

export interface QualityScores {
  hookStrength: number;
  retentionStructure: number;
  titleCTR: number;
  keywordCoverage: number;
  competitorDiff: number;
  museBlueprintAdherence: number;
  uniquenessScore: number;
}

export interface QualityGateOutput {
  scores: QualityScores;
  overall: number;
  weakSections: string[];
  feedback: Record<string, string>;
  uniquenessAutoReject: boolean;
  recommendation: "PROCEED" | "REWRITE" | "REJECT";
  sprintCritical: boolean;
}

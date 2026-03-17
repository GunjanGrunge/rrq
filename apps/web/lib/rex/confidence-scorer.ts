import type { RawSignal } from "./signal-fetchers";

export interface ConfidenceScore {
  sourceQuality: number;
  sourceCount: number;
  contentMaturity: number;
  trendVelocity: number;
  channelFit: number;
  competitorGap: number;
  shelfLife: number;
  overall: number;
}

export interface ScoredTopic {
  topic: string;
  niche: string;
  signals: RawSignal[];
  confidence: ConfidenceScore;
  maturityLevel: "breaking" | "developing" | "confirmed" | "evergreen";
  urgency: "publish_now" | "publish_today" | "publish_thisweek";
  trendVelocity: "rising_fast" | "rising" | "peaked" | "falling";
  shelfLife: "24hrs" | "48hrs" | "1week" | "evergreen";
}

const TIER_WEIGHTS: Record<1 | 2 | 3 | 4, number> = { 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.3 };

function getSourceQualityScore(signals: RawSignal[]): number {
  if (signals.length === 0) return 0;
  const avg = signals.reduce((sum, s) => sum + TIER_WEIGHTS[s.tier], 0) / signals.length;
  return Math.min(avg, 1.0);
}

function getContentMaturityScore(signals: RawSignal[]): number {
  const count = signals.length;
  if (count >= 8) return 1.0;
  if (count >= 6) return 0.85;
  if (count >= 4) return 0.65;
  if (count >= 2) return 0.45;
  return 0.25;
}

function getTrendVelocityScore(signals: RawSignal[]): number {
  const velocities = signals.map(s => s.velocity ?? 0.5);
  if (velocities.length === 0) return 0.3;
  return velocities.reduce((a, b) => a + b, 0) / velocities.length;
}

function getChannelFitScore(topic: string, niche: string): number {
  // Keyword overlap heuristic — replaced with Bedrock Titan embeddings in Phase 5+
  const topicLower = topic.toLowerCase();
  const nicheLower = niche.toLowerCase();
  if (topicLower.includes(nicheLower)) return 0.9;
  // General topics score moderately
  return 0.6;
}

function getCompetitorGapScore(): number {
  // Default moderate gap — refined by Zeus analytics in later phases
  return 0.5;
}

function getShelfLifeScore(signals: RawSignal[]): number {
  // If multiple tier-1 sources → breaking → short shelf life but high priority
  const tier1Count = signals.filter(s => s.tier === 1).length;
  if (tier1Count >= 2) return 0.4; // breaking news — short shelf, high urgency
  const hnCount = signals.filter(s => s.source === "hacker_news").length;
  if (hnCount > 0) return 0.8; // HN = often evergreen tech
  return 0.6;
}

export function calculateConfidence(
  topic: string,
  niche: string,
  signals: RawSignal[]
): ConfidenceScore {
  const sourceQuality   = getSourceQualityScore(signals);
  const sourceCount     = Math.min(signals.length / 8, 1.0);
  const contentMaturity = getContentMaturityScore(signals);
  const trendVelocity   = getTrendVelocityScore(signals);
  const channelFit      = getChannelFitScore(topic, niche);
  const competitorGap   = getCompetitorGapScore();
  const shelfLife       = getShelfLifeScore(signals);

  const overall =
    sourceQuality   * 0.25 +
    sourceCount     * 0.15 +
    contentMaturity * 0.20 +
    trendVelocity   * 0.15 +
    channelFit      * 0.15 +
    competitorGap   * 0.05 +
    shelfLife       * 0.05;

  return {
    sourceQuality,
    sourceCount,
    contentMaturity,
    trendVelocity,
    channelFit,
    competitorGap,
    shelfLife,
    overall,
  };
}

export function getMaturityLevel(
  confidence: ConfidenceScore,
  signalCount: number
): "breaking" | "developing" | "confirmed" | "evergreen" {
  if (signalCount >= 2 && confidence.overall >= 0.85) return "breaking";
  if (signalCount >= 4 && confidence.overall >= 0.65) return "developing";
  if (signalCount >= 6 && confidence.overall >= 0.80) return "confirmed";
  return "evergreen";
}

export function getUrgency(
  maturity: string
): "publish_now" | "publish_today" | "publish_thisweek" {
  if (maturity === "breaking") return "publish_now";
  if (maturity === "developing") return "publish_today";
  return "publish_thisweek";
}

export function getTrendVelocityLabel(
  score: number
): "rising_fast" | "rising" | "peaked" | "falling" {
  if (score >= 0.8) return "rising_fast";
  if (score >= 0.5) return "rising";
  if (score >= 0.3) return "peaked";
  return "falling";
}

export function getShelfLifeLabel(
  score: number
): "24hrs" | "48hrs" | "1week" | "evergreen" {
  if (score <= 0.3) return "24hrs";
  if (score <= 0.5) return "48hrs";
  if (score <= 0.7) return "1week";
  return "evergreen";
}

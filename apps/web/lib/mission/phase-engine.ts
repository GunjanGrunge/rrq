export type ChannelPhase = "COLD_START" | "MOMENTUM" | "PUSH" | "MONETISED";

export interface ChannelMetrics {
  subscribers: number;
  watchHours: number;
  daysSinceLaunch: number;
}

export interface DailyRequirements {
  subsPerDay: number;
  hoursPerDay: number;
  daysLeft: number;
  onTrack: boolean;
  currentSubsRate: number;
  currentHoursRate: number;
}

export function determinePhase(metrics: ChannelMetrics): ChannelPhase {
  const { subscribers, watchHours, daysSinceLaunch } = metrics;
  if (subscribers >= 1000 && watchHours >= 4000) return "MONETISED";
  if (daysSinceLaunch >= 61 || subscribers >= 700) return "PUSH";
  if (daysSinceLaunch >= 31 || subscribers >= 300) return "MOMENTUM";
  return "COLD_START";
}

export function calculateDailyRequirements(
  metrics: ChannelMetrics,
  currentSubsRate: number,
  currentHoursRate: number
): DailyRequirements {
  const daysLeft = Math.max(1, 90 - metrics.daysSinceLaunch);
  const subsNeeded = Math.max(0, 1000 - metrics.subscribers);
  const hoursNeeded = Math.max(0, 4000 - metrics.watchHours);
  const subsPerDay = Math.ceil(subsNeeded / daysLeft);
  const hoursPerDay = Math.ceil(hoursNeeded / daysLeft);
  const onTrack = currentSubsRate >= subsPerDay && currentHoursRate >= hoursPerDay;

  return { subsPerDay, hoursPerDay, daysLeft, onTrack, currentSubsRate, currentHoursRate };
}

export function getRexConfidenceThreshold(phase: ChannelPhase): number {
  switch (phase) {
    case "COLD_START": return 70;
    case "MOMENTUM":   return 60;
    case "PUSH":       return 55;
    case "MONETISED":  return 60;
  }
}

export function getRexTopicPriority(phase: ChannelPhase): "evergreen_first" | "balanced" | "trending_first" {
  switch (phase) {
    case "COLD_START": return "evergreen_first";
    case "MOMENTUM":   return "balanced";
    case "PUSH":       return "trending_first";
    case "MONETISED":  return "balanced";
  }
}

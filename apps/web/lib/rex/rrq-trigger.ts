import { getRRQState, updateRRQState, getQueueDepth } from "./memory-store";

export type TriggerMode = "CRON" | "QUEUE_LOW" | "MANUAL";

export interface TriggerContext {
  mode: TriggerMode;
  channelId: string;
  nicheOverride?: string;
  sourceFilter?: string[];
  userId?: string;
}

export async function handleCronTrigger(channelId = "default"): Promise<TriggerContext> {
  const state = await getRRQState(channelId);
  const nextIndex = (state.sourceRotationIndex + 1) % 3;

  await updateRRQState(channelId, {
    triggerMode: "CRON",
    lastRunAt: new Date().toISOString(),
    sourceRotationIndex: nextIndex,
    runCount: state.runCount + 1,
  });

  return { mode: "CRON", channelId };
}

export async function handleQueueLowTrigger(
  channelId = "default"
): Promise<TriggerContext | null> {
  const state = await getRRQState(channelId);
  const depth = await getQueueDepth();

  if (depth >= state.queueLowThreshold) return null; // queue is healthy

  await updateRRQState(channelId, {
    triggerMode: "QUEUE_LOW",
    lastRunAt: new Date().toISOString(),
    queueDepth: depth,
    runCount: state.runCount + 1,
  });

  return { mode: "QUEUE_LOW", channelId };
}

export async function handleManualTrigger(
  channelId = "default",
  nicheOverride?: string,
  sourceFilter?: string[],
  userId?: string
): Promise<TriggerContext> {
  const state = await getRRQState(channelId);

  await updateRRQState(channelId, {
    triggerMode: "MANUAL",
    lastRunAt: new Date().toISOString(),
    runCount: state.runCount + 1,
  });

  return { mode: "MANUAL", channelId, nicheOverride, sourceFilter, userId };
}

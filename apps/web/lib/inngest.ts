import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "rrq-content-factory",
  name: "RRQ Content Factory",
});

// Event types for type safety across the app
export type InngestEvents = {
  "pipeline/step.started": {
    data: { jobId: string; step: number; stepName: string };
  };
  "pipeline/step.completed": {
    data: { jobId: string; step: number; stepName: string; output?: unknown };
  };
  "pipeline/step.failed": {
    data: { jobId: string; step: number; stepName: string; error: string };
  };
  "pipeline/job.started": {
    data: { jobId: string; userId: string; topic: string };
  };
  "pipeline/job.completed": {
    data: { jobId: string; youtubeUrl: string };
  };
  "agent/rex.scan": {
    data: { triggeredBy: "schedule" | "manual"; niche?: string };
  };
  "agent/regum.evaluate": {
    data: { opportunityId: string };
  };
  "agent/qeon.produce": {
    data: { briefId: string };
  };
  "agent/zeus.comments": {
    data: { videoIds: string[] };
  };
  "agent/zeus.analytics": {
    data: { channelId: string };
  };
};

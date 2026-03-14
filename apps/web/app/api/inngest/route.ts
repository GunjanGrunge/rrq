import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { createVideoWorkflow } from "@/inngest/create-video-workflow";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [createVideoWorkflow],
});

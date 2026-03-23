import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import * as workflows from "@/inngest";

// Allow long-running steps (SadTalker ~3-5min per beat × multiple beats)
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(workflows),
});

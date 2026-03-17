import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import * as workflows from "@/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(workflows),
});

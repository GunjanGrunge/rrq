import type { Handler } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  CodeAgentInput,
  type CodeAgentInputType,
  type CodeAgentOutputType,
} from "@rrq/lambda-types";
import { executeSandboxed } from "./sandbox";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";

// Haiku model — fast code generation
const HAIKU_MODEL = "anthropic.claude-haiku-4-5-20251001";

const TONY_SYSTEM_PROMPT = `You are TONY — the Code Agent for the RRQ autonomous YouTube system.
You generate executable JavaScript code on demand for other agents.

STRICT RULES:
1. Output ONLY executable JavaScript — no import, no require(), no module.exports
2. All HTTP must use globalThis.fetch (already patched with domain allowlist)
3. Context variables are pre-injected as frozen constants — use them directly by name
4. Return results: process.send({ success: true, output: <JSON-serializable value> })
5. On any error: process.send({ success: false, error: "<message>" })
6. No filesystem writes except reading from /tmp
7. No child_process, no eval, no new Function, no dynamic import
8. Code must complete within 30 seconds
9. Keep code concise — single purpose, no abstraction layers

OUTPUT TYPES:
- "data"   → output is a JSON object/array with the requested data
- "chart"  → output is a base64 PNG string (data:image/png;base64,...)
- "report" → output is a markdown string
- "scrape" → output is structured JSON extracted from scraped content`;

export const handler: Handler = async (event) => {
  const jobId = (event as { jobId?: string }).jobId ?? "unknown";

  try {
    const input: CodeAgentInputType = CodeAgentInput.parse(event);
    console.log(`[tony][${input.jobId}] Agent: ${input.agentId} | Task: ${input.task.slice(0, 120)}`);

    // Step 1: Generate code with Bedrock Haiku
    const generatedCode = await generateCode(input);
    console.log(`[tony][${input.jobId}] Code generated (${generatedCode.length} chars)`);

    // Step 2: Execute in sandbox
    const result = await executeSandboxed(generatedCode, input.context, input.timeoutMs);
    console.log(`[tony][${input.jobId}] Sandbox: ${result.success ? "OK" : "FAILED"} in ${result.executionMs}ms`);

    if (!result.success) {
      console.error(`[tony][${input.jobId}] Error: ${result.error}`);
    }

    // Step 3: Upload output to S3 for chart/report/scrape types
    let s3Key: string | undefined;
    if (result.success && result.output !== undefined && input.outputType !== "data") {
      s3Key = await uploadOutput(input.jobId, input.outputType, result.output);
      console.log(`[tony][${input.jobId}] Output uploaded to S3: ${s3Key}`);
    }

    const output: CodeAgentOutputType = {
      success: result.success,
      outputType: input.outputType,
      s3Key,
      data: input.outputType === "data" && result.output !== undefined
        ? result.output as Record<string, unknown>
        : undefined,
      markdown: input.outputType === "report" && result.output !== undefined
        ? String(result.output)
        : undefined,
      errorMessage: result.error,
      codeGenerated: generatedCode,
      executionMs: result.executionMs,
    };

    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify({ success: result.success, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tony][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

async function generateCode(input: CodeAgentInputType): Promise<string> {
  const contextKeys = Object.keys(input.context);
  const userPrompt = `Agent: ${input.agentId}
Task: ${input.task}
Output type: ${input.outputType}
Available context variables: ${contextKeys.length > 0 ? contextKeys.join(", ") : "none"}

Generate JavaScript code to accomplish this task. Remember: no imports, use process.send() to return results.`;

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: HAIKU_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2048,
        system: TONY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })
  );

  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const raw: string = parsed.content?.[0]?.text ?? "";

  // Strip markdown code fences if Haiku wrapped the code
  return raw
    .replace(/^```(?:javascript|js|typescript|ts)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

async function uploadOutput(
  jobId: string,
  outputType: string,
  output: unknown
): Promise<string> {
  const ext = outputType === "chart" ? "png" : outputType === "report" ? "md" : "json";
  const s3Key = `jobs/${jobId}/tony/${outputType}-${Date.now()}.${ext}`;

  let body: Buffer;
  let contentType: string;

  if (outputType === "chart" && typeof output === "string") {
    // output is base64 data URI — extract raw base64
    const base64 = output.replace(/^data:image\/\w+;base64,/, "");
    body = Buffer.from(base64, "base64");
    contentType = "image/png";
  } else if (outputType === "report") {
    body = Buffer.from(String(output), "utf8");
    contentType = "text/markdown";
  } else {
    body = Buffer.from(JSON.stringify(output), "utf8");
    contentType = "application/json";
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: contentType,
    })
  );

  return s3Key;
}

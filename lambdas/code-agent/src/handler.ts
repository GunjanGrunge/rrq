import type { Handler } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  CodeAgentInput,
  type CodeAgentInputType,
  type CodeAgentOutputType,
} from "@rrq/lambda-types";
import { executeSandboxed } from "./sandbox";
import { ALLOWED_DOMAINS } from "./allowlist";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_BUCKET_NAME ?? "content-factory-assets";

// Lazy-init — only created if all attempts fail (keeps happy-path cold start clean)
let _docClient: DynamoDBDocumentClient | null = null;
function getDocClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" })
    );
  }
  return _docClient;
}

const MAX_ATTEMPTS = 3;
const TONY_FAILURE_TABLE = "jason-tasks";

// TONY model routing — Sonnet primary, Haiku fallback
const SONNET_MODEL = "arn:aws:bedrock:us-east-1:751289209169:inference-profile/us.anthropic.claude-sonnet-4-6";
const HAIKU_MODEL = "arn:aws:bedrock:us-east-1:751289209169:inference-profile/global.anthropic.claude-haiku-4-5-20251001-v1:0";

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

// ─── Reflect loop types ──────────────────────────────────────────────────────

interface RetryContext {
  attempt: number;
  previousCode: string;
  errorMessage: string;
  errorHint: string;
}

// ─── Error classifier ────────────────────────────────────────────────────────

const ALLOWED_DOMAINS_HINT = ALLOWED_DOMAINS.slice(0, 8).join(", ") + " (and others)";

function classifyError(error: string): string {
  if (/timeout/i.test(error))
    return "Your previous code ran too long. Avoid loops over large datasets. Fetch only what is strictly needed. Must complete in under 10 seconds.";
  if (/blocked domain/i.test(error))
    return `Your previous code tried to fetch from a blocked domain. Only these domains are allowed: ${ALLOWED_DOMAINS_HINT}`;
  if (/maximum call stack/i.test(error))
    return "Your previous code caused infinite recursion. Use iteration instead of recursion.";
  if (/cannot read prop/i.test(error))
    return "Your previous code accessed a property on undefined or null. Add null checks before accessing nested properties.";
  if (/not json/i.test(error) || /serialize/i.test(error))
    return "Your previous code returned a value that could not be serialized to JSON. Ensure output is a plain object/array/string/number.";
  if (/worker exited/i.test(error))
    return "Your previous code caused the sandbox process to exit unexpectedly. Check for uncaught synchronous exceptions at the top level.";
  return "Review your logic carefully and fix the error shown above.";
}

// ─── Degraded fallback ───────────────────────────────────────────────────────

function buildDegradedFallback(input: CodeAgentInputType): CodeAgentOutputType {
  const fallbackMarkdown = `## Visual Unavailable\n\nThis visual could not be generated after ${MAX_ATTEMPTS} attempts.\nTask: ${input.task.slice(0, 100)}`;
  return {
    success: false,
    outputType: input.outputType,
    markdown: input.outputType === "report" ? fallbackMarkdown : undefined,
    data: input.outputType === "data" ? {} : undefined,
    errorMessage: `All ${MAX_ATTEMPTS} TONY attempts failed — degraded fallback returned`,
    codeGenerated: "",
    executionMs: 0,
  };
}

// ─── Best-effort failure log ─────────────────────────────────────────────────

async function logFailureToDynamoDB(
  input: CodeAgentInputType,
  lastCode: string,
  lastError: string
): Promise<void> {
  try {
    await getDocClient().send(
      new PutCommand({
        TableName: TONY_FAILURE_TABLE,
        Item: {
          jobId: input.jobId,
          sk: `tony-failure-${Date.now()}`,
          agentId: input.agentId,
          task: input.task,
          lastCode,
          lastError,
          attemptCount: MAX_ATTEMPTS,
          timestamp: new Date().toISOString(),
        },
      })
    );
    console.log(`[tony][${input.jobId}] Failure logged to ${TONY_FAILURE_TABLE}`);
  } catch (err) {
    // Best-effort — never fail the Lambda on a logging error
    console.warn(
      `[tony][${input.jobId}] DynamoDB failure log skipped:`,
      err instanceof Error ? err.message : err
    );
  }
}

// ─── Lambda handler ──────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const jobId = (event as { jobId?: string }).jobId ?? "unknown";

  try {
    const input: CodeAgentInputType = CodeAgentInput.parse(event);
    console.log(`[tony][${input.jobId}] Agent: ${input.agentId} | Task: ${input.task.slice(0, 120)}`);

    let lastCode = "";
    let lastError = "";
    let retryContext: RetryContext | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Generate (or regenerate with correction prompt)
      const generatedCode = await generateCode(input, retryContext);
      lastCode = generatedCode;
      console.log(`[tony][${input.jobId}] Attempt ${attempt}/${MAX_ATTEMPTS}: code generated (${generatedCode.length} chars)`);

      // Execute in sandbox
      const result = await executeSandboxed(generatedCode, input.context, input.timeoutMs);
      console.log(
        `[tony][${input.jobId}] Attempt ${attempt}/${MAX_ATTEMPTS}: ${result.success ? "OK" : "FAILED"} in ${result.executionMs}ms${result.error ? ` — ${result.error}` : ""}`
      );

      if (result.success) {
        // Upload output to S3 for chart/report/scrape types
        let s3Key: string | undefined;
        if (result.output !== undefined && input.outputType !== "data") {
          s3Key = await uploadOutput(input.jobId, input.outputType, result.output);
          console.log(`[tony][${input.jobId}] Output uploaded to S3: ${s3Key}`);
        }

        const output: CodeAgentOutputType = {
          success: true,
          outputType: input.outputType,
          s3Key,
          data:
            input.outputType === "data" && result.output !== undefined
              ? (result.output as Record<string, unknown>)
              : undefined,
          markdown:
            input.outputType === "report" && result.output !== undefined
              ? String(result.output)
              : undefined,
          codeGenerated: generatedCode,
          executionMs: result.executionMs,
        };

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data: output }),
        };
      }

      // Failure — prepare retry context for next attempt (only when another attempt remains)
      lastError = result.error ?? "unknown error";
      if (attempt < MAX_ATTEMPTS) {
        retryContext = {
          attempt: attempt + 1,
          previousCode: generatedCode,
          errorMessage: lastError,
          errorHint: classifyError(lastError),
        };
      }
    }

    // All MAX_ATTEMPTS exhausted
    console.error(`[tony][${input.jobId}] All ${MAX_ATTEMPTS} attempts failed. Last error: ${lastError}`);
    await logFailureToDynamoDB(input, lastCode, lastError);
    const fallback = buildDegradedFallback(input);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, data: fallback }),
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

// ─── Code generation ─────────────────────────────────────────────────────────

async function generateCode(
  input: CodeAgentInputType,
  retryContext?: RetryContext
): Promise<string> {
  const contextKeys = Object.keys(input.context);

  const userPrompt = retryContext
    ? `Agent: ${input.agentId}
Task: ${input.task}
Output type: ${input.outputType}
Available context variables: ${contextKeys.length > 0 ? contextKeys.join(", ") : "none"}

ATTEMPT ${retryContext.attempt} OF ${MAX_ATTEMPTS} — PREVIOUS CODE FAILED.

Your previous code:
---
${retryContext.previousCode}
---
Error:
${retryContext.errorMessage}

${retryContext.errorHint}

Rewrite the code to fix this error. Keep the same output structure and purpose.
Remember: no imports, use process.send() to return results.`
    : `Agent: ${input.agentId}
Task: ${input.task}
Output type: ${input.outputType}
Available context variables: ${contextKeys.length > 0 ? contextKeys.join(", ") : "none"}

Generate JavaScript code to accomplish this task. Remember: no imports, use process.send() to return results.`;

  const now = new Date();
  const dateContext = `Today's date: ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} (${now.getFullYear()}). Always use the current year in any titles, labels, or comparisons — never use a past year.`;
  const systemWithDate = `${dateContext}\n\n${TONY_SYSTEM_PROMPT}`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2048,
    system: systemWithDate,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Try Sonnet first, fall back to Haiku
  let modelId = SONNET_MODEL;
  try {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: SONNET_MODEL,
        contentType: "application/json",
        accept: "application/json",
        body,
      })
    );
    const parsed = JSON.parse(new TextDecoder().decode(response.body));
    const raw: string = parsed.content?.[0]?.text ?? "";
    console.log(`[tony][${input.jobId}] Code gen: Sonnet 4.6`);
    return raw
      .replace(/^```(?:javascript|js|typescript|ts)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
  } catch (err) {
    console.warn(
      `[tony][${input.jobId}] Sonnet failed, falling back to Haiku:`,
      err instanceof Error ? err.message : err
    );
    modelId = HAIKU_MODEL;
  }

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const raw: string = parsed.content?.[0]?.text ?? "";
  console.log(`[tony][${input.jobId}] Code gen: Haiku 4.5 (fallback)`);
  return raw
    .replace(/^```(?:javascript|js|typescript|ts)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// ─── S3 upload ───────────────────────────────────────────────────────────────

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

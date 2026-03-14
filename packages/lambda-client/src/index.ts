import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from "@aws-sdk/client-lambda";
import { z } from "zod";
import {
  type AudioGenInputType,
  type AudioGenOutputType,
  AudioGenOutput,
  type ResearchVisualInputType,
  type ResearchVisualOutputType,
  ResearchVisualOutput,
  type VisualGenInputType,
  type VisualGenOutputType,
  VisualGenOutput,
  type AvSyncInputType,
  type AvSyncOutputType,
  AvSyncOutput,
  type ShortsGenInputType,
  type ShortsGenOutputType,
  ShortsGenOutput,
  type UploaderInputType,
  type UploaderOutputType,
  UploaderOutput,
  type CodeAgentInputType,
  type CodeAgentOutputType,
  CodeAgentOutput,
} from "@rrq/lambda-types";

// ─── Client singleton ─────────────────────────────────────────────────────

let client: LambdaClient | null = null;

function getClient(): LambdaClient {
  if (!client) {
    client = new LambdaClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return client;
}

// ─── Lambda function names (set via env or SST output) ────────────────────

const FUNCTION_NAMES = {
  audioGen: process.env.LAMBDA_AUDIO_GEN ?? "rrq-audio-gen",
  researchVisual: process.env.LAMBDA_RESEARCH_VISUAL ?? "rrq-research-visual",
  visualGen: process.env.LAMBDA_VISUAL_GEN ?? "rrq-visual-gen",
  avSync: process.env.LAMBDA_AV_SYNC ?? "rrq-av-sync",
  shortsGen: process.env.LAMBDA_SHORTS_GEN ?? "rrq-shorts-gen",
  uploader: process.env.LAMBDA_UPLOADER ?? "rrq-uploader",
  codeAgent: process.env.LAMBDA_CODE_AGENT ?? "rrq-code-agent",
} as const;

// ─── Generic invoke helper ────────────────────────────────────────────────

interface InvokeOptions<TInput> {
  functionName: string;
  payload: TInput;
  /** Async invocations fire-and-forget — no response parsing */
  async?: boolean;
}

async function invokeLambda<TInput, TOutput>(
  opts: InvokeOptions<TInput>,
  outputSchema: z.ZodType<TOutput>
): Promise<TOutput> {
  const lambda = getClient();

  const command = new InvokeCommand({
    FunctionName: opts.functionName,
    InvocationType: opts.async
      ? InvocationType.Event
      : InvocationType.RequestResponse,
    Payload: new TextEncoder().encode(JSON.stringify(opts.payload)),
  });

  const response = await lambda.send(command);

  if (opts.async) {
    // Fire-and-forget — return empty output (caller doesn't need response)
    return {} as TOutput;
  }

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(new TextDecoder().decode(response.Payload))
      : { errorMessage: "Unknown Lambda error" };
    throw new Error(
      `Lambda ${opts.functionName} error: ${errorPayload.errorMessage ?? JSON.stringify(errorPayload)}`
    );
  }

  if (!response.Payload) {
    throw new Error(`Lambda ${opts.functionName} returned no payload`);
  }

  const raw = JSON.parse(new TextDecoder().decode(response.Payload));

  // Lambda returns { statusCode, body } — parse body
  const body = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

  if (body.success === false) {
    throw new Error(
      `Lambda ${opts.functionName} failed: ${body.error ?? "unknown error"}`
    );
  }

  const data = body.data ?? body;
  return outputSchema.parse(data);
}

// ─── Typed invoke functions ───────────────────────────────────────────────

export async function invokeAudioGen(
  input: AudioGenInputType
): Promise<AudioGenOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.audioGen, payload: input },
    AudioGenOutput
  );
}

export async function invokeResearchVisual(
  input: ResearchVisualInputType
): Promise<ResearchVisualOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.researchVisual, payload: input },
    ResearchVisualOutput
  );
}

export async function invokeVisualGen(
  input: VisualGenInputType
): Promise<VisualGenOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.visualGen, payload: input },
    VisualGenOutput
  );
}

export async function invokeAvSync(
  input: AvSyncInputType
): Promise<AvSyncOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.avSync, payload: input },
    AvSyncOutput
  );
}

export async function invokeShortsGen(
  input: ShortsGenInputType
): Promise<ShortsGenOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.shortsGen, payload: input },
    ShortsGenOutput
  );
}

export async function invokeUploader(
  input: UploaderInputType
): Promise<UploaderOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.uploader, payload: input },
    UploaderOutput
  );
}

export async function invokeCodeAgent(
  input: CodeAgentInputType
): Promise<CodeAgentOutputType> {
  return invokeLambda(
    { functionName: FUNCTION_NAMES.codeAgent, payload: input },
    CodeAgentOutput
  );
}

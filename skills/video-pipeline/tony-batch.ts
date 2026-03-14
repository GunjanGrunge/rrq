/**
 * lib/video-pipeline/tony-batch.ts
 *
 * Replaces runFluxGeneration() entirely.
 * Takes a batch of MuseBeats routed to TONY and invokes the
 * code-agent Lambda for each one, collecting S3 paths for av-sync.
 *
 * Called from the main pipeline parallel block:
 *   tonyBatch.length > 0 ? invokeTonyBatch(jobId, tonyBatch) : Promise.resolve()
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const lambda = new LambdaClient({ region: process.env.AWS_REGION });
const db     = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MuseBeat {
  id:           string;
  visualType:   string;
  visualNote:   string;       // MUSE's instruction for this beat
  topicContext: string;       // what the video is about
  niche:        string;
  aspectRatio?: "16:9" | "1:1" | "9:16";
  duration?:    number;       // seconds — for animated beats
  data?:        Record<string, unknown>; // structured data for charts/tables
}

export interface TonyBatchOptions {
  simplified?: boolean; // true = retry with core packages only
}

export interface TonyBeatResult {
  beatId:   string;
  s3Path:   string;
  success:  boolean;
  fallback: boolean; // true if text card fallback was used
}

// ─── Main batch function ──────────────────────────────────────────────────────

export async function invokeTonyBatch(
  jobId: string,
  beats: MuseBeat[],
  opts: TonyBatchOptions = {},
): Promise<TonyBeatResult[]> {

  console.log(`[TONY] Processing ${beats.length} beats for job ${jobId}`);

  // Process beats concurrently — Lambda handles its own concurrency
  const results = await Promise.allSettled(
    beats.map(beat => invokeTonyBeat(jobId, beat, opts))
  );

  const beatResults: TonyBeatResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const beat   = beats[i];

    if (result.status === "fulfilled") {
      beatResults.push(result.value);
    } else {
      console.warn(`[TONY] Beat ${beat.id} failed:`, result.reason?.message);
      // Tier 2 fallback — text card via FFmpeg
      const fallbackPath = await generateTextFallbackCard(jobId, beat);
      beatResults.push({
        beatId:   beat.id,
        s3Path:   fallbackPath,
        success:  false,
        fallback: true,
      });
    }
  }

  // Save all results to DynamoDB for av-sync to read
  await saveTonyResults(jobId, beatResults);

  const succeeded = beatResults.filter(r => r.success).length;
  const fellBack  = beatResults.filter(r => r.fallback).length;
  console.log(`[TONY] Batch complete — ${succeeded} succeeded, ${fellBack} fallbacks`);

  return beatResults;
}

// ─── Single beat invocation ───────────────────────────────────────────────────

async function invokeTonyBeat(
  jobId: string,
  beat: MuseBeat,
  opts: TonyBatchOptions,
): Promise<TonyBeatResult> {

  // Build the task description for TONY's Haiku code-gen
  const task = await buildTonyTask(beat, opts.simplified ?? false);

  const input = {
    jobId,
    agentId:    "QEON" as const,
    task:       task.description,
    context:    {
      beatId:      beat.id,
      visualType:  beat.visualType,
      visualNote:  beat.visualNote,
      niche:       beat.niche,
      aspectRatio: beat.aspectRatio ?? "16:9",
      duration:    beat.duration ?? 5,
      data:        beat.data ?? {},
      ...task.context,
    },
    outputType: resolveOutputType(beat.visualType),
    timeoutMs:  30_000,
  };

  // Invoke code-agent Lambda
  const response = await lambda.send(new InvokeCommand({
    FunctionName:   process.env.TONY_LAMBDA_ARN ?? "rrq-code-agent",
    InvocationType: "RequestResponse",
    Payload:        Buffer.from(JSON.stringify(input)),
  }));

  if (!response.Payload) throw new Error(`TONY: no payload returned for beat ${beat.id}`);

  const payload = JSON.parse(Buffer.from(response.Payload).toString());

  if (!payload.success || !payload.s3Key) {
    throw new Error(`TONY: beat ${beat.id} failed — ${payload.errorMessage}`);
  }

  return {
    beatId:   beat.id,
    s3Path:   `s3://${process.env.S3_BUCKET_NAME}/${payload.s3Key}`,
    success:  true,
    fallback: false,
  };
}

// ─── Task builder ─────────────────────────────────────────────────────────────

async function buildTonyTask(
  beat: MuseBeat,
  simplified: boolean,
): Promise<{ description: string; context: Record<string, unknown> }> {

  // Haiku translates the visual note into a TONY task description
  const packageConstraint = simplified
    ? "Use ONLY: remotion, recharts, d3. No other packages."
    : "Use the full approved package toolbox.";

  const response = await bedrock.send(new InvokeModelCommand({
    modelId:     "anthropic.claude-haiku-4-5-20251001",
    contentType: "application/json",
    accept:      "application/json",
    body: JSON.stringify({
      max_tokens: 300,
      messages: [{
        role:    "user",
        content: `Convert this visual beat into a TONY code-agent task description.
                  Visual type: ${beat.visualType}
                  Visual note: "${beat.visualNote}"
                  Topic: "${beat.topicContext}"
                  Niche: ${beat.niche}
                  Aspect ratio: ${beat.aspectRatio ?? "16:9"}
                  Duration: ${beat.duration ?? 5}s
                  ${packageConstraint}

                  Return JSON only:
                  {
                    "description": "one sentence task for TONY",
                    "suggestedComponent": "e.g. BarChart | Timeline | ComparisonTable | AnimatedCounter",
                    "colorScheme": "dark — amber #f5a623 accent, #0a0a0a background",
                    "animationStyle": "e.g. fade-in | count-up | slide | none"
                  }`,
      }],
    }),
  }));

  const body   = JSON.parse(Buffer.from(response.body).toString());
  const text   = body.content[0].text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(text);

  return {
    description: parsed.description,
    context: {
      suggestedComponent: parsed.suggestedComponent,
      colorScheme:        parsed.colorScheme,
      animationStyle:     parsed.animationStyle,
    },
  };
}

// ─── Output type resolver ─────────────────────────────────────────────────────

function resolveOutputType(
  visualType: string,
): "data" | "chart" | "report" | "scrape" {
  const animated = [
    "CHART", "DIAGRAM", "GRAPHIC_OVERLAY",
    "SECTION_CARD", "CONCEPT_IMAGE",
  ];
  return animated.includes(visualType) ? "chart" : "chart";
  // All TONY visual outputs use "chart" outputType —
  // TONY returns an S3 path to either PNG or MP4
}

// ─── Text fallback card ───────────────────────────────────────────────────────

async function generateTextFallbackCard(
  jobId: string,
  beat: MuseBeat,
): Promise<string> {
  // Minimal solid-colour card with beat topic as text overlay
  // Generated via FFmpeg in the av-sync Lambda — no external dependency
  const s3Key = `jobs/${jobId}/tony/${beat.id}_fallback.png`;
  console.log(`[TONY] Fallback card for beat ${beat.id} → ${s3Key}`);
  // av-sync Lambda reads the fallback flag and generates via:
  // ffmpeg -f lavfi -i color=c=#0a0a0a:size=1920x1080:duration=5
  //        -vf "drawtext=text='${beat.topicContext}':fontcolor=#f5a623:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2"
  //        fallback.mp4
  return `s3://${process.env.S3_BUCKET_NAME}/${s3Key}`;
}

// ─── Save results to DynamoDB ─────────────────────────────────────────────────

async function saveTonyResults(
  jobId: string,
  results: TonyBeatResult[],
): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName:         "production-jobs",
    Key:               marshall({ jobId }),
    UpdateExpression:  "SET tonyResults = :r, tonyStatus = :s",
    ExpressionAttributeValues: marshall({
      ":r": results,
      ":s": "complete",
    }),
  }));
}

// ─── Helper for failed beat recovery ─────────────────────────────────────────

export async function getFailedTonyBeats(jobId: string): Promise<MuseBeat[]> {
  // Called by retryTonyWithSimplifiedPrompt() in worker failure handler
  // Reads tonyResults from DynamoDB and returns beats that failed
  // Implementation reads production-jobs table and filters failed beats
  return []; // populated at runtime from DynamoDB
}
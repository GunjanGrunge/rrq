import { getDynamoClient } from "@/lib/aws-clients";
import { callBedrockJSON } from "@/lib/bedrock";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { VeraDomain, VeraFinalStatus, DomainResult, VeraQAResult } from "./types";

// ─── Domain rubric prompts ─────────────────────────────────────────────────────

function getAudioRubric(jobData: Record<string, unknown>): string {
  return `You are VERA running Audio QA for RRQ.

Audio QA checks:
1. Voice cue markers (RISE/PEAK/DROP/WARM/QUESTION/PIVOT) are present in the transcript
2. Voice cue distribution matches the MuseBlueprint beat types — emotional beats have emotional cues
3. Audio pacing: script sections have appropriate length relative to beat duration
4. No placeholder or template text remains in the final script
5. Edge-TTS fallback was not used without flagging (if ElevenLabs failed, it should be noted)

Score 0-10. Below 7 = FAIL.

Job data:
${JSON.stringify(jobData, null, 2)}

Return ONLY valid JSON:
{"score": number, "findings": ["finding1", "finding2", ...], "verdict": "PASS"|"FAIL"}`;
}

function getVisualRubric(jobData: Record<string, unknown>): string {
  return `You are VERA running Visual QA for RRQ.

Visual QA checks:
1. Thumbnail asset (THUMBNAIL_SRC beat) is present and dimensions meet YouTube spec (1280×720 minimum)
2. All MuseBlueprint beats have corresponding asset keys in S3 paths
3. B-roll segment count matches blueprint beat count for B_ROLL visual type
4. TONY Lambda assets (SECTION_CARD, CONCEPT_IMAGE) are present for all required beats
5. No missing or null asset paths in the job record
6. Final MP4 was produced by av-sync Lambda (av_sync_complete = true)

Score 0-10. Below 7 = FAIL.

Job data:
${JSON.stringify(jobData, null, 2)}

Return ONLY valid JSON:
{"score": number, "findings": ["finding1", "finding2", ...], "verdict": "PASS"|"FAIL"}`;
}

function getStandardsRubric(
  jobData: Record<string, unknown>,
  qualityGateScore: number,
  uniquenessScore: number,
  councilStatus: string
): string {
  return `You are VERA running Standards QA for RRQ.

Standards QA checks:
1. Quality gate score ≥ 7.0 (actual: ${qualityGateScore}/10) — FAIL if below threshold
2. Uniqueness score ≥ 6.5 (actual: ${uniquenessScore}/10) — FAIL if below threshold
3. Council approval status: must be APPROVED (actual: ${councilStatus}) — FAIL if DEFERRED or DEADLOCKED
4. No quality gate was bypassed (quality_gate_attempts ≤ 2)
5. Oracle Domain 11 AI detection resistance signals — check if audit was triggered

Score 0-10. Below 7 = FAIL.

Job data:
${JSON.stringify(jobData, null, 2)}

Return ONLY valid JSON:
{"score": number, "findings": ["finding1", "finding2", ...], "verdict": "PASS"|"FAIL"}`;
}

// ─── Run Vera QA ───────────────────────────────────────────────────────────────

export async function runVeraQA(
  jobId: string,
  retryDomains?: VeraDomain[]
): Promise<VeraQAResult> {
  const dynamo = getDynamoClient();

  // Load job data from DynamoDB
  let jobData: Record<string, unknown> = {};
  let qualityGateScore = 0;
  let uniquenessScore = 0;
  let councilStatus = "UNKNOWN";

  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: "production-jobs",
        Key: { jobId },
      })
    );
    jobData = (result.Item ?? {}) as Record<string, unknown>;
    qualityGateScore = (jobData.qualityGateScore as number) ?? 0;
    uniquenessScore = (jobData.uniquenessScore as number) ?? 0;
    councilStatus = (jobData.councilStatus as string) ?? "UNKNOWN";
  } catch (err) {
    console.error(`[vera:run:${jobId}] DynamoDB job load failed:`, err);
  }

  // Determine which domains to run
  const domainsToRun: VeraDomain[] = retryDomains ?? ["AUDIO", "VISUAL", "STANDARDS"];

  // Load previously passed domains from job record if this is a retry
  const previousResults: DomainResult[] = [];
  if (retryDomains && jobData.veraQAResult) {
    const prev = jobData.veraQAResult as { domains?: DomainResult[] };
    if (prev.domains) {
      const passedDomains = prev.domains.filter(
        (d) => d.verdict === "PASS" && !retryDomains.includes(d.domain)
      );
      previousResults.push(...passedDomains);
    }
  }

  // Run each domain in parallel
  const domainPromises = domainsToRun.map(async (domain): Promise<DomainResult> => {
    try {
      let rubric: string;
      if (domain === "AUDIO") {
        rubric = getAudioRubric(jobData);
      } else if (domain === "VISUAL") {
        rubric = getVisualRubric(jobData);
      } else {
        rubric = getStandardsRubric(jobData, qualityGateScore, uniquenessScore, councilStatus);
      }

      const result = await callBedrockJSON<{
        score: number;
        findings: string[];
        verdict: "PASS" | "FAIL";
      }>({
        model: "haiku",
        systemPrompt: rubric,
        userPrompt: `Run the ${domain} QA check and return your JSON verdict.`,
        maxTokens: 512,
        temperature: 0.2,
      });

      return {
        domain,
        verdict: result.verdict,
        score: result.score,
        findings: result.findings,
      };
    } catch (err) {
      console.error(`[vera:run:${jobId}] Domain ${domain} check failed:`, err);
      return {
        domain,
        verdict: "FAIL",
        score: 0,
        findings: [`${domain} QA check failed — evaluator unavailable`],
      };
    }
  });

  const newResults = await Promise.all(domainPromises);
  const allDomainResults = [...previousResults, ...newResults];

  // Tally results
  const failedDomains = allDomainResults
    .filter((r) => r.verdict === "FAIL")
    .map((r) => r.domain);

  let finalStatus: VeraFinalStatus;
  if (failedDomains.length === 0) {
    finalStatus = "CLEARED";
  } else if (failedDomains.length <= 2) {
    finalStatus = "WARNING";
  } else {
    finalStatus = "HOLD";
  }

  // Build report summary
  const report = allDomainResults
    .map(
      (r) =>
        `${r.domain}: ${r.verdict} (${r.score}/10)${r.findings.length > 0 ? " — " + r.findings.slice(0, 2).join("; ") : ""}`
    )
    .join("\n");

  const completedAt = new Date().toISOString();

  const qaResult: VeraQAResult = {
    jobId,
    status: finalStatus,
    domains: allDomainResults,
    failedDomains,
    report,
    completedAt,
  };

  // Write result back to production-jobs record
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: "production-jobs",
        Key: { jobId },
        UpdateExpression:
          "SET veraQAResult = :result, veraStatus = :status, veraCompletedAt = :completedAt",
        ExpressionAttributeValues: {
          ":result": qaResult,
          ":status": finalStatus,
          ":completedAt": completedAt,
        },
      })
    );
  } catch (err) {
    console.error(`[vera:run:${jobId}] DynamoDB result write failed:`, err);
  }

  return qaResult;
}

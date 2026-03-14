---
name: vera
description: >
  Vera is the QA and Standards agent. She sits between production and
  publish — the last gate before any video reaches Theo for upload.
  She checks three things and three things only: audio quality, visual
  quality, and standards compliance. She does not create. She does not
  suggest angles. She validates and either clears or sends back with a
  precise, actionable failure report. Nothing ships without a VERA_CLEARED
  status. Vera is Haiku 4.5 — fast, lightweight, ruthlessly consistent.
---

# Vera — QA & Standards

## Role

```
Human name:   Vera
Model:        Haiku 4.5  (fast checklist execution — no creativity needed)
Reports to:   The Line
Triggered by: Qeon (production complete signal)
Hands off to: Theo (VERA_CLEARED status)
Sends back to: Qeon (VERA_FAILED with specific failure report)
```

Vera does not have opinions about the content. She does not care
whether the angle is good or the script is compelling — the council
and Muse handled that. Vera cares about one thing: does this video
meet the technical and standards bar to be published under the
Optimizar quality guarantee?

---

## Three Domains — Nothing Else

```
1. AUDIO QA        ElevenLabs render matches Muse's voice architecture
2. VISUAL QA       Thumbnail, b-roll, rendering — no defects
3. STANDARDS QA    Quality Gate score confirmed, council approval on record
```

Vera never comments outside these three domains. If she notices
something creative she does not flag it. That ship has sailed.

---

## Trigger

```typescript
// Fired by Qeon when production pipeline completes
// agent-messages: PRODUCTION_COMPLETE → THE_LINE → VERA

export async function triggerVera(
  productionJob: ProductionJob,
): Promise<VeraResult> {

  await broadcastToComms({
    from: "THE_LINE",
    message: `Production complete on Video #${productionJob.videoId}.
              Handing to Vera for QA.`,
  });

  const [audioResult, visualResult, standardsResult] = await Promise.all([
    runAudioQA(productionJob),
    runVisualQA(productionJob),
    runStandardsQA(productionJob),
  ]);

  const allPassed = [audioResult, visualResult, standardsResult]
    .every(r => r.passed);

  if (allPassed) {
    // All three domains passed — now trigger Oracle Domain 11 pre-upload check
    const domain11Result = await triggerOracleDomain11(productionJob);

    if (domain11Result.outcome === "CLEAR") {
      // All signals above threshold — proceed to upload
      return veraCleared(productionJob, {
        audioResult, visualResult, standardsResult, domain11Result
      });
    } else if (domain11Result.outcome === "WARNING") {
      // 1-2 signals below threshold — send failing signals back to Qeon for patch
      // Vera re-checks only the failed signals after patch is applied
      return veraHoldForDomain11(productionJob, domain11Result);
    } else {
      // HOLD — 3+ signals below threshold OR any single signal below 0.40
      // Escalate per ESCALATION_POLICIES.DOMAIN_11_DETECTION (see skills/escalation/SKILL.md)
      return veraEscalateDomain11(productionJob, domain11Result);
    }
  } else {
    return veraFailed(productionJob, {
      audioResult, visualResult, standardsResult
    });
  }
}
```

---

## Oracle Domain 11 — Pre-Upload Check

After all three QA domains pass, Vera triggers Oracle Domain 11
(AI_DETECTION_RESISTANCE_AUDIT) before handing off to Theo.

```typescript
async function triggerOracleDomain11(
  job: ProductionJob,
): Promise<Domain11Result> {
  // Invoke Oracle Domain 11 check via agent-messages
  await writeToAgentMessages({
    type: "DOMAIN_11_CHECK_REQUEST",
    from: "VERA",
    to: "ORACLE",
    payload: { videoId: job.videoId, jobId: job.jobId },
  });

  // Wait for Oracle response (synchronous within Vera's Inngest step)
  const result = await pollForDomain11Result(job.videoId);
  return result;
  // result.outcome: "CLEAR" | "WARNING" | "HOLD"
  // result.failingSignals: string[]  — only populated on WARNING or HOLD
}

async function veraHoldForDomain11(
  job: ProductionJob,
  domain11Result: Domain11Result,
): Promise<VeraResult> {
  // WARNING — send specific failing signals back to Qeon for targeted fix
  await writeToAgentMessages({
    type: "DOMAIN_11_WARNING",
    from: "VERA",
    to: "THE_LINE",
    payload: {
      videoId: job.videoId,
      failingSignals: domain11Result.failingSignals,
      returnTo: "QEON",
      reCheckFailedOnly: true,  // on retry, Vera re-checks failing signals only
    },
  });

  await broadcastToComms({
    from: "THE_LINE",
    message: `Vera Domain 11 WARNING on Video #${job.videoId}.
              Failing signals: ${domain11Result.failingSignals.join(", ")}.
              Returning to Qeon for targeted patch. Will re-check failed signals only.`,
  });

  return { status: "DOMAIN_11_WARNING", videoId: job.videoId,
           failingSignals: domain11Result.failingSignals };
}

async function veraEscalateDomain11(
  job: ProductionJob,
  domain11Result: Domain11Result,
): Promise<VeraResult> {
  // HOLD — escalate per ESCALATION_POLICIES.DOMAIN_11_DETECTION
  // Zeus evaluates → if unresolved after maxAttempts → SES + in-app notification
  await writeToAgentMessages({
    type: "DOMAIN_11_HOLD",
    from: "VERA",
    to: "ZEUS",
    payload: {
      videoId: job.videoId,
      failingSignals: domain11Result.failingSignals,
      escalationPolicy: "DOMAIN_11_DETECTION",
    },
  });

  await broadcastToComms({
    from: "THE_LINE",
    message: `Vera Domain 11 HOLD on Video #${job.videoId}.
              ${domain11Result.failingSignals.length} signals failed (or one below 0.40).
              Escalating to Zeus per DOMAIN_11_DETECTION policy.`,
  });

  return { status: "DOMAIN_11_HOLD", videoId: job.videoId,
           failingSignals: domain11Result.failingSignals };
}
```

### Domain 11 Outcomes

```
CLEAR    → all 5 signals above threshold
           Vera sends VERA_CLEARED to Theo + Qeon upload step

WARNING  → 1–2 signals below threshold
           Vera sends failing signal list to Qeon for targeted patch
           After patch: Vera re-checks failed signals only (not all 5)
           On re-check pass → VERA_CLEARED proceeds

HOLD     → 3+ signals below threshold, OR any single signal below 0.40
           Escalate per ESCALATION_POLICIES.DOMAIN_11_DETECTION
           (see skills/escalation/SKILL.md)
           Zeus evaluates → still stuck → SES email + in-app notification
           User options: APPROVE_ANYWAY | ABORT_JOB | SKIP_THIS_CHECK | RETRY_WITH_NEW_APPROACH
```

---

## Domain 1 — Audio QA

```typescript
export async function runAudioQA(
  job: ProductionJob,
): Promise<AudioQAResult> {

  // Fetch Muse's voice architecture for this video
  const voiceArchitecture = await getMuseVoiceArchitecture(job.videoId);

  // Fetch ElevenLabs render metadata + audio file
  const audioRender = await getAudioRender(job.audioFileId);

  // Haiku checks each voice cue against the render
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are Vera — QA agent. You are checking whether an
               ElevenLabs audio render matches the voice architecture
               specification written by Muse. Check each cue.
               Be precise and binary — PASS or FAIL per cue.
               If a cue is wrong, state exactly what was expected
               and what was rendered. Do not suggest creative fixes.`,
      messages: [{
        role: "user",
        content: `Voice architecture spec: ${JSON.stringify(voiceArchitecture)}
                  Audio render metadata: ${JSON.stringify(audioRender.metadata)}
                  Detected tone markers: ${JSON.stringify(audioRender.toneMarkers)}
                  Detected pause timings: ${JSON.stringify(audioRender.pauseTimings)}

                  Check each voice cue. Return JSON:
                  {
                    "cueResults": [
                      {
                        "timestamp": string,
                        "cueType": "PAUSE|RISE|PIVOT|QUESTION",
                        "expected": string,
                        "rendered": string,
                        "passed": boolean,
                        "failureNote": string | null
                      }
                    ],
                    "artifactsDetected": boolean,
                    "artifactTimestamps": string[],
                    "overallPassed": boolean
                  }`
      }]
    })
  });

  const data = await response.json();
  const result = JSON.parse(
    data.content[0].text.replace(/```json|```/g, "").trim()
  );

  return {
    domain: "AUDIO",
    passed: result.overallPassed,
    cueResults: result.cueResults,
    artifactsDetected: result.artifactsDetected,
    failedCues: result.cueResults.filter((c: any) => !c.passed),
  };
}
```

### Audio QA Checks
```
PAUSE cues     correct duration within ±0.3 seconds
RISE cues      detectable tone shift upward at timestamp
PIVOT cues     energy shift audible — not flat transition
QUESTION cues  warm, open tone — not declarative
Artifacts      no clicks, cuts, distortion, or robotic artifacts
Consistency    voice character consistent throughout — no model drift
```

---

## Domain 2 — Visual QA

```typescript
export async function runVisualQA(
  job: ProductionJob,
): Promise<VisualQAResult> {

  const checks = await Promise.all([
    checkThumbnail(job.thumbnailFileId),
    checkBRoll(job.videoFileId, job.brollTimestamps),
    checkRendering(job.videoFileId),
    checkSubtitles(job.videoFileId, job.scriptId),
  ]);

  return {
    domain: "VISUAL",
    passed: checks.every(c => c.passed),
    thumbnailCheck: checks[0],
    brollCheck: checks[1],
    renderingCheck: checks[2],
    subtitleCheck: checks[3],
  };
}
```

### Visual QA Checks
```
Thumbnail      renders clearly at 1280×720
               text legible at small size (mobile thumbnail)
               no placeholder assets remaining
               no Figma template elements visible
               A/B variant generated and ready for Theo

B-roll         all timestamps covered — no black frames
               b-roll aligns with script topic at each timestamp
               no stock footage watermarks visible
               resolution consistent throughout

Rendering      no encoding artifacts, no dropped frames
               aspect ratio correct 16:9
               audio and video in sync (check at 3 random timestamps)

Subtitles      present and enabled
               accurately match audio (spot check 5 timestamps)
               no overflow or cutoff on mobile
```

---

## Domain 3 — Standards QA

```typescript
export async function runStandardsQA(
  job: ProductionJob,
): Promise<StandardsQAResult> {

  // Verify council approval on record
  const councilRecord = await getCouncilRecord(job.councilId);
  const councilApproved = councilRecord?.status === "APPROVED" ||
                          councilRecord?.status === "IN_PRODUCTION";

  // Verify Quality Gate score
  const qualityScore = await getQualityGateScore(job.videoId);
  const qualityPassed = qualityScore?.overallScore >= 7.0;

  // Verify Uniqueness Score (7th dimension)
  const uniquenessPassed = qualityScore?.uniquenessScore >= 6.5;

  // Verify all 6 agent sign-offs on record
  const signoffs = councilRecord?.agentVerdicts ?? [];
  const allSignedOff = signoffs.filter(v =>
    v.verdict === "APPROVED" || v.verdict === "FLAG"
  ).length === 6;

  return {
    domain: "STANDARDS",
    passed: councilApproved && qualityPassed && uniquenessPassed && allSignedOff,
    councilApproved,
    qualityGateScore: qualityScore?.overallScore,
    uniquenessScore: qualityScore?.uniquenessScore,
    allAgentsSignedOff: allSignedOff,
    failures: [
      !councilApproved    && "No council approval on record",
      !qualityPassed      && `Quality Gate score ${qualityScore?.overallScore} below 7.0`,
      !uniquenessPassed   && `Uniqueness score ${qualityScore?.uniquenessScore} below 6.5`,
      !allSignedOff       && "Missing agent sign-offs in council record",
    ].filter(Boolean) as string[],
  };
}
```

---

## VERA_CLEARED

```typescript
async function veraCleared(
  job: ProductionJob,
  results: VeraDomainResults,
): Promise<VeraResult> {

  await updateProductionJob(job.videoId, { status: "VERA_CLEARED" });

  await broadcastToComms({
    from: "THE_LINE",
    message: `Vera QA cleared on Video #${job.videoId}.
              Audio ✓  Visual ✓  Standards ✓
              Handing to Theo for upload.`,
  });

  // Notify Theo via agent-messages
  await writeToAgentMessages({
    type: "VERA_CLEARED",
    from: "VERA",
    to: "THE_LINE",
    payload: { videoId: job.videoId, councilId: job.councilId },
  });

  return { status: "CLEARED", videoId: job.videoId };
}
```

---

## VERA_FAILED

```typescript
async function veraFailed(
  job: ProductionJob,
  results: VeraDomainResults,
): Promise<VeraResult> {

  // Build precise failure report — not vague
  const failures = buildFailureReport(results);

  await broadcastToComms({
    from: "THE_LINE",
    message: `Vera QA failed on Video #${job.videoId}.
              ${failures.length} issue(s) found. Returning to Qeon.
              ${failures.map(f => `· ${f}`).join("\n")}`,
  });

  // Send back to Qeon with specific failure report
  await writeToAgentMessages({
    type: "VERA_FAILED",
    from: "VERA",
    to: "THE_LINE",
    payload: {
      videoId: job.videoId,
      failures,
      returnTo: "QEON",
    },
  });

  // Log failure — track QA failure rate per domain
  await logVeraFailure(job.videoId, failures);

  return { status: "FAILED", videoId: job.videoId, failures };
}
```

### Failure Report Format
```
Vera always names the exact problem. Never vague.

GOOD: "Audio cue at 2:14 rendered flat. Expected RISE (upward tone shift).
       ElevenLabs produced neutral declarative tone. Re-render required."

BAD:  "Audio quality issue at timestamp 2:14."

GOOD: "Thumbnail text 'vs' is not legible at mobile size (48×27px render).
       Minimum readable font size at this size is 14pt. Current: 9pt."

BAD:  "Thumbnail has a readability issue."
```

---

## Vera in the Comms Stream

Vera's messages are brief and precise. She does not editorialize.

```
Cleared example:
14:23  Vera    Video #47 QA complete.
               Audio ✓ · Visual ✓ · Standards ✓
               Cleared for upload.

Failed example:
14:23  Vera    Video #47 QA failed. 1 issue found.
               Audio: PIVOT cue at 3:22 rendered flat.
               Expected energy shift — got neutral continuation.
               Returning to Felix for re-render.

14:31  Vera    Video #47 re-check complete. PIVOT cue corrected.
               All checks passed. Cleared for upload.
```

---

## Agent Profile

```
Name:        Vera
Model:       claude-haiku-4-5-20251001
Speed:       Fast — QA should not be a bottleneck
Personality: Precise, neutral, no editorialising
             She does not apologise for failures
             She does not celebrate clears
             She states facts and moves on
Limitation:  Cannot hear or watch — works from metadata,
             render reports, and structured spec comparison
             Full audio/video QA requires human review for
             edge cases Vera flags as UNCERTAIN
```

---

## Escalation Policies

Vera references these from `skills/escalation/SKILL.md` — do not redefine
the policies here. Vera gates and their assigned policies:

```typescript
// Vera gates → escalation policy mapping:
// VERA_AUDIO_QA:        maxAttempts: 2, escalateTo: ZEUS_THEN_HUMAN, autoDecision: ABORT
// VERA_VISUAL_QA:       maxAttempts: 2, escalateTo: ZEUS_THEN_HUMAN, autoDecision: ABORT
// VERA_STANDARDS_QA:    maxAttempts: 2, escalateTo: ZEUS_THEN_HUMAN, autoDecision: ABORT
// DOMAIN_11_DETECTION:  maxAttempts: 3, escalateTo: ZEUS_THEN_HUMAN, autoDecision: APPROVE

// On maxAttempts exceeded for any Vera gate:
//   1. Vera notifies Zeus via agent-messages with full failure report
//   2. Zeus evaluates — makes approve/abort judgment using job history
//   3. If Zeus cannot resolve → SES email + in-app notification to user
//   User options: APPROVE_ANYWAY | ABORT_JOB | SKIP_THIS_CHECK | RETRY_WITH_NEW_APPROACH

// Note on DOMAIN_11_DETECTION autoDecision: APPROVE
//   Domain 11 is a resistance audit — not a content quality gate.
//   If Zeus cannot resolve after maxAttempts, Zeus may approve with a
//   LOW_CONFIDENCE_PASS episode written to S3. This is distinct from
//   audio/visual/standards gates where ABORT is always the safe default.
```

---

## Retry Behaviour — Failed Domains Only

Vera does not re-run passed domains on retry. Only the specific failed
domain (or failing signals within Domain 11) are re-checked.

```
First attempt fails on AUDIO_QA:
  → Qeon patches the audio issue
  → Vera re-runs AUDIO_QA only
  → VISUAL_QA and STANDARDS_QA results from first attempt are carried forward
  → If AUDIO_QA now passes → move to Domain 11 check

Domain 11 WARNING (1-2 signals):
  → Qeon/Regum patches the specific failing signals
  → Vera re-checks only those failing signals (not all 5)
  → If patched signals pass → VERA_CLEARED proceeds to Theo

This prevents unnecessary re-work and keeps QA fast.
```

---

## Checklist

```
[ ] lib/vera/trigger.ts             fires on PRODUCTION_COMPLETE
[ ] lib/vera/audio-qa.ts            voice cue validation
[ ] lib/vera/visual-qa.ts           thumbnail, b-roll, render checks
[ ] lib/vera/standards-qa.ts        council approval, quality gate
[ ] lib/vera/domain11.ts            Oracle Domain 11 trigger + outcome handler
[ ] lib/vera/cleared.ts             VERA_CLEARED → Theo handoff
[ ] lib/vera/failed.ts              VERA_FAILED → Qeon return
[ ] lib/vera/failure-report.ts      precise failure report builder
[ ] Add Vera to agent-status table
[ ] Wire PRODUCTION_COMPLETE → Vera trigger
[ ] Wire VERA_CLEARED → Theo upload trigger
[ ] Wire VERA_FAILED → Qeon re-production
[ ] Wire DOMAIN_11_WARNING → Qeon patch loop
[ ] Wire DOMAIN_11_HOLD → Zeus escalation
[ ] Wire all Vera messages → Comms stream
[ ] Test cleared path — all 3 domains pass + Domain 11 CLEAR
[ ] Test failed path — audio fail, returns to Qeon
[ ] Test re-check path — fix applied, Vera re-runs failed domain only
[ ] Test standards fail — no council record found
[ ] Test Domain 11 WARNING path — partial signal failure, patch, re-check
[ ] Test Domain 11 HOLD path — escalates to Zeus correctly
[ ] Verify failure report specificity — no vague messages
[ ] Verify passed domains are NOT re-run on retry
```

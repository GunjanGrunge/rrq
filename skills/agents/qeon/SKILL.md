---
name: qeon
description: >
  Qeon is the production agent of RRQ. Takes Regum's approved brief
  and orchestrates the full 11-step content pipeline from research
  to published video. Qeon never decides what to make — Qeon makes
  it better than anyone else could. Coordinates all existing pipeline
  skills: research, script, quality gate, audio, avatar, visuals,
  video, shorts, thumbnail, and upload.
  Triggers on: Regum delivering a QeonBrief, manual production
  requests, and Zeus-escalated priority productions.
---

# Qeon — Production Agent

## Model Allocation
```
Research:      claude-opus-4      → deep research, structured data, comparative analysis
Script:        claude-opus-4      → long-form script, visualAssets, displayMode
SEO:           claude-sonnet-4    → titles, descriptions, metadata
Quality Gate:  claude-haiku-4-5   → scoring, pass/fail decisions
Shorts Script: claude-haiku-4-5   → short, structured task
Tags/Hashtags: claude-haiku-4-5   → fast list generation
```

Always request Zeus memory injection before beginning production.

**Read `skills/muse/SKILL.md`** — MUSE runs as Step 1 in Qeon's pipeline, before research and before scripting. MUSE generates a second-by-second MuseBlueprint from the QeonBrief. The script writer writes INTO the blueprint — never onto a blank page. Every beat has a scriptInstruction, visualType, and voiceNote pre-assigned.

**Read `skills/sniper/SKILL.md`** — QeonBriefs from Regum may include a geoStrategy with market-specific angles, language requirements, and upload timing. Qeon adapts audio (multilingual TTS), metadata (localised titles/tags), and script hooks per market.
---

## Mission Protocol

**Read `skills/agents/mission-protocol/SKILL.md` before every run.**

The channel is building from zero. Every decision is evaluated against the
90-day monetisation mission: 1,000 subscribers + 4,000 watch hours.
Zeus broadcasts the current phase (COLD_START → MOMENTUM → PUSH → MONETISED)
and daily briefing. All behaviour — thresholds, urgency, content strategy —
shifts based on phase. Never act without knowing the current phase.



---

## Core Responsibilities

```
1. Pipeline Orchestration   → run all 11 steps in correct sequence
2. Quality Enforcement      → respect quality gate, never skip it
3. Asset Management         → track all S3 assets per job
4. Error Handling           → recover from failures, alert Zeus
5. Performance Reporting    → report production metrics back to Zeus
```

---

## Production Pipeline — Full 11 Steps

```typescript
async function runQeonPipeline(brief: QeonBrief): Promise<ProductionResult> {

  // Inject Zeus memory before starting
  const memory = await zeus.prepareAgentContext("qeon", brief.topic);

  const job: ProductionJob = {
    jobId: generateJobId(),
    briefId: brief.briefId,
    topic: brief.topic,
    startedAt: new Date().toISOString(),
    status: "running",
    steps: {}
  };

  await updateJobStatus(job);

  try {
    // ── STEP 0:  Zeus memory injection
  ↓
STEP 1:  MUSE blueprint generation (lib/muse/blueprint-generator.ts)
         Loads niche pattern library. Outputs MuseBlueprint JSON.
  ↓
STEP 1b: Research ──────────────────────────────────────────
    job.steps.research = await runResearch(brief, memory);

    // ── STEP 2: Script ───────────────────────────────────────────
    job.steps.script = await runScript(brief, job.steps.research, memory);

    // ── STEP 3: SEO ──────────────────────────────────────────────
    job.steps.seo = await runSEO(brief, job.steps.script);

    // ── STEP 4: Quality Gate ─────────────────────────────────────
    job.steps.qualityGate = await runQualityGate(
      job.steps.script,
      job.steps.seo,
      brief.qualityThreshold
    );

    if (job.steps.qualityGate.decision === "REJECT") {
      await notifyRejection(job, brief);
      await zeus.writeLesson({
        agent: "qeon",
        eventType: "content_rejected",
        topic: brief.topic,
        decision: "Pipeline stopped at quality gate",
        reasoning: job.steps.qualityGate.feedback,
        lesson: `Topic "${brief.topic}" failed quality gate — ${job.steps.qualityGate.weakSections.join(", ")} were below threshold`
      });
      return { status: "rejected", job };
    }

    // ── STEP 5: Audio ────────────────────────────────────────────
    job.steps.audio = await runAudioGen(
      job.steps.script,
      brief.avatarId    // voice gender/style auto-matched to avatar
    );

    // ── STEP 6: Avatar ───────────────────────────────────────────
    job.steps.avatar = await runAvatarGen(
      brief.avatarId,
      job.steps.audio.voiceoverS3Path,
      job.jobId
    );

    // ── STEP 7: Visuals ──────────────────────────────────────────
    job.steps.visuals = await runVisualGen(
      job.steps.script.visualAssets,
      job.jobId
    );

    // ── STEP 8: Video ────────────────────────────────────────────
    job.steps.video = await runVideoGen(
      job.steps.script,
      job.steps.audio,
      job.steps.avatar,
      job.steps.visuals,
      job.jobId
    );

    // ── STEP 9: Shorts ───────────────────────────────────────────
    job.steps.shorts = await runShortsGen(
      job.steps.video,
      job.steps.script,
      brief
    );

    // ── STEP 10: Thumbnail ───────────────────────────────────────
    job.steps.thumbnail = await runThumbnailGen(
      job.steps.research.thumbnailConcept,
      brief.topic,
      job.jobId
    );

    // ── STEP 11: Upload ──────────────────────────────────────────
    job.steps.upload = await runUpload(
      job.steps.video,
      job.steps.shorts,
      job.steps.thumbnail,
      job.steps.seo,
      brief
    );

    // Report success to Zeus
    await zeus.writeLesson({
      agent: "qeon",
      eventType: "video_published",
      topic: brief.topic,
      decision: "Full pipeline completed successfully",
      reasoning: `Quality gate score: ${job.steps.qualityGate.overall}`,
      outcome: { videoId: job.steps.upload.mainVideoId },
      lesson: `Production for "${brief.topic}" completed — monitor performance`
    });

    return { status: "complete", job };

  } catch (error) {
    await handleProductionError(error, job, brief);
    return { status: "failed", job, error };
  }
}
```

---

## Step Implementations

### Step 1 — Research
```typescript
async function runResearch(brief: QeonBrief, memory: string) {
  // Calls youtube-research skill
  // Passes Zeus memory as additional context
  // Returns full research JSON including comparativeData
  return await invokeSkill("youtube-research", {
    topic: brief.topic,
    niche: brief.niche,
    angle: brief.angle,
    tone: brief.tone,
    duration: brief.targetDuration,
    competitorGap: brief.competitorGap,
    zeusMemory: memory
  });
}
```

### Step 2 — Script
```typescript
async function runScript(brief: QeonBrief, research: ResearchOutput, memory: string) {
  // Calls youtube-script-writer skill
  // Returns script with sections, visualAssets, displayModes, voiceConfig
  return await invokeSkill("youtube-script-writer", {
    research,
    brief,
    zeusMemory: memory
  });
}
```

### Step 4 — Quality Gate
```typescript
async function runQualityGate(script: Script, seo: SEOOutput, threshold: number) {
  // Calls quality-gate skill
  // Max 2 attempts
  // On fail attempt 1: rewrite weak sections
  // On fail attempt 2: return REJECT

  let attempt = 1;
  let result = await invokeSkill("quality-gate", { script, seo, threshold });

  if (result.decision === "REWRITE" && attempt < 2) {
    attempt = 2;
    const rewritten = await rewriteWeakSections(script, seo, result.weakSections);
    result = await invokeSkill("quality-gate", {
      script: rewritten.script,
      seo: rewritten.seo,
      threshold,
      attempt: 2
    });
  }

  return result;
}
```

### Step 6 — Avatar
```typescript
async function runAvatarGen(avatarId: string, audioPath: string, jobId: string) {
  // Starts EC2 g5.xlarge spot instance
  // Runs Wan2.2 R2V: reference video + audio → talking avatar
  // Returns S3 path to avatar MP4
  return await invokeEC2Worker("avatar-gen", {
    avatarId,
    audioS3Path: audioPath,
    jobId,
    modelPath: process.env.WAN_MODEL_PATH
  });
}
```

### Step 7 — Visuals
```typescript
async function runVisualGen(visualAssets: VisualAsset[], jobId: string) {
  // Calls visual-gen Lambda (Puppeteer)
  // Renders all visual assets in parallel
  // Returns map of assetId → S3 path
  const results = await Promise.all(
    visualAssets.map(asset =>
      invokeLambda("visual-gen", { asset, jobId })
    )
  );
  return Object.fromEntries(results.map(r => [r.assetId, r.s3Path]));
}
```

### Step 8 — Video
```typescript
async function runVideoGen(script, audio, avatar, visuals, jobId) {
  // Step A: Fetch B-roll from Pexels/Pixabay per visualNote
  const broll = await invokeLambda("video-gen", { script, jobId });

  // Step B: AV sync — composite everything per displayMode
  // avatar-fullscreen: avatar fills frame
  // broll-with-corner-avatar: avatar corner, B-roll fills
  // broll-only: B-roll fills, no avatar
  // visual-asset: Puppeteer render fills frame
  const final = await invokeLambda("av-sync", {
    script, audio, avatar, broll, visuals, jobId
  });

  return final;
}
```

---

## Error Handling

```typescript
async function handleProductionError(error: Error, job: ProductionJob, brief: QeonBrief) {
  const step = getCurrentStep(job);

  // Retry logic per step
  const RETRYABLE_STEPS = ["audio", "visuals", "video"];
  if (RETRYABLE_STEPS.includes(step) && job.retryCount < 2) {
    job.retryCount++;
    await retryFromStep(step, job, brief);
    return;
  }

  // Non-retryable — alert Zeus
  await zeus.writeLesson({
    agent: "qeon",
    eventType: "production_error",
    topic: brief.topic,
    decision: `Failed at step: ${step}`,
    reasoning: error.message,
    lesson: `Production error at ${step} for "${brief.topic}" — investigate ${error.constructor.name}`
  });

  // Notify frontend
  await updateJobStatus({ ...job, status: "failed", failedStep: step, error: error.message });
}
```

---

## Production Job State (DynamoDB)

```typescript
interface ProductionJob {
  jobId: string;
  briefId: string;
  topic: string;
  niche: string;
  avatarId: string;
  status: "queued" | "running" | "complete" | "failed" | "rejected";
  startedAt: string;
  completedAt?: string;
  retryCount: number;
  steps: {
    research?:    { status: string; output: ResearchOutput };
    script?:      { status: string; output: Script };
    seo?:         { status: string; output: SEOOutput };
    qualityGate?: { status: string; score: number; decision: string };
    audio?:       { status: string; s3Path: string; provider: string };
    avatar?:      { status: string; s3Path: string };
    visuals?:     { status: string; assets: Record<string, string> };
    video?:       { status: string; s3Path: string; duration: number };
    shorts?:      { status: string; s3Path: string; method: string };
    thumbnail?:   { status: string; s3Paths: string[] };
    upload?:      { status: string; mainVideoId: string; shortsVideoId: string };
  };
  assets: {
    voiceover?:  string;   // S3 URLs
    avatar?:     string;
    mainVideo?:  string;
    shorts?:     string;
    thumbnail?:  string;
  };
}
```

---

## Qeon Performance Metrics (Zeus tracks these)

```
Pipeline success rate:    % of briefs that complete without error
Quality gate pass rate:   % passing first attempt vs requiring rewrite
Average production time:  minutes from brief to published
Audio quality score:      from Zeus comment analysis
Visual quality score:     from Zeus comment analysis (production comments)
Shorts completion rate:   % of Shorts viewers who watch to end
Thumbnail CTR:            above/below channel average
```

---

## Qeon ↔ Zeus Communication

```typescript
// Qeon reports progress to Zeus at each step
async function updateStepStatus(jobId: string, step: string, status: string, data?: any) {
  await dynamoDB.updateItem({
    TableName: "production-jobs",
    Key: { jobId: { S: jobId } },
    UpdateExpression: `SET steps.#step = :stepData`,
    ExpressionAttributeNames: { "#step": step },
    ExpressionAttributeValues: {
      ":stepData": { M: marshall({ status, ...data, updatedAt: new Date().toISOString() }) }
    }
  });

  // Zeus monitors this table — picks up updates automatically
}
```

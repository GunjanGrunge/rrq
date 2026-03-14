---
name: video-pipeline
description: >
  Video and audio production pipeline skill. Use this whenever a user needs
  to generate a video from a script, wants to sync audio with video clips,
  needs B-roll footage selected and stitched, wants subtitles burned in,
  needs to create a vertical Reel from landscape footage, wants to add
  background music, or needs a final MP4 exported for YouTube or Instagram.
  Triggers on: "generate the video", "create video", "stitch clips",
  "add subtitles", "sync audio", "render video", "make the Reel", or any
  request to produce a video file from script and research inputs.
---

# Video Pipeline Skill

## Purpose
Orchestrate the full audio-visual production from script JSON to final MP4 — landscape 16:9 for YouTube and vertical 9:16 for YouTube Shorts. All production runs on AWS workers using free APIs and open-source tools. Two EC2 GPU spot instances handle video generation: SkyReels V2 for talking head / avatar segments, Wan2.2 for b-roll and environment segments. Qeon routes each segment to the correct instance based on visual type in Muse's blueprint.

## Architecture
```
Step 1    audio-gen Lambda
          Script + ElevenLabs cues → MP3

Step 2a   avatar-gen EC2 (g5.12xlarge — SkyReels V2)
          Reference image + MP3 → Talking head MP4 segments
          Spot instance — spins up per job, self-terminates

Step 2b   broll-gen EC2 (g5.2xlarge — Wan2.2)
          Text prompt → B-roll / environment MP4 segments
          Spot instance — spins up per job, self-terminates

Step 2c   code-agent Lambda (TONY)
          Haiku generates Remotion / Recharts / D3 / Nivo / @remotion/lottie code
          Sandbox executes → MP4 or PNG to S3
          Handles: SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC,
                   CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY,
                   animated infographics, comparison tables,
                   counters, timelines, overlays
          No EC2. No always-on cost. Fires instantly.
          Oracle Domain 9 keeps TONY's package toolbox current.

Step 3    research-visual Lambda
          Screen recordings, paper figures, official press images
          Niche-specific — AI papers, motorsport press kits, etc.

Step 4    av-sync Lambda
          All segments + audio + subtitles → final MP4 (FFmpeg)

Step 5    shorts-gen Lambda
          Main MP4 → Vertical 9:16 Short (FFmpeg)
```

All assets stored in S3. Workers pull from S3, process, push back to S3.

Two EC2 GPU instances only — both spot, both per-job, both self-terminate.
No always-on instances. Zero idle EC2 cost.
TONY is a Lambda — no pre-warming, no reserved capacity, fires in milliseconds.
Production time ≈ max(SkyReels ~12min, Wan2.2 ~10min, TONY ~2min) = ~12min.

---

### Three EC2 Model Routing

Qeon reads every beat in Muse's MuseBlueprint. Each beat has a `visualType`.
The routing decision is made once per job — all beats categorised before
any EC2 instance is started.

```typescript
type SegmentRoute =
  | "SKYREELS"        // talking head / avatar segments
  | "WAN2"            // b-roll video / atmospheric motion
  | "TONY"            // stills, animated infographics, charts, overlays,
                      // comparison tables, section cards, thumbnails
                      // TONY generates Remotion/Recharts/D3/Nivo code
                      // Haiku writes the script → sandbox executes → MP4/PNG to S3
                      // Oracle Domain 9 keeps TONY's package toolbox current
  | "LAMBDA_VISUAL"   // legacy Chart.js / Mermaid / HTML data viz (TONY preferred)
  | "RESEARCH_VISUAL" // screen recordings, paper figures, official images

function routeSegment(beat: MuseBeat): SegmentRoute {
  if (beat.visualType === "TALKING_HEAD")    return "SKYREELS";
  if (beat.visualType === "SPLIT_SCREEN")    return "SKYREELS";
  if (beat.visualType === "B_ROLL")          return "WAN2";
  if (beat.visualType === "SECTION_CARD")    return "TONY";
  if (beat.visualType === "CONCEPT_IMAGE")   return "TONY";
  if (beat.visualType === "THUMBNAIL_SRC")   return "TONY";
  if (beat.visualType === "CHART")           return "TONY";
  if (beat.visualType === "DIAGRAM")         return "TONY";
  if (beat.visualType === "SLIDE")           return "TONY";
  if (beat.visualType === "GRAPHIC_OVERLAY") return "TONY";
  if (beat.visualType === "IMAGE")           return "RESEARCH_VISUAL";
  if (beat.visualType === "SCREEN_RECORD")   return "RESEARCH_VISUAL";
  return "WAN2"; // default
}

// Batch by route before spinning up instances
const skyreelsBatch  = beats.filter(b => routeSegment(b) === "SKYREELS");
const wan2Batch      = beats.filter(b => routeSegment(b) === "WAN2");
const tonyBatch      = beats.filter(b => routeSegment(b) === "TONY");
const researchBatch  = beats.filter(b => routeSegment(b) === "RESEARCH_VISUAL");

// Fire all workers in parallel
// TONY is a Lambda — no EC2 spin-up needed, fires immediately
const results = await Promise.allSettled([
  skyreelsBatch.length > 0  ? runSkyReelsInstance(jobId, skyreelsBatch)  : Promise.resolve(),
  wan2Batch.length > 0      ? runWan2Instance(jobId, wan2Batch)           : Promise.resolve(),
  tonyBatch.length > 0      ? invokeTonyBatch(jobId, tonyBatch)           : Promise.resolve(),
  researchBatch.length > 0  ? runResearchVisuals(jobId, researchBatch)    : Promise.resolve(),
]);

// Check all settled — handle any individual worker failures before av-sync
await validateWorkerResults(jobId, results);

// av-sync Lambda stitches everything once all workers complete or fallback
await runAvSync(jobId);
```

### Worker Failure Handling

Each worker can fail independently. Pipeline does not abort — it falls back
gracefully per worker and continues. Vera QA catches quality issues after.

```typescript
async function validateWorkerResults(
  jobId: string,
  results: PromiseSettledResult<void>[]
): Promise<void> {
  const workerNames = ["skyreels", "wan2", "tony", "research-visual"];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const workerName = workerNames[i];

    if (result.status === "rejected") {
      console.error(`[${workerName}] FAILED:`, result.reason);

      // Log failure to DynamoDB for dashboard visibility
      await updateJobStatus(jobId, workerName, "FAILED", result.reason?.message);

      // Apply fallback per worker type
      await applyWorkerFallback(jobId, workerName);
    }
  }
}
async function applyWorkerFallback(jobId: string, workerName: string): Promise<void> {
  switch (workerName) {
    case "tony":
      // TONY failure → two-tier fallback:
      // Tier 1: retry with simplified prompt (Haiku regenerates, fewer packages)
      // Tier 2: if retry fails → solid-colour section card with text overlay via FFmpeg
      // Thumbnails: fall back to plain title card — never block the pipeline
      // TONY failures are non-critical — pipeline always continues
      await retryTonyWithSimplifiedPrompt(jobId);
      break;

    case "wan2":
      // Wan2.2 failure → substitute Pexels stock b-roll for affected beats
      await substituteStockBroll(jobId);
      break;

    case "skyreels":
      // SkyReels failure → critical, alert Zeus + Jason immediately via Comms
      // Avatar generation is the only worker that aborts the pipeline
      await alertCriticalFailure(jobId, "skyreels", "Avatar generation failed — video cannot publish");
      throw new Error("SKYREELS_CRITICAL_FAILURE");

    case "research-visual":
      // Research visual failure → skip affected beats, Wan2.2 abstract fill
      await substituteAbstractFill(jobId);
      break;
  }
}

async function retryTonyWithSimplifiedPrompt(jobId: string): Promise<void> {
  // Haiku regenerates with explicit instruction to use only core packages:
  // remotion, recharts, d3 — no experimental Oracle-injected packages
  // If retry also fails → generateTextFallbackCards() handles gracefully
  try {
    await invokeTonyBatch(jobId, await getFailedTonyBeats(jobId), { simplified: true });
  } catch {
    await generateTextFallbackCards(jobId);
  }
}
```

---

## Worker 1: Audio Generation (audio-gen Lambda)

### ElevenLabs Rotation Logic
Four accounts × 10,000 chars/month = 40,000 chars free. One 8-minute video script ≈ 1,200 chars.

```typescript
// Check monthly usage per account before calling
async function selectElevenLabsAccount(charCount: number): Promise<string> {
  const accounts = await getAccountUsages(); // from DynamoDB
  const available = accounts
    .filter(a => a.usedThisMonth + charCount <= 10000)
    .sort((a, b) => a.usedThisMonth - b.usedThisMonth);

  if (available.length > 0) {
    await incrementUsage(available[0].id, charCount);
    return available[0].apiKey;
  }
  // All ElevenLabs accounts exhausted — fallback
  return "EDGE_TTS_FALLBACK";
}
```

### Voice ID Pool

Select voice ID based on `voiceConfig` from the script writer skill. Store all voice IDs in DynamoDB — user can add their own custom ElevenLabs voice IDs in Settings too.

```typescript
const VOICE_POOL = {
  male: {
    analytical:    "TX3LPaxmHKxFdv7VOQHJ", // Liam — clear, authoritative
    enthusiastic:  "VR6AewLTigWG4xSOukaG", // Arnold — energetic, dynamic
    documentary:   "onwK4e9ZLuTAKqWW03F9", // Daniel — deep, measured
    conversational:"pNInz6obpgDQGcFmaJgB", // Adam — warm, natural
  },
  female: {
    analytical:    "EXAVITQu4vr4xnSDxMaL", // Bella — clear, professional
    enthusiastic:  "MF3mGyEYCl7XYWbV9V6O", // Elli — bright, upbeat
    documentary:   "jsCqWAovK2LkecY7zXl4", // Charlotte — warm authority
    conversational:"ThT5KcBeYPX3keUQqHPh", // Dorothy — friendly, natural
  }
};

function selectVoiceId(voiceConfig: VoiceConfig): string {
  const { gender, style } = voiceConfig;
  return VOICE_POOL[gender][style] ?? VOICE_POOL.male.conversational;
}
```

### Edge-TTS Voice Fallback Pool

Mirror the same gender/style selection for Edge-TTS when ElevenLabs is exhausted:

```typescript
const EDGE_TTS_VOICES = {
  male: {
    analytical:    "en-US-GuyNeural",
    enthusiastic:  "en-US-TonyNeural",
    documentary:   "en-GB-RyanNeural",
    conversational:"en-US-ChristopherNeural"
  },
  female: {
    analytical:    "en-US-JennyNeural",
    enthusiastic:  "en-US-AriaNeural",
    documentary:   "en-GB-SoniaNeural",
    conversational:"en-IN-NeerjaNeural"
  }
};
```

### ElevenLabs API Call
```typescript
const voiceId = selectVoiceId(script.voiceConfig);

// Process script sections in sequence to maintain voice consistency
for (const section of script.sections) {
  const audio = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: section.script,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    })
  });
  // Save MP3 chunk to S3
}
```

### Edge-TTS Fallback (unlimited free)
```python
import edge_tts
import asyncio

async def generate_audio(text: str, voice: str = "en-US-GuyNeural") -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
    return b"".join(audio_chunks)

# Good free voices: en-US-GuyNeural, en-US-JennyNeural, en-IN-NeerjaNeural
```

### [PAUSE] Marker Handling
The script writer inserts `[PAUSE]` markers. Strip these from TTS text but use them to insert silence:
```python
import re
PAUSE_DURATION = 0.5  # seconds

def process_pause_markers(text: str) -> tuple[str, list[int]]:
    # Returns clean text + list of character positions where pauses should be inserted
    pause_positions = [m.start() for m in re.finditer(r'\[PAUSE\]', text)]
    clean_text = text.replace('[PAUSE]', '')
    return clean_text, pause_positions
```

---

## Worker 2a: Avatar / Talking Head (EC2 g5.12xlarge — SkyReels V2)

SkyReels V2 handles every beat where a human face appears on screen.
This is the model that determines channel credibility — the viewer
is looking directly at the avatar. Quality here is non-negotiable.

### Why SkyReels V2
SkyReels V2-I2V-14B-720P is the best open-source model for human-centric
video. In human evaluations it scores on par with proprietary models
Kling 1.6 and Runway Gen4. 33 distinct expressions, 400+ movement
combinations, cinematic framing. For a YouTube avatar that speaks to
camera for 8–12 minutes — this is the right tool.

### EC2 Spec
```
Instance:   g5.12xlarge
GPU:        4× NVIDIA A10G = 96GB VRAM total
Pricing:    ~$1.60/hr spot (4× A10G vs 1× A10G on g5.xlarge)
Model:      SkyReels-V2-I2V-14B-720P (fp16 or fp8 quantised)
Output:     720P talking head MP4 segments
```

### S3 Model + Avatar Structure
```
s3://content-factory-assets/
  models/
    skyreels-v2/
      SkyReels-V2-I2V-14B-720P/    ← model weights (~28GB fp8)
      configs/
    wan2.2/
      checkpoints/                  ← model weights (~15GB)
      configs/
  avatars/
    avatar_1_tech/
      reference.jpg                 ← high-res portrait (I2V — image not video)
      thumbnail.jpg
      config.json
    avatar_2_lifestyle/
    avatar_3_finance/
    avatar_4_beauty/
    avatar_5_documentary/
```

Note: SkyReels V2 I2V takes a **static reference image** not a reference
video. One high-quality portrait per avatar. Simpler than Wan2.2 R2V.

### ElevenLabs Voice Cue Parsing

Before sending audio to SkyReels — strip all voice cues from the
audio file but pass a cue map to the inference script so SkyReels
can match facial expression timing to the performance beats:

```typescript
interface VoiceCueMap {
  timestamp: number;      // seconds into audio
  cue: string;            // RISE / PEAK / DROP / WARM / QUESTION / PIVOT
  expressionHint: string; // translated for SkyReels expression system
}

const cueToExpression: Record<string, string> = {
  "RISE":      "curious anticipation, slight brow raise",
  "PEAK":      "confident assertion, direct eye contact",
  "DROP":      "reflective pause, slight head tilt",
  "WARM":      "conversational warmth, gentle smile",
  "QUESTION":  "open curiosity, questioning brow",
  "PIVOT":     "shift energy, brief neutral reset",
  "EMPHASIS":  "focused intensity on single word",
};
```

### EC2 Spot Instance Workflow — SkyReels

```typescript
async function runSkyReelsInstance(
  jobId: string,
  beats: MuseBeat[]
): Promise<void> {

  const instance = await ec2.runInstances({
    ImageId: SKYREELS_AMI_ID,      // pre-baked AMI with SkyReels V2 + CUDA
    InstanceType: "g5.12xlarge",
    InstanceMarketOptions: {
      MarketType: "spot",
      SpotOptions: { SpotInstanceType: "one-time" }
    },
    IamInstanceProfile: { Arn: EC2_ROLE_ARN },
    UserData: Buffer.from(`#!/bin/bash
      # Pull model + assets from S3
      aws s3 cp s3://content-factory-assets/models/skyreels-v2/ \
        /tmp/skyreels-v2/ --recursive
      aws s3 cp s3://content-factory-assets/avatars/${beats[0].avatarId}/ \
        /tmp/avatar/ --recursive
      aws s3 cp s3://content-factory-assets/jobs/${jobId}/audio/ \
        /tmp/audio/ --recursive

      # Run inference for each talking head beat
      python /tmp/skyreels-v2/inference_i2v.py \
        --beats_json /tmp/beats.json \
        --reference_image /tmp/avatar/reference.jpg \
        --audio_dir /tmp/audio/ \
        --cue_map /tmp/cue_map.json \
        --output_dir /tmp/output/ \
        --resolution 720p

      # Push all segment outputs to S3
      aws s3 cp /tmp/output/ \
        s3://content-factory-assets/jobs/${jobId}/segments/skyreels/ \
        --recursive

      # Signal completion
      aws dynamodb update-item --table-name pipeline-jobs \
        --key '{"jobId":{"S":"${jobId}"}}' \
        --update-expression "SET skyreelsStatus = :done" \
        --expression-attribute-values '{":done":{"S":"complete"}}'
      shutdown -h now
    `).toString("base64")
  });

  await pollUntilComplete(jobId, "skyreelsStatus", 900); // 15 min timeout
}
```

### AMI Setup — SkyReels (one-time)
```bash
# On a fresh g5.12xlarge Ubuntu 22.04 + CUDA 12:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate
git clone https://github.com/SkyworkAI/SkyReels-V2
cd SkyReels-V2 && pip install -r requirements.txt
# Download model weights to /models/skyreels-v2/
# Save AMI — reuse for every job
```

---

## Worker 2b: B-roll / Environments (EC2 g5.2xlarge — Wan2.2)

Wan2.2 handles every beat that is NOT a talking head.
Abstract atmosphere, environment, object, process — anything visual
that supports the narration without showing a human face.

### Why Wan2.2
Wan2.2-T2V-A14B is the strongest open-source general video model.
VBench score 84.7%+. Trained on 1.5B videos and 10B images.
Handles complex motion, spatial relationships, multi-object scenes.
For b-roll that gives the channel visual texture — this is correct.

### EC2 Spec
```
Instance:   g5.2xlarge
GPU:        1× NVIDIA A10G = 24GB VRAM
Pricing:    ~$0.40/hr spot
Model:      Wan2.2-T2V-A14B (fp8 quantised fits 24GB)
Output:     720P b-roll MP4 segments
```

### Prompt Construction Per Beat

Each beat's `visualNote` from Muse's blueprint becomes a Wan2.2
text prompt. Haiku translates the note into an optimal video prompt:

```typescript
async function buildWan2Prompt(beat: MuseBeat): Promise<string> {
  // Wan2.2 responds well to: subject, action, environment, lighting, camera
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Convert this visual note into a Wan2.2 video generation prompt.
                  Format: [subject] [action/motion] [environment] [lighting] [camera movement]
                  Max 40 words. No people, no faces. Abstract and atmospheric.
                  Visual note: "${beat.visualNote}"
                  Topic context: "${beat.topicContext}"
                  Return only the prompt, nothing else.`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
}
```

### EC2 Spot Instance Workflow — Wan2.2

```typescript
async function runWan2Instance(
  jobId: string,
  beats: MuseBeat[]
): Promise<void> {

  const instance = await ec2.runInstances({
    ImageId: WAN2_AMI_ID,          // pre-baked AMI with Wan2.2 + CUDA
    InstanceType: "g5.2xlarge",
    InstanceMarketOptions: {
      MarketType: "spot",
      SpotOptions: { SpotInstanceType: "one-time" }
    },
    IamInstanceProfile: { Arn: EC2_ROLE_ARN },
    UserData: Buffer.from(`#!/bin/bash
      aws s3 cp s3://content-factory-assets/models/wan2.2/ \
        /tmp/wan2.2/ --recursive
      aws s3 cp s3://content-factory-assets/jobs/${jobId}/wan2_prompts.json \
        /tmp/prompts.json

      python /tmp/wan2.2/generate_broll.py \
        --prompts_json /tmp/prompts.json \
        --output_dir /tmp/output/ \
        --resolution 720p \
        --fps 24

      aws s3 cp /tmp/output/ \
        s3://content-factory-assets/jobs/${jobId}/segments/wan2/ \
        --recursive

      aws dynamodb update-item --table-name pipeline-jobs \
        --key '{"jobId":{"S":"${jobId}"}}' \
        --update-expression "SET wan2Status = :done" \
        --expression-attribute-values '{":done":{"S":"complete"}}'
      shutdown -h now
    `).toString("base64")
  });

  await pollUntilComplete(jobId, "wan2Status", 900);
}
```

---

## Worker 2c: TONY — Code Agent (Lambda)

TONY is the code agent Lambda that replaced FLUX for all still and animated
visual generation. No EC2. No always-on instance. Fires instantly per job.

Full implementation: `lambdas/code-agent/` and `skills/tony/SKILL.md`
Pipeline wiring: `lib/video-pipeline/tony-batch.ts` via `invokeTonyBatch()`

TONY handles every beat routed to "TONY" in routeSegment():
  SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC   — stills and title cards
  CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY       — data visualisations
  Animated infographics, comparison tables      — Remotion compositions
  Counters, timelines, overlays, Lottie         — motion graphics

How it works:
  1. Qeon passes beat array to invokeTonyBatch()
  2. Each beat → CodeAgentInput with task + context + outputType
  3. Haiku generates Remotion/Recharts/D3/Nivo code
  4. Sandbox executes via child_process.fork() with 30s SIGKILL
  5. Output MP4 or PNG pushed to S3
  6. S3 path returned to av-sync for final stitch

Fallback on failure:
  Tier 1 — retry with simplified prompt (core packages only)
  Tier 2 — solid-colour text card via FFmpeg
  TONY failure never aborts the pipeline — only SkyReels is critical

Oracle Domain 9 keeps TONY's package toolbox current automatically.
New packages approved by Oracle → Zeus injects → TONY uses same day.
No redeployment needed.

---

## Worker 3: Niche Research & Visual Sourcing (research-visual Lambda)

Different niches have completely different research source stacks and
legal visual libraries. This worker handles both — pulling the right
sources for the niche, then surfacing legally usable visuals.

Runs before Wan2.2 and visual-gen so Qeon has real assets to work with
before generating anything.

---

### Niche Classification

```typescript
type NicheClass =
  | "AI_NEWS"         // AI model releases, benchmarks, research
  | "TECH_GENERAL"    // software, hardware, startups
  | "MOTORSPORT"      // F1, MotoGP, WEC, IndyCar
  | "FINANCE"         // markets, crypto, economics
  | "SCIENCE"         // research papers, discoveries
  | "GENERAL"         // fallback

function classifyNiche(niches: string[]): NicheClass {
  if (niches.some(n => ["ai", "llm", "ml", "models"].includes(n))) return "AI_NEWS";
  if (niches.some(n => ["f1", "motogp", "racing", "wec"].includes(n))) return "MOTORSPORT";
  if (niches.some(n => ["finance", "crypto", "markets"].includes(n))) return "FINANCE";
  if (niches.some(n => ["science", "research", "paper"].includes(n))) return "SCIENCE";
  if (niches.some(n => ["tech", "software", "hardware"].includes(n))) return "TECH_GENERAL";
  return "GENERAL";
}
```

---

### Niche: AI_NEWS — Research Stack

```
Source Tier 1 — PRIMARY (facts, numbers, architecture)

  ArXiv RSS               https://arxiv.org/rss/cs.AI
  ArXiv paper fetch       https://arxiv.org/abs/{paperId}
  Extract:                abstract, benchmark scores, parameter count,
                          architecture changes, authors' comparisons,
                          training data details, claimed improvements

  Hugging Face model card https://huggingface.co/{org}/{model}
  Extract:                capabilities, limitations, VRAM requirements,
                          supported tasks, evaluation results

  Company official blogs
    Anthropic             https://www.anthropic.com/news
    OpenAI                https://openai.com/blog
    Google DeepMind       https://deepmind.google/discover/blog
    Meta AI               https://ai.meta.com/blog
    Mistral               https://mistral.ai/news
  Extract:                positioning, use case framing, what they
                          emphasise vs downplay, release timeline

  Benchmark leaderboards
    LMSYS Chatbot Arena   https://chat.lmsys.org/?leaderboard
    HumanEval             (from papers)
    MMLU scores           (from papers)
  Extract:                where this model ranks vs competitors

Source Tier 2 — REACTION (community signal, real-world findings)

  Hacker News             https://hn.algolia.com/?q={modelName}
  Reddit r/MachineLearning, r/LocalLLaMA, r/ChatGPT
  X/Twitter               key researchers: @karpathy, @ylecun, @goodfellow
  Extract:                real-world test results, early failures,
                          surprising findings, community corrections
                          to official claims, contrarian takes

Source Tier 3 — COMPETITIVE CONTEXT

  Previous model paper / card
  LMSYS Arena head-to-head
  Extract:                what actually improved, what didn't,
                          how competitors score on same benchmarks

Research output contract for AI_NEWS:
  benchmarkData:    table of scores — this model vs 3 competitors
  architectureNote: what changed technically (plain English)
  communitySignal:  top 3 practitioner findings (real-world, not claims)
  uniqueAngle:      what most coverage is missing
  controversyFlag:  is there a claim vs reality gap?
```

### Niche: AI_NEWS — Visual Source Library

```typescript
interface AINewsVisualSources {

  // TIER 1 — Official, free, always use first
  officialAssets: {
    companyPressImages:   string;  // from press/media kit pages
    paperFigures:         string;  // ArXiv paper diagrams (open access)
    huggingFaceDemo:      string;  // GIF/screenshots from model card demos
    architectureDiagrams: string;  // from official blog posts
    benchmarkTables:      string;  // extracted from papers → rebuilt in Chart.js
  };

  // TIER 2 — Screen recordings (THE differentiator)
  screenRecordings: {
    // Qeon actually runs the model and records the output
    // This is the unique visual no competitor can replicate without doing the work
    liveAPITest:    string;  // run the model via API, record terminal/notebook
    outputComparison: string; // side-by-side outputs from multiple models
    benchmarkRun:   string;  // run HumanEval subset, record results live
  };

  // TIER 3 — TONY generated (code-agent Lambda)
  tonyGenerated: {
    // Section cards: Remotion animated compositions, brand-consistent dark theme
    // Concept illustrations: D3/Recharts data-driven visuals, stat callouts, timelines
    // Thumbnail source: TONY renders a high-contrast composition for thumbnail base
    // NEVER: generated screenshots of interfaces (use real screen recordings)
    // NEVER: generated benchmark tables (use Chart.js from real data — TONY handles this)
    sectionCards:    string;
    conceptImages:   string;
    thumbnailSrc:    string;
  };

  // TIER 4 — Wan2.2 generated (atmosphere only, video)
  generated: {
    datacentreAtmosphere: string;  // abstract server/compute visuals
    abstractAI:           string;  // neural network visualisations, data flows
    // NEVER: generated faces, generated "researchers", generated lab scenes
  };
}

// Screen recording implementation
async function runModelScreenRecording(
  modelId: string,
  testPrompts: string[],
  jobId: string
): Promise<string> {
  // Launch Puppeteer, navigate to model playground or run via API
  // Record 30-60 seconds of live model interaction
  // This is Step 2b in the research phase — before scripting
  // Muse gets the recording result so the script can reference real outputs
  const browser = await puppeteer.launch({ headless: false }); // visible for recording
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const recorder = await page.screencast({ path: `/tmp/model_test_${jobId}.mp4` });

  // Navigate to HuggingFace spaces or direct API playground
  await page.goto(`https://huggingface.co/spaces/${modelId}`);

  for (const prompt of testPrompts) {
    await page.fill('[placeholder*="message"]', prompt);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000); // wait for response
  }

  await recorder.stop();
  await browser.close();

  await s3.putObject({
    Bucket: BUCKET,
    Key: `jobs/${jobId}/research-visuals/model_test.mp4`,
    Body: fs.readFileSync(`/tmp/model_test_${jobId}.mp4`)
  });

  return `s3://${BUCKET}/jobs/${jobId}/research-visuals/model_test.mp4`;
}
```

---

### Niche: MOTORSPORT (F1, MotoGP) — Research Stack

```
Source Tier 1 — PRIMARY (official, legally safe)

  FIA official site         https://www.fia.com/regulation/category/110
  FIA technical regs        https://www.fia.com/technical-regulations
  Extract:                  rule changes, technical directives, penalties

  Formula1.com press        https://www.formula1.com/en/latest/all
  (press releases only — NOT race footage, NOT broadcast content)
  Extract:                  official driver/team statements, event news

  Team press releases
    Mercedes               https://www.mercedes-amg-petronas.com/news
    Red Bull               https://www.redbullracing.com/int-en/news
    Ferrari                https://www.ferrari.com/en-EN/formula1/news
    McLaren                https://www.mclaren.com/racing/news
  Extract:                  car launch details, driver comments,
                            setup philosophy, team strategy hints
  Note:                     Team press images often cleared for
                            editorial/commentary use — check licence per image

  Timing data (public)
    FastF1 library          pip install fastf1
    OpenF1 API              https://openf1.org/
  Extract:                  lap times, sector splits, tyre strategies,
                            pit stop windows, speed trap data,
                            DRS activations, brake points

  MotoGP official           https://www.motogp.com/en/news
  Dorna press releases      https://www.motogp.com/en/news/press-releases
  Extract:                  official statements, technical updates

Source Tier 2 — ANALYSIS CONTEXT

  Motorsport.com            https://www.motorsport.com (text analysis)
  The Race                  https://the-race.com (technical breakdowns)
  RaceFans                  https://www.racefans.net
  Extract:                  expert technical analysis to reference + build on
  Note:                     Use as source material for YOUR analysis,
                            not as footage. Reference and cite, never embed.
```

### Niche: MOTORSPORT — Visual Source Library

```typescript
interface MotorsportVisualSources {

  // TIER 1 — Data visualisations (built by Qeon, 100% owned)
  dataViz: {
    lapTimeComparison:    string;  // Chart.js — sector by sector breakdown
    tyreStrategyMap:      string;  // custom timeline chart
    pitWindowAnalysis:    string;  // optimal vs actual pit timing
    speedTrapComparison:  string;  // driver vs driver at key points
    underCutModel:        string;  // gap delta chart during pit window
    championshipModel:    string;  // points scenarios visualised
    // All built from FastF1 / OpenF1 timing data — fully owned
  };

  // TIER 2 — Official press images (editorial use)
  officialImages: {
    // Download from team press portals — check licence
    // Most permit editorial/commentary use without commercial licence
    // ALWAYS credit: "Image: [Team Name]"
    // NEVER use without checking the specific licence on each image
    teamCarImages:    string;   // car launch photos, livery reveals
    driverPortraits:  string;   // official team headshots
    trackMaps:        string;   // FIA official circuit layouts
  };

  // TIER 3 — TONY generated (code-agent Lambda)
  tonyGenerated: {
    // TONY renders section cards, transition animations, concept compositions
    // Brand-consistent dark theme via Remotion + RRQ theme tokens
    // Lambda output — fully owned, zero EC2 cost
    sectionCards:     string;   // animated section card: "Monaco circuit, dark cinematic"
    conceptImages:    string;   // data composition: "F1 tyre strategy timeline"
    thumbnailSrc:     string;   // thumbnail base composition with avatar reference
  };

  // TIER 4 — Legal stock footage (Pexels/Pixabay search terms)
  // SUPPLEMENTARY ONLY — for generic atmosphere when TONY data viz doesn't cover it
  legalStock: {
    // These return real racing footage — low quality but legally clean
    // Use for atmosphere B-roll only, not as the main visual
    searchTerms: [
      "racing car track",       // generic circuit footage
      "motorsport helmet",      // driver preparation
      "pit lane crew",          // team mechanics (generic)
      "racing tyres",           // tyre detail
    ]
  };

  // TIER 5 — Wan2.2 generated (atmosphere only)
  generated: {
    // Abstract racing atmosphere — NEVER try to generate real cars/circuits
    // Wan2.2 racing car output looks AI — don't use as primary visual
    // Use only for mood transitions
    searchTerms: [
      "high speed blur motion track",
      "abstract speed light trails",
      "pit crew shadows dramatic lighting",
    ]
  };

  // TIER 6 — NEVER USE (copyright strike guaranteed)
  prohibited: [
    "race broadcast footage",      // F1TV, Sky Sports, ESPN
    "onboard camera footage",      // FOM owned
    "podium ceremony footage",     // FOM owned
    "pre-race grid footage",       // FOM owned
    "YouTube race highlights",     // repost = strike
    "MotoGP race footage",         // Dorna owned
  ];
}
```

### Copyright Risk Classification

```typescript
interface CopyrightRisk {
  level: "SAFE" | "CHECK_LICENCE" | "AVOID" | "NEVER";
  action: string;
}

const copyrightMatrix: Record<string, CopyrightRisk> = {
  // AI Niche
  "arxiv_paper_figure":     { level: "SAFE",           action: "cite paper" },
  "huggingface_demo":       { level: "SAFE",           action: "credit model card" },
  "official_company_blog":  { level: "CHECK_LICENCE",  action: "check media kit terms" },
  "community_screenshot":   { level: "CHECK_LICENCE",  action: "fair use commentary" },
  "screen_recording_own":   { level: "SAFE",           action: "you recorded it" },

  // Motorsport
  "team_press_image":       { level: "CHECK_LICENCE",  action: "check team media terms" },
  "fia_technical_doc":      { level: "SAFE",           action: "public regulation docs" },
  "fastf1_timing_data":     { level: "SAFE",           action: "public timing data" },
  "race_broadcast_clip":    { level: "NEVER",          action: "instant ContentID strike" },
  "f1tv_footage":           { level: "NEVER",          action: "FOM will strike immediately" },
  "youtube_highlights":     { level: "NEVER",          action: "repost = strike" },
  "motogp_race_footage":    { level: "NEVER",          action: "Dorna enforces aggressively" },

  // Universal
  "pexels_stock":           { level: "SAFE",           action: "Pexels licence" },
  "pixabay_stock":          { level: "SAFE",           action: "Pixabay licence" },
  "wan2_generated":         { level: "SAFE",           action: "you generated it" },
  "skyreels_generated":     { level: "SAFE",           action: "you generated it" },
  "tony_generated":         { level: "SAFE",           action: "you generated it — Lambda output, fully owned" },
};

// If any visual source is classified NEVER — block it before it reaches Qeon
// If CHECK_LICENCE — Haiku fetches the licence page and validates before use
async function validateVisualSource(
  source: string,
  url: string
): Promise<boolean> {
  const risk = copyrightMatrix[source];
  if (risk.level === "NEVER") return false;
  if (risk.level === "AVOID") return false;
  if (risk.level === "SAFE")  return true;
  // CHECK_LICENCE — fetch and validate
  return await checkLicence(url);
}
```

---

### Research Output Contract

Every niche research run produces a structured `ResearchPackage`
that Qeon passes to Muse for scripting:

```typescript
interface ResearchPackage {
  niche: NicheClass;
  topic: string;
  angle: string;              // Regum's approved angle

  // Facts layer (sourced, cited)
  facts: {
    claim: string;
    source: string;
    sourceUrl: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }[];

  // Perspective layer (community signal, contrarian finds)
  perspectives: {
    point: string;
    source: string;           // "r/LocalLLaMA", "Researcher X on X"
    relevance: string;        // why this matters to the angle
  }[];

  // Visual assets ready for Qeon
  visualAssets: {
    id: string;
    type: "PAPER_FIGURE" | "SCREEN_RECORDING" | "DATA_VIZ"
        | "OFFICIAL_IMAGE" | "STOCK" | "GENERATED";
    s3Path: string;
    suggestedTimestamp: string;  // which script beat this pairs with
    copyrightStatus: "SAFE" | "CHECK_LICENCE";
    credit: string;
  }[];

  // Screen recordings (AI niche only)
  screenRecordings: {
    modelTested: string;
    testPrompts: string[];
    outputSummary: string;    // what the test found — goes into script
    s3Path: string;
  }[];

  // Niche-specific data
  benchmarkData?: BenchmarkTable;     // AI_NEWS
  timingData?: F1TimingData;          // MOTORSPORT
}
```

---

## Worker 3: AV Sync & Final Render (av-sync Lambda)

FFmpeg is the core engine. Install as a Lambda layer.

### YouTube Video (16:9, 1080p)

```bash
# Step 1: Trim each clip to match audio section duration
ffmpeg -i clip_1.mp4 -t {audio_duration} -c copy clip_1_trimmed.mp4

# Step 2: Concatenate all clips
ffmpeg -f concat -safe 0 -i clips_list.txt -c copy video_raw.mp4

# Step 3: Mix audio over video
ffmpeg -i video_raw.mp4 -i voiceover.mp3 -i background_music.mp3 \
  -filter_complex "[1:a]volume=1.0[vo];[2:a]volume=0.15[bg];[vo][bg]amix=inputs=2[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest video_with_audio.mp4

# Step 4: Burn subtitles (generated from script + timestamps)
ffmpeg -i video_with_audio.mp4 -vf \
  "subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Alignment=2'" \
  -c:a copy final_youtube.mp4
```

### Instagram Reel (9:16, 1080×1920)

```bash
# Crop landscape to vertical with smart center detection
ffmpeg -i final_youtube.mp4 \
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
  -c:a copy reel_vertical.mp4

# Add large subtitle overlay for mobile (85% watch without sound)
ffmpeg -i reel_vertical.mp4 -vf \
  "subtitles=subs.srt:force_style='FontName=Arial,FontSize=28,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150'" \
  -c:a copy final_reel.mp4
```

### Subtitle Generation
Convert script sections + audio timestamps to SRT format:
```python
def generate_srt(sections: list, audio_timestamps: list) -> str:
    srt_entries = []
    for i, (section, timing) in enumerate(zip(sections, audio_timestamps)):
        # Split section text into subtitle chunks (~7 words each)
        words = section.script.split()
        chunks = [words[j:j+7] for j in range(0, len(words), 7)]
        chunk_duration = (timing.end - timing.start) / len(chunks)

        for k, chunk in enumerate(chunks):
            start = timing.start + (k * chunk_duration)
            end = start + chunk_duration
            srt_entries.append(f"{i*100+k+1}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{' '.join(chunk)}\n")

    return "\n".join(srt_entries)
```

### Background Music
Pull from Pixabay Music API (free, no attribution required, searchable by mood):
```typescript
// Search Pixabay Music by mood derived from video tone
const moodMap = {
  informative:  "corporate focus",
  entertaining: "upbeat positive",
  documentary:  "cinematic dramatic",
  analytical:   "focus minimal",
  storytelling: "cinematic emotional"
};

const mood = moodMap[videoTone] || "corporate focus";
const response = await fetch(
  `https://pixabay.com/api/music/?key=${PIXABAY_KEY}&mood=${mood}&duration_max=600`
);
const { hits } = await response.json();
// Pick first result, download MP3, mix at 15% volume under voiceover
```

---

## Worker 4: Reel Cuts (reel-gen Lambda)

Instagram Reels need fast cuts — one cut every 2–3 seconds keeps completion high.

```bash
# Generate cut list: every 2.5 seconds on average
ffmpeg -i reel_vertical.mp4 \
  -vf "select=not(mod(n\,75)),setpts=N/FRAME_RATE/TB" \
  -vsync vfr cuts_preview.mp4

# Apply jump-cut style editing (remove long static shots)
# Use scene detection to find natural cut points
ffmpeg -i reel_vertical.mp4 -vf "select=gt(scene\,0.3),setpts=N/FRAME_RATE/TB" \
  reel_cut.mp4
```

---

## S3 Asset Structure

```
s3://content-factory-assets/
  {jobId}/
    raw/
      audio/       → section_1.mp3, section_2.mp3 ...
      clips/       → clip_section_1.mp4 ...
      music/       → background.mp3
    processed/
      voiceover.mp3
      video_raw.mp4
      subs.srt
    final/
      youtube_final.mp4      → 16:9, 1080p
      instagram_reel.mp4     → 9:16, 1080x1920
      thumbnail.png          → 1280x720
```

---

## Output Contract

```json
{
  "jobId": "string",
  "status": "processing | complete | failed",
  "assets": {
    "youtubeVideo": "string — S3 URL",
    "youtubeShort": "string — S3 URL (present if user chose Shorts)",
    "voiceover": "string — S3 URL",
    "subtitles": "string — S3 URL to SRT file",
    "thumbnail": "string — S3 URL"
  },
  "metadata": {
    "youtubeDurationSeconds": "number",
    "shortsDurationSeconds": "number — present if Shorts generated",
    "shortsMethod": "convert | fresh — which Shorts approach was used",
    "wordCount": "number",
    "ttsProvider": "elevenlabs | edge-tts",
    "elevenLabsAccount": "string — which account was used"
  },
  "errors": ["string — any non-fatal issues encountered"]
}
```

---

## Worker 5: YouTube Shorts Generation (shorts-gen Lambda)

Runs after the main video is rendered. User chose one of two options:

### Option A — Convert from Main Video (free, no extra AI cost)
Extract the single most compelling 60 seconds from the main video using FFmpeg scene detection:

```bash
# Detect highest-energy scene using FFmpeg silencedetect + scene filter
# Pick the 60-second window with most scene changes (most dynamic section)
ffmpeg -i final_youtube.mp4 \
  -vf "select=gt(scene\,0.4),metadata=print:file=scenes.txt" \
  -an -f null -

# Once best window identified, extract it
ffmpeg -i final_youtube.mp4 \
  -ss {best_start} -t 60 \
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
  -c:a copy shorts_vertical.mp4

# Burn large captions for no-sound viewing
ffmpeg -i shorts_vertical.mp4 -vf \
  "subtitles=subs.srt:force_style='FontSize=32,Alignment=2,MarginV=200'" \
  -c:a copy final_short.mp4
```

### Option B — Fresh Short Content (small Haiku cost)
Uses the `shortsScript` from the script writer skill. Generate fresh audio via Edge-TTS (save ElevenLabs credits — it's only 60 seconds), fetch one matching Pexels clip, stitch with FFmpeg.

```bash
# Single clip, single audio file, same FFmpeg pipeline as main video
# but vertical from the start — no cropping needed
ffmpeg -i short_clip.mp4 -i short_audio.mp3 \
  -vf "scale=1080:1920,subtitles=short_subs.srt:force_style='FontSize=32'" \
  -map 0:v -map 1:a -c:v libx264 -c:a aac final_short.mp4
```

Always use **Edge-TTS for Shorts audio** regardless of ElevenLabs availability — 60 seconds doesn't justify spending credits.

---

## Worker 6: Visual Asset Generation (visual-gen Lambda)

Renders all `visualAssets` from the script JSON into PNG screenshots or MP4 animations using Puppeteer headless Chrome. Runs on Lambda — no GPU needed.

### Dependencies (Lambda Layer)
```
puppeteer-core + @sparticuz/chromium  ← lightweight Chromium for Lambda
chart.js                              ← bar, line, radar charts
mermaid                               ← flow diagrams
```

### Master Rendering Function

```typescript
async function renderVisualAsset(asset: VisualAsset): Promise<string> {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Generate HTML for this asset type
  const html = generateHTML(asset);
  await page.setContent(html, { waitUntil: "networkidle0" });

  let outputPath: string;

  if (asset.animated) {
    // Record MP4 via page.screencast (Puppeteer v22+)
    const recorder = await page.screencast({ path: `/tmp/${asset.id}.mp4` });
    await page.waitForTimeout(asset.duration * 1000);
    await recorder.stop();
    outputPath = `/tmp/${asset.id}.mp4`;
  } else {
    // Static screenshot → PNG
    await page.screenshot({ path: `/tmp/${asset.id}.png`, fullPage: false });
    outputPath = `/tmp/${asset.id}.png`;
  }

  await browser.close();

  // Push to S3
  await s3.putObject({
    Bucket: BUCKET,
    Key: `jobs/${jobId}/visuals/${asset.id}.${asset.animated ? "mp4" : "png"}`,
    Body: fs.readFileSync(outputPath)
  });

  return `s3://${BUCKET}/jobs/${jobId}/visuals/${asset.id}`;
}
```

### HTML Templates Per Asset Type

**Design system — consistent across all visuals:**
```css
/* Applied to every template */
body {
  background: #0a0a0a;
  font-family: 'Syne', sans-serif;    /* matches app font */
  color: #f0ece4;
  margin: 0;
  padding: 60px;
}
.accent  { color: #f5a623; }          /* amber — brand colour */
.success { color: #22c55e; }          /* green — winner highlight */
.source  { color: #666; font-size: 14px; font-family: 'DM Mono', monospace; }
```

**comparison-table:**
```html
<!-- Animated: rows fade in one by one 200ms stagger -->
<table>
  <thead>
    <tr>{{columns mapped to <th>}}</tr>
  </thead>
  <tbody>
    {{rows.map(row => <tr class="{{winnerCol highlighted}}">
      <td class="feature-label">{{row[0]}}</td>
      {{row.slice(1).map(cell => <td>{{cell}}</td>)}}
    </tr>)}}
  </tbody>
</table>
<div class="source">Source: {{footnote}}</div>
```

**bar-chart / line-chart:**
```html
<!-- Chart.js canvas — bars animate from 0 to value -->
<canvas id="chart"></canvas>
<script>
  new Chart(document.getElementById('chart'), {
    type: '{{bar|line}}',
    data: {
      labels: {{xValues}},
      datasets: {{datasets mapped to Chart.js format}}
    },
    options: {
      animation: { duration: 1500, easing: 'easeOutQuart' },
      plugins: {
        legend: { labels: { color: '#f0ece4' }},
        title: { display: true, text: '{{title}}', color: '#f0ece4' }
      },
      scales: {
        x: { ticks: { color: '#f0ece4' }, grid: { color: '#222' }},
        y: { ticks: { color: '#f0ece4' }, grid: { color: '#222' }}
      }
    }
  });
</script>
```

**radar-chart:**
```html
<!-- Two subjects overlaid, semi-transparent fill -->
<canvas id="radar"></canvas>
<script>
  new Chart(document.getElementById('radar'), {
    type: 'radar',
    data: {
      labels: {{dimensions}},
      datasets: {{subjects.map(s => ({
        label: s.label,
        data: s.scores,
        backgroundColor: s.colour + '33',
        borderColor: s.colour,
        borderWidth: 2
      }))}}
    },
    options: {
      scales: {
        r: {
          min: 0, max: 10,
          ticks: { color: '#f0ece4', backdropColor: 'transparent' },
          grid: { color: '#333' },
          pointLabels: { color: '#f0ece4', font: { size: 16 }}
        }
      }
    }
  });
</script>
```

**flow-diagram:**
```html
<!-- Mermaid.js — nodes fade in sequentially -->
<div class="mermaid">{{mermaid syntax}}</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({
    theme: 'dark',
    themeVariables: {
      primaryColor: '#1a1a1a',
      primaryTextColor: '#f0ece4',
      lineColor: '#f5a623',
      fontSize: '18px'
    }
  });
</script>
```

**personality-card:**
```html
<!-- Image left, facts right — clean editorial style -->
<div class="card">
  <img src="{{imageUrl}}" class="avatar-img" />
  <div class="facts">
    <h2>{{name}}</h2>
    <p class="role accent">{{role}} · {{organisation}}</p>
    <ul>{{facts.map(f => <li>{{f}}</li>)}}</ul>
    <span class="source">Source: {{source}}</span>
  </div>
</div>
```

**news-timeline:**
```html
<!-- Vertical timeline, events appear one by one -->
<div class="timeline">
  {{events.map((e, i) => `
    <div class="event" style="animation-delay: ${i * 400}ms">
      <div class="date accent">${e.date}</div>
      <div class="headline">${e.headline}</div>
      <div class="detail">${e.detail}</div>
    </div>
  `)}}
</div>
```

**infographic-card / stat-callout:**
```html
<!-- Large stat centred, source bottom — 3-4 second clip -->
<div class="stat-card">
  <div class="big-stat accent">{{stat}}</div>
  <div class="label">{{label}}</div>
  <div class="context">{{context}}</div>
  <div class="source">{{source}}</div>
</div>
```

### Citation Footer

Every visual has a source citation bar at the bottom:
```html
<div class="citation-bar">
  {{citations.map(c => `<span>${c.title} — ${c.url}</span>`)}}
</div>
```

This automatically appears in the video frame — viewers see real sources, channel credibility increases.

### FFmpeg Visual Insertion

After all visuals rendered, av-sync Lambda composites them into the video timeline:

```bash
# For each visual-asset section:
# Get timestamps from section.timestampStart and duration

# Static PNG — hold for duration seconds
ffmpeg -loop 1 -i visual_asset.png -i full_audio.mp3 \
  -ss {insertAt} -t {duration} \
  -vf "scale=1920:1080" \
  -c:v libx264 -tune stillimage -c:a aac \
  visual_clip.mp4

# Animated MP4 — drop in directly
ffmpeg -i visual_animation.mp4 -i full_audio.mp3 \
  -ss {insertAt} -t {duration} \
  -map 0:v -map 1:a \
  visual_clip.mp4

# Stitch all clips (avatar + broll + visuals) in timestamp order
ffmpeg -f concat -safe 0 -i clips_list.txt \
  -c copy final_youtube.mp4
```

Audio and captions run continuously throughout — visuals are video-only, audio master timeline is never interrupted.

---

## Infrastructure Configuration

```yaml
# Lambda workers
audio-gen:
  memory: 512MB
  timeout: 300s

research-visual:
  memory: 2048MB        # Puppeteer for screen recordings
  timeout: 600s         # research + visual sourcing takes time
  layers:
    - chromium-layer    # @sparticuz/chromium
    - nodejs-deps

av-sync:
  memory: 3008MB
  timeout: 900s

shorts-gen:
  memory: 1024MB
  timeout: 180s

# EC2 GPU instances — THREE separate instances, different models

avatar-gen (SkyReels V2):
  instance_type:  g5.12xlarge
  gpu:            4× NVIDIA A10G (96GB VRAM total)
  lifecycle:      spot — spin up per job, self-terminate on complete
  pricing:        spot ~$1.60/hr → ~$0.32/video (12min avg)
  ami:            pre-baked with SkyReels V2 + CUDA 12 + diffusers
  model:          SkyReels-V2-I2V-14B-720P (fp8 quantised)
  model_path:     s3://content-factory-assets/models/skyreels-v2/
  timeout:        900s
  self_terminate: true
  handles:        TALKING_HEAD, SPLIT_SCREEN beats only
  upgrade_path:   update model_path when SkyReels V3 weights stable

broll-gen (Wan2.2):
  instance_type:  g5.2xlarge
  gpu:            1× NVIDIA A10G (24GB VRAM)
  lifecycle:      spot — spin up per job, self-terminate on complete
  pricing:        spot ~$0.40/hr → ~$0.07/video (10min avg)
  ami:            pre-baked with Wan2.2 + CUDA 12
  model:          Wan2.2-T2V-A14B (fp8 quantised, fits 24GB)
  model_path:     s3://content-factory-assets/models/wan2.2/
  timeout:        900s
  self_terminate: true
  handles:        B_ROLL, environment, atmosphere beats only
  upgrade_path:   update model_path when Wan2.3/2.4 weights release

image-gen code-agent (TONY):
  type:           Lambda (code-agent/)
  model:          Haiku 4.5 — generates Remotion/Recharts/D3/Nivo/Lottie code
  execution:      child_process.fork() sandboxed JS — 30s SIGKILL
  lifecycle:      Lambda — no EC2, no always-on, fires instantly per beat
  pricing:        ~$0.01/video (Haiku code-gen + Lambda execution)
  handles:        SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC,
                  CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY,
                  animated infographics, comparison tables,
                  counters, timelines, overlays, Lottie animations
  fallback:       simplified prompt retry → text card via FFmpeg
  toolbox:        Oracle Domain 9 keeps package list current automatically
  upgrade_path:   Oracle approves new packages → Zeus injects → TONY uses same day

# Cost per video (estimates)
# SkyReels segments:    ~12 min @ $1.60/hr spot  = $0.32
# Wan2.2 b-roll:        ~10 min @ $0.40/hr spot  = $0.07
# TONY Lambda:          Haiku code-gen + sandbox  = $0.01
# Lambda workers:       audio, research, av-sync  = $0.04
# S3 + transfer:                                  = $0.01
# ElevenLabs × 4:       free tier rotation        = $0.00
# Bedrock LLM calls:                              = $0.08
# ──────────────────────────────────────────────────────
# Total per video:                                ~ $0.53
#
# Monthly fixed costs:
# AWS Bedrock base (agent scheduled runs)         ~ $8.00
# S3 storage + transfer baseline                  ~ $2.00
# Inngest                                           $0.00  (free tier)
# Vercel                                            $0.00  (free tier)
# ──────────────────────────────────────────────────────
# Monthly fixed:                                  ~ $10.00
# (was ~$146/month with FLUX reserved instance)
#
# Two EC2 instances run in parallel →
# production time ≈ max(SkyReels ~12min, Wan2 ~10min) = ~12 min
# TONY runs concurrently — completes in ~2min, never on critical path
# Zero idle cost — all workers terminate when job is done


```

---

## References
- See `references/ffmpeg-commands.md` for additional FFmpeg recipes
- See `references/lambda-layers.md` for FFmpeg Lambda layer setup instructions

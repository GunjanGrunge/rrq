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
Step 1: audio-gen Lambda        → Script + ElevenLabs cues → MP3
Step 2a: avatar-gen EC2         → Talking head segments → SkyReels V2
          (g5.12xlarge)           Reference image + MP3 → Avatar MP4
Step 2b: broll-gen EC2          → B-roll / environment segments → Wan2.2
          (g5.2xlarge)            Text prompt → B-roll MP4
Step 2c: image-gen EC2          → Stills / thumbnails / section cards → FLUX.2 [klein] 4B
          (g4dn.xlarge)           ALWAYS HOT — dedicated instance, never shared
                                  Text prompt + optional reference images → PNG
Step 3: research-visual Lambda  → Niche-specific visual assets
                                   (screen recordings / paper figures /
                                    data viz / official images)
Step 4: visual-gen Lambda       → Chart.js / Mermaid / HTML visuals → PNG/MP4
Step 5: av-sync Lambda          → All segments + audio + subtitles → MP4 (FFmpeg)
Step 6: shorts-gen Lambda       → Main MP4 → Vertical 9:16 Short (FFmpeg)
```

All assets stored in S3. Workers pull from S3, process, push back to S3.

The image-gen EC2 (g4dn.xlarge) is the only always-on instance.
SkyReels and Wan2.2 spin up per job and self-terminate. FLUX stays running
24/7 — the cost (~$0.19/hr on-demand, ~$0.10/hr reserved) is lower than the
latency and cold-start penalty of spinning it up per job.

---

### Three EC2 Model Routing

Qeon reads every beat in Muse's MuseBlueprint. Each beat has a `visualType`.
The routing decision is made once per job — all beats categorised before
any EC2 instance is started.

```typescript
type SegmentRoute =
  | "SKYREELS"        // talking head / avatar segments
  | "WAN2"            // b-roll video / atmospheric motion
  | "FLUX"            // stills, section cards, thumbnail source images
  | "LAMBDA_VISUAL"   // Chart.js / Mermaid / HTML data viz
  | "RESEARCH_VISUAL" // screen recordings, paper figures, official images

function routeSegment(beat: MuseBeat): SegmentRoute {
  if (beat.visualType === "TALKING_HEAD")    return "SKYREELS";
  if (beat.visualType === "SPLIT_SCREEN")    return "SKYREELS";
  if (beat.visualType === "B_ROLL")          return "WAN2";
  if (beat.visualType === "SECTION_CARD")    return "FLUX";       // title/transition stills
  if (beat.visualType === "CONCEPT_IMAGE")   return "FLUX";       // illustrative still
  if (beat.visualType === "THUMBNAIL_SRC")   return "FLUX";       // thumbnail source image
  if (beat.visualType === "CHART")           return "LAMBDA_VISUAL";
  if (beat.visualType === "DIAGRAM")         return "LAMBDA_VISUAL";
  if (beat.visualType === "SLIDE")           return "LAMBDA_VISUAL";
  if (beat.visualType === "GRAPHIC_OVERLAY") return "LAMBDA_VISUAL";
  if (beat.visualType === "IMAGE")           return "RESEARCH_VISUAL";
  if (beat.visualType === "SCREEN_RECORD")   return "RESEARCH_VISUAL";
  return "WAN2"; // default
}

// Batch by route before spinning up instances
const skyreelsBatch  = beats.filter(b => routeSegment(b) === "SKYREELS");
const wan2Batch      = beats.filter(b => routeSegment(b) === "WAN2");
const fluxBatch      = beats.filter(b => routeSegment(b) === "FLUX");
const lambdaBatch    = beats.filter(b => routeSegment(b) === "LAMBDA_VISUAL");
const researchBatch  = beats.filter(b => routeSegment(b) === "RESEARCH_VISUAL");

// Fire all workers in parallel — FLUX is always hot, others spin up on demand
const results = await Promise.allSettled([
  skyreelsBatch.length > 0  ? runSkyReelsInstance(jobId, skyreelsBatch)  : Promise.resolve(),
  wan2Batch.length > 0      ? runWan2Instance(jobId, wan2Batch)           : Promise.resolve(),
  fluxBatch.length > 0      ? runFluxGeneration(jobId, fluxBatch)         : Promise.resolve(),
  lambdaBatch.length > 0    ? runVisualLambdas(jobId, lambdaBatch)        : Promise.resolve(),
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
  const workerNames = ["skyreels", "wan2", "flux", "lambda-visual", "research-visual"];

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
    case "flux":
      // FLUX failure → use solid-colour section cards + Pexels stock for concept images
      // Thumbnail generation retried up to 3× before falling back to template
      await generateFallbackStills(jobId);
      break;
    case "wan2":
      // Wan2.2 failure → substitute Pexels stock b-roll for affected beats
      await substituteStockBroll(jobId);
      break;
    case "skyreels":
      // SkyReels failure → critical, alert Zeus + Jason immediately via Comms
      await alertCriticalFailure(jobId, "skyreels", "Avatar generation failed — video cannot publish");
      throw new Error("SKYREELS_CRITICAL_FAILURE"); // abort pipeline, do not publish
    case "lambda-visual":
      // Data viz failure → substitute static screenshot of data source
      await generateStaticDataFallback(jobId);
      break;
    case "research-visual":
      // Research visual failure → skip affected beats, Wan2.2 abstract fill
      await substituteAbstractFill(jobId);
      break;
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

## Worker 2c: Image Generation (EC2 g4dn.xlarge — FLUX.2 [klein] 4B) ← ALWAYS ON

FLUX.2 [klein] 4B generates all still images: section title cards, concept
illustrations, thumbnail source images, and any CONCEPT_IMAGE beat in Muse's
blueprint. It runs 24/7 as a dedicated always-hot instance — no cold start,
no resource contention with Wan2.2 or SkyReels.

### Why FLUX.2 [klein] 4B

FLUX.2 [klein] 4B is Apache 2.0 licensed — fully commercial, self-hosted,
zero per-image API cost. 4B distilled model with sub-second inference on
A10G. Supports multi-reference generation (up to 4 reference images) for
avatar/brand consistency across thumbnails. Text rendering capability is
exceptional — benchmark-leading for text-in-image for section cards.

Quality goal: every image passes Vera's Visual QA on first attempt.
Retry budget exists but the target is zero retries. Prompt quality
and inference settings are tuned for quality over speed.

### EC2 Spec
```
Instance:     g4dn.xlarge
GPU:          1× NVIDIA T4 (16GB VRAM)
Pricing:      ~$0.526/hr on-demand OR ~$0.19/hr reserved 1yr
              Reserved is the right call — instance runs 24/7
Model:        FLUX.2-klein-4B distilled (FP8 quantised → ~8GB VRAM)
              8GB VRAM used → 8GB headroom for batched inference
Output:       1024×1024 PNG (16:9 crops applied by Qeon post-generation)
Licence:      Apache 2.0 — commercial use confirmed
Model path:   s3://content-factory-assets/models/flux-klein-4b/
```

### S3 Model Structure
```
s3://content-factory-assets/
  models/
    flux-klein-4b/
      flux-2-klein-4b-fp8.safetensors   ← ~8GB
      text_encoder/                      ← T5 encoder
      vae/                               ← VAE weights
      configs/
  reference-images/
    avatars/                             ← per avatar reference PNGs for consistency
    brand/                               ← channel logo, colour palette reference
```

### Inference Server — Always Running

The g4dn.xlarge runs a persistent FastAPI inference server, not a
one-shot script. Requests arrive via internal HTTP from the pipeline
Lambda. Model stays loaded in VRAM — no model reload per request.

```python
# inference_server.py — runs on startup, stays alive
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from diffusers import FluxPipeline
from contextlib import asynccontextmanager
import torch
import asyncio
import uuid
import boto3
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Global pipeline — loaded once, stays in VRAM
pipe: FluxPipeline = None
generation_semaphore = asyncio.Semaphore(2)  # max 2 concurrent generations

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipe
    logger.info("Loading FLUX.2 [klein] 4B FP8...")
    pipe = FluxPipeline.from_single_file(
        "/models/flux-klein-4b-fp8.safetensors",
        torch_dtype=torch.float16,
    )
    pipe = pipe.to("cuda")
    pipe.enable_vae_slicing()       # reduces peak VRAM during decode
    pipe.enable_attention_slicing() # safer for batched inference on 16GB
    logger.info("FLUX pipeline ready")
    yield
    # Shutdown cleanup
    del pipe
    torch.cuda.empty_cache()

app = FastAPI(lifespan=lifespan)

@app.post("/generate")
async def generate(request: GenerationRequest):
    """
    Single image generation with quality-first settings.
    Returns S3 path of saved PNG.
    """
    async with generation_semaphore:
        return await _generate_image(request)

@app.get("/health")
async def health():
    return {"status": "ok", "gpu_memory_free_gb": _get_free_vram()}

def _get_free_vram() -> float:
    free, total = torch.cuda.mem_get_info()
    return round(free / 1e9, 2)
```

### Generation Request Contract

```typescript
interface FluxGenerationRequest {
  jobId:       string;
  beatId:      string;
  prompt:      string;           // constructed by Qeon from Muse's visualNote
  negativePrompt?: string;       // what to avoid
  referenceImages?: string[];    // S3 paths — avatar refs for consistency (max 4)
  imageType:   "SECTION_CARD" | "CONCEPT_IMAGE" | "THUMBNAIL_SRC";
  aspectRatio: "16:9" | "1:1" | "9:16";
  qualityPreset: "standard" | "high";   // always "high" for thumbnails
  retryAttempt: number;          // 0 = first attempt
}

interface FluxGenerationResult {
  success:     boolean;
  s3Path?:     string;
  failReason?: string;           // Vera failure reason on retry path
  latencyMs:   number;
  attempt:     number;
}
```

### Inference Settings — Quality First

```python
QUALITY_PRESETS = {
    "standard": {
        "num_inference_steps": 28,    # distilled 4B works well at 28
        "guidance_scale":      3.5,
        "height":              1024,
        "width":               1024,
    },
    "high": {
        "num_inference_steps": 40,    # more steps = better quality, worth the extra ~2 sec
        "guidance_scale":      4.0,
        "height":              1024,
        "width":               1024,
    }
}
# Quality note: we are optimising for Vera pass rate, not speed.
# A thumbnail at 40 steps that passes first time beats 28 steps + 2 retries.
```

### Prompt Construction — Quality-First

Qeon translates Muse's visualNote into a FLUX-optimised prompt.
The prompt structure is specific — FLUX.2 klein responds to clear subject
specification, style anchors, and technical quality terms.

```typescript
async function buildFluxPrompt(beat: MuseBeat, imageType: string): Promise<{
  prompt: string;
  negativePrompt: string;
}> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",  // Sonnet for richer prompt creativity
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are writing a prompt for FLUX.2 [klein], a text-to-image model.
                  Image type: ${imageType}
                  Visual note from creative director: "${beat.visualNote}"
                  Topic: "${beat.topicContext}"
                  Channel niche: "${beat.niche}"

                  Write a FLUX prompt following this structure:
                  [main subject, precise description] [action or state] [environment or background]
                  [lighting quality] [style anchors] [technical quality terms]

                  Rules:
                  - Max 60 words
                  - No people or faces (unless imageType is THUMBNAIL_SRC with avatar)
                  - For SECTION_CARD: include clean text placement space, bold typography hint
                  - For THUMBNAIL_SRC: cinematic, high contrast, thumbnail-optimised composition
                  - For CONCEPT_IMAGE: editorial illustration quality, informative
                  - Style: photorealistic OR illustrated — match the channel's established aesthetic

                  Also write a negative prompt (max 25 words) to avoid: blur, watermarks,
                  low quality, distorted text, duplicate elements, oversaturated colours.

                  Return JSON only:
                  { "prompt": "...", "negativePrompt": "..." }`
      }]
    })
  });

  const data = await response.json();
  const result = JSON.parse(data.content[0].text);
  return result;
}
```

### Full Retry Logic — Quality Gate

This is the core quality loop. Vera inspects every FLUX output.
If it fails, Qeon analyses the failure reason, refines the prompt,
and retries with adjusted settings. Maximum 3 attempts before fallback.

```typescript
const FLUX_MAX_RETRIES  = 3;
const FLUX_RETRY_DELAYS = [0, 3000, 5000]; // ms between attempts (0 = immediate first try)

async function runFluxGeneration(
  jobId: string,
  beats: MuseBeat[]
): Promise<void> {

  // Process beats concurrently — FLUX server handles semaphore internally
  const generationPromises = beats.map(beat =>
    generateWithRetry(jobId, beat)
  );

  const results = await Promise.allSettled(generationPromises);

  // Collect any beats that exhausted all retries
  const hardFailures = results
    .map((r, i) => ({ result: r, beat: beats[i] }))
    .filter(({ result }) => result.status === "rejected");

  if (hardFailures.length > 0) {
    // Log which beats failed — Vera QA will catch visually
    // Fallback: solid-colour card with text overlay for section cards
    await generateTextFallbackCards(jobId, hardFailures.map(f => f.beat));
    logger.warn(`[flux] ${hardFailures.length} beats fell back to text cards`, { jobId });
  }
}

async function generateWithRetry(
  jobId: string,
  beat: MuseBeat
): Promise<FluxGenerationResult> {

  let lastFailReason: string | null = null;
  let currentPrompt = await buildFluxPrompt(beat, beat.visualType);

  for (let attempt = 0; attempt < FLUX_MAX_RETRIES; attempt++) {

    // Delay between retries (not on first attempt)
    if (attempt > 0 && FLUX_RETRY_DELAYS[attempt] > 0) {
      await sleep(FLUX_RETRY_DELAYS[attempt]);
    }

    logger.info(`[flux] attempt ${attempt + 1}/${FLUX_MAX_RETRIES}`, {
      jobId,
      beatId: beat.id,
      visualType: beat.visualType,
      prompt: currentPrompt.prompt.slice(0, 80)
    });

    // Call FLUX inference server with timeout
    const result = await callFluxServerWithTimeout(jobId, beat, currentPrompt, attempt);

    if (!result.success) {
      // Infrastructure failure (timeout, OOM, server error)
      lastFailReason = result.failReason ?? "unknown infrastructure error";
      logger.warn(`[flux] inference failed on attempt ${attempt + 1}`, {
        beatId: beat.id,
        reason: lastFailReason
      });

      // If OOM — reduce inference steps for next attempt
      if (lastFailReason.includes("OOM") || lastFailReason.includes("CUDA out of memory")) {
        currentPrompt = await buildFluxPrompt(beat, beat.visualType); // fresh prompt
        // signal reduced quality on next attempt
        beat.qualityPreset = "standard"; // downgrade if high was set
      }
      continue; // next attempt
    }

    // Image generated — run Vera Visual QA inline
    const veraResult = await veraVisualQA(result.s3Path!, beat.imageType, beat.id);

    if (veraResult.passed) {
      // SUCCESS — store result and move on
      await saveFluxResult(jobId, beat.id, result.s3Path!);
      logger.info(`[flux] PASSED Vera QA on attempt ${attempt + 1}`, { beatId: beat.id });
      return result;
    }

    // Vera failed — refine prompt using Vera's specific failure reason
    lastFailReason = veraResult.failReason;
    logger.warn(`[flux] Vera QA FAILED on attempt ${attempt + 1}`, {
      beatId: beat.id,
      veraReason: lastFailReason
    });

    if (attempt < FLUX_MAX_RETRIES - 1) {
      // Refine prompt based on what Vera flagged
      currentPrompt = await refinePromptFromVeraFeedback(
        currentPrompt,
        lastFailReason!,
        beat
      );
    }
  }

  // All retries exhausted
  logger.error(`[flux] EXHAUSTED all ${FLUX_MAX_RETRIES} attempts`, {
    jobId,
    beatId: beat.id,
    lastFailReason
  });

  throw new Error(`FLUX_EXHAUSTED: ${beat.id} — ${lastFailReason}`);
}
```

### Timeout Handling

Every FLUX call is wrapped with a hard timeout. T4 inference should
complete within 45 seconds for a 1024×1024 high-quality image.
If it hangs (OOM, deadlock, network issue) — we abort and retry.

```typescript
const FLUX_INFERENCE_TIMEOUT_MS  = 60_000;  // 60 sec hard timeout per attempt
const FLUX_HEALTH_CHECK_INTERVAL = 30_000;  // 30 sec heartbeat check

async function callFluxServerWithTimeout(
  jobId: string,
  beat: MuseBeat,
  promptPair: { prompt: string; negativePrompt: string },
  attempt: number
): Promise<FluxGenerationResult> {

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.warn(`[flux] request timeout after ${FLUX_INFERENCE_TIMEOUT_MS}ms`, {
      jobId,
      beatId: beat.id,
      attempt
    });
  }, FLUX_INFERENCE_TIMEOUT_MS);

  try {
    const response = await fetch(`${FLUX_SERVER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jobId,
        beatId:        beat.id,
        prompt:        promptPair.prompt,
        negativePrompt: promptPair.negativePrompt,
        referenceImages: beat.referenceImages ?? [],
        imageType:     beat.visualType,
        aspectRatio:   beat.aspectRatio ?? "16:9",
        qualityPreset: beat.visualType === "THUMBNAIL_SRC" ? "high" : (beat.qualityPreset ?? "high"),
        retryAttempt:  attempt,
      } satisfies FluxGenerationRequest),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success:    false,
        failReason: `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
        latencyMs:  0,
        attempt,
      };
    }

    const data: FluxGenerationResult = await response.json();
    return data;

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      return {
        success:    false,
        failReason: `TIMEOUT after ${FLUX_INFERENCE_TIMEOUT_MS}ms`,
        latencyMs:  FLUX_INFERENCE_TIMEOUT_MS,
        attempt,
      };
    }

    return {
      success:    false,
      failReason: err.message ?? "unknown fetch error",
      latencyMs:  0,
      attempt,
    };
  }
}
```

### Prompt Refinement from Vera Feedback

When Vera fails a FLUX image, she returns a specific failure reason.
Qeon uses that reason to construct a refined prompt before the next attempt.
This is not generic retry — it is targeted correction.

```typescript
async function refinePromptFromVeraFeedback(
  originalPrompt: { prompt: string; negativePrompt: string },
  veraFailReason: string,
  beat: MuseBeat
): Promise<{ prompt: string; negativePrompt: string }> {

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are refining a FLUX.2 image generation prompt based on QA failure feedback.

                  Original prompt: "${originalPrompt.prompt}"
                  Original negative prompt: "${originalPrompt.negativePrompt}"
                  Vera QA failure reason: "${veraFailReason}"
                  Image type: "${beat.visualType}"
                  Visual note: "${beat.visualNote}"

                  Rules:
                  - Address SPECIFICALLY what Vera flagged — do not change unrelated elements
                  - If Vera flagged blur → add "sharp focus, crisp details" to prompt
                  - If Vera flagged cluttered → simplify subject, add "clean minimal composition"
                  - If Vera flagged wrong aspect → keep prompt but add crop guidance
                  - If Vera flagged text quality → add "perfect legible typography, clean font"
                  - If Vera flagged wrong mood → adjust lighting and style anchors only
                  - Strengthen the negative prompt to explicitly exclude what Vera rejected

                  Return JSON only:
                  { "prompt": "...", "negativePrompt": "..." }`
      }]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}
```

### Health Check + Server Recovery

The pipeline Lambda checks FLUX server health before dispatching a job.
If the server is unresponsive — it attempts to restart the EC2 instance
before proceeding, not abort.

```typescript
async function ensureFluxServerHealthy(): Promise<void> {
  const MAX_HEALTH_RETRIES   = 3;
  const HEALTH_RETRY_DELAY   = 10_000; // 10 sec between health checks
  const HEALTH_TIMEOUT_MS    = 5_000;  // 5 sec per health check call

  for (let i = 0; i < MAX_HEALTH_RETRIES; i++) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const res = await fetch(`${FLUX_SERVER_URL}/health`, {
        signal: controller.signal
      });

      if (res.ok) {
        const { status, gpu_memory_free_gb } = await res.json();
        if (status === "ok" && gpu_memory_free_gb > 2) {
          logger.info(`[flux-health] healthy — ${gpu_memory_free_gb}GB free`);
          return; // healthy, proceed
        }
      }
    } catch {
      logger.warn(`[flux-health] health check ${i + 1} failed`);
    }

    if (i < MAX_HEALTH_RETRIES - 1) {
      await sleep(HEALTH_RETRY_DELAY);
    }
  }

  // Server unresponsive — attempt EC2 restart before failing
  logger.error("[flux-health] server unresponsive — attempting EC2 reboot");
  await rebootFluxInstance();
  await sleep(60_000); // wait 60 sec for reboot + model reload

  // Final check after reboot
  const finalCheck = await fetch(`${FLUX_SERVER_URL}/health`).catch(() => null);
  if (!finalCheck?.ok) {
    throw new Error("FLUX_SERVER_UNRECOVERABLE — manual intervention required");
  }
}
```

### AMI Setup — FLUX (one-time)
```bash
# On a fresh g4dn.xlarge Ubuntu 22.04 + CUDA 12:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate fastapi uvicorn

# Download FLUX.2 klein 4B FP8 from HuggingFace
huggingface-cli download black-forest-labs/FLUX.2-klein \
  --include "flux-2-klein-4b-fp8.safetensors" \
  --local-dir /models/flux-klein-4b/

# Copy inference server
cp /app/inference_server.py /models/

# Start server on boot
echo "@reboot cd /models && uvicorn inference_server:app --host 0.0.0.0 --port 8080" | crontab -

# Save AMI — this instance runs persistently, AMI is for recovery
```

### Cost Model
```
g4dn.xlarge on-demand:    $0.526/hr
g4dn.xlarge 1yr reserved: $0.190/hr  ← right call for always-on
1yr reserved × 24hr × 30d = ~$136/month fixed

Per-image cost:            $0.00 (beyond instance fixed cost)
10 images/video:           $0.00 marginal cost
Vera retries (up to 3×):  $0.00 marginal cost
30 images/day worst case: $0.00 marginal cost

vs fal.ai at $0.03/image:
  30 images/day × 30 days = $27/month at 1-user volume
  At 100 users → $2,700/month
  Self-hosted pays off at ~5 users
```

---

### When to Supplement FLUX with Research Visuals

FLUX generates concept images and section cards. But some beats have
better legal assets than any generated image:

```typescript
function selectImageSource(beat: MuseBeat, niche: string): "FLUX" | "RESEARCH_VISUAL" {
  // Paper figures are more credible than generated concept art for AI niche
  if (niche === "AI_NEWS" && beat.hasPaperFigure) return "RESEARCH_VISUAL";
  // Official team images for motorsport editorial beats
  if (niche === "MOTORSPORT" && beat.hasOfficialPressImage) return "RESEARCH_VISUAL";
  // For thumbnails — FLUX always (brand consistency, reference image control)
  if (beat.visualType === "THUMBNAIL_SRC") return "FLUX";
  // Everything else — FLUX
  return "FLUX";
}
```

---

### When to Supplement Wan2.2 with Stock Footage

Wan2.2 generates abstract and atmospheric b-roll well. But some niches
have better legal stock options that look more authentic:

```typescript
function selectBrollSource(beat: MuseBeat, niche: string): "WAN2" | "STOCK" {
  // For AI niche — paper figures and screen recordings are more credible
  // than abstract generated footage
  if (niche === "AI_NEWS" && beat.hasPaperFigure) return "STOCK"; // use actual figure
  // For sports niches — legal stock racing footage from Pexels looks better
  // than generated racing scenes
  if (["F1", "MOTOGP"].includes(niche) && beat.stockAvailable) return "STOCK";
  // Default — Wan2.2 for everything else
  return "WAN2";
}
```

### Avatar Layout Options (user picks in Settings)

**Layout A — Corner Presenter (default)**
```
Avatar occupies bottom-right 30% of frame
B-roll fills the rest
Good for: most topics, keeps content visual
```

**Layout B — Split Screen**
```
Avatar left 40%, B-roll right 60%
Good for: reviews, comparisons, analysis topics
```

**Layout C — Full Screen Avatar**
```
Avatar fills entire frame for hook + CTA sections
B-roll used only for body sections
Good for: personal story, opinion, documentary
```

Layout selection is per-section based on `visualNote` — hook and CTA default to full screen, body sections default to corner or split.

### FFmpeg Compositing
```bash
# Layout A — corner presenter
ffmpeg -i broll.mp4 -i avatar_output.mp4 \
  -filter_complex \
  "[1:v]scale=480:270[avatar]; \
   [0:v][avatar]overlay=W-w-20:H-h-20" \
  -c:a copy composited.mp4

# Layout B — split screen
ffmpeg -i broll.mp4 -i avatar_output.mp4 \
  -filter_complex \
  "[0:v]scale=768:1080,pad=1920:1080:768:0[right]; \
   [1:v]scale=768:1080[left]; \
   [right][left]overlay=0:0" \
  -c:a copy composited.mp4
```

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

  // TIER 3 — FLUX.2 [klein] generated stills
  fluxGenerated: {
    // Section cards between topics: "artificial intelligence neural network, dark blue tones"
    // Concept illustrations: "language model token prediction, abstract data flow"
    // Thumbnail source images: cinematic, high contrast, model-face-consistent
    // NEVER: generated screenshots of interfaces (use real screen recordings)
    // NEVER: generated benchmark tables (use Chart.js from real data)
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

  // TIER 3 — FLUX.2 [klein] generated stills (section cards + concept images)
  fluxGenerated: {
    // FLUX generates section cards, transition stills, concept illustrations
    // Brand-consistent, channel-aesthetic matched
    // Apache 2.0 — fully commercial, self-hosted
    sectionCards:     string;   // "Monaco circuit layout, dramatic overhead, dark" 
    conceptImages:    string;   // "F1 tyre strategy decision, abstract data visual"
    thumbnailSrc:     string;   // thumbnail base image with avatar reference
  };

  // TIER 4 — Legal stock footage (Pexels/Pixabay search terms)
  // SUPPLEMENTARY ONLY — for generic atmosphere when FLUX or data viz don't cover it
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
  "flux_generated":         { level: "SAFE",           action: "you generated it — Apache 2.0" },
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

visual-gen:
  memory: 2048MB        # Puppeteer + Chromium needs RAM
  timeout: 300s
  layers:
    - chromium-layer
    - nodejs-deps       # chart.js, mermaid

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

image-gen (FLUX.2 [klein] 4B):
  instance_type:  g4dn.xlarge
  gpu:            1× NVIDIA T4 (16GB VRAM)
  lifecycle:      ALWAYS ON — persistent, never terminates
  pricing:        1yr reserved ~$0.190/hr → ~$136/month fixed
  ami:            pre-baked with FLUX.2 klein 4B FP8 + FastAPI server
  model:          FLUX.2-klein-4B (FP8 quantised → ~8GB VRAM)
  model_path:     s3://content-factory-assets/models/flux-klein-4b/
  licence:        Apache 2.0 — commercial use confirmed
  server_port:    8080 (FastAPI inference server, always running)
  health_check:   GET /health every 5min via CloudWatch alarm
  restart_policy: auto-reboot on health check failure (CloudWatch + Lambda)
  handles:        SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC beats
  max_retries:    3 per image (Vera QA inline)
  timeout_per_req: 60s hard abort per attempt
  upgrade_path:   swap weights to FLUX.2-klein-9B when BFL licence available

# Cost per video (estimates)
# SkyReels segments:    ~12 min @ $1.60/hr spot  = $0.32
# Wan2.2 b-roll:        ~10 min @ $0.40/hr spot  = $0.07
# FLUX images:          fixed cost (always-on)    = $0.00 marginal
# Lambda workers:       ~$0.04
# S3 + transfer:        ~$0.01
# ElevenLabs:           ~$0.00 (free tier rotation)
# Total per video:      ~$0.44 (+ $136/month fixed for FLUX instance)
#
# FLUX fixed cost amortised:
#   1 user  (2 vid/day)  = ~$136/mo fixed → $2.27/video from FLUX
#   10 users (20 vid/day) = ~$136/mo fixed → $0.23/video from FLUX
#   50 users (100 vid/day) = ~$136/mo fixed → $0.046/video from FLUX
#
# vs fal.ai API ($0.03/image × 10 img/video):
#   break-even: ~5 users — self-hosted wins from 5 users onwards
#
# All three EC2 instances run in parallel →
# production time ≈ max(SkyReels 12min, Wan2 10min, FLUX 3min) = ~12 min
```

---

## References
- See `references/ffmpeg-commands.md` for additional FFmpeg recipes
- See `references/lambda-layers.md` for FFmpeg Lambda layer setup instructions

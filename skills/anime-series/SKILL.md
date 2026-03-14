---
name: anime-series
description: >
  COMING SOON — Funded phase only. Future architecture for AI-generated anime
  series on YouTube. Character consistency across episodes requires LoRA
  fine-tuning — this is a model architecture problem, not a prompt engineering
  problem. No current open-source model solves this reliably at production
  quality without LoRA conditioning. This skill documents the full spec so it
  can be built correctly when funded. What If + Conspiracy formats ship first
  on the existing pipeline. Do not attempt to build any part of this until
  funding is explicitly authorised and all three readiness conditions (below)
  are met.
---

# Anime Series — LoRA Pipeline Spec

## Status

```
╔══════════════════════════════════════════════════════════════════════╗
║  COMING SOON — DO NOT BUILD                                          ║
║                                                                      ║
║  This phase requires explicit funding authorisation before any       ║
║  code is written, any EC2 AMI is created, or any DynamoDB table      ║
║  is provisioned.                                                     ║
║                                                                      ║
║  What If + Conspiracy formats ship first — they are fully            ║
║  executable on the current pipeline today without LoRA.             ║
║                                                                      ║
║  Anime series is the right long-term bet. It is not the right        ║
║  next step until the channel has proven its audience and has         ║
║  revenue to absorb the training compute.                             ╠
╚══════════════════════════════════════════════════════════════════════╝
```

---

## Why Anime Series Needs Its Own Phase

The hard problem in AI-generated anime series is not making one
good-looking frame. Every text-to-video model alive today can produce
a compelling single clip given the right prompt. The hard problem is
character consistency across episodes — the same face, the same colour
palette, the same proportions — frame after frame, episode after episode,
across weeks of production.

Current open-source models fail this test without intervention. Wan2.2
alone produces a new character every generation. Different nose. Different
jaw. Different hair saturation. This is not a prompting problem. Prompt
engineering cannot constrain a diffusion model to a specific face
consistently. It is a model architecture problem. The solution is LoRA
fine-tuning.

A LoRA (Low-Rank Adaptation) is a lightweight fine-tuned adapter trained
on a specific character's visual identity. Once trained, it conditions
every subsequent generation toward that character's face, palette, and
proportions. This is how professional AI animation studios produce
consistency. It is also the only approach that works reliably at scale.

This adds a one-time training cost per character (~$3–5 on a g5.2xlarge
spot instance, 30–60 min per character) and a storage cost for the LoRA
weights in S3. After that, each episode generates at Wan2.2 inference
cost, which is already in the pipeline.

---

## What This Unlocks

```
Serialised content         Each episode ends on a narrative hook.
                           Viewers subscribe to find out what happens next.
                           The algorithm rewards high return-viewer rate.

Character investment       Viewers name characters in comments. They argue
                           about who is right. They write fan theories.
                           Comment volume drives distribution.

Arc-driven retention       Mid-video retention is higher when there is
                           continuity to protect — viewers who are invested
                           in a character watch to the end.

Series playlists           Every new episode feeds subscribers back through
                           the full back catalogue. Watch time compounds.

Format differentiation     No other fully autonomous AI content system is
                           running a consistent anime series at this quality.
                           First mover advantage is significant.
```

---

## LoRA Training Pipeline

### Phase 1 — Character Design

Before LoRA training can begin, a character reference sheet must exist.
The reference sheet is the single source of truth for the character's
visual identity. It is generated once, approved by the user, and locked.
No training without user approval.

```
Character sheet contains:
  Front view (neutral expression)
  3/4 view (slight angle, same expression)
  Side profile
  Close-up face (neutral)
  Expression sheet: happy, determined, shocked, sad, angry
  Full body (action pose — establishes proportions)

Total: 5–10 reference images per character
```

MUSE generates the character brief (personality, visual direction, role in
series). TONY renders the character sheet as a structured Remotion composition
using MUSE's brief as input. The user reviews and approves in Mission Control
before LoRA training fires.

IP-Adapter conditioning can be used for approximately 85–90% consistency on
close-up shots during the period before a full LoRA is trained — useful for
a pilot episode to test the format without full training cost. IP-Adapter
is not a substitute for LoRA at series scale.

```
Character reference images stored at:
s3://content-factory-assets/avatars/anime/{channelId}/{characterId}/sheet/
  front.jpg
  three_quarter.jpg
  profile.jpg
  closeup.jpg
  expressions.jpg
  full_body.jpg
```

### Phase 2 — LoRA Training

```
Instance:    g5.2xlarge spot — same spot pricing as Wan2.2 b-roll
             Different AMI — LoRA training AMI with PEFT + diffusers
             Launches on demand, self-terminates on completion
             Not always-on. One training job per character per channel.

Input:       5–10 reference images from character sheet (Phase 1)
             Images cover: front face, 3/4 angle, close-up, full body
             All images consistent lighting, consistent art style

Framework:   kohya_ss or equivalent SDXL LoRA training framework
             PEFT + diffusers on the base model

Duration:    30–60 minutes per character
             Training job writes weights to S3 on completion

Cost:        ~$3–5 per character (spot pricing, 30–60 min at ~$0.40/hr × 4 GPU)
             One-time cost. Weights reused every episode forever.

Output:      LoRA weights (.safetensors) written to:
             s3://content-factory-assets/models/lora/{channelId}/{characterId}/
               weights.safetensors
               config.json       { triggerWord, baseModel, rank, steps }
             Character config written to DynamoDB anime-characters table
             DynamoDB trainingStatus updated to TRAINING_COMPLETE
```

### Phase 3 — LoRA Inference

```
Wan2.2 instance loads LoRA weights at job start before generation begins.
LoRA weights are applied via PEFT adapter injection into Wan2.2 UNet.
All subsequent frames for that character are conditioned on the LoRA.

Consistency expectation:
  Close-up shots (face dominant)     ~90–95% consistent
  Mid-shots (head + shoulders)       ~85–90% consistent
  Wide shots (full body, distance)   ~70–80% consistent

Wide shots where character is small: standard Wan2.2 without LoRA is
sufficient. LoRA overhead is only justified for close-up dialogue and
emotional reaction shots.
```

---

## Series State Machine

Regum owns the series state. Each series is a long-running object in
DynamoDB that Regum updates after every episode council and every
RRQ Retro.

```
┌────────────────────────────────────────────────────────┐
│                   SERIES LIFECYCLE                      │
│                                                         │
│   COMING_SOON → ACTIVE → ON_HOLD → ACTIVE → CONCLUDED │
│                    ↑                                    │
│                    └── new arc starts                   │
└────────────────────────────────────────────────────────┘
```

```typescript
// lib/anime-series/series-state.ts

type AnimeGenre = 'ACTION' | 'MYSTERY' | 'THRILLER' | 'SCI_FI' | 'DRAMA';
type SeriesStatus = 'COMING_SOON' | 'ACTIVE' | 'ON_HOLD' | 'CONCLUDED';

interface AudienceSignal {
  signal: string;
  source: 'COMMENTS' | 'RETENTION' | 'SEARCH' | 'COMMUNITY_POLL';
  weight: number;
  capturedAt: string;
}

interface CharacterRef {
  characterId: string;
  name: string;
  role: 'PROTAGONIST' | 'ANTAGONIST' | 'SUPPORTING' | 'RECURRING';
  loraWeightsS3: string;             // s3://.../{characterId}/weights.safetensors
  ipAdapterImageS3: string;          // fallback for pre-LoRA or wide shots
  voiceId: string;                   // ElevenLabs voice ID for this character
  personalityBrief: string;          // 2–3 sentences — Muse uses this for dialogue
}

interface AnimeSeries {
  seriesId: string;
  channelId: string;
  userId: string;
  title: string;
  premise: string;
  genre: AnimeGenre;
  episodeCount: number;
  currentArc: string;
  currentEpisodeNumber: number;
  nextEpisodeBrief: string;
  characters: CharacterRef[];
  audienceSignals: AudienceSignal[];
  arcHistory: string[];              // past arcs for continuity
  openNarrativeHooks: string[];      // threads left unresolved — to be picked up
  status: SeriesStatus;
  createdAt: string;
  lastEpisodePublishedAt: string;
}
```

---

## Arc Continuation Logic

Rex, Oracle, and Regum jointly manage the signal loop that decides where
the story goes next. This is not random — it is data-driven narrative
continuation.

```
Rex monitors (per episode, 24hr + 7-day windows):
  Comment sentiment and "what happens next?" volume and phrasing
  Search volume for series title and character names
  Viewer retention at episode end (do they go to next episode?)
  Community post engagement on related threads

Oracle arc decision types:
  CONTINUE_ARC         Current arc is working — extend it
  PIVOT_STORY          Audience signal indicates a narrative pivot is needed
  INTRODUCE_CHARACTER  Comment demand or retention data suggests cast expansion
  SPIN_OFF             Character interest high enough to warrant a dedicated series
  CONCLUDE             Arc has naturally closed — wrap it, tease next

Regum executes:
  Updates nextEpisodeBrief in DynamoDB
  Writes arc history entry
  Commissions next episode via Qeon
  Broadcasts narrative decision in Mission Control Comms
```

```typescript
// lib/anime-series/arc-continuation.ts

type ArcDecision =
  | 'CONTINUE_ARC'
  | 'PIVOT_STORY'
  | 'INTRODUCE_CHARACTER'
  | 'SPIN_OFF'
  | 'CONCLUDE';

interface ArcContinuationResult {
  decision: ArcDecision;
  rationale: string;                 // Oracle's plain-English explanation
  nextEpisodeBrief: string;          // updated brief for Regum → Qeon
  newCharacterBrief?: string;        // only present if decision = INTRODUCE_CHARACTER
  spinOffPremise?: string;           // only present if decision = SPIN_OFF
}
```

---

## Character Consistency Mechanism

Two conditioning methods are used at different shot types:

```
LoRA (primary — close-up + mid shots)
  Applied via PEFT adapter injection into Wan2.2 UNet
  Consistency: ~90% on face-dominant frames
  Loaded once at Wan2.2 job start — shared across all shots in that episode
  Trigger word in prompt activates character identity conditioning

IP-Adapter (secondary — wide shots + pre-LoRA period)
  Uses a single reference image (character sheet close-up)
  Consistency: ~85–90% on face-dominant frames (lower than LoRA)
  Acceptable for wide shots where character face is small in frame
  No training required — useful for pilot episodes before LoRA is trained

Hybrid approach per shot:
  Close-up / dialogue   LoRA + IP-Adapter combined (~95% consistency)
  Mid-shot              LoRA alone (~88%)
  Wide / establishing   IP-Adapter alone or neither (~80%)
  Background character  Standard Wan2.2 — no conditioning required
```

---

## Episode Production Flow

Episode production uses the existing 13-step pipeline with these
anime-specific modifications. The standard pipeline is not replaced —
it is extended.

```
Step 1   Research       Oracle queries series history + audience signals
                        Rex checks trending narrative angles in genre
                        Result: episode brief grounded in continuity

Step 2   Script         Muse writes episode script with:
                          - Consistent character voices (CharacterRef personalityBrief)
                          - Opening recap of previous episode (15 sec)
                          - Episode hook at 0:30
                          - Cliffhanger or narrative hook in final 20 sec

Steps 3–4  Same as standard pipeline

Step 5   Audio          Per-character voice mapping to ElevenLabs voice IDs
                        from CharacterRef — not generic voice selection

Step 6   Avatar         SkyReels for talking head shots where character
                        faces camera directly — reference from character sheet
                        (Note: this is the one case SkyReels is used in a
                        faceless-adjacent mode — character sheet image as reference)

Step 7   B-Roll         Wan2.2 + LoRA weights for all anime-style generation
                        Character action scenes, establishing shots, transitions

Step 8   Images         TONY for title cards, recap frames, episode title reveal

Steps 9–13  Same as standard pipeline
```

---

## DynamoDB Tables (Future — Do Not Create Yet)

Three new tables are required. None of these exist today. Do not create
them until the anime series build is explicitly authorised.

```
anime-characters
  PK:  characterId
  GSI: channelId, seriesId
  fields:
    characterId, channelId, seriesId
    name
    role                   PROTAGONIST | ANTAGONIST | SUPPORTING | RECURRING
    characterSheetS3       path prefix to reference sheet images
    loraWeightsS3          s3 path to trained .safetensors weights (null until trained)
    ipAdapterImageS3       s3 path to IP-Adapter reference image (fallback)
    voiceId                ElevenLabs voice ID assigned to this character
    personalityBrief       2–3 sentences — Muse dialogue reference
    trainingStatus         PENDING | TRAINING | COMPLETE | FAILED
    trainingJobId          EC2 spot instance ID for the training run
    trainingCompletedAt    ISO timestamp
    seedImages[]           s3 paths of reference images used for training
    createdAt

series-registry
  PK:  seriesId
  GSI: channelId, userId, status, genre
  fields:
    seriesId, channelId, userId
    title, premise, genre
    episodeCount, currentEpisodeNumber, currentArc
    nextEpisodeBrief
    characters[]           CharacterRef objects
    audienceSignals[]
    arcHistory[]
    openNarrativeHooks[]
    status                 COMING_SOON | ACTIVE | ON_HOLD | CONCLUDED
    createdAt, lastEpisodePublishedAt

episode-registry
  PK:  episodeId
  GSI: seriesId, channelId, episodeNumber
  fields:
    episodeId, seriesId, channelId
    episodeNumber, arcName
    title, brief, scriptId
    openingRecapText       15-sec recap of previous episode
    cliffhanger            closing hook text
    charactersAppearing[]  characterId refs
    productionJobId        linked to production-jobs table
    councilId              council-sessions record
    publishedAt
    videoId                YouTube video ID post-upload
    retro                  RRQ Retro outcome for this episode
```

---

## EC2 Requirement (Future — New AMI Needed)

LoRA training requires a separate AMI from the Wan2.2 b-roll AMI.
They are both g5.2xlarge instances — same spot pricing, different images.

```
Training AMI (new — not yet created):
  g5.2xlarge spot
  CUDA 12 + PyTorch 2.x
  diffusers (latest) + PEFT
  kohya_ss or equivalent LoRA training framework
  Mounts S3 model weights on startup
  Polls DynamoDB for TRAINING_PENDING job
  Writes LoRA weights to S3 on completion
  Updates DynamoDB trainingStatus to TRAINING_COMPLETE
  Self-terminates

Inference (existing Wan2.2 AMI, modified):
  Add PEFT to existing Wan2.2 AMI dependencies
  Accept optional loraWeightsS3 parameter in job payload
  Load LoRA adapter before generation begins
  Fall back to standard Wan2.2 if loraWeightsS3 is null
```

---

## Cost Model

```
Per-character training (one-time)
  g5.2xlarge spot × ~1 hr                ~$0.40–0.50
  S3 storage for weights (~1–2 GB)       ~$0.02/month
  Total per character                    ~$0.50 one-time + $0.02/month

Per-episode (recurring)
  Wan2.2 inference + LoRA loading        ~$0.08–0.10 (vs $0.07 without LoRA)
  LoRA load time overhead                +5–10 min on Wan2.2 job
  Additional cost per episode            ~$0.01–0.03 (negligible)

Series startup cost (5-character cast)
  5 characters × ~$0.50                  ~$2.50 one-time
  Character sheet TONY generation        ~$0.05
  Total series initialisation            ~$2.55

Series break-even vs standard format    Within first 2–3 episodes
(Anime series commands higher CPM in storytelling-adjacent niches)
```

---

## When to Build

Three conditions must all be true before starting this phase:

```
Condition 1    Channel has published at least 20 videos on the existing
               pipeline (What If, Conspiracy, or other standard formats).

Condition 2    Channel has demonstrated audience retention > 45% average
               across the last 10 videos — evidence the audience exists
               before investing in serialised content.

Condition 3    User is on Creator ($49) or Agency ($149) plan — revenue
               covers the LoRA training compute without eroding margin.
               Free and Starter plan users do not have access to this feature.
```

When all three are met — read this skill file completely, then start the
build sequence in this order:

```
1. Character sheet tooling (TONY + Muse character brief)
2. LoRA training pipeline (new EC2 AMI + DynamoDB tables)
3. Episode state machine (episode-registry + arc continuation)
4. Series bible UI in Mission Control (series dashboard + character approval gate)
5. Wan2.2 AMI modification (PEFT + LoRA loading)
6. End-to-end test: character brief → sheet → LoRA train → episode 1 production
```

---

## Why Not Now — Detailed Reasoning

```
1. Build time    LoRA training pipeline is a 2–3 week dedicated build.
                 It requires a new EC2 AMI, three new DynamoDB tables,
                 a new training job orchestrator, character sheet generation
                 tooling, and Mission Control UI for character approval.
                 This is not an afternoon addition to the existing pipeline.

2. Sequence      Character design must precede training. Training must
                 precede production. Production requires a full series
                 bible before episode 1. The prerequisites chain is long
                 and strictly sequential — no parallelisation possible.

3. Revenue gate  Each character costs ~$3–5 to train. A 5-character cast
                 costs $15–25 before a single frame of episode 1 is
                 generated. This is justified only when the channel has
                 proven it can monetise content and the user is on Creator
                 or Agency plan.

4. Format proof  What If + Conspiracy formats are unproven on this channel.
                 The correct sequence: prove the audience exists with simpler
                 formats, then invest in the complex serialised format.
                 Building the LoRA pipeline before the audience is proven
                 is backwards.
```

---

## Build Checklist

All items are NOT STARTED. Do not begin until funding is authorised.

```
[ ] DO NOT START — confirm all three readiness conditions are met first

Character Design Phase
[ ] Read muse/SKILL.md — character brief generation is a MUSE function
[ ] Read tony/SKILL.md — character sheet is a TONY Remotion output
[ ] Create lib/anime-series/character-brief.ts   — Muse character brief type + generator
[ ] Create lib/anime-series/character-sheet.ts   — TONY task builder for sheet generation
[ ] Add character approval gate to Mission Control (human-in-loop, not optional)
[ ] Store approved character sheets at s3://content-factory-assets/avatars/anime/...

LoRA Training Pipeline
[ ] Create LoRA training EC2 AMI (g5.2xlarge + PEFT + kohya_ss)
[ ] Create lib/anime-series/training-orchestrator.ts   — launch training job + poll status
[ ] Create lambdas/lora-trainer/ handler — triggers EC2, polls DynamoDB, handles completion
[ ] Add anime-characters DynamoDB table
[ ] Update Wan2.2 AMI: add PEFT dependency + loraWeightsS3 parameter support

Series State Machine
[ ] Create lib/anime-series/series-state.ts    — AnimeSeries type + lifecycle management
[ ] Create lib/anime-series/arc-continuation.ts — Rex + Oracle signal loop + ArcDecision
[ ] Add series-registry DynamoDB table
[ ] Add episode-registry DynamoDB table
[ ] Wire arc continuation to RRQ Retro cycle (Day 7 retro triggers Oracle arc evaluation)

Episode Production
[ ] Update Qeon pipeline: series episode mode detection
[ ] Update Muse: episode script format (recap + hook + cliffhanger)
[ ] Update audio-gen: per-character voice ID mapping from CharacterRef
[ ] Update Wan2.2 instance launch: pass loraWeightsS3 in job payload
[ ] Wire SkyReels I2V for talking head shots (character sheet reference image)

Mission Control UI
[ ] Create /app/anime/ — series dashboard
[ ] Character approval review screen (sheet images + approve/reject)
[ ] Series timeline view (episode list + arc history)
[ ] Audience signal panel (Rex comment signals per episode)

End-to-End Testing
[ ] Test: character brief → TONY sheet generation → user approval gate
[ ] Test: approved sheet → LoRA training job → weights written to S3
[ ] Test: Wan2.2 + LoRA weights → character consistency across 3 clips
[ ] Test: episode 1 production end-to-end (all 13 steps)
[ ] Test: arc continuation — Oracle CONTINUE_ARC decision → episode 2 brief
[ ] Test: INTRODUCE_CHARACTER decision → new character sheet flow triggered
[ ] Verify IP-Adapter fallback on wide shots (LoRA not loaded for wide shots)
[ ] Verify character approval gate blocks LoRA training until approval recorded
[ ] Verify Creator/Agency plan gate — Free/Starter users see "Upgrade required"
```

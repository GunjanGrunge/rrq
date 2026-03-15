# Rex Regum Qeon (RRQ) — Claude Code Project Guide

> "The fastest way to start, grow, and run your channel."
> "Your AI Content Manager. Research, script, produce, upload — you stay in control of what matters."

---

## Current Build State — Read This First

```
Phase 1:   COMPLETE  — Frontend foundation (Next.js 14, Clerk v7, Mission Control UI)
Phase 2:   COMPLETE  — API routes (research, script, SEO, quality gate — all Bedrock)
Phase 3:   COMPLETE  — Lambda workers (audio-gen, research-visual, visual-gen,
                        av-sync, shorts-gen, uploader) + lambda-types + lambda-client
Phase 3.5: COMPLETE  — TONY + Remotion visual layer + Oracle domains 8 & 9 (see below)
Phase 4+:  NOT STARTED
```

### Phase 3.5 Checklist
```
[x] A — Schema & Types (animated-infographic, geo-map, CodeAgentInput/Output)
[x] B — packages/remotion-compositions/ (10 compositions + theme + Root)
[x] C — visual-gen Lambda upgrade (Remotion primary, Puppeteer fallback, always MP4)
[x] D — lambdas/code-agent/ TONY Lambda (handler, sandbox, allowlist)
[x] E — Inngest workflow: invokeCodeAgent wired (forward-compatible, activates Phase 9)
[x] F — skills/oracle/SKILL.md: domains 8 (SECURITY_DEPENDENCY_AUDIT) + 9 (PACKAGE_DISCOVERY)
[x] G — Security tooling (.github/dependabot.yml, .eslintrc.lambdas.js, audit scripts)
[x] H — CLAUDE.md updated (this section)
```

### Key Decisions — Do Not Re-Litigate
```
- visual-gen: ALL beats render as animated MP4 (quality > speed, FLUX EC2 eliminated — TONY Lambda handles all stills/infographics)
- TONY sandbox: child_process.fork() + fetch allowlist + 30s SIGKILL
- TONY code gen: Bedrock Haiku (never raw user input)
- MUSE → TONY: execution arm for custom visuals + data prep (dotted line, not replacement)
- Oracle domain 8 = CVE security monitoring (report-only, never auto-patches)
- Oracle domain 9 = package discovery for TONY toolbox (NEXT_CYCLE priority)
- Avatar (SkyReels) + B-roll (Wan2.2): still needed for Phase 4a/4b — unchanged
- Remotion version pinned: 4.0.435 (React 19 confirmed)
```

### Agent Roster (for org chart)
```
Zeus, Rex, Regum, Qeon, ARIA, SNIPER, MUSE, ORACLE, THEO, JASON, VERA, THE LINE,
TONY (Phase 3.5 — code agent, MUSE's execution arm),
SENTINEL (Phase 4+ — infrastructure monitor, Autopilot Mode only)

Universal Escalation Protocol — Zeus-owned, all agents reference
  Max attempts per gate → isStuck() detection → Zeus evaluates → SES + in-app if unresolved
  Autopilot Mode adds: SENTINEL → SNS SMS as third channel for infra failures
  See: skills/escalation/SKILL.md

Skill Systems (not agents — infrastructure-level):
AVATAR-GEN (Phase 4d — FLUX.1 [dev] portrait generator, onboarding + roster expansion only)
SENTINEL (Phase 4+ — SignOz observability, Haiku retry, SNS escalation, Autopilot Mode only)
```

### Token-Efficient Session Resumption
```
1. Read THIS section only (not the whole file) to understand current state
2. Check the checklist above for what's done
3. Read ONLY the skill file for the feature you're building
4. TONY skill: skills/tony/SKILL.md | Oracle: skills/oracle/SKILL.md (domains 8+9 at bottom)
5. Phase 4 next: EC2 GPU instances (SkyReels 4a, Wan2.2 4b) — read video-pipeline skill
```

---

## FIRST — READ THIS BEFORE WRITING ANY CODE

Claude Code: follow this exact sequence on every session start:

```
1. Read this file completely
2. Identify which phase you are building
3. Read the relevant skill file(s) for that phase
4. Read the agent skill file if building agent functionality
5. THEN write code — never before
```

Never skip a skill file. The skill files contain decisions made after
significant trial and error. Ignoring them produces wrong code.

---

## What This Is

A one-stop shop to start, grow, and run a YouTube channel — with AI
doing the research, writing, production, and strategy.

Three product modes:

**STUDIO MODE** (was: Manual Pipeline) — user enters a topic, the 13-step
pipeline produces and uploads a YouTube video. User stays in control.

**REX MODE** (new) — Rex scans the market, surfaces ranked opportunities
to the user. User picks a topic and fires. AI executes. Best of both worlds.

**AUTOPILOT MODE** (was: GO RRQ) — four autonomous agents (Zeus, Rex, Regum,
Qeon) monitor the world, identify the best content opportunity, and run the
full pipeline. Niche-locked channels only. SENTINEL monitors infrastructure.
Faceless animated format (What If + Conspiracy). No avatars in this mode.

Instagram: coming soon. User downloads video + pre-written caption for manual
posting. Facebook Ads integration spec'd for a future phase.

---

## Skill Files — Read Before Building Each Feature

| Building | Read This Skill First |
|---|---|
| Any frontend component | `skills/frontend-design-spec/SKILL.md` |
| Auth / sign-in / user management | `skills/auth-clerk/SKILL.md` |
| Research API route | `skills/youtube-research/SKILL.md` + `skills/crawler-cloudflare/SKILL.md` |
| Script generation | `skills/youtube-script-writer/SKILL.md` |
| SEO / metadata | `skills/seo-optimizer-youtube/SKILL.md` |
| Quality gate | `skills/quality-gate/SKILL.md` |
| Audio / video / avatar | `skills/video-pipeline/SKILL.md` |
| Thumbnails | `skills/thumbnail-generator/SKILL.md` |
| YouTube upload | `skills/platform-uploader/SKILL.md` |
| Google Ads + AdSense | `skills/ads-manager/SKILL.md` |
| Mission Protocol (ALL agents) | `skills/agents/mission-protocol/SKILL.md` |
| ARIA agent | `skills/aria/SKILL.md` |
| SNIPER (geo-linguistic) | `skills/sniper/SKILL.md` |
| MUSE (video architect) | `skills/muse/SKILL.md` |
| ORACLE (L&D, self-updating RAG, format discovery) | `skills/oracle/SKILL.md` |
| THEO (channel manager) | `skills/theo/SKILL.md` |
| THE LINE (synthesis layer → Zeus) | `skills/the-line/SKILL.md` |
| JASON (scrum master + kanban + mission control UI) | `skills/jason/SKILL.md` |
| ONBOARDING (niche scout, channel audit, conflict detection) | `skills/onboarding/SKILL.md` |
| ON THE LINE COUNCIL (pre-production standup, deadlock protocol) | `skills/on-the-line-council/SKILL.md` |
| RRQ RETRO (7-day post-publish performance council + learning loop) | `skills/rrq-retro/SKILL.md` |
| COLD START DEEP RESEARCH (24hr pre-launch sprint, index seeding) | `skills/cold-start-deep-research/SKILL.md` |
| TONY (code agent — visuals, scrapers, reports, data) | `skills/tony/SKILL.md` |
| VERA (QA & Standards agent — audio, visual, standards gate) | `skills/vera/SKILL.md` |
| Full RRQ faceless mode (What If + Conspiracy formats) | `skills/full-rrq/SKILL.md` |
| Universal escalation protocol (agent stuck detection + SES notifications) | `skills/escalation/SKILL.md` |
| Anime series (Coming Soon spec — LoRA pipeline) | `skills/anime-series/SKILL.md` |
| Avatar presenter roster + portrait generation | `skills/avatar-gen/SKILL.md` |
| SENTINEL (infrastructure monitor — Autopilot Mode only) | `skills/sentinel/SKILL.md` |
| Rex Mode (Rex-assisted manual — topic surfacing + user GO trigger) | `skills/manual-rex-mode/SKILL.md` |
| Data Harvest (Rex + ARIA) | `skills/data-harvest/SKILL.md` — includes 6 new intent-layer sources: Google Autocomplete, YouTube Suggestions, Reddit Trending, TikTok Creative Center, Google Keyword Planner, Polymarket |
| Zeus agent | `skills/agents/zeus/SKILL.md` |
| Rex agent | `skills/agents/rex/SKILL.md` |
| Regum agent | `skills/agents/regum/SKILL.md` |
| Qeon agent | `skills/agents/qeon/SKILL.md` |
| Rex Memory Store (scoring model, dedup, niche profiles, RRQ state) | `lib/rex/memory-store.ts` inline — self-contained, no skill file needed |
| RRQ Trigger Modes (cron, queue-low, manual) | `lib/rex/rrq-trigger.ts` inline — wires to EventBridge + Inngest |

---
## Full System Architecture

```
VERCEL — Next.js 14 App Router
  /app/create/        Manual pipeline UI (13 steps)
  /app/zeus/          Zeus Command Center (GO RRQ)
  /api/pipeline/      Inngest workflow trigger endpoints
  /api/agents/        Agent webhook endpoints

INNGEST — Workflow Orchestration (runs on Vercel)
  createVideoWorkflow       13-step manual pipeline
  rexScanWorkflow           Rex trend scan (every 30 min)
  zeusCommentWorkflow       Zeus comment analysis (every 6 hrs)
  zeusAnalyticsWorkflow     Zeus analytics review (every 24 hrs)
  regumScheduleWorkflow     Regum upload scheduler

AWS LAMBDA WORKERS
  audio-gen/          ElevenLabs 4-account rotation + voice cue parser + Edge-TTS fallback
  research-visual/    Puppeteer screen recordings + paper figures + official images
  visual-gen/         Puppeteer + Chromium + Chart.js + Mermaid (8 dark-themed templates)
  av-sync/            FFmpeg stitch (avatar + b-roll + images + visuals) + subtitles
  shorts-gen/         FFmpeg convert OR fresh Short via Haiku
  uploader/           YouTube Data API v3 (main + Shorts)
  code-agent/         TONY — sandboxed JS execution (Haiku generates code, fork() runs it)
                      Renders Remotion MP4s, web scraping, data reports, custom visuals
                      Called by: MUSE (primary), REX, REGUM, ORACLE, QEON, ZEUS

AWS EC2 — TWO GPU Instances (all spot, all self-terminate)
  video-gen           g5.12xlarge spot — single instance, model-swap pattern
                      Launches per job, self-terminates when done
                      Step 1: loads + runs SkyReels V2-I2V-14B-720P (~12 min)
                      Step 2: unloads, loads Wan2.2-T2V-A14B FP8 (~10 min)
                      Total: ~22 min sequential (parallel was ~12 min — accepted tradeoff)
                      Cost: ~$0.59/video vs ~$0.39 parallel (g5.12xlarge overprovisioned for Wan2.2 but accepted)
                      Handles: TALKING_HEAD, SPLIT_SCREEN, B_ROLL, atmospheric video beats
                      Decision: user accepted +15 min wait to save one spot instance per video

  avatar-portrait-gen g4dn.xlarge spot — FLUX.1 [dev] FP8 (1× T4, 16GB VRAM)
                      Fires on channel onboarding + roster expansion only
                      Self-terminates after portrait batch completes
                      Per-batch cost: ~$0.15-0.25 (3-5 portraits)
                      Steady state: near-zero (portraits reused forever via SkyReels)

  code-agent          Lambda — TONY (Haiku + Remotion/Recharts/D3/Nivo sandbox)
                      No EC2. No always-on. Fires instantly per job.
                      Handles: SECTION_CARD, CONCEPT_IMAGE, THUMBNAIL_SRC,
                               CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY
                      Oracle Domain 9 keeps package toolbox current automatically

AWS SUPPORT SERVICES
  S3                  All media assets + episodic agent memory
  DynamoDB            State, scores, watchlist, schedule, job tracking
  Bedrock             Opus/Sonnet/Haiku LLM calls + Knowledge Base
  EventBridge         Cron triggers for agent scheduled runs
  Secrets Manager     All API keys — never hardcode credentials
  SES                 Transactional email notifications (AGENT_STUCK, JOB_FAILED, HUMAN_APPROVAL)
                      Action buttons via signed URLs — user resolves stuck jobs from email
  SNS                 SMS alerts for SENTINEL infrastructure failures (Autopilot Mode only)

OBSERVABILITY (Autopilot Mode)
  SignOz              Open source — EC2 t3.small, OTLP log ingestion, Lambda + EC2 metrics
                      Upgrade path: Datadog (endpoint swap only, no Lambda changes)
  SENTINEL            Haiku-guided retry → SNS SMS → in-app if infra failure unresolved
```

---

## Model Routing — Always AWS Bedrock, Never Direct Anthropic API

```typescript
const MODELS = {
  opus:   "anthropic.claude-opus-4-5",
  sonnet: "anthropic.claude-sonnet-4-5",
  haiku:  "anthropic.claude-haiku-4-5-20251001"
}

// Task allocation:
// ZEUS agent:           opus   — memory, scoring, comment intelligence
// REX agent:            opus   — trend judgment, confidence scoring
// REGUM agent:          sonnet — strategy, scheduling, channel mgmt
// QEON research:        opus   — deep research + structured data
// QEON script:          opus   — long-form script + visual assets
// QEON seo:             sonnet — titles, descriptions, metadata
// QEON quality gate:    haiku  — pass/fail scoring
// QEON tags/shorts:     haiku  — fast structured tasks
// TONY code gen:        haiku  — fast JS code generation, structured output
```

Always IAM role auth. Never hardcode credentials.
Always enable prompt caching on system prompts for repeated context.
Prompt caching saves ~60% on input tokens for research→script calls.

---

## The Four Agents

```
ZEUS  (Opus)
  Head of RRQ team. Never sleeps.
  → Memory management (DynamoDB + S3 + Bedrock KB)
  → Comment intelligence (filter → classify → attribute → score)
  → Agent performance scoring (points engine)
  → Video health monitoring (24hr + 72hr reviews)
  → Team coordination and conflict arbitration
  Runs: every 6hrs comments, 24hrs analytics, 72hrs video review

REX   (Opus)
  Intelligence and scouting agent.
  → Scans 6 signal sources every 30 minutes
  → Scores each topic: confidence, maturity, channel fit
  → Manages watchlist for developing stories
  → Delivers ranked opportunity list to Regum
  → Never flags until there is enough to make a credible video
  Runs: every 30 minutes via EventBridge → Inngest

REGUM (Sonnet)
  Strategy and channel management agent.
  → Evaluates Rex's greenlights, picks best angle
  → Generates complete QeonBrief for production
  → Manages playlists, series, upload schedule
  → Owns analytics strategy, feeds learnings to Zeus
  Runs: triggered by Rex greenlights in DynamoDB

QEON  (mixed models)
  Production execution agent.
  → Orchestrates the full 13-step pipeline
  → Enforces quality gate — never skips it
  → Reports every step to Zeus
  → Handles retries and error recovery
  Runs: triggered by Regum's QeonBrief in DynamoDB
```

### Agent Communication Flow

```
EventBridge (30 min) → Inngest rexScanWorkflow
  → Rex scans, scores, ranks
  → Writes greenlights to DynamoDB rex-watchlist

DynamoDB stream → Inngest regumWorkflow
  → Regum evaluates, picks angle, sets schedule
  → Writes QeonBrief to DynamoDB production-jobs

DynamoDB stream → Inngest qeonWorkflow
  → Qeon runs 13 steps
  → Publishes to YouTube
  → Reports outcomes to Zeus

Zeus monitors all tables via streams and scheduled runs
Zeus injects memory into every agent before they start
```

---

## Memory Stack (All AWS)

```
DynamoDB — Working Memory (real-time, milliseconds)
  agent-scores        Points, trends, wins, errors per agent
  channel-health      Daily YouTube analytics snapshots
  video-memory        Per-video performance + lessons written flag
  rex-watchlist       Monitored topics + confidence score history
  regum-schedule      Upload calendar with time slots
  production-jobs     Qeon 13-step job state machine
  pipeline-state      Manual pipeline user sessions
  elevenlabs-usage    Per-account char usage tracking
  user-tokens         YouTube OAuth tokens — PK = Clerk userId
  user-settings       Quality threshold, voice prefs — PK = Clerk userId
  ad-insights         Zeus daily ad review — partition key: date
  ad-campaigns        One record per campaign — videoId, budget, status, performance
  agent-messages      Inter-agent message bus — Zeus routes all messages
  channel-milestones  Tracks milestone hits — subs/hours thresholds
  aria-portfolio      ARIA weekly portfolio state + drift tracking
  evidence-log        Every ARIA decision with signal snapshot + outcome
  signal-cache        Rex harvested signals — 30min TTL
  topic-queue         Held topics awaiting re-evaluation
  source_weights      Rex signal scoring — per source avg confidence × clip performance
  topic_history       Rex dedup store — 72h cooldown TTL, prevents re-generating same topic
  niche_profiles      Per channel: seed keywords, subreddit list, TikTok hashtags, embedding key
  rrq_state           RRQ trigger mode, last run time, queue depth, source rotation index
  channel-settings    channelMode (OPEN/NICHE_LOCKED/MULTI_NICHE) + niche theme mappings
  geo-strategies      SNIPER analysis per topic — market plans + ad plans
  market-performance  Zeus weekly per-market campaign results
  oracle-updates      ORACLE research run results + agent injection tracking
  oracle-knowledge-index  per-domain last updated + S3 + Bedrock sync status
  zeus-briefs             THE LINE morning briefs + Zeus responses
  the-line-log            per-run message routing audit
  theo-comment-actions    per-video comment triage
  theo-ab-tests           title/thumbnail A/B test lifecycle
  theo-community-posts    community post history
  theo-weekly-reports     Theo Sunday synthesis reports
  jason-sprints           sprint plans per phase
  jason-tasks             kanban task tracking
  jason-standups          daily standup records
  jason-reviews           sprint review outcomes
  jason-retros            retrospective action items
  user-suggestions        client suggestions + verdicts
  agent-status            real-time agent status for UI
  council-sessions        On The Line council records + RRQ retro completion
  cold-start-sprints      cold start deep research sprint records
  the-line-council-index  Bedrock Knowledge Base namespace (owned by The Line)
  channel-audit           onboarding channel identity audit results
  avatar-profiles         Presenter roster — seed, config, performance scores, evolution history
  notifications       User notification inbox — agent stuck, job failed, approval required
  channel-confidence  Niche+mode confidence score cache (Haiku eval, 24h TTL)
  series-registry     What If + Conspiracy arc state machine (Full RRQ faceless mode)
  rex-topic-queue     Rex-surfaced topics awaiting user GO — Rex Mode only (48h TTL)
  sprint-evaluations  Pre-production sprint council scores per job (Full RRQ only)
  sentinel-alerts     SENTINEL infrastructure alerts + resolution log (Autopilot Mode only)

Note: user identity, email, and plan tier stored on Clerk publicMetadata.
All DynamoDB user tables use Clerk userId as partition key.

S3: s3://rrq-memory/ — Episodic Memory
  episodes/{agent}/{year}/{month}/{episodeId}.json
  Every significant decision + outcome + lesson stored here
  Written by Zeus only

Bedrock Knowledge Base — Semantic Memory
  Indexes S3 episodes automatically via Amazon Titan Embeddings v2
  Agents query in natural language before every major decision
  Returns top-5 semantically relevant past lessons
  Zeus triggers re-sync after writing new episodes
```

---

## Full 13-Step Production Pipeline

```
Step 1   Research       Rex + Sniper — web search + niche stack + structured data
Step 2   Script         Muse (Opus) — script + MuseBlueprint + voice cues + perspective
Step 3   SEO            Regum + Haiku — titles, descriptions, tags + Shorts metadata
Step 4   Quality Gate   Vera + Haiku — 7 dimensions scored (incl. Uniqueness), max 2 attempts
                                       GATE: no audio/video until this passes
         Council        On The Line — agent sign-off chain before production
                                       Rex → Zara → Aria → Qeon → Muse → Regum → Zeus
Step 5   Audio          ElevenLabs (4 accounts rotating) + Edge-TTS fallback
                        Voice cue markers (RISE/PEAK/DROP/WARM/QUESTION/PIVOT) processed
Step 6   Avatar         EC2 g5.12xlarge — SkyReels V2-I2V-14B-720P (spot, per job)
                        Static reference image + audio → talking head MP4 segments
Step 7   B-Roll         EC2 g5.2xlarge — Wan2.2-T2V-A14B (spot, per job)
                        Text prompts → atmospheric video b-roll segments
Step 8   Images         TONY Lambda (code-agent) — Haiku generates Remotion/Recharts/D3 code
                        Section cards + concept images + thumbnail source → PNG/MP4
                        Max 3 retries — Haiku regenerates code on failure, Vera QA inline
Step 9   Visuals        Puppeteer Lambda — Chart.js / Mermaid / HTML data viz → PNG/MP4
Step 10  AV Sync        FFmpeg Lambda — stitch all segments + audio + subtitles → MP4
Step 11  Vera QA        Final pass — Audio QA + Visual QA + Standards QA
                        CLEARED → Theo. FAILED → back to Qeon with precise failure report
Step 12  Shorts         FFmpeg convert OR fresh Haiku script + Edge-TTS
Step 13  Upload         Oracle Domain 11 — AI detection resistance audit (pre-upload gate)
                            5-signal check: visual uniqueness, audio cadence, metadata patterns,
                            script templates, upload timing
                            CLEAR → proceed | WARNING → patch + re-check | HOLD → escalate
                        YouTube main video + Short (Shorts 2-3hrs before main)
                        Theo handles comments + community post
```

Steps 6, 7, 8 fire in parallel via Promise.allSettled().
Production time ≈ max(SkyReels ~12min, Wan2.2 ~10min, TONY Lambda ~1min) = ~12 min.

Autopilot Mode (Full RRQ): SENTINEL monitors all steps in real time.
  Faceless mode: Steps 6 (SkyReels) skipped entirely. TONY + Wan2.2 handle all visuals.
  Pre-production sprint council fires before Step 5 — no EC2 launched until sprint clears.

Studio Mode: user-triggered, no SENTINEL, standard escalation on failure.
Rex Mode: user selects topic from Rex queue, then same pipeline as Studio Mode.

visualType per beat (Muse's MuseBlueprint):
```
TALKING_HEAD      → SkyReels V2 (EC2 g5.12xlarge — single instance, model-swap)
SPLIT_SCREEN      → SkyReels V2 (EC2 g5.12xlarge — single instance, model-swap)
B_ROLL            → Wan2.2 (EC2 g5.12xlarge — same instance after SkyReels unloads)
SECTION_CARD      → TONY Lambda (Remotion/Recharts/D3)
CONCEPT_IMAGE     → TONY Lambda (Remotion/Recharts/D3)
THUMBNAIL_SRC     → TONY Lambda (Remotion/Recharts/D3)
CHART             → Lambda visual-gen (Chart.js)
DIAGRAM           → Lambda visual-gen (Mermaid)
SLIDE             → Lambda visual-gen (HTML)
GRAPHIC_OVERLAY   → Lambda visual-gen
IMAGE             → research-visual Lambda (paper figures / official press)
SCREEN_RECORD     → research-visual Lambda (Puppeteer screen capture)
```

---

## Build Order — Follow Exactly

### Phase 1 — Frontend Foundation
```
[ ] Read frontend-design-spec skill completely first
[ ] Read auth-clerk skill completely first
[ ] Next.js 14 App Router setup
[ ] Tailwind CSS + CSS variables (design tokens)
[ ] Fonts: Syne (headings), DM Mono (labels), Lora (script body)
[ ] Colour tokens: bg #0a0a0a, surface #111111, amber #f5a623,
    success #22c55e, text #f0ece4
[ ] Install + configure Clerk (@clerk/nextjs)
[ ] ClerkProvider wrapping root layout
[ ] /sign-in and /sign-up pages (styled to Mission Control theme)
[ ] middleware.ts protecting all /create/* and /zeus/* routes
[ ] Sidebar (240px) + Header (with UserButton) + PipelineProgress (13-step) components
[ ] Zustand stores: pipeline-store.ts + agent-store.ts
[ ] Inngest client + useInngestSubscription hook
[ ] GSAP + Framer Motion + Lenis setup
```

### Phase 2 — Manual Pipeline API Routes
```
[ ] Read all pipeline skill files before building routes
[ ] POST /api/pipeline/research  → Bedrock Opus
[ ] POST /api/pipeline/script    → Bedrock Opus
[ ] POST /api/pipeline/seo       → Bedrock Sonnet + Haiku
[ ] POST /api/pipeline/quality   → Bedrock Haiku
[ ] Inngest createVideoWorkflow wiring all 13 steps
[ ] All 13 step UI components with real-time progress
```

### Phase 3 — Lambda Workers
```
[ ] audio-gen       (ElevenLabs rotation + voice cue parser + Edge-TTS fallback)
[ ] research-visual (Puppeteer screen recordings + paper figures + official images)
[ ] visual-gen      (Puppeteer + Chart.js / Mermaid / HTML — all 8 dark-themed templates)
[ ] av-sync         (FFmpeg stitch segments + audio + subtitles → final MP4)
[ ] shorts-gen      (Option A convert + Option B fresh Haiku script)
[ ] uploader        (YouTube main + Shorts + playlist + pin comment)
```

### Phase 4 — EC2 GPU Instances + TONY Lambda (4a SkyReels / 4b Wan2.2 / 4c TONY / 4d FLUX Portrait / 4e Anime Series)

#### 4a — SkyReels V2 (Avatar / Talking Head)
```
[ ] Create EC2 AMI: g5.12xlarge + CUDA 12 + SkyReels V2-I2V-14B-720P + diffusers
[ ] Generate 5 avatar portraits using Midjourney or any image tool — store in S3
    s3://content-factory-assets/avatars/{id}/reference.jpg
[ ] Spot instance launch → UserData bootstrap → poll DynamoDB → self-terminate
[ ] End-to-end test: reference.jpg + MP3 + cue_map → SkyReels → talking head MP4
[ ] ElevenLabs voice cue → SkyReels expression hint mapping validated
```

#### 4b — Wan2.2 (B-Roll / Atmosphere)
```
[ ] Create EC2 AMI: g5.2xlarge + CUDA 12 + Wan2.2-T2V-A14B (fp8 quantised)
[ ] Haiku prompt builder (visualNote → structured Wan2.2 prompt)
[ ] Spot instance launch → UserData bootstrap → poll DynamoDB → self-terminate
[ ] End-to-end test: text prompt → Wan2.2 → b-roll MP4 720p
[ ] Niche routing: AI_NEWS → paper figure preferred over generated atmosphere
```

#### 4c — TONY Code Agent (Visuals / Thumbnails / Infographics)
```
[ ] Read skills/tony/SKILL.md completely first
[ ] Deploy code-agent Lambda (lambdas/code-agent/)
[ ] Wire invokeTonyBatch() into Qeon pipeline parallel block
[ ] Create lib/video-pipeline/tony-batch.ts
[ ] Add TONY_LAMBDA_ARN to env + Vercel
[ ] Test: visualNote → buildTonyTask() → Haiku code-gen → sandbox → PNG/MP4 → S3
[ ] Test: SECTION_CARD beat end-to-end
[ ] Test: CHART beat with real data object
[ ] Test: THUMBNAIL_SRC beat → Vera QA → S3
[ ] Test: fallback path — simplified retry → text card
[ ] Verify Oracle Domain 9 package injection reaches TONY system prompt
```

#### 4d — FLUX.1 [dev] Portrait Generator (Avatar Roster)
```
[ ] Read skills/avatar-gen/SKILL.md completely first
[ ] Create EC2 AMI: g4dn.xlarge + CUDA 12 + FLUX.1 [dev] FP8 + diffusers
[ ] Muse character brief → FLUX prompt builder
[ ] Seed locking mechanism (seed stored in avatar-profiles DynamoDB)
[ ] Spot instance launch → portrait batch → S3 upload → self-terminate
[ ] Human-in-loop approval gate (optional, off by default)
[ ] Oracle Domain 10 wired (presenter performance analytics)
[ ] Regum rotation logic: no 3x repeat, performance scoring, 20% randomness
[ ] End-to-end test: channel onboarding → 4 portraits generated → roster approved → SkyReels animated
```

#### 4e — Anime Series with LoRA (COMING SOON — Funded Phase)
```
[ ] Read skills/anime-series/SKILL.md completely first
[ ] LoRA training pipeline on EC2 g5.2xlarge
[ ] Character sheet generation (TONY + IP-Adapter reference)
[ ] Series state machine in DynamoDB (series-registry, episode-registry, anime-characters)
[ ] Rex/Oracle audience signal loop for arc continuation decisions
[ ] Wan2.2 + LoRA inference integration
[ ] End-to-end test: character brief → LoRA train → consistent anime generation → episode 1
```
Status: NOT STARTED — requires funding authorization before build begins.

### Phase 5 — Memory + Agent Infrastructure
```
[ ] All DynamoDB tables (see full list in Infrastructure section below)
    Including: council-sessions, cold-start-reports (new in v3)
[ ] S3 rrq-memory bucket + IAM permissions
[ ] Bedrock Knowledge Base (the-line-council-index) pointing to rrq-memory bucket
[ ] EventBridge rules: Rex 30min, Zeus 6hr + 24hr, RRQ retro Day 2/7 checks
[ ] Inngest agent workflows: rex, zeus (×2), regum, qeon, vera, theo
[ ] Agent status table seeded: all 11 agents (Marcus/Zeus through Vera)
```

### Phase 6 — Rex Agent
```
[ ] Read skills/agents/rex/SKILL.md completely first
[ ] 6 signal source fetchers in parallel
[ ] 4-tier source quality scoring
[ ] Confidence score calculator (7 dimensions)
[ ] Watchlist CRUD with trajectory detection
[ ] Full Opus reasoning pass with Zeus memory injection
[ ] Output RexOpportunity array to DynamoDB
```

### Phase 7 — Regum Agent
```
[ ] Read skills/agents/regum/SKILL.md completely first
[ ] Greenlight evaluation with niche balance + cadence rules
[ ] QeonBrief generation with full Bedrock Sonnet call
[ ] Playlist management (YouTube API create/assign)
[ ] Series detection logic
[ ] Upload slot scheduler
[ ] Weekly analytics review with lesson extraction
```

### Phase 8 — Zeus Agent
```
[ ] Read skills/agents/zeus/SKILL.md completely first
[ ] Comment batch fetcher (YouTube API)
[ ] Opus comment classification (genuine/spam + attribution + points)
[ ] Points engine with DynamoDB atomic updates
[ ] Video health score at 24hr + 72hr
[ ] Episode writer to S3 + KB sync trigger
[ ] Weekly agent performance review
[ ] Zeus dashboard API route (/api/zeus/dashboard)
```

### Phase 9 — Qeon Agent
```
[ ] Read skills/agents/qeon/SKILL.md completely first
[ ] Brief → 13-step pipeline orchestration via Inngest
[ ] Three parallel workers: runSkyReelsInstance + runWan2Instance + invokeTonyBatch()
[ ] Promise.allSettled() — per-worker fallback, pipeline does not abort on single failure
[ ] Zeus memory injection at job start
[ ] Council trigger after Quality Gate passes (before production)
[ ] TONY retry: max 3 attempts, Haiku regenerates code on failure, Vera QA inline
[ ] Step-level error handling + retry (max 2 per step for Lambda steps)
[ ] Zeus reporting at every step transition
[ ] Job state machine in DynamoDB
```

### Phase 10 — Zeus Command Center UI
```
[ ] Read frontend-design-spec skill — Zeus section
[ ] /app/zeus/ page layout (3 column)
[ ] GO RRQ button (amber cinematic, GSAP sweep on click)
[ ] Niche selector (hover reveal below button)
[ ] Agent performance cards (score bars animate on load)
[ ] Live activity feed (Inngest real-time subscription)
[ ] Comms tab: council session render (agent verdict badges, deadlock card, APPROVED/DEFERRED)
[ ] LIVE tab: 97.5% probability display, monitoring cards (RRQ Retro Day X/7)
[ ] KANBAN: COUNCIL column with sign-off indicators + WIN/MISS retro badges on DONE cards
[ ] AGENTS tab: Vera as 11th card + COUNCIL STATUS indicator per agent
[ ] Rex watchlist panel
[ ] Comment insights panel
[ ] Memory log (last 5 Zeus lessons)
```

### Phase 11 — Cold Start Deep Research
```
[ ] Read skills/cold-start-deep-research/SKILL.md completely first
[ ] CHANNEL_MODE_SET EventBridge trigger → cold start sprint fires
[ ] 6-phase sprint: competitor audit → gap analysis → trend velocity →
    shortlist (3 candidates) → council index seeding → sprint brief
[ ] /app/cold-start/page.tsx — phase progress rows + research complete card
[ ] 3 ranked video candidates with ✦ RECOMMENDED badge on #1
[ ] Council convenes countdown timer
[ ] cold-start-reports DynamoDB table
```

### Phase 12 — Council + Vera + RRQ Retro
```
[ ] Read skills/on-the-line-council/SKILL.md completely first
[ ] Read skills/vera/SKILL.md completely first
[ ] Read skills/rrq-retro/SKILL.md completely first

Council:
[ ] Sign-off chain: Rex → Zara → Aria → Qeon → Muse → Regum → Zeus
[ ] The Line synthesis + deadlock detection
[ ] Deadlock resolution: Zeus rules domain, Jason rules process
[ ] council-sessions DynamoDB table + Bedrock the-line-council-index
[ ] Real-time Comms tab streaming of all council agent messages

Vera QA:
[ ] Three domains: Audio QA + Visual QA + Standards QA
[ ] TONY inline QA already wired in Phase 4c — this is final pre-publish pass
[ ] PASS → CLEARED signal to Theo. FAIL → precise failure report to Qeon
[ ] Re-check failed domains only — passed domains not re-run

RRQ Retro:
[ ] Day 2 early read: CTR + retention at Muse's pivot point
[ ] Catastrophic signal → emergency council fires
[ ] Daily EventBridge target checks
[ ] Early close on SET TARGET hit
[ ] Full retro council at Day 7: each agent reviews original call vs actual
[ ] WIN_RECORD / MISS_RECORD written to Bedrock
[ ] Conflict vindication flag if overruled RED agent was right
```

### Phase 13 — Auth + Billing + Polish
```
[ ] Read auth-clerk skill completely first
[ ] Install @clerk/nextjs — wrap root layout in ClerkProvider (dark theme, amber primary)
[ ] Create middleware.ts — protect /create/* and /zeus/* routes
[ ] Create /sign-in and /sign-up pages (Mission Control styled)
[ ] Add UserButton to Header
[ ] Clerk webhook → auto-create user-settings in DynamoDB on sign-up
[ ] YouTube OAuth connect + callback routes (see auth-clerk skill)
[ ] lib/youtube-auth.ts with auto-refresh listener
[ ] lib/plan-guard.ts — gate pipeline by monthly video count
[ ] Stripe: 4 plans (Free/Starter $19/Creator $49/Agency $149)
[ ] Stripe webhook → update Clerk publicMetadata on subscription change
[ ] User settings page: quality threshold, voice prefs, YouTube disconnect
[ ] Job history with per-video performance stats
[ ] Error states + retry UI for every pipeline step
[ ] A/B thumbnail testing interface
[ ] Mobile responsive sidebar collapse
```

---

## Coding Standards

**TypeScript everywhere.** No .js files — only .ts and .tsx.

**No hardcoded credentials.** AWS Secrets Manager for all API keys.
IAM roles for Lambda and EC2. Never put keys in .env.local for prod.

**Every Lambda must:**
- Export typed handler
- Wrap in try/catch with CloudWatch logging
- Include jobId in every log line
- Update DynamoDB at start, each major step, and completion/failure
- Return `{ statusCode, body }` with typed body

**Every Inngest step must:**
- Use `step.run()` for every discrete operation
- Keep steps small — one external call per step
- Return meaningful data for UI progress tracking
- Never put two external API calls in the same step

**S3 asset paths:**
```
content-factory-assets/
  jobs/{jobId}/
    voiceover.mp3
    avatar_output.mp4
    visuals/{assetId}.(png|mp4)
    broll/{sectionId}.mp4
    final_youtube.mp4
    final_short.mp4
    thumbnail_a.jpg
    thumbnail_b.jpg
  avatars/avatar_{1-5}/
    reference.mp4
    portrait.jpg
    config.json       { name, gender, style, topics[] }
  models/wan2.2/      (model weights ~15GB)

rrq-memory/
  episodes/{agent}/{year}/{month}/{episodeId}.json
```

**Frontend:**
- CSS variables for all colours — never hex in components
- GSAP for animations over 200ms
- Framer Motion for page/component transitions
- Mission Control aesthetic — dark, cinematic, amber accents
- Never use default Tailwind blue — always amber (#f5a623)

---

## Presenter Roster + Portrait Generation

Channel identity is built around a rotating roster of 3-5 presenters.
Default ratio: 3 female : 1 male (or 4F:1M on expansion).
Female presenters: bold, classy, well-groomed, photorealistic.
All portraits seed-locked — same face reused every video via SkyReels I2V.

Portraits generated once via FLUX.1 [dev] on EC2 g4dn.xlarge spot.
Stored: s3://content-factory-assets/avatars/dynamic/{channelId}/{presenterId}/reference.jpg
Reused every video — SkyReels animates the same reference portrait.

Personality evolves over time (Oracle Domain 10 tracks performance).
Face never changes. Expression hints, tone, content assignment evolve.
Regum rotates presenters — no same presenter 3x in a row.

Human-in-loop approval gate available (off by default).
If enabled: pipeline hard-stops after portrait generation for user approval.

Read skills/avatar-gen/SKILL.md for full architecture.

---

## Environment Variables (Complete List)

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/create
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/create
CLERK_WEBHOOK_SECRET=

# AWS Core (IAM role in Lambda/EC2 — local dev only)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AWS SES — Transactional Notifications
SES_FROM_ADDRESS=notifications@rrq.ai
SES_REGION=us-east-1
SES_CONFIGURATION_SET=rrq-transactional

# AWS SNS — Infrastructure Alerts (Autopilot Mode / SENTINEL only)
AWS_SNS_ALERT_TOPIC_ARN=          # SNS topic ARN for SMS alerts to user phone

# Observability — SENTINEL (Autopilot Mode only)
SIGNOZ_ENDPOINT=                   # OpenTelemetry OTLP collector endpoint (SignOz)
SIGNOZ_API_KEY=                    # SignOz ingestion API key

# Vercel + Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Bedrock Knowledge Base
BEDROCK_KB_ID=
BEDROCK_DS_ID=
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0

# S3
S3_BUCKET_NAME=content-factory-assets
RRQ_MEMORY_BUCKET=rrq-memory

# EC2 GPU Instances — Three Instances (SkyReels + Wan2.2 + FLUX Portrait)
# SkyReels V2 (avatar — spot, per job)
EC2_SKYREELS_AMI_ID=
EC2_SKYREELS_INSTANCE_TYPE=g5.12xlarge
SKYREELS_MODEL_PATH=s3://content-factory-assets/models/skyreels-v2/

# Wan2.2 (b-roll — spot, per job)
EC2_WAN2_AMI_ID=
EC2_WAN2_INSTANCE_TYPE=g5.2xlarge
WAN2_MODEL_PATH=s3://content-factory-assets/models/wan2.2/

# Avatar Portrait Generation (FLUX.1 [dev] — EC2 g4dn.xlarge spot)
EC2_FLUX_PORTRAIT_AMI_ID=
EC2_FLUX_PORTRAIT_INSTANCE_TYPE=g4dn.xlarge
FLUX_PORTRAIT_MODEL_PATH=s3://content-factory-assets/models/flux1-dev/

#tony coding agent
TONY_LAMBDA_ARN=   # ARN of the code-agent Lambda

# Shared EC2 config
EC2_ROLE_ARN=
EC2_SUBNET_ID=
EC2_SECURITY_GROUP_ID=

# Puppeteer Lambda
CHROMIUM_LAYER_ARN=

# Cloudflare Browser Rendering (crawler)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_BROWSER_RENDERING_TOKEN=   # API token — Browser Rendering Edit permission

# YouTube OAuth
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=

# Rex Signal Sources
TWITTER_BEARER_TOKEN=            # X API v2 Basic+ tier — keyword search + trending topics
NEWS_API_KEY=

# Media APIs (supplementary reference sources — niche research only)
# Pexels/Pixabay: supplementary stock b-roll for motorsport + fallback only
# NOT primary pipeline dependencies — TONY handles stills/infographics, Wan2.2 handles video
PEXELS_API_KEY=
PIXABAY_API_KEY=

# ElevenLabs (4 accounts — rotate by char usage)
ELEVENLABS_KEY_1=
ELEVENLABS_KEY_2=
ELEVENLABS_KEY_3=
ELEVENLABS_KEY_4=

# Data Harvest
SERPAPI_KEY=                    # Google Trends via SerpApi
TICKETMASTER_API_KEY=          # Major events calendar
TIKTOK_ACCESS_TOKEN=           # TikTok for Business Research API (free) — intent layer
# Reddit + GDELT = no key needed

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=

# AdSense
GOOGLE_ADSENSE_PUBLISHER_ID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# RRQ Trigger Modes
RRQ_CRON_RULE=rate(6 hours)           # cron mode — configurable, default 6h
RRQ_QUEUE_LOW_CHECK_RULE=rate(30 minutes)  # queue-low check interval
RRQ_QUEUE_LOW_THRESHOLD=3             # fire scan when pending clips < this

# EventBridge Rules
REX_SCAN_RULE=rate(30 minutes)
RRQ_CRON_RULE=rate(6 hours)
RRQ_QUEUE_LOW_CHECK_RULE=rate(30 minutes)
RRQ_QUEUE_LOW_THRESHOLD=3
ORACLE_RUN_RULE=cron(0 9 ? * TUE,FRI *)
THE_LINE_MORNING_RULE=cron(45 8 * * ? *)
THE_LINE_EOD_RULE=cron(0 21 * * ? *)
THEO_DAILY_RULE=cron(0 9 * * ? *)
THEO_WEEKLY_RULE=cron(0 8 ? * SUN *)
JASON_STANDUP_RULE=cron(0 9 * * ? *)
JASON_SPRINT_CHECK_RULE=cron(0 18 * * ? *)
ZEUS_COMMENT_RULE=rate(6 hours)
ZEUS_ANALYTICS_RULE=rate(24 hours)
```

---

## Cost Estimate

### Per-Video Cost
```
video-gen   (g5.12xlarge spot ~$1.60/hr × 22min)    ~$0.59  (SkyReels + Wan2.2 sequential, single instance)
TONY Lambda (Haiku code-gen + sandbox execution)    ~$0.01
Lambda workers (audio, visuals, av-sync, upload)    ~$0.04
S3 + data transfer                                  ~$0.01
ElevenLabs × 4 accounts                             ~$0.00  (free tier)
AWS Bedrock (per video LLM calls)                   ~$0.08
FLUX portrait (g4dn.xlarge spot ~$0.53/hr × 4min, once per presenter)  ~$0.04 amortized
────────────────────────────────────────────────────
Per video                                            ~$0.77
```

### Monthly Fixed Costs (platform, regardless of video count)
```
AWS Bedrock base (agent scheduled runs)              ~$8.00
S3 storage + transfer baseline                       ~$2.00
Inngest                                              ~$0.00  (free tier)
Vercel                                               ~$0.00  (free tier)
SignOz EC2 t3.small (Autopilot Mode users only)      ~$15.00 (opt-in)
────────────────────────────────────────────────────
Monthly fixed (Studio/Rex modes)                     ~$10.00
Monthly fixed (Autopilot Mode)                       ~$25.00
```

### Total at Scale (monthly)
```
Volume       Fixed    Variable    Total    Per-video
1 user/2/day ~$10    + ~$31      ~$41     ~$0.68   (fixed amortised)
10 users     ~$10    + ~$312     ~$322    ~$0.54
50 users     ~$10    + ~$1,560   ~$1,570  ~$0.52
100 users    ~$10    + ~$3,120   ~$3,130  ~$0.52
```

SaaS plan pricing:
```
Free      $0     3 videos/mo
Starter   $19    15 videos/mo   7-day free trial
Creator   $49    50 videos/mo
Agency    $149   unlimited
```

---

## Starting a New Claude Code Session

```bash
# Install Claude Code (once)
npm install -g @anthropic/claude-code

# Open project
cd yt-content-factory
claude
```

**First session:**
```
Read CLAUDE.md completely. Then start Phase 1 —
build the Next.js frontend foundation following
the frontend-design-spec skill exactly.
```

**Subsequent sessions:**
```
Read CLAUDE.md. We are on Phase [N] of 13.
Read the relevant skill files for this phase.
Continue from where we left off.
```

**Resuming after a break:**
```
Read CLAUDE.md. Check what is built so far.
Read the skill file for [feature].
Continue building.
```

**Phase reference:**
```
Phase 1  — Frontend Foundation
Phase 2  — Manual Pipeline API Routes
Phase 3  — Lambda Workers
Phase 4  — EC2 GPU Instances + TONY Lambda (4a SkyReels / 4b Wan2.2 / 4c TONY Lambda / 4d FLUX Portrait / 4e SENTINEL)
Phase 4e — Anime Series (COMING SOON — LoRA pipeline, funded phase — see skills/anime-series/SKILL.md)
Phase 5  — Memory + Agent Infrastructure
Phase 6  — Rex Agent
Phase 7  — Regum Agent
Phase 8  — Zeus Agent
Phase 9  — Qeon Agent (13-step pipeline orchestration)
Phase 10 — Zeus Command Center UI (incl. Council + Vera + Retro screens)
Phase 11 — Cold Start Deep Research
Phase 12 — Council + Vera + RRQ Retro systems
Phase 13 — Auth + Billing + Polish
```

---

## Key Architecture Decisions

| Decision | Why |
|---|---|
| Bedrock over direct Anthropic API | IAM auth, prompt caching, all in one AWS account |
| Inngest over Step Functions | 50k free runs vs 4k, TypeScript-first, Vercel-native |
| Bedrock Knowledge Base over Pinecone | Fully managed RAG, no external account, all AWS |
| Single EC2 spot (model-swap) over two parallel instances | User accepted +15 min wait (~22 min total) to eliminate one spot instance per video. SkyReels runs first, unloads, Wan2.2 loads on same g5.12xlarge. Saves one instance launch per video. |
| TONY over FLUX for stills | Remotion/Recharts/D3 generates data-driven, on-brand artifacts. No EC2 cost, no AI image generation, Oracle keeps toolbox current automatically |
| SkyReels V2 over SadTalker or D-ID | 33 expressions, cinematic quality, zero per-video API cost |
| Wan2.2 over stock b-roll APIs | VBench 84.7%, generated not licensed, no attribution required |
| TONY Lambda over fal.ai API for images | Zero EC2 cost, Lambda-only, Remotion/D3/Recharts output is fully owned, Oracle keeps toolbox current |
| Puppeteer over D3/Matplotlib | Browser-quality render, CSS animations, any visual type |
| ElevenLabs × 4 over single account | 40k free chars/month at zero cost |
| FFmpeg on Lambda over video APIs | Zero cost, full control, Lambda layer available |
| Opus for Muse + Rex + Zeus | Highest-stakes judgment — wrong calls compound forever |
| Sonnet for Regum + council positions | Structured decisions — cost-effective at run frequency |
| Haiku for Vera QA + prompt construction | Checklist execution — speed matters, not creativity |
| Quality gate before audio/video | Protects ElevenLabs credits and EC2 GPU time |
| Council before production | Catches wrong angles before $0.52 is spent per video |
| Promise.allSettled over Promise.all | Single EC2 failure doesn't abort entire pipeline |

# RRQ — AI-Powered Content Production Platform

> **Your AI Content Manager. Research, script, produce, upload — you stay in control of what matters.**

Built by **Vayu Innovation**.

---

## What It Does

RRQ is an end-to-end AI content factory for YouTube creators. It orchestrates the full production lifecycle — from market signal detection and script generation through to GPU-accelerated video rendering and platform upload — in a single automated pipeline.

Three operating modes:

- **Studio Mode** — User enters a topic. AI handles research, scripting, production, SEO, and upload. User approves key decisions. ~25 minutes topic to published video.
- **Rex Mode** — AI continuously scans content signals and surfaces ranked opportunities. User selects a topic and triggers the pipeline.
- **Autopilot Mode** — Fully autonomous operation. Multi-agent coordination handles content strategy, production, and channel management end-to-end.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND          Next.js 16 · React 19 · TypeScript       │
│  (Vercel)          Tailwind CSS · Framer Motion · GSAP       │
│                    Clerk v7 authentication                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  WORKFLOW ENGINE   Inngest (durable, event-driven)           │
│                    16+ production + agent workflows          │
│                    EventBridge cron integration              │
└──────┬─────────────────┬──────────────────┬─────────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼────────────────┐
│  AWS LAMBDA │  │  AWS EC2     │  │  AMAZON BEDROCK        │
│  10 workers │  │  GPU spot    │  │  Claude Opus / Sonnet  │
│  Node 20    │  │  instances   │  │  / Haiku + Knowledge   │
│  SST v3     │  │  (per job)   │  │  Base (Titan v2)       │
└──────┬──────┘  └───────┬──────┘  └───────────────────────┘
       │                 │
┌──────▼─────────────────▼────────────────────────────────────┐
│  AWS DATA LAYER    S3 · DynamoDB · Secrets Manager           │
│                    SES · SNS · EventBridge · ECR             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

**Frontend**
- Next.js 16 (App Router) · React 19 · TypeScript 5
- Tailwind CSS · Zustand · Framer Motion · GSAP · Lenis
- Recharts · Lucide React

**Backend / Compute**
- AWS Lambda (Node.js 20) — 10 serverless worker functions
- Amazon EC2 (GPU spot instances) — AI video generation
- Amazon Bedrock — all LLM inference (no direct API calls)
- Inngest — durable workflow orchestration
- SST v3 — infrastructure as code

**AI Models (via Amazon Bedrock)**
- `claude-opus-4-6` — research, strategy, memory, creative judgment
- `claude-sonnet-4-6` — structured decisions, quality assessment
- `claude-haiku-4-5` — fast tasks, code generation, metadata

**Storage**
- Amazon S3 — all media assets and agent memory
- Amazon DynamoDB — operational state (30+ tables, on-demand)
- Amazon ECR — Lambda container images

**Security & Auth**
- Clerk v7 — user authentication + OAuth
- AWS Secrets Manager — all credentials
- IAM roles — Lambda and EC2 (no hardcoded keys)

---

## Key Features

- **13-step production pipeline** — research through upload in a single automated workflow
- **Multi-agent AI coordination** — specialised agents handle distinct domains (intelligence, strategy, production, quality, safety, channel management)
- **GPU-accelerated video generation** — AI talking-head synthesis and atmospheric b-roll via AWS EC2 spot instances
- **Dynamic visual generation** — data-driven infographics, charts, and diagrams rendered as animated MP4 via code-generation sandbox
- **Voice synthesis** — ElevenLabs multi-account rotation with Edge-TTS fallback and expressive voice cue processing
- **Autonomous content intelligence** — continuous signal scanning across multiple data sources with confidence scoring
- **Quality gate** — AI-driven quality assessment before any compute-intensive production begins
- **Prompt caching** — ~60% input token savings on Bedrock calls with repeated system context
- **Self-healing workflows** — per-step retry logic with escalation to email/SMS on unresolved failures

---

## AWS Infrastructure Overview

RRQ runs entirely on AWS (`us-east-1`) with a zero-idle-cost architecture:

| Layer | Services | Notes |
|---|---|---|
| Compute | Lambda, EC2 spot | Lambda per-request; EC2 self-terminates per job |
| AI/ML | Bedrock (LLM + Knowledge Base) | Cross-region inference profiles |
| Storage | S3, DynamoDB | 2 S3 buckets; 30+ DynamoDB tables |
| Messaging | SES, SNS, EventBridge | Notifications + cron agent scheduling |
| Security | Secrets Manager, IAM | Zero hardcoded credentials |
| Container Registry | ECR | 4 container-based Lambda functions |
| Deployment | SST v3 | Infrastructure as code |

**Per-video production cost (spot pricing): ~$0.77**

---

## Project Structure

```
yt-content-factory/
├── apps/
│   └── web/                    # Next.js 16 application
│       ├── app/                # App Router pages + API routes
│       ├── components/         # UI components
│       ├── inngest/            # Workflow definitions
│       └── lib/                # Agents, clients, utilities
├── lambdas/
│   ├── audio-gen/              # Voice synthesis worker
│   ├── av-sync/                # FFmpeg video assembly
│   ├── code-agent/             # AI code-generation sandbox
│   ├── research-visual/        # Puppeteer web capture
│   ├── shorts-gen/             # Shorts format conversion
│   ├── uploader/               # YouTube Data API v3
│   └── visual-gen/             # Data visualisation renderer
├── infra/                      # SST v3 infrastructure config
└── packages/                   # Shared packages (Remotion compositions, types)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- AWS account (us-east-1) with Bedrock access enabled
- YouTube Data API v3 credentials
- Clerk account
- ElevenLabs account(s)

### Install

```bash
git clone <repo>
cd yt-content-factory
npm install
```

### Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required variables are documented in `.env.example`. All AWS credentials use IAM roles in production — for local development only, you may use `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### Development

```bash
# Start the Next.js development server
npm run dev --workspace=apps/web

# Deploy Lambda workers (requires AWS credentials)
npm run deploy --workspace=infra

# Run Inngest dev server
npx inngest-cli@latest dev
```

---

## Deployment

Lambda functions are deployed via SST v3:

```bash
cd infra
npm run deploy
```

The Next.js frontend deploys automatically to Vercel on push to `main`.

---

## Contributing

This is a proprietary product by Vayu Innovation. Contributions are not currently open to the public. If you are a collaborator with access, please follow the branch naming convention: `feature/`, `fix/`, `chore/`.

---

## License

© 2026 Vayu Innovation. All rights reserved. Proprietary and confidential.

---

*RRQ — The fastest way to start, grow, and run your channel.*

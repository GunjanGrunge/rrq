---
name: tony
description: >
  TONY is RRQ's Code Agent — inspired by Tony Stark. A sandboxed JavaScript
  execution engine that any agent can call to run code on demand. TONY generates
  visuals, scrapers, reports, charts, and custom data transformations. MUSE is
  TONY's primary caller — MUSE designs the blueprint, TONY executes custom
  visuals and data prep. Read this skill when building the code-agent Lambda,
  extending TONY's capabilities, or wiring an agent to call TONY.
---

# TONY — Code Agent

## What TONY Is

```
TONY is not a replacement for MUSE. TONY is MUSE's execution arm.

MUSE designs: "I need an animated bar chart comparing GPU performance for this beat."
TONY builds: Haiku generates the Recharts component → sandbox runs it → MP4 to S3.
MUSE continues: Uses the S3 URL in the MuseBlueprint.

Any agent can call TONY. TONY is a shared service.
```

---

## Org Chart Position

```
ZEUS
  └── MUSE ──→ TONY (dotted line — execution arm)
  └── REX  ──→ TONY (for custom scrapers)
  └── REGUM ─→ TONY (for analytics charts)
  └── ORACLE ─→ TONY (for data extraction)
```

---

## Lambda Location

```
lambdas/code-agent/
  src/handler.ts     — main Lambda handler, Bedrock Haiku code gen, S3 upload
  src/sandbox.ts     — child_process.fork() isolated execution
  src/allowlist.ts   — permitted outbound fetch() domains
```

---

## Model

```
Bedrock Haiku — anthropic.claude-haiku-4-5-20251001
Fast structured code generation. Never Sonnet or Opus for TONY.
```

---

## Input / Output

```typescript
// Input (CodeAgentInput schema in lambda-types)
{
  jobId:       string,
  agentId:     "REX" | "REGUM" | "QEON" | "ZEUS" | "ARIA" | "ORACLE" | "MUSE",
  task:        string,           // natural language task description
  context:     Record<string, unknown>,  // data TONY can use (injected as frozen constants)
  outputType:  "data" | "chart" | "report" | "scrape",
  allowedDomains?: string[],     // override default allowlist (use sparingly)
  timeoutMs:   number,           // default 30_000
}

// Output (CodeAgentOutput schema in lambda-types)
{
  success:       boolean,
  outputType:    "data" | "chart" | "report" | "scrape",
  s3Key?:        string,         // set for chart/report/scrape
  data?:         Record<string, unknown>,  // set for outputType "data"
  markdown?:     string,         // set for outputType "report"
  errorMessage?: string,
  codeGenerated: string,         // always included — audit trail
  executionMs:   number,
}
```

---

## TONY's 10 Output Categories

```
1.  Data Visualizations     — charts, graphs, scorecards, stat callouts, leaderboards
2.  Motion Graphics         — animated infographics, kinetic text, counter animations
3.  Overlay Elements        — lower thirds, name tags, source citations, watermarks
4.  Comparison Assets       — side-by-side tables, spec sheets, feature grids
5.  Timeline & Story        — event timelines, news sequences, narrative arcs
6.  Maps & Geo              — market maps, regional highlights, SNIPER geo segments
7.  3D Elements             — depth-effect cards (CSS 3D — not WebGL, not Lambda-safe)
8.  Code & Data Reports     — structured JSON from scraped/processed data
9.  Custom Scrapers         — on-demand web scraping returning clean structured data
10. Lottie Animations       — After Effects-quality animations via @remotion/lottie
```

---

## Confirmed Package Toolbox

### Official Remotion (Lambda-safe, React 19, pinned 4.0.435)
```
remotion                @remotion/renderer      @remotion/bundler
@remotion/shapes        @remotion/motion-blur   @remotion/noise
@remotion/google-fonts  @remotion/lottie
```

### Charts & Data
```
recharts 3.8.0    — SVG charts, React-native, server-safe
d3 7.9.0          — raw visualization power, no browser deps
@nivo/core 0.99.0 + @nivo/bar + @nivo/line + @nivo/radar
```

### Geo & Maps
```
d3-geo                               — pure server-safe geo projections
@vnedyalk0v/react19-simple-maps      — React 19 fork of react-simple-maps
```

### Icons
```
lucide-react 0.577.0   — already in project
phosphor-react          — SSR-safe /dist/ssr export
```

### DROPPED — Not Lambda/Remotion safe
```
canvas-confetti        — browser Canvas API, not Lambda
three.js               — WebGL context required, not Lambda
@react-three/fiber     — WebGL context required, not Lambda
framer-motion          — client-only animations (stays in web app frontend)
gsap                   — client-only (stays in web app frontend)
lottie-react           — use @remotion/lottie instead
react-simple-maps      — React 18 max, use @vnedyalk0v/react19-simple-maps
react-icons            — SSR issues, use phosphor-react
```

---

## Sandbox Architecture

```
Calling agent → invokeCodeAgent(input)
  → handler.ts
    → generateCode(input) via Bedrock Haiku
        System prompt: output only JS, no imports, process.send() to return
        Context keys injected into prompt as available variables
    → executeSandboxed(code, context, timeoutMs)
        1. Write to /tmp/tony-worker-{ts}.js
           File contains:
             - context as frozen Object.freeze() constants
             - fetch() patched with ALLOWED_DOMAINS check
             - generated code body
        2. child_process.fork() spawns worker
           env: { NODE_ENV: "sandbox" } only — no AWS credentials
           execArgv: ["--disallow-code-generation-from-strings"]
           stdio: ["ignore", "pipe", "pipe", "ipc"]
        3. setTimeout(SIGKILL, timeoutMs) — uncatchable hard kill
        4. Parent listens on IPC → child calls process.send({ success, output })
        5. Child killed unconditionally after IPC message
        6. Worker file cleaned from /tmp
    → uploadOutput() if chart/report/scrape → S3 jobs/{jobId}/tony/
    → Return CodeAgentOutput (always includes codeGenerated for audit)
```

---

## Fetch Allowlist

```typescript
// See lambdas/code-agent/src/allowlist.ts for full list
// Key domains:
reddit.com, old.reddit.com, www.reddit.com
gdeltproject.org, trends.google.com, serpapi.com, newsapi.org
api.twitter.com, api.x.com
api.ticketmaster.com
www.googleapis.com, youtube.com
en.wikipedia.org
s3.amazonaws.com (S3 read only)
```

---

## MUSE Integration (Phase 9)

When MUSE generates MuseBlueprint, it can set `tonyTasks` on scriptOutput:

```typescript
// scriptOutput.tonyTasks (added to script schema in Phase 9)
tonyTasks?: Array<{
  task:       string,
  context:    Record<string, unknown>,
  outputType: "data" | "chart" | "report" | "scrape",
}>
```

The Inngest workflow (Step 9 parallel block) checks `scriptOutput.tonyTasks?.[0]`
and calls `invokeCodeAgent()` if present. This is forward-compatible — currently
resolves to `null` since MUSE doesn't yet generate tonyTasks (Phase 9 wires it fully).

---

## Oracle Integration

Oracle domain 9 (`PACKAGE_DISCOVERY`) monitors for new packages that enhance
TONY's capabilities. When Oracle finds a qualifying package:
1. Writes to `oracle-knowledge-index` with domain `PACKAGE_DISCOVERY`
2. Zeus injects at morning briefing into TONY's system context
3. TONY can use the package in the next run (Haiku will know it's available)

Inclusion criteria (strict — prevents noise):
- Reduces Lambda bundle size >10%, OR
- Adds a TONY output category not currently supported, OR
- Fixes a measurable performance issue

---

## IAM Permissions

```
TONY Lambda IAM role — minimum viable:
  s3:PutObject  →  arn:aws:s3:::content-factory-assets/jobs/*/tony/*
  (NO other AWS permissions — child process gets NOTHING)
```

---

## SST Config

```typescript
const codeAgent = new sst.aws.Function("CodeAgent", {
  handler: "lambdas/code-agent/src/handler.handler",
  runtime: "container",     // needs Puppeteer for scrape tasks
  timeout: "1 minute",      // 30s sandbox + 15s Haiku gen + buffer
  memory: "1024 MB",
  environment: {
    ...sharedEnv,
    LAMBDA_CODE_AGENT: "rrq-code-agent",
  },
  link: [assetsBucket],
});
```

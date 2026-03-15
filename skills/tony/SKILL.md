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
  visualBrief?: VisualBrief,     // MUSE-generated per beat — drives all Haiku creative decisions
                                  // Optional: required for MUSE tasks, optional for Rex/Regum/Oracle tasks
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

## VisualBrief — The Creative Driver

TONY does not have a static visual style. MUSE (Opus) generates a `VisualBrief`
per beat and attaches it to every tonyTask. Haiku's code generation prompt
is built directly from the VisualBrief — not from defaults or templates.

```
MUSE designs → VisualBrief attached to tonyTask
TONY receives → Haiku code-gen prompt built from VisualBrief
Haiku generates → Remotion component that executes the brief exactly
TONY runs → output matches MUSE's intent
```

### Haiku Prompt Construction

The handler builds the Haiku code-gen prompt by serialising the VisualBrief
into precise natural language instructions:

```typescript
function buildCodeGenPrompt(input: CodeAgentInput): string {
  const brief = input.visualBrief;

  return `
You are generating a Remotion React component. Execute these instructions exactly.

## Visual Brief (from MUSE)
Mood: ${brief.mood}
Animation: ${brief.animationStyle}
Typography: ${brief.typography}
Color: ${brief.colorTreatment}
Duration: ${brief.durationSeconds} seconds at 30fps (${Math.round(brief.durationSeconds * 30)} total frames)
Entry: ${brief.entryAnimation}
Exit: ${brief.exitAnimation}
Inspired by: ${brief.inspiredBy.join(", ")}
Current meta applied: ${brief.currentMeta}

## Must Avoid
${brief.mustAvoid.map(a => `- ${a}`).join("\n")}

## Accessibility
${brief.accessibilityNote}

## Task
${input.task}

## Available Data
${JSON.stringify(input.context, null, 2)}

## Available Packages
remotion, @remotion/shapes, @remotion/motion-blur, @remotion/noise,
@remotion/google-fonts, @remotion/lottie, recharts, d3, @nivo/core,
@nivo/bar, @nivo/line, @nivo/radar, lucide-react, phosphor-react,
d3-geo, @vnedyalk0v/react19-simple-maps

## Rules
- Use useCurrentFrame() and interpolate() for all animations
- Use spring() from remotion for physics-based motion
- Export default a React component — no imports, context is pre-injected
- Call process.send({ success: true, output: "rendered" }) when done
- Never use browser APIs (window, document, localStorage)
- Honour every spec in the Visual Brief — do not substitute or simplify
`.trim();
}
```

### No Fallback Defaults

TONY does not have hardcoded visual defaults. If `visualBrief` is missing
from a tonyTask, the handler throws and retries — it does not fall back to
a generic style. Every TONY output must be directed by MUSE.

Exception: when TONY is called by agents other than MUSE (Rex for scrapers,
Regum for analytics charts), `visualBrief` is optional. If absent,
Haiku uses minimal dark styling: bg #0a0a0a, white text, amber accent.

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
  task:        string,
  context:     Record<string, unknown>,
  outputType:  "data" | "chart" | "report" | "scrape",
  visualBrief: VisualBrief,   // Opus-generated per beat — TONY executes this, not static defaults
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
## Live Toolbox — Oracle Integration

TONY's available package list is not static. At every job start, Zeus injects
the current approved toolbox into TONY's Haiku system prompt via the
agent-prompts-dynamic table.

The injection includes:
  - All confirmed packages from the static toolbox (always present)
  - New packages Oracle approved since last deployment (additions)
  - Deprecated packages with their replacements noted (TONY avoids these)

TONY's Haiku code-gen prompt always starts with:
"Available packages (current as of this run): [injected list]"

This means TONY automatically adopts newly approved packages without
any redeployment. Oracle approves → Zeus injects → TONY uses it same day.
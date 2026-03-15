---
name: oracle
description: >
  ORACLE is RRQ's Learning & Development department. It runs autonomously
  twice a week (Tuesday and Friday at 9AM) and performs deep research across
  every skill domain in the system. It finds what has changed, what is newly
  discovered, and what is now deprecated. It updates the Bedrock RAG knowledge
  base, writes structured update messages to Zeus, and Zeus injects relevant
  findings into the right agents at morning briefing. ORACLE is how the entire
  RRQ system stays current without human intervention. Read this skill when
  building any self-updating, research automation, RAG ingestion, or knowledge
  management feature.
---

# ORACLE — Learning & Development Department

## What ORACLE Does

```
Without ORACLE:
  MUSE uses video structure knowledge from the day it was built.
  Six months later the meta has shifted — long hooks are dead,
  cold opens changed, new retention devices emerged.
  MUSE doesn't know. It keeps producing outdated blueprints.
  Performance slowly declines. Nobody knows why.

With ORACLE:
  Every Tuesday and Friday ORACLE runs deep research on every domain.
  Finds: YouTube changed how it weights the first 30 seconds.
  Updates RAG: new hook guidance versioned and stored.
  Briefs Zeus: "MUSE hook architecture needs updating — here's why."
  Zeus injects at morning briefing: MUSE receives the update.
  Next video produced reflects the new meta.
  System stays sharp indefinitely.
```

---

## Research Model

```
PRIMARY:   Amazon Bedrock — Amazon Nova Pro
           Best for: long-form synthesis, multi-source research,
           cost-efficient deep dives, document comparison
           Used for: all ORACLE research runs

SECONDARY: Claude Opus 4 (via Bedrock)
           Used for: final synthesis when Nova Pro output needs
           deeper editorial judgement or cross-domain reasoning

NEVER:     Haiku or Sonnet for ORACLE research — depth is the point
```

---

## Research Domains

ORACLE covers six domains. Each maps to one or more agents that depend on it.

```typescript
export const ORACLE_DOMAINS = [

  {
    id: "VIDEO_STRUCTURE_META",
    name: "Video Structure & Retention Meta",
    description: "What video formats, hook styles, pacing techniques, and " +
                 "structural patterns are currently working on YouTube. " +
                 "What has stopped working. What is emerging.",
    primaryAgent: "MUSE",
    secondaryAgents: ["QEON"],
    researchDepth: "DEEP",        // full deep dive every run
    sources: [
      "YouTube Creator Academy updates",
      "VidIQ blog and research reports",
      "TubeBuddy research",
      "Retention Rabbit benchmark reports",
      "Creator economy newsletters",
      "Top creator breakdowns and case studies",
      "YouTube algorithm documentation changes",
    ],
    queries: [
      "YouTube video structure meta changes {currentMonth} {currentYear}",
      "YouTube retention techniques what is working {currentYear}",
      "YouTube hook strategies latest research",
      "faceless YouTube channel retention 2025 2026",
      "YouTube algorithm changes video structure impact",
      "pattern interrupt techniques YouTube {currentYear}",
    ],
  },

  {
    id: "PLATFORM_ALGORITHM",
    name: "YouTube & Platform Algorithm Intelligence",
    description: "Algorithm changes, ranking signal shifts, what YouTube " +
                 "is currently rewarding and penalising. Includes Shorts " +
                 "algorithm, recommendation system, and search ranking.",
    primaryAgent: "ARIA",
    secondaryAgents: ["REX", "REGUM"],
    researchDepth: "DEEP",
    sources: [
      "YouTube official creator blog",
      "Google Search Central updates",
      "Creator economy analysts",
      "YouTube Studio feature announcements",
      "Platform policy changes",
    ],
    queries: [
      "YouTube algorithm update {currentMonth} {currentYear}",
      "YouTube recommendation system changes latest",
      "YouTube search ranking factors {currentYear}",
      "YouTube Shorts algorithm update {currentYear}",
      "YouTube AI content detection policy {currentYear}",
      "YouTube monetisation policy changes {currentYear}",
    ],
  },

  {
    id: "AD_STRATEGY",
    name: "Google Ads & AdSense Intelligence",
    description: "CPM trends by market and niche, Google Ads best practices " +
                 "for video campaigns, AdSense optimisation, new ad formats, " +
                 "targeting changes, and budget efficiency techniques.",
    primaryAgent: "ZEUS",
    secondaryAgents: ["SNIPER"],
    researchDepth: "STANDARD",    // standard research every run, deep monthly
    sources: [
      "Google Ads blog",
      "Google AdSense publisher blog",
      "PPC industry reports",
      "YouTube advertising benchmark reports",
      "Media buying newsletters",
    ],
    queries: [
      "Google Ads video campaign best practices {currentYear}",
      "YouTube CPM trends by niche {currentMonth} {currentYear}",
      "Google Ads targeting changes {currentYear}",
      "AdSense RPM optimisation {currentYear}",
      "YouTube TrueView campaign optimisation latest",
    ],
  },

  {
    id: "GEO_MARKET_INTELLIGENCE",
    name: "Geo-Linguistic Market Intelligence",
    description: "CPM shifts by country, new emerging YouTube markets, " +
                 "language and cultural trend shifts, market-specific " +
                 "content performance patterns. Feeds SNIPER's market database.",
    primaryAgent: "SNIPER",
    secondaryAgents: ["ZEUS"],
    researchDepth: "STANDARD",
    sources: [
      "YouTube global usage reports",
      "Statista digital media reports",
      "Regional ad market reports",
      "Creator economy international reports",
    ],
    queries: [
      "YouTube market growth by country {currentYear}",
      "YouTube CPM by country {currentYear}",
      "emerging YouTube markets {currentYear}",
      "YouTube audience demographics by region {currentYear}",
    ],
  },

  {
    id: "CONTENT_TREND_SIGNALS",
    name: "Content Trend & Format Signals",
    description: "What content formats are growing vs declining. New video " +
                 "styles gaining traction. Niche-level trend shifts. " +
                 "What topics are evergreen vs peaking. Feeds ARIA's " +
                 "theme allocation and Rex's signal scoring.",
    primaryAgent: "ARIA",
    secondaryAgents: ["REX", "MUSE"],
    researchDepth: "DEEP",
    sources: [
      "YouTube trending analysis",
      "Social media trend reports",
      "Creator economy research",
      "Niche-specific industry publications",
    ],
    queries: [
      "YouTube content format trends {currentMonth} {currentYear}",
      "fastest growing YouTube niches {currentYear}",
      "YouTube video length trends {currentYear}",
      "what content is performing on YouTube {currentMonth} {currentYear}",
      "YouTube faceless channel niche trends {currentYear}",
    ],
  },

  {
    id: "AI_PRODUCTION_TOOLS",
    name: "AI Production & Tool Intelligence",
    description: "New AI tools for video production, TTS advances, " +
                 "avatar generation improvements, automation techniques. " +
                 "What tools are improving that RRQ should adopt or upgrade to.",
    primaryAgent: "QEON",
    secondaryAgents: ["ZEUS"],
    researchDepth: "STANDARD",
    sources: [
      "AI tool launch announcements",
      "ElevenLabs product updates",
      "Video generation model releases",
      "Creator tooling newsletters",
      "AI research papers on video/audio generation",
    ],
    queries: [
      "AI video generation tools new release {currentMonth} {currentYear}",
      "ElevenLabs updates {currentYear}",
      "AI avatar generation improvements {currentYear}",
      "text to video AI tools {currentYear}",
      "AI voiceover tools comparison {currentYear}",
    ],
  },


  {
    id: "VIDEO_FORMAT_LIBRARY",
    name: "Video Format Discovery & Library Maintenance",
    description: "Identify emerging video format patterns on YouTube. " +
                 "Find new structural approaches gaining traction in top " +
                 "performing videos. Detect formats that are declining. " +
                 "Maintain the dynamic format library MUSE reads from. " +
                 "A format candidate must appear in 3+ videos with 500k+ views " +
                 "within 60 days and be structurally distinct from existing formats.",
    primaryAgent: "MUSE",
    secondaryAgents: ["QEON", "REGUM"],
    researchDepth: "DEEP",
    sources: [
      "Top performing YouTube video analysis",
      "Creator economy trend reports",
      "YouTube structure breakdown articles",
      "Viral video case studies",
    ],
    queries: [
      "new YouTube video formats gaining traction {currentMonth} {currentYear}",
      "YouTube video structure trends {currentYear}",
      "viral YouTube format analysis top creators {currentYear}",
      "what video formats are performing best YouTube {currentMonth} {currentYear}",
      "YouTube creator format innovation emerging {currentYear}",
    ],
  },

  // ── Domain 8 (added Phase 3.5) ────────────────────────────────────────────
  {
    id: "SECURITY_DEPENDENCY_AUDIT",
    name: "Security & Dependency CVE Monitoring",
    description: "Monitor CVEs and security advisories for all npm packages " +
                 "used in the RRQ production stack. Packages monitored: " +
                 "aws-sdk v3, puppeteer-core, googleapis, remotion, recharts, " +
                 "nivo, d3, @sparticuz/chromium, elevenlabs client libraries, zod. " +
                 "REPORT ONLY — ORACLE never modifies package.json or opens PRs. " +
                 "Routes DEVELOPER_ALERT to Zeus for CRITICAL/HIGH CVEs.",
    primaryAgent: "ZEUS",
    secondaryAgents: ["QEON"],
    researchDepth: "STANDARD",
    sources: [
      "National Vulnerability Database (NVD) — nvd.nist.gov",
      "GitHub Advisory Database",
      "Snyk vulnerability database",
      "npm security advisories",
      "AWS SDK GitHub releases",
      "Remotion GitHub releases and changelog",
      "Puppeteer release notes",
    ],
    queries: [
      "CVE aws-sdk v3 npm {currentMonth} {currentYear}",
      "CVE puppeteer-core security vulnerability {currentYear}",
      "CVE googleapis npm {currentYear}",
      "remotion npm security advisory {currentYear}",
      "ElevenLabs SDK security advisory {currentYear}",
      "npm audit critical vulnerabilities nodejs lambda {currentMonth} {currentYear}",
      "zod npm vulnerability {currentYear}",
    ],
    // Special behaviour rules (not in other domains):
    // - CRITICAL/HIGH severity → urgency "IMMEDIATE", type "DEVELOPER_ALERT"
    //   Zeus writes to agent-messages with a red banner in the UI.
    //   Payload includes: package, CVE ID, severity, affected version range, fix version.
    // - MEDIUM/LOW → urgency "THIS_WEEK", standard oracle-updates record.
    // - No CVEs found → still log the run as NEXT_CYCLE (confirms monitoring ran).
    // - Use Haiku (not Opus) for delta detection on MEDIUM/LOW — binary "seen before?" check.
    // - Use Opus for delta detection on CRITICAL/HIGH — nuanced impact assessment needed.
    developerAlertRules: {
      critical: { urgency: "IMMEDIATE", messageType: "DEVELOPER_ALERT" },
      high:     { urgency: "IMMEDIATE", messageType: "DEVELOPER_ALERT" },
      medium:   { urgency: "THIS_WEEK", messageType: "ORACLE_UPDATE" },
      low:      { urgency: "NEXT_CYCLE", messageType: "ORACLE_UPDATE" },
    },
    agentInstructions: {
      ZEUS: "Route DEVELOPER_ALERT to human channel — do not attempt to self-patch. Display red banner in Oracle panel.",
      QEON: "If a production tool is affected (ElevenLabs, Puppeteer, Remotion), flag in the next job start report.",
    },
  },

  // ── Domain 9 (added Phase 3.5) ────────────────────────────────────────────
  {
    id: "PACKAGE_DISCOVERY",
    name: "TONY Toolbox — Package & Library Discovery",
    description: "Discover new npm packages that enhance TONY's visual and " +
                 "animation capabilities. Track Remotion sub-package releases, " +
                 "new Lambda-safe charting or animation libraries, and updates " +
                 "to existing packages in TONY's toolbox. " +
                 "Strict inclusion criteria — prevents noise: " +
                 "(1) reduces Lambda bundle size >10%, OR " +
                 "(2) adds a TONY output category not currently supported, OR " +
                 "(3) fixes a measurable performance issue (render time, memory). " +
                 "Approved packages written to oracle-knowledge-index. " +
                 "Zeus injects into TONY's system context at morning briefing.",
    primaryAgent: "ZEUS",    // Zeus injects into TONY at morning briefing
    secondaryAgents: ["QEON", "MUSE"],
    researchDepth: "STANDARD",
    sources: [
      "Remotion GitHub changelog and releases",
      "npm new packages weekly — categories: video, animation, charts, visualization",
      "Recharts, Nivo, D3 release notes",
      "AWS Lambda community — new layer packages",
      "React ecosystem newsletters",
    ],
    queries: [
      "remotion new sub-packages released {currentMonth} {currentYear}",
      "new npm packages lambda safe animation visualization {currentYear}",
      "recharts nivo d3 major update {currentMonth} {currentYear}",
      "React 19 compatible charting animation library new {currentYear}",
      "AWS Lambda nodejs bundle size optimization packages {currentYear}",
      "lottie animation React 19 compatible {currentYear}",
    ],
    // Inclusion filter applied BEFORE writing to oracle-knowledge-index:
    // Package must meet at least ONE of the three criteria above.
    // Oracle writes a brief evaluation: name, criteria met, estimated impact, install command.
    // TONY gains the package in its next run after Zeus injects the context.
    injectionTarget: "TONY",   // Zeus knows to route this to TONY's system context
    urgency: "NEXT_CYCLE",     // Package discovery is never urgent

    onDeprecatedPackageFound: `
      1. Identify the replacement package (must meet inclusion criteria)
      2. Write both old and new to oracle-knowledge-index:
         { deprecated: "old-package", replacement: "new-package", reason: "why" }
         Example: { deprecated: "react-simple-maps", replacement: "@vnedyalk0v/react19-simple-maps", reason: "React 19 incompatible" }
      3. Zeus injection includes deprecation notice alongside new approvals
         TONY's Haiku prompt receives: "DEPRECATED (do not import): [package] → use [replacement] instead"
      4. Old package moves to DROPPED list in tony/SKILL.md as permanent record
    `,
  },

  // ── Domain 10 (added Phase 4) ─────────────────────────────────────────────
  {
    id: "VISUAL_META_LIBRARY",
    name: "Visual Meta & Design Trend Intelligence",
    description: "Tracks what visual styles, animation patterns, typography treatments, " +
                 "and overlay designs are currently performing on YouTube and in the broader " +
                 "motion design space. Feeds MUSE's VisualBrief generation. " +
                 "Oracle evaluates RexDesignSignals from the field and adopts worthy sources.",
    primaryAgent: "MUSE",
    secondaryAgents: ["TONY", "REX"],
    researchDepth: "STANDARD",
    sources: [
      // Design education + trend sources
      "awwwards.com — web design trend reports and Site of the Day analysis",
      "mobbin.com — UI pattern library and motion design references",
      "fonts.google.com/knowledge — typography principles and current usage",
      "Behance motion design collections — animation patterns and visual language",
      "Nielsen Norman Group — visual hierarchy and UX research",
      // Channel inspiration (structural patterns — not copying)
      "MrBeast video analysis — kinetic energy, bold stat callouts, countdown tension",
      "Kurzgesagt — geometric animation, clean infographic visual language",
      "MKBHD — minimal dark aesthetic, precision typography, lower third design",
      "Veritasium — data-first overlays, thesis-driven graphic cards",
      "ColdFusion — cinematic dark lower thirds, moody b-roll text treatment",
    ],
    queries: [
      "YouTube video overlay design trends {currentMonth} {currentYear}",
      "motion graphics styles trending YouTube {currentYear}",
      "lower third design best practices video {currentYear}",
      "kinetic typography video trends {currentYear}",
      "infographic animation styles YouTube top channels {currentYear}",
      "video graphic overlay design {currentMonth} {currentYear}",
      "Remotion animation library new releases {currentYear}",
      "web animation design trends {currentMonth} {currentYear}",
    ],

    // Rex feeds this domain from the field
    rexSignalIntake: {
      signalType: "RexDesignSignal",
      table: "oracle-knowledge-index",
      evaluationCriteria: [
        "Is this a genuinely new resource not already in the watched sources list?",
        "Does it cover motion design, video overlays, animation, or typography?",
        "Is it actively maintained and updated (not abandoned)?",
        "Does it represent an emerging pattern vs a one-off?",
      ],
      onAdoption: "Add URL to watched sources list in RAG. Start pulling on next Oracle run. Notify Zeus.",
      onRejection: "Log reason. Do not add. Rex is not penalised for false positives — field signals are noisy.",
    },

    outputSchema: {
      // One VisualMetaEntry per identified style/pattern
      entries: "VisualMetaEntry[]",
    },
  },

  // ── Domain 11 (added Phase 4) ─────────────────────────────────────────────
  {
    id: "PRESENTER_PERFORMANCE_ANALYTICS",
    name: "Presenter Performance Analytics",
    description: "Oracle tracks per-presenter performance metrics and triggers " +
                 "evolution or roster expansion recommendations.",
    primaryAgent: "ZEUS",
    secondaryAgents: ["MUSE", "REGUM"],
    researchDepth: "STANDARD",
    sources: [
      "channel-health DynamoDB table (per-video CTR + retention snapshots)",
      "video-memory DynamoDB table (per-presenter performance records)",
      "theo-comment-actions DynamoDB table (comment sentiment per video)",
      "avatar-profiles DynamoDB table (presenter roster + evolution history)",
    ],
    queries: [],   // no external web search — data-driven from internal tables only

    // Trigger conditions:
    // - After every 10 videos: performance snapshot
    // - After 30 videos: full evolution evaluation
    // - On Zeus directive: immediate review
    // - On catastrophic CTR drop (< 2% for 3 consecutive videos with same presenter)

    analyticsInput: `
interface PresenterAnalyticsUpdate {
  presenterId: string;
  channelId: string;
  videosAnalyzed: number;
  performanceByContentType: {
    contentType: string;
    avgCTR: number;
    avgRetention: number;
    avgViewCount: number;
    commentSentiment: 'positive' | 'neutral' | 'negative';
  }[];
  rotationBalance: { [presenterId: string]: number }; // % of videos
  humanApprovalSignals: number; // count of human-approved portraits
}
    `,

    oracleOutputs: `
type OraclePresenterRecommendation =
  | { action: 'EVOLVE'; presenterId: string; reason: string; traitChanges: string[] }
  | { action: 'EXPAND_ROSTER'; reason: string; newPresenterBrief: string }
  | { action: 'RETIRE'; presenterId: string; reason: string; replacement: string }
  | { action: 'NO_ACTION'; reason: string };
    `,

    injectionTargets: [
      "MUSE system prompt (next character brief generation)",
      "REGUM system prompt (rotation scoring weights)",
      "Zeus episode log (performance record)",
    ],

    // Human approval as a high-confidence signal:
    // When a user approves a presenter portrait via the human-in-loop gate:
    //   - Oracle tags that presenter's performance data as HIGH_CONFIDENCE
    //   - Human aesthetic preferences override model-estimated scores
    //   - Rejection reason stored and injected into next FLUX generation prompt
    humanApprovalBehaviour: {
      onApproval: "Tag presenter performance data as HIGH_CONFIDENCE",
      onRejection: "Store rejection reason; inject into next FLUX portrait generation prompt",
      preference: "Human aesthetic preferences override model-estimated scores",
    },
  },

  // ── Domain 12 (added Phase 4+) ────────────────────────────────────────────
  {
    id: "AI_DETECTION_RESISTANCE_AUDIT",
    name: "AI Detection Resistance Audit",
    description: "Pre-upload gate that audits each finished video for patterns " +
                 "that could flag it as AI-generated content — template reuse, " +
                 "audio cadence repetition, metadata similarity, script structure " +
                 "templating, and predictable upload timing. Runs after VERA QA " +
                 "passes, before YouTube upload. Owned by Oracle, triggered by " +
                 "Qeon pipeline. Report-and-patch model: failures are corrected " +
                 "by the responsible agent before upload proceeds.",
    primaryAgent: "ZEUS",
    secondaryAgents: ["QEON", "REGUM"],
    researchDepth: "STANDARD",
    sources: [
      "channel-health DynamoDB table (per-video upload timestamps)",
      "video-memory DynamoDB table (per-video metadata + script fingerprints)",
      "oracle/knowledge/AI_DETECTION_RESISTANCE_AUDIT/latest.json",
      "TONY output frame hashes stored in production-jobs per jobId",
      "ElevenLabs render metadata (pitch/pace delta per audio render)",
    ],
    queries: [],   // no external web search — data-driven from internal tables only

    trigger: "pre-upload gate — after VERA QA passes, before YouTube upload",
    escalationPolicy: "DOMAIN_11_DETECTION", // references skills/escalation/SKILL.md

    checks: [
      {
        signal: "VISUAL_UNIQUENESS",
        description: "Hash TONY output frames vs previous 20 videos — detect template reuse",
        threshold: 0.70,
        fix: "Qeon requests new TONY render with different composition seed",
      },
      {
        signal: "AUDIO_CADENCE_VARIANCE",
        description: "ElevenLabs pitch/pace delta vs last 5 videos",
        threshold: 0.65,
        fix: "Adjust stability + similarity_boost settings on re-render",
      },
      {
        signal: "METADATA_PATTERN_SCORE",
        description: "Title/description similarity vs channel history (Bedrock embedding cosine similarity)",
        threshold: 0.70,
        fix: "Regum regenerates SEO metadata with explicit variation instruction",
      },
      {
        signal: "SCRIPT_TEMPLATE_DETECTION",
        description: "Bedrock checks own output for repeated sentence structures, template phrases",
        threshold: 0.75,
        fix: "Qeon reruns script step with anti-template instruction injected",
      },
      {
        signal: "UPLOAD_TIMING_VARIANCE",
        description: "Is upload time too predictable? Check regularity against last 10 uploads",
        threshold: 0.60,
        fix: "Regum shifts upload slot by 15-45 min random offset",
      },
    ],

    outputs: {
      CLEAR: "all signals above threshold — proceed to upload",
      WARNING: "1-2 signals below threshold — Qeon patches specific signals, re-check those only",
      HOLD: "3+ signals below threshold OR any single signal below 0.40 — escalate to Zeus",
    },

    maxAttempts: 3,       // per escalation policy — after 3 → Zeus → human notification
    reCheckFailedOnly: true, // on retry, only re-run failed signals not all 5

    agentInstructions: {
      ZEUS: "Evaluate HOLD escalations. Approve or trigger human notification via SES. Log outcome as episode to S3.",
      QEON: "On WARNING: patch failing signals, re-trigger Domain 11 check for failed signals only. On HOLD: pause pipeline, await Zeus ruling.",
      REGUM: "On METADATA_PATTERN_SCORE or UPLOAD_TIMING_VARIANCE failure: regenerate SEO or shift upload slot per fix instruction.",
    },
  },

] as const;

export type DomainId = typeof ORACLE_DOMAINS[number]["id"];
```

---

## Visual Meta Types

Types used by Domain 10 (`VISUAL_META_LIBRARY`) and the MUSE VisualBrief system.

```typescript
// Visual meta entry — one per identified style or pattern
interface VisualMetaEntry {
  id: string;                    // e.g. "kinetic-stat-callout-2026"
  category: "OVERLAY" | "LOWER_THIRD" | "STAT_CALLOUT" | "SECTION_CARD"
           | "TYPOGRAPHY" | "COLOR_TREATMENT" | "ANIMATION_PATTERN" | "TRANSITION";
  name: string;                  // e.g. "Kinetic Number Callout"
  description: string;           // what it is and when it works
  status: "EMERGING" | "ESTABLISHED" | "DECLINING" | "DEPRECATED";
  inspiredBy: string[];          // e.g. ["MrBeast", "Kurzgesagt"] — inspiration not copy
  colorLanguage: string;         // e.g. "dark bg, amber accent, white headline"
  typographyNotes: string;       // e.g. "Syne bold 72px, DM Mono 14px label"
  animationNotes: string;        // e.g. "number counts up with spring easing, lands with glow pulse"
  entryAnimation: string;        // e.g. "slides in from left, 12-frame ease-out"
  exitAnimation: string;         // e.g. "fades to black over 8 frames"
  beatPositionFit: Array<"hook" | "body" | "climax" | "outro">;
  toneFit: Array<"analytical" | "explanatory" | "critical" | "entertainment" | "hybrid">;
  performanceSignal: string;     // why Oracle thinks this is working right now
  discoveredAt: string;          // ISO date
  lastUpdated: string;
  source: "ORACLE_SCHEDULED" | "REX_SIGNAL";
}

// Rex sends this when he spots a new design resource in the field
interface RexDesignSignal {
  type: "DESIGN_TOOL" | "DESIGN_RESOURCE" | "VISUAL_TREND";
  name: string;                  // e.g. "Motion One", "Framer Sites 2026 trend report"
  url: string;
  why: string;                   // Rex's one-line reason it's worth watching
  confidence: number;            // 0-100 — how sure Rex is this is legit
  source: string;                // where Rex spotted it (GitHub trending, X, Reddit, etc.)
  discoveredAt: string;          // ISO timestamp
}
```

---

## The Research Run

```typescript
// lib/oracle/research-run.ts

export async function runOracleResearch(): Promise<void> {
  const runId = `oracle-${Date.now()}`;
  const runDate = new Date().toISOString();

  console.log(`[ORACLE] Research run started: ${runId}`);

  // Run all domains in parallel
  const results = await Promise.allSettled(
    ORACLE_DOMAINS.map(domain => researchDomain(domain, runId))
  );

  // Process results
  const updates: OracleUpdate[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      updates.push(result.value);
    }
  }

  // Write updates to DynamoDB + notify Zeus
  await Promise.all([
    saveOracleUpdates(updates, runId),
    notifyZeus(updates, runId),
  ]);

  console.log(`[ORACLE] Run complete. ${updates.length} updates found.`);
}

async function researchDomain(
  domain: typeof ORACLE_DOMAINS[number],
  runId: string
): Promise<OracleUpdate | null> {

  // 1. Build research queries with current date injected
  const now = new Date();
  const currentMonth = now.toLocaleString("default", { month: "long" });
  const currentYear = now.getFullYear();

  const queries = domain.queries.map(q =>
    q.replace("{currentMonth}", currentMonth)
     .replace("{currentYear}", String(currentYear))
  );

  // 2. Run web searches via Bedrock Nova Pro with web search tool
  const researchPrompt = buildResearchPrompt(domain, queries, currentMonth, currentYear);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "amazon.nova-pro-v1:0",   // Bedrock Nova Pro via API
      max_tokens: 4000,
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
      }],
      system: ORACLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: researchPrompt }],
    })
  });

  const data = await response.json();

  // 3. Extract findings from response
  const researchText = data.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");

  // 4. Compare against existing RAG knowledge for this domain
  const existingKnowledge = await getExistingKnowledge(domain.id);
  const delta = await findKnowledgeDelta(existingKnowledge, researchText, domain);

  // No meaningful delta found — skip update
  if (!delta.hasChanges) return null;

  // 5. Update RAG knowledge base
  await ingestToRAG(domain.id, researchText, runId);

  // 6. Build structured update for Zeus
  return {
    runId,
    domainId: domain.id,
    domainName: domain.name,
    primaryAgent: domain.primaryAgent,
    secondaryAgents: [...domain.secondaryAgents],
    runDate,
    summary: delta.summary,
    newInsights: delta.newInsights,
    deprecatedInsights: delta.deprecatedInsights,
    urgency: delta.urgency,
    agentInstructions: delta.agentInstructions,
  };
}

const ORACLE_SYSTEM_PROMPT = `You are ORACLE, the Learning & Development intelligence 
for an autonomous YouTube content system called RRQ. Your job is to research a specific 
domain and return a structured analysis of:
1. What is NEW and working that the system should adopt
2. What has CHANGED that affects current practices
3. What is now DEPRECATED or no longer effective
4. SPECIFIC actionable instructions for each affected agent

Be precise, evidence-based, and direct. Cite sources. Focus on changes from the last 
30-60 days. Distinguish between confirmed findings and emerging signals.
Return your analysis in the JSON format requested.`;

function buildResearchPrompt(
  domain: typeof ORACLE_DOMAINS[number],
  queries: string[],
  currentMonth: string,
  currentYear: number
): string {
  return `Research domain: ${domain.name}

Description: ${domain.description}

Search for current information on the following topics:
${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Focus on: ${currentMonth} ${currentYear} developments. What has changed recently?

After researching, return a JSON object with this exact structure:
{
  "hasChanges": boolean,
  "summary": "2-3 sentence summary of most important findings",
  "newInsights": [
    {
      "insight": "specific new finding",
      "evidence": "source or evidence",
      "impact": "HIGH | MEDIUM | LOW",
      "agentInstruction": "specific instruction for the affected agent"
    }
  ],
  "deprecatedInsights": [
    {
      "what": "what is no longer working or valid",
      "why": "why it changed",
      "replacement": "what replaces it if anything"
    }
  ],
  "urgency": "IMMEDIATE | THIS_WEEK | NEXT_CYCLE",
  "agentInstructions": {
    "MUSE": "specific instruction if affected, null otherwise",
    "ARIA": "specific instruction if affected, null otherwise",
    "REX": "specific instruction if affected, null otherwise",
    "REGUM": "specific instruction if affected, null otherwise",
    "QEON": "specific instruction if affected, null otherwise",
    "ZEUS": "specific instruction if affected, null otherwise",
    "SNIPER": "specific instruction if affected, null otherwise"
  }
}`;
}
```

---

## Knowledge Delta Detection

How ORACLE decides if something has actually changed vs just restating
what the system already knows.

```typescript
// lib/oracle/delta-detector.ts

async function findKnowledgeDelta(
  existingKnowledge: string,
  newResearch: string,
  domain: typeof ORACLE_DOMAINS[number]
): Promise<KnowledgeDelta> {

  // Use Opus for delta detection — needs nuanced judgement
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 2000,
      system: `You are a knowledge delta detector. Compare existing knowledge 
               against new research findings. Identify ONLY genuinely new 
               information, changed guidance, or deprecated practices. 
               Do not flag restated existing knowledge as new.
               Be conservative — only flag real changes, not minor variations.`,
      messages: [{
        role: "user",
        content: `EXISTING KNOWLEDGE:
${existingKnowledge || "No existing knowledge for this domain yet."}

NEW RESEARCH:
${newResearch}

Domain: ${domain.name}
Primary Agent: ${domain.primaryAgent}

Identify: What is genuinely new? What has changed? What is now outdated?
Return JSON: { hasChanges, summary, newInsights[], deprecatedInsights[], 
               urgency, agentInstructions }`
      }]
    })
  });

  const data = await response.json();

  try {
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { hasChanges: false, summary: "", newInsights: [], 
             deprecatedInsights: [], urgency: "NEXT_CYCLE", agentInstructions: {} };
  }
}
```

---

## RAG Ingestion

```typescript
// lib/oracle/rag-ingestion.ts

// S3 structure:
// content-factory-assets/oracle/knowledge/{domainId}/{runId}.json
// content-factory-assets/oracle/knowledge/{domainId}/latest.json
// content-factory-assets/oracle/knowledge/{domainId}/deprecated.json

export async function ingestToRAG(
  domainId: DomainId,
  content: string,
  runId: string
): Promise<void> {

  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const timestamp = new Date().toISOString();

  // 1. Save versioned copy
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `oracle/knowledge/${domainId}/${runId}.json`,
    Body: JSON.stringify({ runId, timestamp, content }),
    ContentType: "application/json",
  }));

  // 2. Update latest.json — what agents query in real time
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `oracle/knowledge/${domainId}/latest.json`,
    Body: JSON.stringify({ runId, timestamp, content, domainId }),
    ContentType: "application/json",
  }));

  // 3. Sync to Bedrock Knowledge Base for RAG queries
  await syncToBedrockKB(domainId, content, runId);
}

async function syncToBedrockKB(
  domainId: string,
  content: string,
  runId: string
): Promise<void> {

  const bedrock = new BedrockAgentClient({ region: process.env.AWS_REGION });

  // Start ingestion job — Bedrock will chunk and embed the new content
  await bedrock.send(new StartIngestionJobCommand({
    knowledgeBaseId: process.env.BEDROCK_KB_ID,
    dataSourceId: process.env.BEDROCK_DS_ID,
    clientToken: runId,
    description: `ORACLE update: ${domainId} — ${new Date().toISOString()}`,
  }));
}

export async function getExistingKnowledge(domainId: DomainId): Promise<string> {
  const s3 = new S3Client({ region: process.env.AWS_REGION });

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `oracle/knowledge/${domainId}/latest.json`,
    }));
    const data = JSON.parse(await response.Body!.transformToString());
    return data.content ?? "";
  } catch {
    return ""; // first run — no existing knowledge
  }
}
```

---

## Zeus Notification & Agent Injection

How ORACLE's findings reach the agents.

```typescript
// lib/oracle/zeus-notify.ts

export async function notifyZeus(
  updates: OracleUpdate[],
  runId: string
): Promise<void> {

  if (updates.length === 0) return;

  const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Write to agent-messages table — Zeus reads at morning briefing
  await dynamodb.send(new PutItemCommand({
    TableName: "agent-messages",
    Item: {
      messageId:   { S: `oracle-${runId}` },
      type:        { S: "ORACLE_UPDATE" },
      from:        { S: "ORACLE" },
      to:          { S: "ZEUS" },
      timestamp:   { S: new Date().toISOString() },
      payload:     { S: JSON.stringify({
        runId,
        updateCount: updates.length,
        updates: updates.map(u => ({
          domain:          u.domainId,
          primaryAgent:    u.primaryAgent,
          urgency:         u.urgency,
          summary:         u.summary,
          agentInstructions: u.agentInstructions,
          newInsights:     u.newInsights,
          deprecatedInsights: u.deprecatedInsights,
        }))
      })},
      ttl: { N: String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14) }, // 14 days
    }
  }));
}

// Zeus calls this at morning briefing to process ORACLE updates
export async function processOracleUpdates(zeusContext: ZeusContext): Promise<string[]> {
  const unprocessed = await getUnprocessedOracleUpdates();
  if (unprocessed.length === 0) return [];

  const injections: string[] = [];

  for (const update of unprocessed) {
    for (const u of update.updates) {

      // Inject into primary agent
      if (u.agentInstructions[u.primaryAgent]) {
        await injectAgentUpdate(u.primaryAgent, {
          source: "ORACLE",
          domain: u.domain,
          urgency: u.urgency,
          instruction: u.agentInstructions[u.primaryAgent],
          newInsights: u.newInsights,
          deprecatedInsights: u.deprecatedInsights,
        });
        injections.push(`${u.primaryAgent}: ${u.summary}`);
      }

      // Inject into secondary agents
      for (const agent of u.secondaryAgents ?? []) {
        if (u.agentInstructions[agent]) {
          await injectAgentUpdate(agent, {
            source: "ORACLE",
            domain: u.domain,
            urgency: u.urgency,
            instruction: u.agentInstructions[agent],
          });
        }
      }
    }

    // Mark processed
    await markOracleUpdateProcessed(update.runId);
  }

  return injections;
}

async function injectAgentUpdate(
  agent: string,
  update: AgentKnowledgeUpdate
): Promise<void> {

  // Write to agent-messages — each agent reads its own messages
  // at the start of each run via Zeus memory injection
  const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

  await dynamodb.send(new PutItemCommand({
    TableName: "agent-messages",
    Item: {
      messageId:  { S: `oracle-injection-${agent}-${Date.now()}` },
      type:       { S: "MEMORY_INJECTION" },
      from:       { S: "ZEUS" },
      to:         { S: agent },
      timestamp:  { S: new Date().toISOString() },
      payload:    { S: JSON.stringify(update) },
      ttl:        { N: String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30) }, // 30 days
    }
  }));
}
```

---

## Zeus Morning Briefing Addition

```typescript
// Added to Zeus morning briefing (lib/agents/zeus/morning-briefing.ts)

const oracleSection = await processOracleUpdates(zeusContext);

if (oracleSection.length > 0) {
  briefing += `\n\n── ORACLE UPDATES ──────────────────────────────────\n`;
  briefing += `${oracleSection.length} knowledge update(s) injected this cycle:\n`;
  for (const injection of oracleSection) {
    briefing += `  → ${injection}\n`;
  }
  briefing += `\nAgents will receive updated knowledge on their next run.\n`;
}
```

---

## How Agents Query ORACLE Knowledge

Any agent can query the RAG knowledge base before making decisions.

```typescript
// lib/oracle/query.ts — available to all agents

export async function queryOracleKnowledge(
  question: string,
  domain?: DomainId
): Promise<string> {

  const bedrock = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });

  const response = await bedrock.send(new RetrieveAndGenerateCommand({
    input: { text: question },
    retrieveAndGenerateConfiguration: {
      type: "KNOWLEDGE_BASE",
      knowledgeBaseConfiguration: {
        knowledgeBaseId: process.env.BEDROCK_KB_ID!,
        modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/amazon.nova-pro-v1:0`,
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5,
            filter: domain ? {
              equals: { key: "domain", value: { stringValue: domain } }
            } : undefined,
          }
        }
      }
    }
  }));

  return response.output?.text ?? "";
}

// Usage examples:
// MUSE before building blueprint:
//   const meta = await queryOracleKnowledge(
//     "What hook styles are currently working for tech explainer videos?",
//     "VIDEO_STRUCTURE_META"
//   );

// ARIA before portfolio decisions:
//   const trends = await queryOracleKnowledge(
//     "What content formats are growing on YouTube this month?",
//     "CONTENT_TREND_SIGNALS"
//   );

// ZEUS before creating ad campaign:
//   const cpmData = await queryOracleKnowledge(
//     "What is the current CPM for tech content in the US market?",
//     "GEO_MARKET_INTELLIGENCE"
//   );
```

---

## ORACLE Command Center Panel (Zeus UI)

```
ORACLE — Learning & Development

Last run: Tuesday 14 Jan 2026 — 9:14 AM
Next run: Friday 17 Jan 2026 — 9:00 AM

Domain Status:
  VIDEO_STRUCTURE_META      ✓ Updated   3 new insights   0 deprecated
  PLATFORM_ALGORITHM        ✓ Updated   1 new insight    1 deprecated
  AD_STRATEGY               ○ No change
  GEO_MARKET_INTELLIGENCE   ✓ Updated   2 new insights   0 deprecated
  CONTENT_TREND_SIGNALS     ✓ Updated   4 new insights   2 deprecated
  AI_PRODUCTION_TOOLS       ✓ Updated   1 new insight    0 deprecated

Recent injections:
  → MUSE: Hook windows narrowing — 5-7 seconds now critical threshold
  → ARIA: Short-form content demand rising in CULTURE_PULSE theme
  → SNIPER: India CPM rising — upgrade from VOLUME to MID tier
  → QEON: ElevenLabs v3 multilingual model released — upgrade recommended

[Run Now]  [View Full Report]  [Knowledge Base]
```

---

## DynamoDB Tables

```
oracle-updates
  PK: runId (oracle-{timestamp})
  SK: domainId
  fields: summary, newInsights[], deprecatedInsights[],
          urgency, agentInstructions, processed, runDate

oracle-knowledge-index
  PK: domainId
  fields: lastUpdated, lastRunId, insightCount, deprecatedCount,
          s3LatestKey, bedrockSyncStatus
```

---

## New Environment Variables

```bash
# ORACLE schedule
ORACLE_RUN_RULE=cron(0 9 ? * TUE,FRI *)

# Bedrock Nova Pro (already in Bedrock setup — just the model ID)
BEDROCK_NOVA_PRO_MODEL=amazon.nova-pro-v1:0

# All other vars already exist in the system
# BEDROCK_KB_ID, BEDROCK_DS_ID, S3_BUCKET_NAME already defined
```

---

## Build Order

```
[ ] Create lib/oracle/ folder
[ ] Create lib/oracle/research-run.ts      — main orchestrator
[ ] Create lib/oracle/delta-detector.ts    — Opus-powered change detection
[ ] Create lib/oracle/rag-ingestion.ts     — S3 + Bedrock KB sync
[ ] Create lib/oracle/zeus-notify.ts       — agent message writing + injection
[ ] Create lib/oracle/query.ts             — shared RAG query utility
[ ] Create DynamoDB tables: oracle-updates, oracle-knowledge-index
[ ] Create S3 prefix: oracle/knowledge/{domainId}/
[ ] Add EventBridge rule: ORACLE_RUN_RULE
[ ] Add processOracleUpdates() to Zeus morning briefing
[ ] Add queryOracleKnowledge() calls to:
      MUSE  — before blueprint generation (VIDEO_STRUCTURE_META)
      ARIA  — before portfolio decisions (CONTENT_TREND_SIGNALS, PLATFORM_ALGORITHM)
      REX   — before signal scoring (CONTENT_TREND_SIGNALS)
      ZEUS  — before campaign creation (AD_STRATEGY, GEO_MARKET_INTELLIGENCE)
      SNIPER — before market scoring (GEO_MARKET_INTELLIGENCE)
[ ] Add ORACLE panel to Zeus Command Center UI
[ ] Test with single domain run before enabling all six
[ ] Verify Bedrock KB ingestion job completes before agents query
[ ] Create lib/oracle/tone-analytics.ts        — tone performance record writer + correlation analysis
[ ] Create S3 prefix: rrq-memory/episodes/oracle/tone-performance/{channelId}/
[ ] Wire tone record write into Zeus Day-7 RRQ Retro job (after metrics available)
[ ] Wire surfaceToneRefinement() into Oracle Tue/Fri run (after ≥ 5 records exist)
[ ] Wire tone refinement suggestion → oracle-updates DynamoDB → Zeus in-app notification
[ ] Test: 5 analytical records → Oracle surfaces refinement suggestion correctly
[ ] Test: user accepts refinement → user-settings.channelTone updated
[ ] Test: user dismisses → no re-suggestion for 30 days
```


## Council Role — Drift Validation

Oracle is called by The Line when Rex reports narrative drift
and historical pattern context is needed.

```
Oracle answers two questions during drift validation:

1. "Has this niche drifted like this before?"
   Query the knowledge base for previous drift cycles in this niche.
   How long did the drift last? What angles thrived during it?
   What angles died? Did the niche recover or permanently shift?

2. "What does history say about videos made during a drift cycle?"
   Channels that ignored drift and kept the old frame — what happened?
   Channels that adapted quickly — what worked?
   This gives the council a historical baseline for their decision.
```

Oracle does not make the council decision. Oracle provides
the historical evidence the council uses to make it.

## Council Index — RRQ Retro Integration

After each RRQ Retro, The Line writes lessons to the council index.
Oracle's knowledge base is updated with format performance data,
niche pattern updates, and channel growth learnings.

Oracle queries both:
- Its existing knowledge base (content trends, format library)
- The council index (real performance records from our own videos)

When both sources conflict — Oracle flags the conflict to The Line
rather than silently preferring one source.

---

## Domain 10 Extension — Tone Performance Analytics

Oracle Domain 10 (`PRESENTER_PERFORMANCE_ANALYTICS`) is extended to track **tone
signal → performance correlation** alongside presenter performance.

### What Gets Tracked

After each video's Day-7 RRQ Retro, Zeus writes a tone performance record to S3:

```json
{
  "videoId": "string",
  "channelId": "string",
  "tone": {
    "primary": "analytical | explanatory | critical | entertainment | hybrid",
    "secondary": "string | null",
    "confidence": 0.8
  },
  "metrics": {
    "avgViewDuration": "seconds",
    "retentionAt30s": "percentage",
    "retentionAt50pct": "percentage",
    "ctr": "percentage",
    "likeRatio": "percentage"
  },
  "museBlueprintAdherence": 9.0,
  "recordedAt": "ISO timestamp"
}
```

Stored at: `s3://rrq-memory/episodes/oracle/tone-performance/{channelId}/{videoId}.json`

### Refinement Suggestion Logic

After 5+ tone performance records are written for a channel, Oracle runs a
tone correlation analysis on the next scheduled run (Tue/Fri):

```typescript
// Oracle queries its own S3 prefix for the channel's tone records
// Groups records by primary tone
// Compares avg retention at 50% mark per tone group
// If one tone group outperforms hybrid by > 8 percentage points:
//   → surfaceToneRefinement() → writes suggestion to oracle-updates DynamoDB
//   → Zeus picks up oracle-updates and delivers suggestion via in-app notification

interface ToneRefinementSuggestion {
  currentPrimary: string;
  suggestedPrimary: string;
  suggestedSecondary?: string;
  evidenceSummary: string;     // "Analytical scripts averaged 74% retention vs 61% for hybrid"
  videosAnalysed: number;
  confidence: number;          // 0–1
}
```

### User Notification

```
┌─────────────────────────────────────────────────────────┐
│  Oracle — Tone Insight                                   │
│                                                          │
│  Based on your last 8 videos, Explanatory scripts        │
│  averaged 74% retention vs 61% for Hybrid.              │
│                                                          │
│  Suggested update: Set primary tone → Explanatory        │
│                                                          │
│  [ACCEPT UPDATE]  [SEE DATA]  [DISMISS FOR 30 DAYS]     │
└─────────────────────────────────────────────────────────┘
```

User accepts → `user-settings.channelTone` updated, `definedAt` → `"evolved"`.
User dismisses → Oracle does not re-suggest for 30 days (stored in `oracle-updates` table).
Zeus logs the interaction as an episode regardless of outcome.

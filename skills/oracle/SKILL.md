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

  // ── Domain 9 (added Phase 3.5, upgraded to live signal feeds) ──────────────
  {
    id: "PACKAGE_DISCOVERY",
    name: "TONY Toolbox — Package & Library Discovery",
    description: "Discover new npm packages that enhance TONY's visual and " +
                 "animation capabilities. Track Remotion sub-package releases, " +
                 "new Lambda-safe charting or animation libraries, and updates " +
                 "to existing packages in TONY's toolbox. " +
                 "Uses three signal tiers: (A) deterministic GitHub Releases API " +
                 "polling for known packages, (B) npm registry + GitHub Trending " +
                 "for new package discovery, (C) RSS practitioner feeds for " +
                 "community-level alpha before packages reach search indexes. " +
                 "Strict inclusion criteria — prevents noise: " +
                 "(1) reduces Lambda bundle size >10%, OR " +
                 "(2) adds a TONY output category not currently supported, OR " +
                 "(3) fixes a measurable performance issue (render time, memory). " +
                 "Approved packages written to oracle-knowledge-index. " +
                 "Zeus injects into TONY's system context at morning briefing.",
    primaryAgent: "ZEUS",    // Zeus injects into TONY at morning briefing
    secondaryAgents: ["QEON", "MUSE"],
    researchDepth: "STANDARD",

    // ── Tier A — GitHub Releases API (deterministic, exact, no hallucination) ──
    // Poll on every Oracle run. No auth needed for public repos (60 req/hr
    // unauthenticated). Add GITHUB_TOKEN env var to reach 5000 req/hr.
    // Returns exact semver, changelog body, and publish date.
    githubReleasesWatchlist: [
      // Core TONY stack
      { repo: "remotion-dev/remotion",          label: "Remotion core" },
      { repo: "recharts/recharts",              label: "Recharts" },
      { repo: "plouc/nivo",                     label: "Nivo" },
      { repo: "d3/d3",                          label: "D3" },
      { repo: "pmndrs/react-spring",            label: "react-spring" },
      { repo: "framer/motion",                  label: "Framer Motion" },
      { repo: "Sparticuz/chromium",             label: "@sparticuz/chromium" },
      { repo: "nickvdyck/puppeteer-core-sharp", label: "puppeteer-core" },
      // Remotion sub-packages (each is its own GitHub repo section)
      { repo: "remotion-dev/remotion",          label: "@remotion/transitions", tagPrefix: "@remotion/transitions" },
      { repo: "remotion-dev/remotion",          label: "@remotion/shapes",      tagPrefix: "@remotion/shapes" },
      { repo: "remotion-dev/remotion",          label: "@remotion/noise",       tagPrefix: "@remotion/noise" },
      { repo: "remotion-dev/remotion",          label: "@remotion/skia",        tagPrefix: "@remotion/skia" },
      { repo: "remotion-dev/remotion",          label: "@remotion/three",       tagPrefix: "@remotion/three" },
    ],
    // API call pattern (runs in Oracle Lambda, not Puppeteer):
    // GET https://api.github.com/repos/{repo}/releases/latest
    // Compare tag_name against last-seen version stored in oracle-knowledge-index.
    // If newer: pass changelog body to Nova Pro for inclusion filter evaluation.

    // ── Tier B — npm Registry + GitHub Trending (new package discovery) ────────
    // npm registry search API — no key, deterministic JSON, not web search
    npmRegistryQueries: [
      // Search by keywords in each relevant category
      { keywords: ["animation", "react", "lambda"],       minWeeklyDownloads: 500 },
      { keywords: ["visualization", "chart", "react19"],  minWeeklyDownloads: 500 },
      { keywords: ["video", "remotion", "composition"],   minWeeklyDownloads: 100 },
      { keywords: ["svg", "canvas", "animation", "react"],minWeeklyDownloads: 1000 },
      { keywords: ["motion", "spring", "react"],          minWeeklyDownloads: 1000 },
    ],
    // API: GET https://registry.npmjs.org/-/v1/search?text=keywords:{kw1},{kw2}&ranking=popularity&size=25
    // Filter: published within last 14 days OR downloads spiked >300% week-over-week
    // Downloads spike check: GET https://api.npmjs.org/downloads/point/last-week/{packageName}
    //                    vs: GET https://api.npmjs.org/downloads/point/2024-W{n-1}/{packageName}

    // GitHub Trending — scraped by Puppeteer Lambda (already deployed)
    githubTrendingScrape: {
      url: "https://github.com/trending/javascript?since=weekly",
      filter: {
        minStarsGainedThisWeek: 200,
        topicKeywords: ["animation", "video", "chart", "visualization", "motion", "render", "canvas", "svg"],
      },
      // Puppeteer fetches the page, extracts repo name + stars + description.
      // Nova Pro evaluates each against inclusion criteria.
      // Repos passing filter → check npm for corresponding package → inclusion filter.
    },

    // ── Tier C — RSS Practitioner Feeds (community alpha, earliest signal) ──────
    // Parsed in Oracle Lambda (no Puppeteer needed — pure HTTP + XML parse).
    // These feeds surface practitioner excitement BEFORE packages reach search indexes.
    rssFeeds: [
      {
        url: "https://javascriptweekly.com/rss",
        label: "JavaScript Weekly",
        note: "High-signal weekly picks — editors curate only notable releases",
      },
      {
        url: "https://bytes.dev/rss.xml",
        label: "Bytes.dev",
        note: "Weekly JS ecosystem roundup — tends to catch new libs early",
      },
      {
        url: "https://dev.to/feed/tag/animation",
        label: "dev.to #animation",
        note: "Practitioner writeups — often the first long-form coverage of new libs",
      },
      {
        url: "https://dev.to/feed/tag/react",
        label: "dev.to #react",
        note: "React ecosystem — catches new packages in real usage context",
      },
      {
        url: "https://www.reddit.com/r/reactjs/top.rss?t=week",
        label: "r/reactjs weekly top",
        note: "Community signal — top posts often surface new tools with real feedback",
      },
      {
        url: "https://www.reddit.com/r/javascript/top.rss?t=week",
        label: "r/javascript weekly top",
        note: "Broader JS ecosystem — catches non-React animation/viz tools",
      },
    ],
    // RSS parse pattern:
    // Fetch each feed → extract items published within last 7 days
    // → Nova Pro reads all items in one batch prompt:
    //   "From these articles, identify any npm packages in the animation,
    //    video rendering, charting, or visualization space that are newly
    //    released or gaining significant attention. For each, extract:
    //    package name, category, why it is notable."
    // → Identified packages → inclusion filter → oracle-knowledge-index if approved.

    // ── Legacy web search queries (kept as fallback) ────────────────────────────
    // Runs only if Tier A/B/C produce fewer than 3 candidates in a given run.
    queries: [
      "remotion new sub-packages released {currentMonth} {currentYear}",
      "new npm packages lambda safe animation visualization {currentYear}",
      "recharts nivo d3 major update {currentMonth} {currentYear}",
      "React 19 compatible charting animation library new {currentYear}",
      "AWS Lambda nodejs bundle size optimization packages {currentYear}",
      "lottie animation React 19 compatible {currentYear}",
    ],

    // ── Rex signal intake (structured auto-emit from Rex's 6 sources) ───────────
    // Rex emits RexPackageSignal automatically (not optionally) whenever he
    // encounters an npm package reference in any of his 6 signal sources.
    rexPackageSignalIntake: {
      signalType: "RexPackageSignal",
      table: "oracle-knowledge-index",
      // Rex emits this structure whenever he sees a package mentioned in his sources:
      schema: {
        packageName: "string",         // e.g. '@remotion/skia'
        sourceUrl: "string",           // where Rex saw it
        contextSnippet: "string",      // the surrounding text (max 200 chars)
        confidence: "number",          // 0-1, Rex's estimate of signal quality
        detectedAt: "ISO8601",
      },
      // Oracle evaluates on next run — applies inclusion filter.
      // Rex is never penalised for false positives — community signals are noisy.
    },

    // ── Inclusion filter (applied to ALL tiers before writing to index) ─────────
    // Package must meet at least ONE criterion:
    // (1) reduces Lambda bundle size >10%
    // (2) adds a TONY output category not currently supported
    // (3) fixes a measurable performance issue (render time, memory)
    // Oracle writes: { name, criterionMet, estimatedImpact, installCommand, source, discoveredAt }
    injectionTarget: "TONY",   // Zeus routes this to TONY's system context
    urgency: "NEXT_CYCLE",     // Package discovery is never urgent

    // ── Run order within Domain 9 ────────────────────────────────────────────────
    // 1. Tier A (GitHub Releases API) — deterministic, runs first, fastest
    // 2. Tier B (npm registry + GitHub Trending) — new discovery
    // 3. Tier C (RSS feeds) — community alpha, batch to Nova Pro
    // 4. Rex signals (drain oracle-knowledge-index pending signals table)
    // 5. Inclusion filter pass on all candidates from tiers 1-4
    // 6. Legacy web search queries (only if fewer than 3 candidates found above)
    // 7. Write approved packages to oracle-knowledge-index
    // 8. Zeus injection at next morning briefing

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

---

## Domain 13 — Agent Performance Evaluation Layer

Oracle is the system's measurement and evidence authority. Every agent in the
pipeline is continuously evaluated against a shared scoring model. Zeus remains
the final governance authority — Oracle surfaces evidence, Zeus approves action.

### Why This Exists

Without a formal evaluation layer, agents can execute well locally but drift
into outdated strategies that hurt global outcomes. Harvy (ROI brain) is
especially risky here — stale assumptions burn ad budget fast. A shared
evaluation framework creates compounding improvement across every agent.

**Role split (non-negotiable):**
- **Oracle** — evaluates, measures, attributes outcomes, detects drift
- **Zeus** — approves trust-band changes, policy updates, guardrail enforcement
- **Harvy** — recommends financial actions; Oracle audits Harvy's decision quality
- **Other agents** — execute domain responsibilities, emit structured decision logs

---

### Universal Agent Score Formula

One composite score per agent per evaluation window. Hard-coded weights — do
not vary these by agent. Agent-specific overlays are additive, not replacements.

```typescript
// All components normalised to 0–100 before weighting
AgentScore =
  0.30 * OutcomeLift      +  // incremental KPI gain vs baseline
  0.20 * DecisionAccuracy +  // correct_decisions / total_decisions
  0.15 * Calibration      +  // confidence vs actual hit rate alignment
  0.15 * Efficiency       +  // outcome per cost/time/token
  0.10 * Reliability      +  // success rate minus retry/timeout rate
  0.10 * Compliance          // policy adherence, zero guardrail breaches = 100
```

### Trust Bands — Hard-Coded

```
85–100  HIGH_TRUST    Auto-scale within guardrails. Oracle updates auto-inject.
70–84   MED_TRUST     Test-first, then scale. Zeus reviews before full rollout.
50–69   LOW_TRUST     Zeus approval required for any action. Weekly review.
< 50    RESTRICTED    Limited autonomy. Oracle recommendations = HOLD/TEST only.
```

Trust bands stored in `agent-policies` table:
- `agentId`: the agent being scored
- `policyKey`: `"TRUST_BAND"`
- `value`: current band name (`"HIGH_TRUST"` etc.)
- `source`: `"ORACLE"` (Oracle writes, Zeus confirms)

### Hard-Coded Score Penalties

```typescript
const ORACLE_PENALTIES = {
  CRITICAL_BAD_RECOMMENDATION: -10, // high-confidence rec that produced negative outcome
  THREE_LOW_IMPACT_IN_A_ROW:    -5,  // 3 consecutive updates with no measurable KPI move
  MISSING_EVIDENCE_FIELDS:       -3, // decision log missing required fields
  DEPRECATED_GUIDANCE_LATE:      -5, // flagging deprecated guidance after it caused harm
} as const;
```

---

### Decision Data Contract — Required for All Agents

Every agent decision must log a `DecisionEvent` to DynamoDB `agent-decision-log`
before acting. Oracle reads these at evaluation windows (24h / 7d / 30d).

```typescript
interface DecisionEvent {
  eventId: string;              // UUID — PK
  agentId: string;              // "harvy" | "zeus" | "rex" | "regum" | "qeon" | ...
  decisionType: string;         // e.g. "SCALE_CAMPAIGN" | "GREENLIGHT_TOPIC" | "PAUSE_AD"
  hypothesis: string;           // one sentence: what the agent expected to happen
  confidence: number;           // 0–1: agent's stated confidence at decision time
  expectedKPIImpact: {
    metric: string;             // e.g. "subscriberCPA" | "viewRetention" | "ROAS"
    expectedDelta: number;      // e.g. +0.15 (15% improvement expected)
  };
  spendOrComputeCost: number;   // USD — ad spend, Lambda compute, or EC2 cost
  timestamp: string;            // ISO — when decision was made
  contextSnapshot: Record<string, unknown>; // key input signals at decision time

  // Filled in by Oracle at evaluation windows
  outcomes: {
    at24h: OutcomeRecord | null;
    at7d:  OutcomeRecord | null;
    at30d: OutcomeRecord | null;
  };
  evaluationLabel: "correct" | "partially_correct" | "incorrect" | "pending";
}

interface OutcomeRecord {
  actualKPIDelta: number;       // what actually happened
  evaluatedAt: string;          // ISO timestamp
  evaluatorNote: string;        // Oracle one-line explanation
}
```

`agent-decision-log` DynamoDB table:
- PK: `eventId`
- GSI 1: `agentId-timestamp` — Oracle queries per agent per window
- GSI 2: `decisionType-timestamp` — cross-agent decision type analysis
- TTL: 90 days

---

### Agent-Specific Metric Overlays

These are evaluated IN ADDITION to the universal formula. They do not replace
any component — they are surfaced as supplementary signals in Zeus's briefing.

```typescript
const AGENT_METRIC_OVERLAYS: Record<string, string[]> = {
  zeus:   ["arbitration_win_rate", "false_escalation_rate", "portfolio_roi_lift"],
  harvy:  ["incremental_roi", "cost_per_qualified_watch_hour",
           "cost_per_incremental_subscriber", "scale_decision_precision",
           "pause_decision_precision", "budget_pacing_accuracy", "downside_prevented"],
  oracle: [], // Oracle uses its own self-score (see below)
  rex:    ["trend_hit_rate", "false_positive_rate", "lead_time_before_peak",
           "topic_maturity_prediction_error", "greenlight_downstream_success"],
  regum:  ["brief_to_performance_lift", "slot_efficiency",
           "pivot_success_rate", "strategy_reversal_regret", "niche_allocation_efficiency"],
  qeon:   ["completion_rate", "on_time_delivery_rate",
           "step_retry_rate", "defect_escape_rate", "throughput_per_cycle"],
  muse:   ["hook_retention_lift", "retention_stability_mid_video",
           "script_contribution_to_ctr", "blueprint_adherence",
           "council_pass_without_major_rework"],
  vera:   ["detection_precision", "detection_recall", "false_block_rate",
           "post_release_quality_incidents", "qa_turnaround_time"],
  theo:   ["title_thumbnail_test_lift", "community_sentiment_shift",
           "comment_handling_quality", "recommendation_hit_rate",
           "engagement_to_retention_lift"],
  aria:   ["theme_allocation_return", "drift_alert_correctness",
           "rebalance_effectiveness", "evidence_log_accuracy",
           "risk_adjusted_portfolio_performance"],
  sniper: ["geo_lift_vs_baseline", "market_selection_precision",
           "cpm_efficiency_by_market", "localization_lift", "expansion_success_rate"],
  tony:   ["asset_acceptance_rate", "render_success_rate", "re_render_rate",
           "render_efficiency", "asset_level_performance_lift"],
  jason:  ["blocker_resolution_time", "workflow_sla_adherence",
           "dependency_delay_reduction", "planning_predictability",
           "coordination_overhead_efficiency"],
};
```

---

### Oracle Self-Score — Deterministic Formula

Oracle does not use another agent to evaluate itself. Hard-coded 6-component
formula. Computed weekly during the Sunday WEEKLY_PORTFOLIO run.

```typescript
interface OracleSelfScore {
  // Component 1: Precision of Updates (30%)
  // useful_updates / total_updates
  // Useful = update led to positive KPI movement at 7d or 30d window
  updatePrecision: number;        // 0–1

  // Component 2: False Alarm Rate (20%)
  // bad_updates / total_updates
  // Bad = no impact or negative impact after adoption
  falseAlarmRate: number;         // 0–1 (lower is better — inverted before weighting)

  // Component 3: Freshness (15%)
  // Average age of evidence used in updates (days). Newer = higher score.
  // score = max(0, 1 - (avgEvidenceAgeDays / 30))
  evidenceFreshness: number;      // 0–1

  // Component 4: Evidence Quality (15%)
  // Weighted source trust score × cross-source confirmation count
  evidenceQuality: number;        // 0–1

  // Component 5: Calibration (10%)
  // |predicted_confidence - actual_hit_rate| across all recommendations
  // score = 1 - avg(abs(confidence - hit_rate))
  calibrationScore: number;       // 0–1

  // Component 6: Actionability (10%)
  // % of updates with clear agent instruction + measurable expected KPI impact
  actionabilityScore: number;     // 0–1

  // Final composite (all components normalised to 0–100 before weighting)
  compositeScore: number;         // 0–100
  trustBand: "HIGH_TRUST" | "MED_TRUST" | "LOW_TRUST" | "RESTRICTED";
  evaluatedAt: string;
  penaltiesApplied: Array<{ reason: string; points: number }>;
}

function computeOracleSelfScore(metrics: OracleSelfScore): number {
  const precision    = metrics.updatePrecision * 100;
  const falseAlarm   = (1 - metrics.falseAlarmRate) * 100; // inverted
  const freshness    = metrics.evidenceFreshness * 100;
  const quality      = metrics.evidenceQuality * 100;
  const calibration  = metrics.calibrationScore * 100;
  const actionable   = metrics.actionabilityScore * 100;

  const raw =
    0.30 * precision  +
    0.20 * falseAlarm +
    0.15 * freshness  +
    0.15 * quality    +
    0.10 * calibration +
    0.10 * actionable;

  const totalPenalty = metrics.penaltiesApplied.reduce(
    (sum, p) => sum + Math.abs(p.points), 0
  );
  return Math.max(0, Math.round(raw - totalPenalty));
}
```

---

### Evaluation Windows

```
24h   Operational reliability and early quality signals only.
      Weight: 0.15 — high noise, directional only.
      Use for: step failures, timeout rates, defect escapes.

7d    Primary performance truth window.
      Weight: 0.50 — primary evaluation for all agents.
      Use for: decision accuracy, KPI impact, calibration.

30d   Durability, decay, and strategic correctness.
      Weight: 0.35 — trend confirmation.
      Use for: cohort quality, channel growth attribution, strategy reversal regret.
```

---

### Harvy-Specific Evaluation

Oracle treats Harvy as a first-class learning target. In addition to the
universal score formula, Oracle tracks Harvy's recommendation accuracy over
rolling 20-decision windows and feeds findings back via the calibration loop
already defined in `skills/harvy/SKILL.md`.

```typescript
interface HarvyAuditRecord {
  // Written by Oracle at 7d evaluation window
  windowStart: string;
  windowEnd: string;
  totalRecommendations: number;
  scaleDecisions:    { made: number; correct: number; precision: number };
  pauseDecisions:    { made: number; correct: number; precision: number };
  holdDecisions:     { made: number; correct: number; precision: number };
  avgConfidenceError: number;   // abs(predictedROAS - actualROAS) / predictedROAS
  downsidePrevented: number;    // USD: campaigns correctly paused before loss
  falseNegativeCost: number;    // USD: campaigns Harvy held that would have scaled positively

  // Oracle verdict
  oracleVerdict: "CALIBRATED" | "OVERCONFIDENT" | "UNDERCONFIDENT" | "REVIEW";
  verdictReason: string;
  recommendedConfidenceAdjustment: number; // e.g. -0.10 if overconfident
}
```

Harvy guardrails Oracle enforces (non-negotiable — Oracle flags, Zeus acts):
```
1. Never violate account safety caps (policy MIN_ACCOUNT_BALANCE)
2. No SCALE without minimum data confidence (policy SCALE_MIN_IMPRESSIONS)
3. Automatic pause flag on hard-loss conditions (ROAS < 1.0)
4. SCALE only when quality metrics AND incrementality are both positive
5. Any high-confidence wrong call (confidence > 0.80, label = "incorrect") →
   Oracle writes HARVY_CALIBRATION_PENALTY to agent-policies immediately
```

---

### Governance Workflow — Weekly Cycle

```
Sunday (WEEKLY_PORTFOLIO run):
  Step 1  Oracle computes AgentScore for all 13 agents from agent-decision-log
  Step 2  Oracle computes OracleSelfScore
  Step 3  Oracle writes scorecards to agent-scores DynamoDB table
          (existing table — new columns: oracleScore, trustBand, evaluationWindow)
  Step 4  Oracle generates evidence-backed recommendations for any agent < 70
  Step 5  Oracle routes recommendations to Zeus via zeus-briefs table

Monday morning briefing (THE LINE → Zeus):
  Zeus reviews scorecards and Oracle recommendations
  Zeus approves or rejects trust-band changes
  Zeus injects updated guidance into target agents via morning briefing payload
  Agent receives updated policy at next run start (reads agent-policies table)

Next Sunday:
  Oracle re-measures — did Zeus's injection improve the agent's score?
  Cycle compounds.
```

---

### New DynamoDB Table: `agent-decision-log`

```
PK:  eventId     (String)
SK:  agentId     (String)
GSI 1: agentId-timestamp      — Oracle queries per agent per evaluation window
GSI 2: decisionType-timestamp — cross-agent decision type analysis
TTL: expiresAt (90 days)
```

Add `agent-decision-log` to CLAUDE.md DynamoDB tables list.

---

### Oracle Evaluation — Implementation Checklist

```
[ ] Create lib/oracle/evaluation/types.ts
    — DecisionEvent, OutcomeRecord, AgentScoreCard, OracleSelfScore,
      HarvyAuditRecord, AgentMetricOverlay

[ ] Create lib/oracle/evaluation/score-formula.ts
    — computeAgentScore()         universal formula, all agents
    — computeOracleSelfScore()    deterministic self-evaluation
    — applyPenalties()            ORACLE_PENALTIES constants
    — assignTrustBand()           hard-coded band thresholds

[ ] Create lib/oracle/evaluation/decision-log-db.ts
    — writeDecisionEvent(event: DecisionEvent)
    — getDecisionEvents(agentId, windowDays): DecisionEvent[]
    — updateOutcome(eventId, window, outcome: OutcomeRecord)
    — getPendingEvaluations(agentId): DecisionEvent[]

[ ] Create lib/oracle/evaluation/harvy-audit.ts
    — runHarvyAudit(windowDays: 7): HarvyAuditRecord
    — applyHarvyCalibrationPenalty(adjustment: number)
    — writeHarvyAuditRecord(record: HarvyAuditRecord)

[ ] Create lib/oracle/evaluation/agent-scorecard.ts
    — computeAllAgentScores(): AgentScoreCard[]
    — writeScorecardsToAgentScores(cards: AgentScoreCard[])
    — generateZeusRecommendations(cards: AgentScoreCard[]): string[]

[ ] Wire into WEEKLY_PORTFOLIO step in zeusAnalyticsWorkflow
    — after harvy-weekly-portfolio step
    — step.run("oracle-evaluation") → computeAllAgentScores()
    — step.run("oracle-self-score") → computeOracleSelfScore()
    — step.run("oracle-zeus-brief") → writeOracleScoresBrief() → zeus-briefs

[ ] Every existing agent decision point must emit writeDecisionEvent()
    — Harvy: before every SCALE/PAUSE/HOLD/SKIP recommendation
    — Zeus: before arbitration decisions and campaign actions
    — Rex: before every GREENLIGHT
    — Regum: before every QeonBrief generation
    — Qeon: before pipeline launch
    — Vera: before every QA verdict
    — (other agents: add as they are built)

[ ] Create agent-decision-log DynamoDB table (PK, SK, 2× GSI, TTL)
[ ] Add agent-decision-log to CLAUDE.md DynamoDB table list

[ ] Test: Harvy SCALE → writeDecisionEvent → 7d outcome → Oracle audit
[ ] Test: OracleSelfScore with mock 10 updates → correct composite computed
[ ] Test: Trust band written to agent-policies after Sunday evaluation
[ ] Test: Penalty applied when Harvy confidence > 0.80 + label = "incorrect"
[ ] Test: Zeus receives scorecard brief in Monday morning briefing payload
[ ] Verify: No agent score logic in campaign-control.ts or budget-guard.ts
[ ] Verify: Oracle never calls campaign-control.ts or budget-guard.ts

---

## Domain 14 — Agent Version Control + Evaluation Policy

### Purpose

Every agent in the RRQ system evolves over time — new Oracle guidance injections,
prompt refinements, policy threshold changes. Without version control, there is no
way to know which version of an agent produced a given decision, no way to compare
before vs after a change, and no safe path to roll back when performance degrades.

Domain 14 gives Oracle the authority to track every agent version, evaluate
performance over a 7-day window, and recommend promotion or rollback to Zeus.
Zeus approves all version state changes. Oracle recommends. Zeus acts.

**This domain never touches campaign-control.ts or budget-guard.ts.**

---

### Version Control Model

DynamoDB-only. No external repository required.

Two tables handle the full version lifecycle:

**`agent-version-registry`** — the manifest store (one record per version per agent)
```
PK: agentId
SK: version  (e.g. "1.3.0")
Fields:
  status              "pending" | "active" | "stable" | "rolled_back" | "archived"
  changeType          "PROMPT_UPDATE" | "PACKAGE_UPDATE" | "POLICY_UPDATE" | "MODEL_UPDATE"
  parentVersion       previous version this was bumped from
  activationTimestamp ISO timestamp when version went active
  rollbackTo          version to revert to if rollback triggered
  sourceUpdateId      Oracle update reference (oracle-updates table PK) — optional
  changeNotes         plain English description of what changed
  canaryShape         "TOPIC_SAMPLE" | "JOB_SAMPLE" | "EVENT_SAMPLE" (agent category)
  oracleVerdict       "PROMOTE" | "HOLD" | "ROLLBACK_REQUIRED" | "pending"
  verdictAt           ISO timestamp of Oracle's verdict
  zeusApproved        boolean — Zeus must confirm before status transitions
  zeusApprovedAt      ISO timestamp of Zeus approval

GSI: status-activationTimestamp
  — Oracle queries all ACTIVE versions on evaluation day
  — Zeus queries all PROMOTE_READY versions on Monday briefing
```

**`agent-policies`** (existing table) — the runtime pointer
```
agentId + "active_version"  → "1.3.0"
agentId + "prev_version"    → "1.2.0"  (kept for fast rollback reference)
```

Agents read `active_version` from `agent-policies` at job start.
Oracle writes version records to `agent-version-registry`.
Zeus approves transitions by updating `agent-policies`.

---

### Prompt + Policy Snapshot Storage

Every version bump writes a snapshot to S3 before the new version activates:

```
s3://rrq-memory/agent-versions/{agentId}/{version}/system-prompt.txt
s3://rrq-memory/agent-versions/{agentId}/{version}/policy-snapshot.json
```

**Rollback = two operations:**
1. Write `active_version` → previous stable version in `agent-policies`
2. Agent reads `system-prompt.txt` from S3 at that version on next run

No Lambda redeploy. No infrastructure change. Pointer swap only.

---

### Version Naming

Semantic versioning per agent: `tony@1.3.0`, `harvy@1.0.0`, `zeus@2.1.4`

```
MAJOR  behavior or policy changes that alter how the agent makes decisions
MINOR  new capabilities, new strategy packages, new output fields
PATCH  Oracle-injected guidance updates, threshold tuning, stability fixes
```

**Version bump triggers:**
- Every Oracle guidance injection automatically creates a new PATCH version.
  Oracle is the primary versioning engine. No manual action required.
- Manual prompt edits require an explicit version bump by the user.
- Policy threshold changes written by Oracle to `agent-policies` trigger a PATCH bump.
- User-initiated policy changes (via frontend) trigger a PATCH bump with `source: USER`.

---

### Evaluation Flow — Oracle Decides, Zeus Acts

No canary traffic splitting. New version goes fully active immediately.

```
Step 1 — Version activates
  Oracle writes new record to agent-version-registry (status: active)
  agent-policies active_version updated
  All new DecisionEvents tagged with new agentVersion

Step 2 — 7-day collection window
  Oracle collects all DecisionEvents for this agent at new version
  Outcomes filled at 24h / 7d windows per existing Domain 13 protocol
  Oracle does NOT evaluate until minimum 7 days of data exist

Step 3 — Day 7: Oracle version comparison
  Oracle queries agent-decision-log:
    version = new  (last 7 days)
    version = prev stable  (prior 7-day equivalent window)
  Computes AgentScore for each version using universal formula (Domain 13)
  Compares: primary KPI lift, decision accuracy, reliability, cost efficiency,
            quality regression, latency impact, policy violations, confidence calibration

Step 4 — Oracle emits verdict
  PROMOTE           new version outperforms or matches stable on primary KPI
                    + no regression on reliability or quality
  HOLD              inconclusive — run another 7 days, re-evaluate
  ROLLBACK_REQUIRED hard regression detected (see rollback rules below)

Step 5 — Zeus approves
  Oracle verdict written to agent-version-registry + zeus-briefs Monday payload
  Zeus reviews → approves or overrides
  On approval: agent-policies active_version updated (PROMOTE) or reverted (ROLLBACK)
  agent-version-registry status updated: stable | rolled_back

Step 6 — Post-rollback lock
  Rolled-back version cannot be re-promoted for 7 days from rollback timestamp
  Prevents promote → rollback → promote thrashing on noisy windows
```

---

### Hard Rollback Rules (Oracle triggers automatically, Zeus confirms)

Oracle emits `ROLLBACK_REQUIRED` if any single condition is met:

```
1. Critical policy or safety violation detected in DecisionEvents
2. Failure / retry / timeout rate increased > 30% vs previous stable version
3. Primary KPI dropped below threshold for the full 7-day window
   (not a single day dip — the weighted 7d window must be negative)
4. Cost increased significantly while primary KPI also declined
5. Quality regression: defect escape rate or rework rate increased > 25%
```

### Soft Rollback Rules (Zeus approval required, Oracle recommends)

```
1. Primary KPI flat but latency or cost worsened > 20%
2. Mixed segment performance — some agent contexts improved, others degraded
3. Confidence calibration degraded without hard violations
```

---

### `agentVersion` on DecisionEvent — Mandatory

`agentVersion: string` is a required field on every `DecisionEvent`.
This is the backbone of version isolation. Without it, Oracle cannot run
before/after comparison — the entire version evaluation system breaks.

**Enforcement rules:**
- `agentVersion` must be written on 100% of DecisionEvents — never optional
- Agents read `active_version` from `agent-policies` at job start and pass it
  through to every `writeDecisionEvent()` call in that run
- DecisionEvents missing `agentVersion` are flagged as INCOMPLETE and excluded
  from version comparison queries — they do not count toward evaluation windows
- Domain 14 is not considered active until `agentVersion` coverage reaches 100%

**What this enables:**
- Pure A/B comparison: v1.2.0 decisions vs v1.3.0 decisions on identical context types
- Automatic regression detection — no extra tooling needed, just query by version
- Calibration drift visible per version over time, not just per agent
- Historical audit: any decision traceable to the exact agent version that made it

---

### Oracle Self-Versioning Exception

Oracle cannot evaluate its own evaluation logic changes — circular dependency.

**Oracle version changes follow a different gate:**
- New Oracle version runs in **shadow mode** for 14 days
- Shadow mode: new version computes scores in parallel but does not write them
- Zeus manually compares new Oracle version outputs vs current Oracle outputs
  on the same set of past decisions (last 30 days)
- No automated promotion — Zeus gates all Oracle version changes
- Promotion requires Zeus explicit approval with written rationale
- Shadow outputs stored at: `s3://rrq-memory/agent-versions/oracle/{version}/shadow-outputs/`

This is the one hard exception to the standard Domain 14 evaluation flow.
It must be documented at the call site in `lib/oracle/versioning/version-evaluator.ts`.

---

### Tier 1 vs Tier 2 Metric Separation

**Tier 1 — Hard-coded. Never user-modifiable. Never change without a code deploy.**

```typescript
// These values are constants in score-formula.ts
// Changing them makes all historical scores incomparable — never do this at runtime
const SCORE_WEIGHTS = {
  outcomeLift:       0.30,
  decisionAccuracy:  0.20,
  calibration:       0.15,
  efficiency:        0.15,
  reliability:       0.10,
  compliance:        0.10,
} as const;

const TRUST_BANDS = {
  HIGH_TRUST:  { min: 85, max: 100 },
  MED_TRUST:   { min: 70, max: 84  },
  LOW_TRUST:   { min: 50, max: 69  },
  RESTRICTED:  { min: 0,  max: 49  },
} as const;

const ORACLE_PENALTIES = {
  CRITICAL_BAD_RECOMMENDATION: -10,
  THREE_LOW_IMPACT_IN_A_ROW:    -5,
  MISSING_EVIDENCE_FIELDS:       -3,
  DEPRECATED_GUIDANCE_LATE:      -5,
} as const;
```

**Tier 2 — User-configurable. Stored in `agent-policies`. Source: USER or ORACLE.**

```
Promotion threshold          min_kpi_lift_pct         default: 3%
Rollback trigger             max_failure_rate_delta   default: 30%
Evaluation window length     eval_window_days         default: 7
Hard rollback KPI floor      min_primary_kpi_lift     default: -5%
Latency regression limit     max_latency_delta_pct    default: 20%
Cost regression limit        max_cost_delta_pct       default: 15%
Agent-specific KPI weights   {agentId}_kpi_weights    per-agent overlay
```

Oracle reads Tier 2 values from `agent-policies` at evaluation time.
User updates via frontend → `agent-policies` write → Oracle picks up on next run.
No redeploy needed. Every Tier 2 change tagged `source: USER` in `agent-policies`.

---

### Policy Control Surface — Frontend Spec

The analytics page (future phase) exposes Tier 2 controls to the user.
This is a high-sensitivity surface. The following rules govern it completely.

#### What Users CAN Do
- Adjust existing Tier 2 metric thresholds
- Add new performance metrics (observer mode — see below)
- Modify agent-specific KPI overlay weights

#### What Users CANNOT Do
- Delete any metric — archive only (historical scores must remain comparable)
- Modify Tier 1 formula weights, penalty constants, or trust band thresholds
- Bypass Oracle's mandatory impact preview before a change takes effect
- Make any change take effect immediately — all changes go through preview first

#### Mandatory Change Flow (Every Change, No Exceptions)

```
1. User proposes a change or adds a new metric

2. Oracle runs impact simulation immediately
   — Reruns last 30 days of agent-decision-log decisions with proposed change applied
   — Computes: how many decisions would have been scored differently
   — Computes: direction and magnitude of change per affected agent

3. Oracle produces plain English impact summary
   — No architecture revealed. No table names. No formula weights shown.
   — Summary format:
     "This change would have affected X decisions across Y agents in the last 30 days.
      Agent performance scores would have [increased / decreased / been unchanged] on average.
      The most affected agent is [agentName]: [+/- N points] on average."

4. Three-level warning displayed based on impact magnitude:

   ADVISORY    minor threshold adjustment, low predicted impact
     "Lowering Tony's render success threshold from 95% to 90% means Oracle will
      tolerate more render failures before flagging a version rollback.
      Last 30 days: this would have affected 2 decisions."

   CAUTION     adding a new metric or changing a primary KPI weight
     "Adding a new metric shifts how Oracle scores every agent going forward.
      Historical scores before this date will not be recalculated.
      This affects 9 agents."

   HIGH IMPACT changing evaluation window length, rollback triggers, or promotion thresholds
     "Extending the evaluation window from 7 to 14 days means agent versions run
      twice as long before Oracle can recommend rollback. If a bad version deploys,
      it runs longer before being caught."

5. User must explicitly confirm:
   "I understand this affects [N] agents and [describe impact]"
   Checkbox confirmation required — not just a button click.

6. Change written to agent-policies with source: USER

7. Audit log entry created in agent-policy-audit-log:
   { userId, changeType, previousValue, newValue, oraclePrediction, confirmedAt }

8. Oracle version of this guidance auto-bumped (PATCH) for affected agents
```

#### "With Power Comes Responsibility" Gate

Shown on first access to the policy control page AND on every HIGH IMPACT change:

```
Before you continue

The metrics on this page directly control how your AI agents
are evaluated, promoted, and rolled back.

A wrong threshold means:
  — A poorly performing agent version stays active longer
  — A well-performing update gets rolled back unnecessarily
  — Your channel's growth decisions are measured against the wrong standard

Oracle will always show you the predicted impact before any change takes effect.
Deletions are not permitted — metrics can only be archived.
Every change is logged and can be reviewed at any time.

You are responsible for this channel's performance.
The system is designed to help you — not to protect you from yourself.

[ I understand — continue ]
```

This gate cannot be bypassed. `[ I understand — continue ]` is the only path forward.
The gate re-appears on every HIGH IMPACT change regardless of prior acknowledgements.

#### New Metric Observer Mode

New user-defined metrics do not score agents immediately. They enter observer mode.

```
Observer mode rules:
  — Weight: 0 (logged but not included in AgentScore calculation)
  — Runs for minimum 14 days collecting signal against live decisions
  — Oracle evaluates at day 14: is this metric producing meaningful, non-redundant signal?
  — If meaningful: Oracle notifies Zeus + user that metric is ready to promote to active
  — User confirms promotion + sets weight (guided: suggested weight from Oracle)
  — If not meaningful: Oracle flags as LOW_SIGNAL, user advised to refine or archive

Why observer mode exists:
  A poorly defined metric promoted immediately distorts every agent's score
  from day one. Observer mode ensures the metric proves itself before it votes.
  This is the same proving-window logic used for new agent versions.
```

#### What Is Shown vs Hidden on the Frontend

**Always shown to user:**
- Metric name and plain English description of what it measures
- Which agents it affects
- Predicted impact on last 30 days (simulated, not actual production change)
- Current value and who last changed it (USER or ORACLE) and when
- Warning level for the proposed change
- Observer mode status and day count for new metrics

**Never shown to user:**
- Tier 1 formula weights or penalty constants
- Agent architecture, prompt structure, or system design
- DynamoDB table names or S3 paths
- Oracle's internal evaluation methodology
- Raw DecisionEvent data or agent-decision-log contents
- Any field with `source: HARDCODED` in agent-policies

---

### New DynamoDB Tables

**`agent-version-registry`**
```
PK: agentId (String)
SK: version (String)
GSI: status-activationTimestamp
  — Oracle queries ACTIVE versions on evaluation day
  — Zeus queries PROMOTE_READY on Monday briefing
TTL: none (version history kept permanently)
Fields: all manifest fields listed in Version Control Model section above
```

**`agent-policy-audit-log`**
```
PK: changeId (String — UUID)
SK: changedAt (String — ISO timestamp)
GSI: agentId-changedAt — query all policy changes for a given agent
TTL: 365 days
Fields:
  userId              Clerk userId of who made the change
  agentId             which agent's policy was changed (or "global")
  policyKey           which key in agent-policies was modified
  previousValue       value before change
  newValue            value after change
  source              "USER" | "ORACLE"
  warningLevel        "ADVISORY" | "CAUTION" | "HIGH_IMPACT"
  oraclePrediction    plain English impact summary Oracle showed the user
  userConfirmed       boolean — did user pass the gate
  confirmedAt         ISO timestamp of confirmation
```

---

### lib/oracle/versioning/ — Files to Create

```
lib/oracle/versioning/
  types.ts                  AgentVersionManifest, VersionVerdict, PolicyAuditEntry,
                            VersionComparisonResult, MetricObserverRecord interfaces
  version-registry-db.ts   writeVersionManifest(), getActiveVersion(),
                            updateVersionStatus(), getVersionHistory()
  prompt-snapshot.ts        writePromptSnapshot(), readPromptSnapshot(),
                            writePolicySnapshot(), readPolicySnapshot()
  version-evaluator.ts      evaluateVersionPerformance(), compareVersions(),
                            emitVersionVerdict(), isOracleVersionException()
  policy-audit-db.ts        writePolicyAuditEntry(), getPolicyAuditHistory(),
                            getRecentUserChanges()
  observer-mode.ts          registerObserverMetric(), evaluateObserverSignal(),
                            promoteObserverMetric()
```

---

### Implementation Checklist

[ ] Create agent-version-registry DynamoDB table (PK, SK, GSI, no TTL)
[ ] Create agent-policy-audit-log DynamoDB table (PK, SK, GSI, 365d TTL)
[ ] Add agent-version-registry and agent-policy-audit-log to CLAUDE.md
[ ] Add agentVersion field to DecisionEvent interface in lib/oracle/evaluation/types.ts
[ ] Add active_version read to agent-policies at job start for every agent
[ ] Create lib/oracle/versioning/types.ts — all interfaces
[ ] Create lib/oracle/versioning/version-registry-db.ts — CRUD helpers
[ ] Create lib/oracle/versioning/prompt-snapshot.ts — S3 read/write
[ ] Create lib/oracle/versioning/version-evaluator.ts — comparison + verdict logic
[ ] Create lib/oracle/versioning/policy-audit-db.ts — audit log helpers
[ ] Create lib/oracle/versioning/observer-mode.ts — new metric proving window
[ ] Auto-bump PATCH version on every Oracle guidance injection
[ ] Wire version verdict into zeus-briefs Monday briefing payload
[ ] Wire post-rollback 7-day re-promotion lock
[ ] Oracle shadow mode logic for Oracle's own version changes
[ ] Add s3://rrq-memory/agent-versions/ path to CLAUDE.md S3 paths
[ ] Test: new version activates → 7d window → PROMOTE verdict → Zeus approves
[ ] Test: hard regression → ROLLBACK_REQUIRED → Zeus approves → active_version reverted
[ ] Test: rolled-back version blocked from re-promotion for 7 days
[ ] Test: Oracle version change → shadow mode fires, not standard evaluation
[ ] Test: agentVersion missing on DecisionEvent → flagged INCOMPLETE, excluded from comparison
[ ] Test: observer metric at day 14 → Oracle evaluates signal → promotes or flags LOW_SIGNAL
[ ] Test: HIGH_IMPACT policy change → gate shown → audit log entry written
[ ] Test: Tier 1 constant read attempt from frontend → blocked, not exposed
[ ] Verify: agentVersion coverage 100% before Domain 14 considered active
[ ] Verify: no version state changes in agent-policies without Zeus zeusApproved flag
```

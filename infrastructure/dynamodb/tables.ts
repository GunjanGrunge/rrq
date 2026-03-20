// infrastructure/dynamodb/tables.ts
// Complete DynamoDB table definitions for RRQ Phase 5.
// Used as reference for provisioning (create-tables.ts) and as runtime config.
// All tables use PAY_PER_REQUEST billing (on-demand).

export interface DynamoTableConfig {
  tableName: string;
  partitionKey: { name: string; type: "S" | "N" | "B" };
  sortKey?: { name: string; type: "S" | "N" | "B" };
  gsi?: Array<{
    indexName: string;
    partitionKey: { name: string; type: "S" | "N" | "B" };
    sortKey?: { name: string; type: "S" | "N" | "B" };
    projectionType: "ALL" | "KEYS_ONLY" | "INCLUDE";
  }>;
  ttlAttribute?: string;
  /** true = DynamoDB Streams enabled — needed for Inngest triggers */
  streamEnabled?: boolean;
  billingMode: "PAY_PER_REQUEST";
  description: string;
}

export const DYNAMO_TABLES: DynamoTableConfig[] = [
  // ─── Agent scoring + performance ─────────────────────────────────────────
  {
    tableName: "agent-scores",
    partitionKey: { name: "agentId", type: "S" },
    sortKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Points, trends, wins, errors per agent per day",
  },

  // ─── Channel analytics ────────────────────────────────────────────────────
  {
    tableName: "channel-health",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Daily YouTube analytics snapshots per channel",
  },

  // ─── Video episodic memory ────────────────────────────────────────────────
  {
    tableName: "video-memory",
    partitionKey: { name: "videoId", type: "S" },
    sortKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per-video performance metrics and Zeus lesson flags",
  },

  // ─── Rex watchlist ────────────────────────────────────────────────────────
  {
    tableName: "rex-watchlist",
    partitionKey: { name: "topicId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Rex monitored topics with confidence score history",
  },

  // ─── Regum upload schedule ────────────────────────────────────────────────
  {
    tableName: "regum-schedule",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "scheduledAt", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Regum upload calendar with time slots",
  },

  // ─── Production jobs (Qeon 13-step state machine) ─────────────────────────
  {
    tableName: "production-jobs",
    partitionKey: { name: "jobId", type: "S" },
    streamEnabled: true,
    billingMode: "PAY_PER_REQUEST",
    description: "Qeon 13-step job state machine — stream triggers Inngest qeonWorkflow",
  },

  // ─── Manual pipeline user sessions ───────────────────────────────────────
  {
    tableName: "pipeline-state",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "jobId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Manual pipeline user session state",
  },

  // ─── ElevenLabs usage tracking ───────────────────────────────────────────
  {
    tableName: "elevenlabs-usage",
    partitionKey: { name: "accountId", type: "S" },
    sortKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per-account character usage tracking for ElevenLabs rotation",
  },

  // ─── YouTube OAuth tokens ─────────────────────────────────────────────────
  {
    tableName: "user-tokens",
    partitionKey: { name: "userId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "YouTube OAuth tokens — PK = Clerk userId",
  },

  // ─── User preferences ─────────────────────────────────────────────────────
  {
    tableName: "user-settings",
    partitionKey: { name: "userId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Quality threshold, voice prefs — PK = Clerk userId",
  },

  // ─── Google Ads insights ──────────────────────────────────────────────────
  {
    tableName: "ad-insights",
    partitionKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Zeus daily ad review — partition key: date",
  },

  // ─── Ad campaigns ─────────────────────────────────────────────────────────
  {
    tableName: "ad-campaigns",
    partitionKey: { name: "campaignId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "One record per campaign — videoId, budget, status, performance",
  },

  // ─── Inter-agent message bus ──────────────────────────────────────────────
  {
    tableName: "agent-messages",
    partitionKey: { name: "messageId", type: "S" },
    sortKey: { name: "recipientAgent", type: "S" },
    gsi: [
      {
        indexName: "recipientAgent-createdAt-index",
        partitionKey: { name: "recipientAgent", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "Inter-agent message bus — Zeus routes all messages",
  },

  // ─── Channel milestones ───────────────────────────────────────────────────
  {
    tableName: "channel-milestones",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "milestoneId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Tracks subscriber/watch-hour milestone hits",
  },

  // ─── ARIA portfolio ───────────────────────────────────────────────────────
  {
    tableName: "aria-portfolio",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "weekId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "ARIA weekly portfolio state + drift tracking",
  },

  // ─── Evidence log ─────────────────────────────────────────────────────────
  {
    tableName: "evidence-log",
    partitionKey: { name: "evidenceId", type: "S" },
    sortKey: { name: "timestamp", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Every ARIA decision with signal snapshot + outcome",
  },

  // ─── Signal cache ─────────────────────────────────────────────────────────
  {
    tableName: "signal-cache",
    partitionKey: { name: "signalId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Rex harvested signals — 30min TTL",
  },

  // ─── Topic queue ──────────────────────────────────────────────────────────
  {
    tableName: "topic-queue",
    partitionKey: { name: "topicId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Held topics awaiting re-evaluation",
  },

  // ─── Rex source weights ───────────────────────────────────────────────────
  {
    tableName: "source_weights",
    partitionKey: { name: "sourceId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Rex signal scoring — per source avg confidence × clip performance",
  },

  // ─── Rex topic dedup ──────────────────────────────────────────────────────
  {
    tableName: "topic_history",
    partitionKey: { name: "topicId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Rex dedup store — 72h cooldown TTL, prevents re-generating same topic",
  },

  // ─── Niche profiles ───────────────────────────────────────────────────────
  {
    tableName: "niche_profiles",
    partitionKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per channel: seed keywords, subreddit list, TikTok hashtags, embedding key",
  },

  // ─── RRQ trigger state ────────────────────────────────────────────────────
  {
    tableName: "rrq_state",
    partitionKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "RRQ trigger mode, last run time, queue depth, source rotation index",
  },

  // ─── Channel settings ─────────────────────────────────────────────────────
  {
    tableName: "channel-settings",
    partitionKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "channelMode (OPEN/NICHE_LOCKED/MULTI_NICHE) + niche theme mappings",
  },

  // ─── Geo strategies ───────────────────────────────────────────────────────
  {
    tableName: "geo-strategies",
    partitionKey: { name: "topicId", type: "S" },
    sortKey: { name: "marketId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "SNIPER analysis per topic — market plans + ad plans",
  },

  // ─── Market performance ───────────────────────────────────────────────────
  {
    tableName: "market-performance",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "weekId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Zeus weekly per-market campaign results",
  },

  // ─── Oracle research updates ──────────────────────────────────────────────
  {
    tableName: "oracle-updates",
    partitionKey: { name: "updateId", type: "S" },
    sortKey: { name: "domain", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "ORACLE research run results + agent injection tracking",
  },

  // ─── Oracle knowledge index ───────────────────────────────────────────────
  {
    tableName: "oracle-knowledge-index",
    partitionKey: { name: "domain", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per-domain last updated + S3 + Bedrock sync status",
  },

  // ─── Zeus briefs ──────────────────────────────────────────────────────────
  {
    tableName: "zeus-briefs",
    partitionKey: { name: "briefId", type: "S" },
    sortKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "THE LINE morning briefs + Zeus responses",
  },

  // ─── The Line log ─────────────────────────────────────────────────────────
  {
    tableName: "the-line-log",
    partitionKey: { name: "runId", type: "S" },
    sortKey: { name: "timestamp", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per-run message routing audit for The Line synthesis layer",
  },

  // ─── Theo — comment actions ───────────────────────────────────────────────
  {
    tableName: "theo-comment-actions",
    partitionKey: { name: "videoId", type: "S" },
    sortKey: { name: "commentId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Per-video comment triage actions taken by Theo",
  },

  // ─── Theo — A/B tests ─────────────────────────────────────────────────────
  {
    tableName: "theo-ab-tests",
    partitionKey: { name: "videoId", type: "S" },
    sortKey: { name: "testId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Title/thumbnail A/B test lifecycle managed by Theo",
  },

  // ─── Theo — community posts ───────────────────────────────────────────────
  {
    tableName: "theo-community-posts",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "postId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Community post history managed by Theo",
  },

  // ─── Theo — weekly reports ────────────────────────────────────────────────
  {
    tableName: "theo-weekly-reports",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "weekId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Theo Sunday synthesis reports",
  },

  // ─── Jason — sprints ──────────────────────────────────────────────────────
  {
    tableName: "jason-sprints",
    partitionKey: { name: "sprintId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Sprint plans per phase managed by Jason",
  },

  // ─── Jason — tasks (kanban) ───────────────────────────────────────────────
  {
    tableName: "jason-tasks",
    partitionKey: { name: "taskId", type: "S" },
    sortKey: { name: "sprintId", type: "S" },
    gsi: [
      {
        indexName: "sprintId-status-index",
        partitionKey: { name: "sprintId", type: "S" },
        sortKey: { name: "status", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "Kanban task tracking — GSI enables query by sprint + status",
  },

  // ─── Jason — standups ─────────────────────────────────────────────────────
  {
    tableName: "jason-standups",
    partitionKey: { name: "standupId", type: "S" },
    sortKey: { name: "date", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Daily standup records",
  },

  // ─── Jason — reviews ──────────────────────────────────────────────────────
  {
    tableName: "jason-reviews",
    partitionKey: { name: "sprintId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Sprint review outcomes",
  },

  // ─── Jason — retros ───────────────────────────────────────────────────────
  {
    tableName: "jason-retros",
    partitionKey: { name: "sprintId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Retrospective action items",
  },

  // ─── User suggestions ─────────────────────────────────────────────────────
  {
    tableName: "user-suggestions",
    partitionKey: { name: "suggestionId", type: "S" },
    sortKey: { name: "userId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Client suggestions + verdicts",
  },

  // ─── Agent real-time status ───────────────────────────────────────────────
  {
    tableName: "agent-status",
    partitionKey: { name: "agentId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Real-time agent status for Mission Control UI",
  },

  // ─── Council sessions ─────────────────────────────────────────────────────
  {
    tableName: "council-sessions",
    partitionKey: { name: "sessionId", type: "S" },
    sortKey: { name: "jobId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "On The Line council records + RRQ retro completion",
  },

  // ─── Cold start deep research sprints ─────────────────────────────────────
  {
    tableName: "cold-start-sprints",
    partitionKey: { name: "sprintId", type: "S" },
    sortKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Cold start deep research sprint records",
  },

  // ─── The Line council KB namespace ───────────────────────────────────────
  {
    tableName: "the-line-council-index",
    partitionKey: { name: "indexId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Bedrock Knowledge Base namespace owned by The Line",
  },

  // ─── Channel onboarding audit ─────────────────────────────────────────────
  {
    tableName: "channel-audit",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "auditId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Onboarding channel identity audit results",
  },

  // ─── Avatar presenter profiles ────────────────────────────────────────────
  {
    tableName: "avatar-profiles",
    partitionKey: { name: "channelId", type: "S" },
    sortKey: { name: "presenterId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Presenter roster — seed, config, performance scores, evolution history",
  },

  // ─── User notification inbox ──────────────────────────────────────────────
  {
    tableName: "notifications",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "notificationId", type: "S" },
    ttlAttribute: "expiresAt",
    gsi: [
      {
        indexName: "userId-createdAt-index",
        partitionKey: { name: "userId", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "User notification inbox — agent stuck, job failed, approval required",
  },

  // ─── Channel confidence cache ─────────────────────────────────────────────
  {
    tableName: "channel-confidence",
    partitionKey: { name: "channelId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Niche+mode confidence score cache — Haiku eval, 24h TTL",
  },

  // ─── Series registry (Full RRQ faceless) ─────────────────────────────────
  {
    tableName: "series-registry",
    partitionKey: { name: "seriesId", type: "S" },
    sortKey: { name: "channelId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "What If + Conspiracy arc state machine for Full RRQ faceless mode",
  },

  // ─── Rex Mode topic queue ─────────────────────────────────────────────────
  {
    tableName: "rex-topic-queue",
    partitionKey: { name: "topicId", type: "S" },
    sortKey: { name: "channelId", type: "S" },
    ttlAttribute: "expiresAt",
    billingMode: "PAY_PER_REQUEST",
    description: "Rex-surfaced topics awaiting user GO — Rex Mode only, 48h TTL",
  },

  // ─── Sprint evaluations (Full RRQ pre-production) ─────────────────────────
  {
    tableName: "sprint-evaluations",
    partitionKey: { name: "jobId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Pre-production sprint council scores per job — Full RRQ only",
  },

  // ─── SENTINEL infrastructure alerts ──────────────────────────────────────
  {
    tableName: "sentinel-alerts",
    partitionKey: { name: "alertId", type: "S" },
    sortKey: { name: "timestamp", type: "S" },
    ttlAttribute: "resolvedAt",
    billingMode: "PAY_PER_REQUEST",
    description: "SENTINEL infrastructure alerts + resolution log — Autopilot Mode only",
  },

  // ─── Harvy ROI signals ────────────────────────────────────────────────────
  {
    tableName: "harvy-roi-signals",
    partitionKey: { name: "recommendationId", type: "S" },
    sortKey: { name: "runId", type: "S" },
    ttlAttribute: "expiresAt",
    gsi: [
      {
        indexName: "videoId-createdAt-index",
        partitionKey: { name: "videoId", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
      {
        indexName: "triggeredBy-createdAt-index",
        partitionKey: { name: "triggeredBy", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "Harvy ROI recommendations — Zeus reads before every ad decision; Harvy calibration loop reads weekly. 90d TTL",
  },

  // ─── Agent decision audit log ─────────────────────────────────────────────
  {
    tableName: "agent-decision-log",
    partitionKey: { name: "eventId", type: "S" },
    sortKey: { name: "agentId", type: "S" },
    ttlAttribute: "expiresAt",
    gsi: [
      {
        indexName: "agentId-timestamp-index",
        partitionKey: { name: "agentId", type: "S" },
        sortKey: { name: "timestamp", type: "S" },
        projectionType: "ALL",
      },
      {
        indexName: "decisionType-timestamp-index",
        partitionKey: { name: "decisionType", type: "S" },
        sortKey: { name: "timestamp", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "Agent decision audit log — Oracle reads at 24h/7d/30d windows. All agents write DecisionEvent before acting. 90d TTL",
  },

  // ─── Agent version registry ───────────────────────────────────────────────
  {
    tableName: "agent-version-registry",
    partitionKey: { name: "agentId", type: "S" },
    sortKey: { name: "version", type: "S" },
    gsi: [
      {
        indexName: "status-activationTimestamp-index",
        partitionKey: { name: "status", type: "S" },
        sortKey: { name: "activationTimestamp", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "Agent version manifest store — Oracle writes on every bump; Zeus approves all status transitions. No TTL.",
  },

  // ─── Agent policy audit log ───────────────────────────────────────────────
  {
    tableName: "agent-policy-audit-log",
    partitionKey: { name: "changeId", type: "S" },
    sortKey: { name: "changedAt", type: "S" },
    ttlAttribute: "expiresAt",
    gsi: [
      {
        indexName: "agentId-changedAt-index",
        partitionKey: { name: "agentId", type: "S" },
        sortKey: { name: "changedAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "User-initiated policy change audit — every Tier 2 policy change written here. 365d TTL",
  },

  // ─── Unreal AD render jobs ────────────────────────────────────────────────
  {
    tableName: "unreal-render-jobs",
    partitionKey: { name: "jobId", type: "S" },
    sortKey: { name: "beatId", type: "S" },
    gsi: [
      {
        indexName: "status-createdAt-index",
        partitionKey: { name: "status", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "Unreal AD render job state — Inngest polls for RENDER_COMPLETE",
  },

  // ─── Unreal asset catalog ─────────────────────────────────────────────────
  {
    tableName: "unreal-asset-catalog",
    partitionKey: { name: "assetId", type: "S" },
    gsi: [
      {
        indexName: "source-createdAt-index",
        partitionKey: { name: "source", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
      {
        indexName: "contentDomain-usageCount-index",
        partitionKey: { name: "contentDomain", type: "S" },
        sortKey: { name: "usageCount", type: "N" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "Unreal 3D asset library — semantic tags + Titan v2 embedding. Oracle Domain 12 manages.",
  },

  // ─── Unreal asset requests ────────────────────────────────────────────────
  {
    tableName: "unreal-asset-requests",
    partitionKey: { name: "requestId", type: "S" },
    gsi: [
      {
        indexName: "status-createdAt-index",
        partitionKey: { name: "status", type: "S" },
        sortKey: { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "TripoSR generation queue — written when Muse approves GENERATE for a scene gap. Oracle tracks pending.",
  },

  // ─── Agent policies ───────────────────────────────────────────────────────
  {
    tableName: "agent-policies",
    partitionKey: { name: "agentId", type: "S" },
    sortKey: { name: "policyKey", type: "S" },
    gsi: [
      {
        indexName: "category-agentId-index",
        partitionKey: { name: "category", type: "S" },
        sortKey: { name: "agentId", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description:
      "Centralized policy store — Oracle injects updated policies; agents read at runtime. All hardcoded thresholds live here.",
  },

  // ─── Murphy safety sessions ───────────────────────────────────────────────
  {
    tableName: "murphy-sessions",
    partitionKey: { name: "sessionId", type: "S" },
    gsi: [
      {
        indexName:    "userId-lastEvaluatedAt",
        partitionKey: { name: "userId", type: "S" },
        sortKey:      { name: "lastEvaluatedAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    ttlAttribute: "ttl",
    billingMode:  "PAY_PER_REQUEST",
    description:  "Murphy conversational arc tracking — sliding window of last 20 messages per session UUID. 24h TTL.",
  },

  // ─── Murphy safety patterns ───────────────────────────────────────────────
  {
    tableName: "murphy-patterns",
    partitionKey: { name: "patternId", type: "S" },
    gsi: [
      {
        indexName:    "status-createdAt",
        partitionKey: { name: "status", type: "S" },
        sortKey:      { name: "createdAt", type: "S" },
        projectionType: "ALL",
      },
      {
        indexName:    "category-status",
        partitionKey: { name: "category", type: "S" },
        sortKey:      { name: "status", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "Murphy safety patterns — PENDING_ORACLE awaits Oracle Domain 15 approval; ACTIVE used in real-time token-overlap lookup.",
  },

  // ─── User safety strikes ──────────────────────────────────────────────────
  {
    tableName:   "user-strikes",
    partitionKey: { name: "userId", type: "S" },
    billingMode: "PAY_PER_REQUEST",
    description: "Zeus/Murphy strike counter — permanent, no TTL. Increments on HARMFUL verdict; 3 strikes = perma-ban.",
  },

  // ─── Banned devices ───────────────────────────────────────────────────────
  {
    tableName:   "banned-devices",
    partitionKey: { name: "fingerprintHash", type: "S" },
    gsi: [
      {
        indexName:    "userId-bannedAt",
        partitionKey: { name: "userId", type: "S" },
        sortKey:      { name: "bannedAt", type: "S" },
        projectionType: "ALL",
      },
    ],
    billingMode: "PAY_PER_REQUEST",
    description: "FingerprintJS device ban list — checked on every Zeus chat session start (best-effort deterrent).",
  },

  // ─── User device fingerprints ─────────────────────────────────────────────
  {
    tableName:   "user-fingerprints",
    partitionKey: { name: "userId", type: "S" },
    ttlAttribute: "ttl",
    billingMode:  "PAY_PER_REQUEST",
    description:  "Latest FingerprintJS visitorId hash per user — 90d TTL session tracking.",
  },
];

/** Convenience lookup by table name */
export const TABLE_MAP: Record<string, DynamoTableConfig> = Object.fromEntries(
  DYNAMO_TABLES.map((t) => [t.tableName, t])
);

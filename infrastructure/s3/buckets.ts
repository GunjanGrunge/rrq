// infrastructure/s3/buckets.ts
// S3 bucket configurations for RRQ content pipeline and agent episodic memory.

export interface S3LifecycleRule {
  id: string;
  prefix: string;
  /** Days before transitioning to storageClass (mutually exclusive with expirationDays) */
  transitionDays?: number;
  storageClass?: "STANDARD_IA" | "INTELLIGENT_TIERING" | "GLACIER" | "DEEP_ARCHIVE";
  /** Days before object expires and is deleted */
  expirationDays?: number;
}

export interface S3CorsRule {
  allowedOrigins: string[];
  allowedMethods: ("GET" | "PUT" | "POST" | "DELETE" | "HEAD")[];
  allowedHeaders?: string[];
  maxAgeSeconds?: number;
}

export interface S3BucketConfig {
  bucketName: string;
  versioning: boolean;
  lifecycleRules: S3LifecycleRule[];
  corsRules?: S3CorsRule[];
  description: string;
}

// ─── Bucket definitions ───────────────────────────────────────────────────────

export const S3_BUCKETS = {
  /**
   * Primary media asset store.
   * Holds all job outputs, avatar references, model weights, and temp files.
   */
  CONTENT_FACTORY: {
    bucketName: process.env.S3_BUCKET_NAME ?? "content-factory-assets",
    versioning: false,
    lifecycleRules: [
      {
        id: "job-output-to-ia",
        prefix: "jobs/",
        transitionDays: 30,
        storageClass: "STANDARD_IA",
      },
      {
        id: "tmp-expiry",
        prefix: "tmp/",
        expirationDays: 7,
      },
    ],
    corsRules: [
      {
        // Allow presigned URL uploads and downloads from the Next.js frontend
        allowedOrigins: ["*"],
        allowedMethods: ["GET", "PUT"],
        allowedHeaders: ["*"],
        maxAgeSeconds: 3600,
      },
    ],
    description: "Primary media asset store — job outputs, avatars, model weights",
  } satisfies S3BucketConfig,

  /**
   * Agent episodic memory store.
   * Versioned so Zeus episode writes are never lost.
   * Old episodes transition to Glacier after 1 year to control storage cost.
   */
  RRQ_MEMORY: {
    bucketName: process.env.RRQ_MEMORY_BUCKET ?? "rrq-memory",
    versioning: true,
    lifecycleRules: [
      {
        id: "episodes-to-glacier",
        prefix: "episodes/",
        transitionDays: 365,
        storageClass: "GLACIER",
      },
    ],
    description: "Agent episodic memory — Zeus-written lessons, KB-indexed via Bedrock",
  } satisfies S3BucketConfig,
};

// ─── Canonical folder structure ───────────────────────────────────────────────
// Maps to S3 asset paths defined in CLAUDE.md.
// Use these constants everywhere to avoid typos in path construction.

export const S3_FOLDER_STRUCTURE = {
  /** Per-job media outputs: audio, avatar, visuals, b-roll, final, thumbnails */
  JOB_ROOT: (jobId: string) => `jobs/${jobId}/`,
  JOB_VOICEOVER: (jobId: string) => `jobs/${jobId}/voiceover.mp3`,
  JOB_AVATAR_OUTPUT: (jobId: string) => `jobs/${jobId}/avatar_output.mp4`,
  JOB_VISUALS: (jobId: string, assetId: string, ext: "png" | "mp4") =>
    `jobs/${jobId}/visuals/${assetId}.${ext}`,
  JOB_BROLL: (jobId: string, sectionId: string) => `jobs/${jobId}/broll/${sectionId}.mp4`,
  JOB_FINAL_YOUTUBE: (jobId: string) => `jobs/${jobId}/final_youtube.mp4`,
  JOB_FINAL_SHORT: (jobId: string) => `jobs/${jobId}/final_short.mp4`,
  JOB_THUMBNAIL_A: (jobId: string) => `jobs/${jobId}/thumbnail_a.jpg`,
  JOB_THUMBNAIL_B: (jobId: string) => `jobs/${jobId}/thumbnail_b.jpg`,

  /** Static avatar reference files (seed portraits + config) */
  AVATAR_STATIC: (avatarId: string) => `avatars/${avatarId}/`,
  AVATAR_REFERENCE: (avatarId: string) => `avatars/${avatarId}/reference.mp4`,
  AVATAR_PORTRAIT: (avatarId: string) => `avatars/${avatarId}/portrait.jpg`,
  AVATAR_CONFIG: (avatarId: string) => `avatars/${avatarId}/config.json`,

  /** Dynamically generated presenter portraits (FLUX.1, per channel) */
  AVATAR_DYNAMIC: (channelId: string, presenterId: string) =>
    `avatars/dynamic/${channelId}/${presenterId}/reference.jpg`,

  /** AI model weights */
  MODEL_WAN2: () => "models/wan2.2/",
  MODEL_SKYREELS: () => "models/skyreels-v2/",
  MODEL_FLUX: () => "models/flux1-dev/",

  /** Temp files (auto-expire after 7 days via lifecycle rule) */
  TMP: (filename: string) => `tmp/${filename}`,

  // ── RRQ Memory bucket paths ──────────────────────────────────────────────
  /** Agent episodic memory episodes written by Zeus */
  MEMORY_EPISODE: (agent: string, year: string, month: string, episodeId: string) =>
    `episodes/${agent}/${year}/${month}/${episodeId}.json`,

  /** Agent version prompt snapshots */
  AGENT_VERSION_PROMPT: (agentId: string, version: string) =>
    `agent-versions/${agentId}/${version}/system-prompt.txt`,

  /** Agent version policy snapshots */
  AGENT_VERSION_POLICY: (agentId: string, version: string) =>
    `agent-versions/${agentId}/${version}/policy-snapshot.json`,

  /** Oracle shadow mode outputs (14-day proving window) */
  ORACLE_SHADOW_OUTPUT: (version: string, filename: string) =>
    `agent-versions/oracle/${version}/shadow-outputs/${filename}`,
} as const;

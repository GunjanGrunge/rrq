import { z } from "zod";

// ─── Shared Enums ──────────────────────────────────────────────────────────

export const VisualType = z.enum([
  "TALKING_HEAD",
  "SPLIT_SCREEN",
  "B_ROLL",
  "SECTION_CARD",
  "CONCEPT_IMAGE",
  "THUMBNAIL_SRC",
  "CHART",
  "DIAGRAM",
  "SLIDE",
  "GRAPHIC_OVERLAY",
  "IMAGE",
  "SCREEN_RECORD",
]);

export const NicheClass = z.enum([
  "AI_NEWS",
  "TECH_GENERAL",
  "MOTORSPORT",
  "FINANCE",
  "SCIENCE",
  "GENERAL",
]);

// ─── Audio Gen ─────────────────────────────────────────────────────────────

export const VoiceCueMap = z.object({
  timestamp: z.number(),
  cue: z.enum(["RISE", "PEAK", "DROP", "WARM", "QUESTION", "PIVOT", "EMPHASIS"]),
  expressionHint: z.string(),
});

export type VoiceCueMapType = z.infer<typeof VoiceCueMap>;

export const AudioGenInput = z.object({
  jobId: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      script: z.string(),
      toneNote: z.string(),
    })
  ),
  voiceConfig: z.object({
    gender: z.enum(["male", "female"]),
    style: z.enum(["analytical", "enthusiastic", "documentary", "conversational"]),
  }),
  /** User's custom ElevenLabs voice ID override, if set in Settings */
  customVoiceId: z.string().optional(),
});

export type AudioGenInputType = z.infer<typeof AudioGenInput>;

export const AudioGenOutput = z.object({
  voiceoverUrl: z.string(),
  sectionAudioUrls: z.array(
    z.object({
      sectionId: z.string(),
      s3Key: z.string(),
      durationMs: z.number(),
    })
  ),
  totalDurationMs: z.number(),
  voiceUsed: z.enum(["elevenlabs", "edge-tts"]),
  voiceId: z.string(),
  cueMap: z.array(VoiceCueMap),
});

export type AudioGenOutputType = z.infer<typeof AudioGenOutput>;

// ─── Research Visual ───────────────────────────────────────────────────────

export const ResearchVisualInput = z.object({
  jobId: z.string(),
  niche: NicheClass,
  beats: z.array(
    z.object({
      id: z.string(),
      visualType: VisualType,
      visualNote: z.string(),
      topicContext: z.string(),
      /** URL to fetch official image / paper figure from */
      sourceUrl: z.string().optional(),
      /** Search terms for stock footage */
      stockSearchTerms: z.array(z.string()).optional(),
    })
  ),
});

export type ResearchVisualInputType = z.infer<typeof ResearchVisualInput>;

export const ResearchVisualOutput = z.object({
  assets: z.array(
    z.object({
      beatId: z.string(),
      s3Key: z.string(),
      type: z.enum(["image", "video", "screenshot"]),
      source: z.string(),
      attribution: z.string().optional(),
      durationMs: z.number().optional(),
    })
  ),
});

export type ResearchVisualOutputType = z.infer<typeof ResearchVisualOutput>;

// ─── Visual Gen ────────────────────────────────────────────────────────────

export const VisualAssetType = z.enum([
  "comparison-table",
  "bar-chart",
  "line-chart",
  "radar-chart",
  "flow-diagram",
  "infographic-card",
  "personality-card",
  "news-timeline",
  "stat-callout",
  "animated-infographic",
  "geo-map",
]);

export const VisualGenInput = z.object({
  jobId: z.string(),
  assets: z.array(
    z.object({
      id: z.string(),
      sectionId: z.string(),
      type: VisualAssetType,
      /** Duration of the visual in seconds */
      duration: z.number(),
      animated: z.boolean(),
      /** The data payload — shape varies by type */
      data: z.record(z.unknown()),
      citations: z.array(z.string()).optional(),
    })
  ),
});

export type VisualGenInputType = z.infer<typeof VisualGenInput>;

export const VisualGenOutput = z.object({
  assets: z.array(
    z.object({
      id: z.string(),
      s3Key: z.string(),
      format: z.enum(["png", "mp4"]),
      width: z.number(),
      height: z.number(),
      durationMs: z.number().optional(),
    })
  ),
});

export type VisualGenOutputType = z.infer<typeof VisualGenOutput>;

// ─── AV Sync ───────────────────────────────────────────────────────────────

export const AvSyncInput = z.object({
  jobId: z.string(),
  /** S3 key of the full voiceover MP3 */
  voiceoverS3Key: z.string(),
  segments: z.array(
    z.object({
      sectionId: z.string(),
      /** Which display mode this segment uses */
      displayMode: z.enum([
        "avatar-fullscreen",
        "broll-with-corner-avatar",
        "broll-only",
        "visual-asset",
      ]),
      /** S3 key of the avatar segment (if applicable) */
      avatarS3Key: z.string().optional(),
      /** S3 key of the b-roll segment (if applicable) */
      brollS3Key: z.string().optional(),
      /** S3 key of the image/visual asset (if applicable) */
      visualS3Key: z.string().optional(),
      /** Start time in the voiceover (ms) */
      startMs: z.number(),
      /** End time in the voiceover (ms) */
      endMs: z.number(),
    })
  ),
  /** Subtitle data for burn-in */
  subtitles: z.object({
    srtContent: z.string(),
    style: z
      .object({
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
        primaryColor: z.string().optional(),
        outlineColor: z.string().optional(),
      })
      .optional(),
  }),
  /** Output resolution */
  resolution: z.enum(["720p", "1080p"]).default("720p"),
});

export type AvSyncInputType = z.infer<typeof AvSyncInput>;

export const AvSyncOutput = z.object({
  finalVideoS3Key: z.string(),
  durationMs: z.number(),
  resolution: z.string(),
  fileSize: z.number(),
});

export type AvSyncOutputType = z.infer<typeof AvSyncOutput>;

// ─── Shorts Gen ────────────────────────────────────────────────────────────

export const ShortsGenInput = z.object({
  jobId: z.string(),
  mode: z.enum(["convert", "fresh"]),
  /** For "convert" mode: S3 key of the main video to extract from */
  mainVideoS3Key: z.string().optional(),
  /** For "fresh" mode: short script content */
  freshScript: z
    .object({
      hook: z.string(),
      body: z.string(),
      onScreenText: z.array(z.string()),
      visualNote: z.string(),
      duration: z.number(),
    })
    .optional(),
  /** Voice config for fresh mode (Edge-TTS) */
  voiceConfig: z
    .object({
      gender: z.enum(["male", "female"]),
      style: z.enum(["analytical", "enthusiastic", "documentary", "conversational"]),
    })
    .optional(),
  /** Topic context for Haiku prompt construction */
  topicContext: z.string().optional(),
});

export type ShortsGenInputType = z.infer<typeof ShortsGenInput>;

export const ShortsGenOutput = z.object({
  shortsS3Key: z.string(),
  durationMs: z.number(),
  mode: z.enum(["convert", "fresh"]),
  fileSize: z.number(),
});

export type ShortsGenOutputType = z.infer<typeof ShortsGenOutput>;

// ─── Uploader ──────────────────────────────────────────────────────────────

export const UploaderInput = z.object({
  jobId: z.string(),
  userId: z.string(),
  /** Main video */
  mainVideo: z.object({
    s3Key: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    category: z.string(),
    scheduledTime: z.string(),
    thumbnailS3Key: z.string(),
  }),
  /** YouTube Short */
  short: z
    .object({
      s3Key: z.string(),
      title: z.string(),
      description: z.string(),
      hashtags: z.array(z.string()),
      scheduledTime: z.string(),
    })
    .optional(),
  /** Pin a first comment */
  pinnedComment: z.string().optional(),
  /** Playlist ID to add to */
  playlistId: z.string().optional(),
});

export type UploaderInputType = z.infer<typeof UploaderInput>;

export const UploaderOutput = z.object({
  youtube: z.object({
    videoId: z.string(),
    videoUrl: z.string(),
    status: z.enum(["scheduled", "published", "failed"]),
    scheduledTime: z.string(),
    thumbnailSet: z.boolean(),
    pinnedCommentId: z.string().optional(),
  }),
  short: z
    .object({
      videoId: z.string(),
      videoUrl: z.string(),
      status: z.enum(["scheduled", "published", "failed"]),
    })
    .optional(),
  errors: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type UploaderOutputType = z.infer<typeof UploaderOutput>;

// ─── TONY — Code Agent ─────────────────────────────────────────────────────

export const CodeAgentInput = z.object({
  jobId: z.string(),
  agentId: z.enum(["REX", "REGUM", "QEON", "ZEUS", "ARIA", "ORACLE", "MUSE"]),
  task: z.string(),
  context: z.record(z.unknown()),
  outputType: z.enum(["data", "chart", "report", "scrape"]),
  /** Override default domain allowlist — use sparingly */
  allowedDomains: z.array(z.string()).optional(),
  timeoutMs: z.number().default(30_000),
});

export type CodeAgentInputType = z.infer<typeof CodeAgentInput>;

export const CodeAgentOutput = z.object({
  success: z.boolean(),
  outputType: z.enum(["data", "chart", "report", "scrape"]),
  /** S3 key of output file — set for chart/report/scrape types */
  s3Key: z.string().optional(),
  /** Structured data — set for outputType: "data" */
  data: z.record(z.unknown()).optional(),
  /** Markdown string — set for outputType: "report" */
  markdown: z.string().optional(),
  errorMessage: z.string().optional(),
  /** Always included — audit trail of what Haiku generated */
  codeGenerated: z.string(),
  executionMs: z.number(),
});

export type CodeAgentOutputType = z.infer<typeof CodeAgentOutput>;

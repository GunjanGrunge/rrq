---
name: platform-uploader
description: >
  YouTube and Instagram upload and scheduling skill. Use this whenever a user
  wants to upload a video to YouTube, post a Reel to Instagram, schedule
  content for optimal times, needs OAuth authentication setup for YouTube or
  Instagram, wants to automate video publishing, or needs to set YouTube
  metadata programmatically. Triggers on: "upload to YouTube", "post to
  Instagram", "schedule the video", "publish the content", "connect YouTube
  account", "connect Instagram account", or any request to distribute
  finished video content to social platforms.
---

# Platform Uploader Skill

## Purpose
Handle authenticated upload and scheduling to YouTube and Instagram with full metadata, optimal timing, and post-upload monitoring setup. This is the final step in the pipeline — by this point all assets (video, audio, thumbnail, metadata) are in S3 and ready.

## Model
Use **claude-haiku-4-5** via AWS Bedrock for any final metadata adjustments or description formatting — fast, cheap, accurate for structured text tasks.

---

## YouTube Upload

### Authentication (OAuth 2.0)
YouTube requires OAuth 2.0 — no service account can upload on behalf of a user.
The auth flow is handled by the Clerk auth skill. Read `skills/auth-clerk/SKILL.md`
for the full connect + callback + token storage implementation.

Key points:
- User signs in via Clerk, then separately connects their YouTube channel
- YouTube OAuth tokens are stored in DynamoDB `user-tokens` table, keyed by Clerk userId
- Tokens auto-refresh via `googleapis` refresh listener
- Always use `getYouTubeClient(userId)` from `lib/youtube-auth.ts` — never build oauth2Client directly in upload code

```typescript
// Get an authenticated YouTube client for a user
import { getYouTubeClient } from "@/lib/youtube-auth";

const youtube = await getYouTubeClient(userId);  // userId = Clerk userId
```

### Video Upload
```typescript
const youtube = google.youtube({ version: "v3", auth: oauth2Client });

// Stream from S3 directly — don't download to Lambda
const s3Stream = s3.getObject({ Bucket: BUCKET, Key: `${jobId}/final/youtube_final.mp4` }).createReadStream();

const uploadResponse = await youtube.videos.insert({
  part: ["snippet", "status"],
  requestBody: {
    snippet: {
      title: seoData.finalTitle,
      description: seoData.description,
      tags: seoData.tags,
      categoryId: getCategoryId(seoData.category),
      defaultLanguage: "en",
      defaultAudioLanguage: "en"
    },
    status: {
      privacyStatus: "private",     // always upload private first
      publishAt: seoData.scheduledTime,  // ISO 8601 — makes it scheduled
      madeForKids: false,
      selfDeclaredMadeForKids: false
    }
  },
  media: {
    body: s3Stream
  }
});

const videoId = uploadResponse.data.id;
```

### Set Thumbnail After Upload
```typescript
const thumbnailStream = s3.getObject({
  Bucket: BUCKET,
  Key: `${jobId}/final/thumbnail.png`
}).createReadStream();

await youtube.thumbnails.set({
  videoId,
  media: { body: thumbnailStream }
});
```

### Add Chapters via Description
YouTube generates chapters automatically when:
- Description contains timestamps starting with `0:00`
- Minimum 3 timestamps
- First timestamp is `0:00`

The description from the SEO skill already includes these. No additional API call needed.

### Upload Quota Management
YouTube Data API v3 has a daily quota of 10,000 units. Video uploads cost 1,600 units each. This means ~6 uploads per day per API project.

Strategy for high-volume creators:
- Create multiple API projects (each gets 10,000 units)
- Rotate projects per upload
- Store quota usage in DynamoDB, reset daily at midnight PST

```typescript
async function selectYouTubeProject(): Promise<YouTubeCredentials> {
  const projects = await getProjectQuotas(); // from DynamoDB
  const available = projects
    .filter(p => p.usedToday + 1600 <= 10000)
    .sort((a, b) => a.usedToday - b.usedToday);

  if (available.length === 0) throw new Error("Daily quota exhausted — retry tomorrow");
  return available[0];
}
```

---

## Instagram — Coming Soon (Phase 2)

Instagram is not implemented in Phase 1. The UI shows a "Coming Soon" badge on the Instagram connection button. Do not build any Instagram upload code now.

**Phase 2 plan (Make.com webhook approach):**
- User creates a free Make.com account
- Imports our pre-built Make.com scenario template
- Connects their Instagram inside Make.com
- Pastes their Make.com webhook URL into our app settings
- Our app fires a single webhook POST — Make.com handles the Instagram post

No Meta App Review, no OAuth, works with personal and business accounts.

---

## Scheduling Logic

Both platforms scheduled via **AWS EventBridge** (cron) rather than platform-native scheduling, giving us more control:

```typescript
// Create EventBridge rule for scheduled publish time
const rule = await eventBridge.putRule({
  Name: `publish-${jobId}`,
  ScheduleExpression: `cron(${cronFromISO(scheduledTime)})`,
  State: "ENABLED"
});

// Target: the uploader Lambda
await eventBridge.putTargets({
  Rule: `publish-${jobId}`,
  Targets: [{
    Id: `upload-${jobId}`,
    Arn: UPLOADER_LAMBDA_ARN,
    Input: JSON.stringify({ jobId, platform: "youtube" })
  }]
});
```

YouTube videos uploaded as `private` + `publishAt` field handle scheduling natively.

---

## YouTube Shorts Upload

Shorts use the exact same YouTube Data API v3 upload endpoint as regular videos. The only differences are:

- Video file is vertical 9:16 (YouTube auto-detects and classifies as Short)
- Title under 40 characters
- Description includes `#Shorts` hashtag
- Scheduled 2-3 hours BEFORE the main video

```typescript
// Upload Short — identical to main video upload
const shortUpload = await youtube.videos.insert({
  part: ["snippet", "status"],
  requestBody: {
    snippet: {
      title: seoData.shortsTitle,
      description: seoData.shortsDescription,
      tags: seoData.shortsHashtags,
      categoryId: getCategoryId(seoData.category)
    },
    status: {
      privacyStatus: "private",
      publishAt: seoData.shortsScheduledTime  // 2-3 hrs before main video
    }
  },
  media: { body: shortsS3Stream }
});

// Link Short to main video in pinned comment
await youtube.commentThreads.insert({
  part: ["snippet"],
  requestBody: {
    snippet: {
      videoId: shortUpload.data.id,
      topLevelComment: {
        snippet: {
          textOriginal: `Full breakdown here → https://youtube.com/watch?v=${mainVideoId}`
        }
      }
    }
  }
});
```

---

## Post-Upload Handoff — Theo

After every successful upload, write a PRODUCTION_COMPLETE message to
`agent-messages` so THE LINE routes it to Theo automatically.
Do NOT trigger Theo directly — always via agent-messages.

```typescript
await writeToAgentMessages({
  type: "PRODUCTION_COMPLETE",
  from: "QEON",
  to: "THE_LINE",
  payload: {
    videoId,
    videoTitle: seoData.finalTitle,
    scheduledPublishAt: seoData.scheduledTime,
    abVariants: thumbnailData.variantBUrl ? [
      { label: "A", url: thumbnailData.youtube.thumbnailUrl },
      { label: "B", url: thumbnailData.youtube.variantBUrl },
    ] : null,
    format: museBlueprintFormat,        // e.g. "COMPARISON"
    niche: researchData.niche,
    seriesId: researchData.seriesId ?? null,
    // Theo needs these to assign playlists and initiate A/B test
  }
});
```

Theo handles: first-wave comment triage, playlist assignment,
end screen verification, A/B test initiation, and community teaser post.
Platform uploader does not do any of these — Theo owns post-upload.

## Mission Beta Flag

After upload, check if this video has viral potential.
Flag it to Jason if MUSE's blueprint was a HIGH_VIRAL format
or if quality gate score was 9.0+.

```typescript
if (qualityGateScore >= 9.0 || muse.viralPotential === "HIGH") {
  await writeToAgentMessages({
    type: "VIRAL_CANDIDATE",
    from: "QEON",
    to: "THE_LINE",
    payload: {
      videoId,
      reason: qualityGateScore >= 9.0
        ? `Quality gate score ${qualityGateScore} — exceptional content`
        : "MUSE flagged HIGH viral potential format",
    }
  });
}
```

Jason creates a sprint watch-task on viral candidates.
Zeus monitors their 24h performance against Mission Beta target.

---

## Post-Upload Setup

After successful upload, trigger these automatically:

### YouTube
- [ ] Pin a comment (first comment from channel with CTA)
- [ ] Add video to relevant playlist
- [ ] Set end screen elements (requires 20+ second endscreen section)
- [ ] Add cards at timestamps matching `cardSuggestions` from script skill

```typescript
// Pin a comment
const comment = await youtube.commentThreads.insert({
  part: ["snippet"],
  requestBody: {
    snippet: {
      videoId,
      topLevelComment: {
        snippet: { textOriginal: `👋 ${scriptData.endScreenSuggestion}\n\n🔔 Subscribe for more` }
      }
    }
  }
});

await youtube.comments.setModerationStatus({
  id: [comment.data.id],
  moderationStatus: "published"
});
```

### Instagram
- [ ] Add to Close Friends story (creator followers get notified)
- [ ] Share Reel to Story with sticker link to YouTube

---

## Output Contract

```json
{
  "youtube": {
    "videoId": "string",
    "videoUrl": "https://youtube.com/watch?v={videoId}",
    "status": "scheduled | published | failed",
    "scheduledTime": "string — ISO 8601",
    "thumbnailSet": "boolean",
    "pinnedCommentId": "string"
  },
  "instagram": {
    "mediaId": "string",
    "reelUrl": "string",
    "status": "published | failed",
    "hashtagCommentPosted": "boolean"
  },
  "errors": ["string"],
  "nextSteps": ["string — recommended manual actions e.g. 'Share to Story', 'Reply to first comments within 1 hour'"]
}
```

---

## First-Hour Engagement Protocol

The algorithm measures velocity in the first 60 minutes after publish. Generate this checklist automatically in `nextSteps`:

```
□ Reply to every comment within first hour (signals active creator)
□ Share to Instagram Story with "New Video" sticker
□ Post teaser clip to Twitter/X with YouTube link
□ Send community post on YouTube (>500 subscribers feature)
□ Share in 2-3 relevant Reddit communities (organic, not spammy)
□ Send to email newsletter if exists
```

---

## References
- See `references/youtube-api-setup.md` for step-by-step API project creation and OAuth setup
- See `references/instagram-api-setup.md` for Facebook Developer App setup and Instagram Graph API access
- See `references/quota-management.md` for multi-project quota rotation strategy

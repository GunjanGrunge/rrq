import type { Handler } from "aws-lambda";
import {
  UploaderInput,
  type UploaderInputType,
  type UploaderOutputType,
} from "@rrq/lambda-types";
import { getYouTubeClient } from "./youtube-client";
import { getS3Stream } from "./s3";

/**
 * Sanitize YouTube tags:
 * - Strip tags longer than 100 chars (YouTube limit per tag is 500 but Muse sometimes generates sentences)
 * - Remove tags containing < > & characters (rejected by YouTube API)
 * - Deduplicate, limit to 500 total chars combined (YouTube hard limit)
 */
function sanitizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  let totalChars = 0;
  for (const tag of tags) {
    const t = tag.trim().replace(/[<>&"]/g, "").substring(0, 100);
    if (!t || seen.has(t.toLowerCase())) continue;
    if (totalChars + t.length > 500) break;
    seen.add(t.toLowerCase());
    result.push(t);
    totalChars += t.length;
  }
  return result;
}

const CATEGORY_MAP: Record<string, string> = {
  "Science & Technology": "28",
  Education: "27",
  Entertainment: "24",
  "News & Politics": "25",
  "Autos & Vehicles": "2",
  Sports: "17",
  "People & Blogs": "22",
  "Howto & Style": "26",
};

/**
 * uploader Lambda
 *
 * Uploads main video + optional Short to YouTube via Data API v3.
 * Always uploads as private + publishAt for scheduling.
 * Sets thumbnail, pins a comment, adds to playlist.
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: UploaderInputType = UploaderInput.parse(event);
    console.log(`[uploader] Starting job ${input.jobId}`);

    const youtube = await getYouTubeClient(input.userId);
    const errors: string[] = [];
    const nextSteps: string[] = [];

    // ── Upload main video ─────────────────────────────────────────
    console.log(`[uploader][${input.jobId}] Uploading main video`);

    const mainStream = getS3Stream(input.mainVideo.s3Key);
    const categoryId = CATEGORY_MAP[input.mainVideo.category] ?? "28";

    const mainUpload = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: input.mainVideo.title,
          description: input.mainVideo.description,
          tags: sanitizeTags(input.mainVideo.tags),
          categoryId,
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: "private",
          publishAt: input.mainVideo.scheduledTime,
          madeForKids: false,
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: mainStream },
    });

    const videoId = mainUpload.data.id!;
    console.log(`[uploader][${input.jobId}] Main video uploaded: ${videoId}`);

    // ── Set thumbnail ─────────────────────────────────────────────
    let thumbnailSet = false;
    try {
      const thumbnailStream = getS3Stream(input.mainVideo.thumbnailS3Key);
      await youtube.thumbnails.set({
        videoId,
        media: { body: thumbnailStream },
      });
      thumbnailSet = true;
      console.log(`[uploader][${input.jobId}] Thumbnail set`);
    } catch (err) {
      errors.push(`Thumbnail set failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Pin comment ───────────────────────────────────────────────
    let pinnedCommentId: string | undefined;
    if (input.pinnedComment) {
      try {
        const comment = await youtube.commentThreads.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              videoId,
              topLevelComment: {
                snippet: { textOriginal: input.pinnedComment },
              },
            },
          },
        });
        pinnedCommentId = comment.data.id ?? undefined;
        console.log(`[uploader][${input.jobId}] Comment pinned`);
      } catch (err) {
        errors.push(`Pin comment failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Add to playlist ───────────────────────────────────────────
    if (input.playlistId) {
      try {
        await youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId: input.playlistId,
              resourceId: { kind: "youtube#video", videoId },
            },
          },
        });
        console.log(`[uploader][${input.jobId}] Added to playlist ${input.playlistId}`);
      } catch (err) {
        errors.push(`Playlist add failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Upload Short (if provided) ────────────────────────────────
    let shortResult: UploaderOutputType["short"] | undefined;

    if (input.short) {
      try {
        console.log(`[uploader][${input.jobId}] Uploading Short`);
        const shortStream = getS3Stream(input.short.s3Key);

        const shortUpload = await youtube.videos.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: input.short.title,
              description: input.short.description,
              tags: sanitizeTags(input.short.hashtags),
              categoryId,
            },
            status: {
              privacyStatus: "private",
              publishAt: input.short.scheduledTime,
              madeForKids: false,
              selfDeclaredMadeForKids: false,
            },
          },
          media: { body: shortStream },
        });

        const shortId = shortUpload.data.id!;

        // Link Short to main video via comment
        try {
          await youtube.commentThreads.insert({
            part: ["snippet"],
            requestBody: {
              snippet: {
                videoId: shortId,
                topLevelComment: {
                  snippet: {
                    textOriginal: `Full breakdown here → https://youtube.com/watch?v=${videoId}`,
                  },
                },
              },
            },
          });
        } catch {
          // Non-critical — don't fail the upload
        }

        shortResult = {
          videoId: shortId,
          videoUrl: `https://youtube.com/shorts/${shortId}`,
          status: "scheduled",
        };

        console.log(`[uploader][${input.jobId}] Short uploaded: ${shortId}`);
      } catch (err) {
        errors.push(`Short upload failed: ${err instanceof Error ? err.message : String(err)}`);
        shortResult = {
          videoId: "",
          videoUrl: "",
          status: "failed",
        };
      }
    }

    // ── First-hour engagement checklist ───────────────────────────
    nextSteps.push(
      "Reply to every comment within first hour (signals active creator)",
      "Share to Instagram Story with 'New Video' sticker",
      "Post teaser clip to Twitter/X with YouTube link",
      "Send community post on YouTube (>500 subscribers feature)",
      "Share in 2-3 relevant Reddit communities (organic, not spammy)"
    );

    const output: UploaderOutputType = {
      youtube: {
        videoId,
        videoUrl: `https://youtube.com/watch?v=${videoId}`,
        status: "scheduled",
        scheduledTime: input.mainVideo.scheduledTime,
        thumbnailSet,
        pinnedCommentId,
      },
      short: shortResult,
      errors,
      nextSteps,
    };

    console.log(`[uploader][${input.jobId}] Complete`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[uploader][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

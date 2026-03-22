import type { Handler } from "aws-lambda";
import {
  AvSyncInput,
  type AvSyncInputType,
  type AvSyncOutputType,
} from "@rrq/lambda-types";
import { downloadFromS3, uploadToS3, getFileSize } from "./s3";
import { buildConcatList, runFFmpeg } from "./ffmpeg";
import { writeFile, readFile, mkdir } from "fs/promises";

const WORK_DIR = "/tmp/av-sync";

/**
 * av-sync Lambda (container deploy — includes FFmpeg binary)
 *
 * Stitches all video/image segments + audio + subtitles into final MP4.
 * Input: voiceover MP3, segment files (avatar, b-roll, images, visuals),
 *        display mode per segment, and SRT subtitles.
 * Output: final_youtube.mp4 in S3.
 *
 * Layout compositing rules:
 *   avatar-fullscreen     → avatar fills entire frame
 *   broll-with-corner-avatar → b-roll full frame, avatar bottom-right 30%
 *   broll-only            → b-roll fills entire frame
 *   visual-asset          → static image/visual fills frame (hold for duration)
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: AvSyncInputType = AvSyncInput.parse(event);
    console.log(
      `[av-sync] Starting job ${input.jobId}, ${input.segments.length} segments`
    );

    await mkdir(WORK_DIR, { recursive: true });

    // ── Download voiceover ────────────────────────────────────────
    const voiceoverPath = `${WORK_DIR}/voiceover.mp3`;
    await downloadFromS3(input.voiceoverS3Key, voiceoverPath);

    // ── Write SRT subtitles ──────────────────────────────────────
    const srtPath = `${WORK_DIR}/subtitles.srt`;
    await writeFile(srtPath, input.subtitles.srtContent, "utf-8");

    // ── Download and process each segment ────────────────────────
    const clipPaths: string[] = [];

    for (let i = 0; i < input.segments.length; i++) {
      const segment = input.segments[i];
      const clipPath = `${WORK_DIR}/clip_${String(i).padStart(3, "0")}.mp4`;

      console.log(
        `[av-sync][${input.jobId}] Processing segment ${i}: ${segment.displayMode}`
      );

      const durationSec = (segment.endMs - segment.startMs) / 1000;
      const startSec = segment.startMs / 1000;
      const resolution = input.resolution === "1080p" ? "1920:1080" : "1280:720";
      const resolutionLavfi = resolution.replace(":", "x"); // lavfi needs 1280x720 not 1280:720

      switch (segment.displayMode) {
        case "avatar-fullscreen": {
          const avatarPath = `${WORK_DIR}/avatar_${i}.mp4`;
          if (segment.avatarS3Key) {
            await downloadFromS3(segment.avatarS3Key, avatarPath);
            // Avatar fills entire frame, audio from voiceover at correct offset
            await runFFmpeg([
              "-i", avatarPath,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-vf", `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black`,
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-y", clipPath,
            ]);
          } else {
            // No avatar available (EC2 not configured) — black video with audio
            await runFFmpeg([
              "-f", "lavfi", "-i", `color=c=black:size=${resolutionLavfi}:rate=25`,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-shortest",
              "-y", clipPath,
            ]);
          }
          break;
        }

        case "broll-with-corner-avatar": {
          const brollPath = `${WORK_DIR}/broll_${i}.mp4`;
          const avatarPath = `${WORK_DIR}/avatar_${i}.mp4`;
          const hasBroll = !!segment.brollS3Key;
          const hasAvatar = !!segment.avatarS3Key;
          if (hasBroll) await downloadFromS3(segment.brollS3Key!, brollPath);
          if (hasAvatar) await downloadFromS3(segment.avatarS3Key!, avatarPath);

          if (hasBroll && hasAvatar) {
            // B-roll full frame with avatar picture-in-picture (bottom-right 30%)
            const avatarScale = input.resolution === "1080p" ? "480:270" : "384:216";
            await runFFmpeg([
              "-i", brollPath,
              "-i", avatarPath,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-filter_complex",
              `[0:v]scale=${resolution}[bg];[1:v]scale=${avatarScale}[avatar];[bg][avatar]overlay=W-w-20:H-h-20`,
              "-map", "[v]",
              "-map", "2:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-y", clipPath,
            ]);
          } else if (hasBroll) {
            // No avatar — just b-roll with audio
            await runFFmpeg([
              "-i", brollPath,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-vf", `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black`,
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-y", clipPath,
            ]);
          } else {
            // Neither available — black video with audio
            await runFFmpeg([
              "-f", "lavfi", "-i", `color=c=black:size=${resolutionLavfi}:rate=25`,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-shortest",
              "-y", clipPath,
            ]);
          }
          break;
        }

        case "broll-only": {
          const brollPath = `${WORK_DIR}/broll_${i}.mp4`;
          if (segment.brollS3Key) {
            await downloadFromS3(segment.brollS3Key, brollPath);
            await runFFmpeg([
              "-i", brollPath,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-vf", `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black`,
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-y", clipPath,
            ]);
          } else {
            // No b-roll available — black video with audio
            await runFFmpeg([
              "-f", "lavfi", "-i", `color=c=black:size=${resolutionLavfi}:rate=25`,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-shortest",
              "-y", clipPath,
            ]);
          }
          break;
        }

        case "visual-asset": {
          const visualPath = `${WORK_DIR}/visual_${i}.png`;
          if (segment.visualS3Key) {
            await downloadFromS3(segment.visualS3Key, visualPath);
            // Static image held for duration with audio
            await runFFmpeg([
              "-loop", "1",
              "-i", visualPath,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-vf", `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:-1:-1:color=black`,
              "-c:v", "libx264",
              "-tune", "stillimage",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-shortest",
              "-y", clipPath,
            ]);
          } else {
            // No visual asset available — black video with audio
            await runFFmpeg([
              "-f", "lavfi", "-i", `color=c=black:size=${resolutionLavfi}:rate=25`,
              "-i", voiceoverPath,
              "-ss", String(startSec),
              "-t", String(durationSec),
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "libx264",
              "-preset", "fast",
              "-crf", "23",
              "-c:a", "aac",
              "-b:a", "128k",
              "-shortest",
              "-y", clipPath,
            ]);
          }
          break;
        }
      }

      clipPaths.push(clipPath);
    }

    // ── Concatenate all clips ─────────────────────────────────────
    const concatListPath = `${WORK_DIR}/clips_list.txt`;
    await buildConcatList(clipPaths, concatListPath);

    const rawOutputPath = `${WORK_DIR}/raw_output.mp4`;
    await runFFmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      "-y", rawOutputPath,
    ]);

    // ── Burn subtitles ────────────────────────────────────────────
    const finalOutputPath = `${WORK_DIR}/final_youtube.mp4`;
    const subtitleStyle = buildSubtitleStyle(input.subtitles.style);

    await runFFmpeg([
      "-i", rawOutputPath,
      "-vf", `subtitles=${srtPath}:force_style='${subtitleStyle}'`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "copy",
      "-y", finalOutputPath,
    ]);

    // ── Upload final video ────────────────────────────────────────
    const finalBuffer = await readFile(finalOutputPath);
    const finalS3Key = `jobs/${input.jobId}/final/youtube_final.mp4`;
    await uploadToS3(finalS3Key, finalBuffer, "video/mp4");

    const fileSize = await getFileSize(finalOutputPath);

    console.log(`[av-sync][${input.jobId}] Complete. Final: ${finalS3Key}`);

    const output: AvSyncOutputType = {
      finalVideoS3Key: finalS3Key,
      durationMs: input.segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0),
      resolution: input.resolution ?? "720p",
      fileSize,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[av-sync][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

function buildSubtitleStyle(
  style?: { fontFamily?: string; fontSize?: number; primaryColor?: string; outlineColor?: string }
): string {
  const font = style?.fontFamily ?? "DM Mono";
  const size = style?.fontSize ?? 22;
  const primary = style?.primaryColor ?? "&HFFFFFF";
  const outline = style?.outlineColor ?? "&H000000";

  return `FontName=${font},FontSize=${size},PrimaryColour=${primary},OutlineColour=${outline},BorderStyle=3,Outline=2,Shadow=1,MarginV=40`;
}

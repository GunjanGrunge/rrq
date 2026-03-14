import { execFile } from "child_process";
import { writeFile } from "fs/promises";

/**
 * FFmpeg binary path — in container, it's installed globally.
 * For Lambda layers, use /opt/bin/ffmpeg.
 */
const FFMPEG_BIN = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";

/**
 * Run an FFmpeg command with the given arguments.
 * Throws on non-zero exit code.
 */
export async function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Running: ffmpeg ${args.join(" ").slice(0, 200)}...`);

    execFile(
      FFMPEG_BIN,
      args,
      {
        timeout: 600_000, // 10 min timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB stdout/stderr buffer
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[ffmpeg] Error:`, error.message);
          console.error(`[ffmpeg] stderr:`, stderr.slice(-1000));
          reject(
            new Error(
              `FFmpeg failed: ${error.message}\nstderr: ${stderr.slice(-500)}`
            )
          );
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

/**
 * Build a concat demuxer list file for FFmpeg.
 * Format: file '/path/to/clip_001.mp4'
 */
export async function buildConcatList(
  clipPaths: string[],
  outputPath: string
): Promise<void> {
  const content = clipPaths
    .map((p) => `file '${p}'`)
    .join("\n");
  await writeFile(outputPath, content, "utf-8");
}

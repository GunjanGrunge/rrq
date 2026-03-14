import { execFile } from "child_process";

const FFMPEG_BIN = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";

export async function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      args,
      { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`FFmpeg failed: ${error.message}\nstderr: ${stderr.slice(-500)}`));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

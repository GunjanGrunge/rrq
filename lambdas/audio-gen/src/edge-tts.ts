import { execFile } from "child_process";
import { readFile, writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";

/**
 * Edge-TTS fallback — unlimited free Microsoft TTS.
 *
 * Uses the edge-tts npm package which wraps Microsoft's Edge read-aloud API.
 * No API key required. Quality is lower than ElevenLabs but perfectly usable.
 *
 * Requires edge-tts CLI: `npx edge-tts --text "..." --voice "en-US-GuyNeural" --write-media /tmp/out.mp3`
 */
export async function generateEdgeTTS(
  text: string,
  voice: string
): Promise<Buffer> {
  const tmpId = randomUUID();
  const textPath = `/tmp/edge_tts_input_${tmpId}.txt`;
  const outputPath = `/tmp/edge_tts_output_${tmpId}.mp3`;

  try {
    // Write text to temp file to avoid shell escaping issues
    await writeFile(textPath, text, "utf-8");

    await new Promise<void>((resolve, reject) => {
      execFile(
        "npx",
        [
          "edge-tts",
          "--file", textPath,
          "--voice", voice,
          "--write-media", outputPath,
        ],
        { timeout: 120_000 },
        (error, _stdout, stderr) => {
          if (error) {
            reject(
              new Error(`Edge-TTS failed: ${error.message}. stderr: ${stderr}`)
            );
          } else {
            resolve();
          }
        }
      );
    });

    const audioBuffer = await readFile(outputPath);
    return audioBuffer;
  } finally {
    // Clean up temp files
    await unlink(textPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

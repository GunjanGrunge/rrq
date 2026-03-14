import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { execFile } from "child_process";
import { writeFile, readFile } from "fs/promises";
import { randomUUID } from "crypto";

interface FreshScript {
  hook: string;
  body: string;
  onScreenText: string[];
  visualNote: string;
  duration: number;
}

interface VoiceConfig {
  gender: "male" | "female";
  style: "analytical" | "enthusiastic" | "documentary" | "conversational";
}

const EDGE_TTS_VOICES: Record<string, Record<string, string>> = {
  male: {
    analytical: "en-US-GuyNeural",
    enthusiastic: "en-US-TonyNeural",
    documentary: "en-GB-RyanNeural",
    conversational: "en-US-ChristopherNeural",
  },
  female: {
    analytical: "en-US-JennyNeural",
    enthusiastic: "en-US-AriaNeural",
    documentary: "en-GB-SoniaNeural",
    conversational: "en-IN-NeerjaNeural",
  },
};

/**
 * Fresh mode: Generate a brand-new Short from script content.
 *
 * 1. Use Edge-TTS to generate audio from the short script
 * 2. Create a simple visual (text on dark background) via FFmpeg drawtext
 * 3. Combine audio + visual into vertical 9:16 MP4
 */
export async function generateFreshShort(
  jobId: string,
  script: FreshScript,
  voiceConfig: VoiceConfig,
  workDir: string
): Promise<Buffer> {
  const voice = EDGE_TTS_VOICES[voiceConfig.gender]?.[voiceConfig.style]
    ?? EDGE_TTS_VOICES.male.conversational;

  // ── Generate audio ─────────────────────────────────────────────
  const fullText = `${script.hook} ${script.body}`;
  const audioPath = `${workDir}/short_audio_${randomUUID()}.mp3`;

  await generateEdgeTTS(fullText, voice, audioPath);

  // ── Build visual with on-screen text ───────────────────────────
  // Dark background with animated text overlays
  const textLines = script.onScreenText.length > 0
    ? script.onScreenText
    : [script.hook];

  const drawTextFilters = textLines
    .map((line, i) => {
      const y = 400 + i * 120;
      const escapedLine = line.replace(/'/g, "'\\''").replace(/:/g, "\\:");
      return `drawtext=text='${escapedLine}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=56:fontcolor=white:x=(w-text_w)/2:y=${y}:enable='between(t,${i * 2},${script.duration})'`;
    })
    .join(",");

  const outputPath = `${workDir}/short_final_${randomUUID()}.mp4`;

  const ffmpegArgs = [
    "-f", "lavfi",
    "-i", `color=c=0x0a0a0a:s=1080x1920:d=${script.duration}`,
    "-i", audioPath,
    "-vf", drawTextFilters || "null",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-y", outputPath,
  ];

  await runFFmpegLocal(ffmpegArgs);

  return readFile(outputPath);
}

async function generateEdgeTTS(
  text: string,
  voice: string,
  outputPath: string
): Promise<void> {
  const textPath = `${outputPath}.txt`;
  await writeFile(textPath, text, "utf-8");

  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      ["edge-tts", "--file", textPath, "--voice", voice, "--write-media", outputPath],
      { timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`Edge-TTS failed: ${error.message}. stderr: ${stderr}`));
        } else {
          resolve();
        }
      }
    );
  });
}

async function runFFmpegLocal(args: string[]): Promise<void> {
  const ffmpegBin = process.env.FFMPEG_PATH ?? "/usr/bin/ffmpeg";

  return new Promise((resolve, reject) => {
    execFile(
      ffmpegBin,
      args,
      { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`FFmpeg failed: ${error.message}\nstderr: ${stderr.slice(-500)}`));
        } else {
          resolve();
        }
      }
    );
  });
}

import type { Handler } from "aws-lambda";
import { AudioGenInput, type AudioGenInputType, type AudioGenOutputType } from "@rrq/lambda-types";
import { selectAccount, incrementUsage } from "./elevenlabs-rotation";
import { generateElevenLabs } from "./elevenlabs";
import { generateEdgeTTS } from "./edge-tts";
import { parseVoiceCues } from "./voice-cues";
import { uploadToS3, concatAudioChunks } from "./s3";

/**
 * audio-gen Lambda
 *
 * Generates voiceover audio from script sections.
 * ElevenLabs with 4-account rotation → Edge-TTS fallback.
 * Outputs per-section MP3s + stitched full voiceover + voice cue map.
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: AudioGenInputType = AudioGenInput.parse(event);
    console.log(`[audio-gen] Starting job ${input.jobId}, ${input.sections.length} sections`);

    // ── Select voice ────────────────────────────────────────────────
    const voiceSelection = selectVoice(input);
    console.log(`[audio-gen] Voice: ${voiceSelection.engine} / ${voiceSelection.voiceId}`);

    // ── Generate per-section audio ──────────────────────────────────
    const sectionResults: Array<{
      sectionId: string;
      s3Key: string;
      durationMs: number;
      audioBuffer: Buffer;
    }> = [];

    let cumulativeMs = 0;

    for (const section of input.sections) {
      console.log(`[audio-gen][${input.jobId}] Generating section ${section.id}`);

      // Strip [PAUSE] markers before TTS — we insert silence later in av-sync
      const cleanScript = section.script.replace(/\[PAUSE\]/g, "");

      let audioBuffer: Buffer;

      if (voiceSelection.engine === "elevenlabs") {
        try {
          audioBuffer = await generateElevenLabs(
            cleanScript,
            voiceSelection.voiceId,
            voiceSelection.apiKey!
          );
          await incrementUsage(voiceSelection.accountId!, cleanScript.length);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.startsWith("ELEVENLABS_PLAN_ERROR:")) {
            console.warn(`[audio-gen][${input.jobId}] ElevenLabs plan limit — falling back to Edge-TTS`);
            const edgeVoiceId = EDGE_TTS_VOICES[input.voiceConfig.gender]?.[input.voiceConfig.style]
              ?? EDGE_TTS_VOICES.male.conversational;
            audioBuffer = await generateEdgeTTS(cleanScript, edgeVoiceId);
            // Switch all remaining sections to Edge-TTS
            voiceSelection.engine = "edge-tts";
            voiceSelection.voiceId = edgeVoiceId;
          } else {
            throw err;
          }
        }
      } else {
        audioBuffer = await generateEdgeTTS(cleanScript, voiceSelection.voiceId);
      }

      // Estimate duration: ~150 words/min for natural speech
      const wordCount = cleanScript.split(/\s+/).length;
      const estimatedDurationMs = Math.round((wordCount / 150) * 60 * 1000);

      const s3Key = `jobs/${input.jobId}/audio/section_${section.id}.mp3`;
      await uploadToS3(s3Key, audioBuffer, "audio/mpeg");

      sectionResults.push({
        sectionId: section.id,
        s3Key,
        durationMs: estimatedDurationMs,
        audioBuffer,
      });

      cumulativeMs += estimatedDurationMs;
    }

    // ── Stitch full voiceover ───────────────────────────────────────
    const fullVoiceoverBuffer = concatAudioChunks(
      sectionResults.map((r) => r.audioBuffer)
    );
    const voiceoverS3Key = `jobs/${input.jobId}/audio/voiceover.mp3`;
    await uploadToS3(voiceoverS3Key, fullVoiceoverBuffer, "audio/mpeg");

    // ── Parse voice cues from script sections ──────────────────────
    const cueMap = parseVoiceCues(input.sections, sectionResults);

    console.log(`[audio-gen][${input.jobId}] Complete. Total duration: ${cumulativeMs}ms`);

    const output: AudioGenOutputType = {
      voiceoverUrl: voiceoverS3Key,
      sectionAudioUrls: sectionResults.map((r) => ({
        sectionId: r.sectionId,
        s3Key: r.s3Key,
        durationMs: r.durationMs,
      })),
      totalDurationMs: cumulativeMs,
      voiceUsed: voiceSelection.engine,
      voiceId: voiceSelection.voiceId,
      cueMap,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[audio-gen][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

// ─── Voice Selection Logic ─────────────────────────────────────────────────

const ELEVENLABS_VOICES: Record<string, Record<string, string>> = {
  male: {
    analytical: "TX3LPaxmHKxFdv7VOQHJ",
    enthusiastic: "VR6AewLTigWG4xSOukaG",
    documentary: "onwK4e9ZLuTAKqWW03F9",
    conversational: "pNInz6obpgDQGcFmaJgB",
  },
  female: {
    analytical: "EXAVITQu4vr4xnSDxMaL",
    enthusiastic: "MF3mGyEYCl7XYWbV9V6O",
    documentary: "jsCqWAovK2LkecY7zXl4",
    conversational: "ThT5KcBeYPX3keUQqHPh",
  },
};

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

interface VoiceSelection {
  engine: "elevenlabs" | "edge-tts";
  voiceId: string;
  apiKey?: string;
  accountId?: string;
}

function selectVoice(input: AudioGenInputType): VoiceSelection {
  const { gender, style } = input.voiceConfig;

  // Check if user has a custom voice override
  if (input.customVoiceId) {
    const account = selectAccount(0); // just get any available account
    if (account) {
      return {
        engine: "elevenlabs",
        voiceId: input.customVoiceId,
        apiKey: account.apiKey,
        accountId: account.id,
      };
    }
  }

  // Calculate total char count across all sections
  const totalChars = input.sections.reduce(
    (sum, s) => sum + s.script.replace(/\[PAUSE\]/g, "").length,
    0
  );

  // Try ElevenLabs first
  const account = selectAccount(totalChars);
  if (account) {
    const voiceId = ELEVENLABS_VOICES[gender]?.[style] ?? ELEVENLABS_VOICES.male.conversational;
    return {
      engine: "elevenlabs",
      voiceId,
      apiKey: account.apiKey,
      accountId: account.id,
    };
  }

  // Fallback to Edge-TTS
  const edgeVoiceId = EDGE_TTS_VOICES[gender]?.[style] ?? EDGE_TTS_VOICES.male.conversational;
  return {
    engine: "edge-tts",
    voiceId: edgeVoiceId,
  };
}

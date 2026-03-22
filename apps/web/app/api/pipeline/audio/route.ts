import { auth } from "@clerk/nextjs/server";
import { invokeAudioGen } from "@rrq/lambda-client";
import { createSSEStream, SSE_HEADERS } from "@/lib/pipeline-sse";
import type { ScriptOutput } from "@/lib/types/pipeline";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { scriptOutput, jobId } = body as {
    scriptOutput: ScriptOutput;
    jobId: string;
  };

  if (!scriptOutput || !jobId) {
    return Response.json(
      { error: "scriptOutput and jobId are required" },
      { status: 400 }
    );
  }

  const { stream, emit, done } = createSSEStream();

  // Normalise voiceConfig.style — the script LLM sometimes returns verbose descriptions
  const VALID_STYLES = ["analytical", "enthusiastic", "documentary", "conversational"] as const;
  type VoiceStyle = typeof VALID_STYLES[number];

  function normaliseStyle(raw: string): VoiceStyle {
    const lower = raw.toLowerCase();
    if (lower.includes("analyt")) return "analytical";
    if (lower.includes("enthus")) return "enthusiastic";
    if (lower.includes("doc")) return "documentary";
    return "conversational";
  }

  const rawStyle = scriptOutput.voiceConfig?.style ?? "conversational";
  const safeStyle: VoiceStyle = (VALID_STYLES as readonly string[]).includes(rawStyle)
    ? rawStyle as VoiceStyle
    : normaliseStyle(rawStyle);

  // Normalise gender — LLM sometimes returns "Male", "MALE", or garbled variants
  const rawGender = (scriptOutput.voiceConfig?.gender ?? "female").toLowerCase().trim();
  const safeGender: "male" | "female" = rawGender.startsWith("m") ? "male" : "female";

  (async () => {
    try {
      emit({ type: "status_line", message: "Analysing script for tone and pacing cues…" });
      emit({ type: "stage_complete", stageIndex: 0 });

      emit({ type: "status_line", message: "Selecting the best voice for your content style…" });
      emit({ type: "stage_complete", stageIndex: 1 });

      emit({ type: "status_line", message: "Generating voiceover with natural expression…" });

      const audioOutput = await invokeAudioGen({
        jobId,
        sections: scriptOutput.sections.map((s) => ({
          id: s.id,
          script: s.script,
          toneNote: s.toneNote,
        })),
        voiceConfig: {
          ...scriptOutput.voiceConfig,
          style: safeStyle,
          gender: safeGender,
        },
      });

      emit({ type: "stage_complete", stageIndex: 2 });
      emit({ type: "status_line", message: "Saving audio for video production…" });
      emit({ type: "stage_complete", stageIndex: 3 });

      emit({ type: "result", data: audioOutput });
    } catch (error) {
      console.error(`[api/pipeline/audio:${userId}] Audio generation failed:`, error);
      emit({
        type: "error",
        error: error instanceof Error ? error.message : "Audio generation failed",
      });
    } finally {
      done();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}

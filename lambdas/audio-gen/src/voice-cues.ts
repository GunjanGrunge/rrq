import type { VoiceCueMapType } from "@rrq/lambda-types";

/**
 * Voice cue markers embedded by the script writer:
 *   [RISE] [PEAK] [DROP] [WARM] [QUESTION] [PIVOT] [EMPHASIS]
 *
 * This parser extracts their positions and maps them to SkyReels
 * expression hints for avatar facial expression timing.
 */

const CUE_PATTERN = /\[(RISE|PEAK|DROP|WARM|QUESTION|PIVOT|EMPHASIS)\]/g;

const CUE_TO_EXPRESSION: Record<string, string> = {
  RISE: "curious anticipation, slight brow raise",
  PEAK: "confident assertion, direct eye contact",
  DROP: "reflective pause, slight head tilt",
  WARM: "conversational warmth, gentle smile",
  QUESTION: "open curiosity, questioning brow",
  PIVOT: "shift energy, brief neutral reset",
  EMPHASIS: "focused intensity on single word",
};

type ValidCue = "RISE" | "PEAK" | "DROP" | "WARM" | "QUESTION" | "PIVOT" | "EMPHASIS";

interface SectionResult {
  sectionId: string;
  durationMs: number;
}

interface SectionInput {
  id: string;
  script: string;
}

/**
 * Parse voice cues from all script sections and map them to timestamps.
 *
 * Cue timestamps are estimated by character position within each section,
 * scaled by that section's audio duration.
 */
export function parseVoiceCues(
  sections: SectionInput[],
  sectionResults: SectionResult[]
): VoiceCueMapType[] {
  const cues: VoiceCueMapType[] = [];
  let cumulativeMs = 0;

  for (const section of sections) {
    const result = sectionResults.find((r) => r.sectionId === section.id);
    if (!result) continue;

    const cleanScript = section.script.replace(/\[PAUSE\]/g, "");
    const totalChars = cleanScript.replace(CUE_PATTERN, "").length;

    let match: RegExpExecArray | null;
    const cueRegex = new RegExp(CUE_PATTERN.source, "g");

    // Track character position without cue markers
    let charsSoFar = 0;
    let lastIndex = 0;

    while ((match = cueRegex.exec(cleanScript)) !== null) {
      // Count characters between last match and this one (excluding markers)
      const textBetween = cleanScript
        .slice(lastIndex, match.index)
        .replace(CUE_PATTERN, "");
      charsSoFar += textBetween.length;
      lastIndex = match.index + match[0].length;

      // Estimate timestamp based on character position ratio
      const ratio = totalChars > 0 ? charsSoFar / totalChars : 0;
      const timestampMs = cumulativeMs + ratio * result.durationMs;

      const cue = match[1] as ValidCue;
      cues.push({
        timestamp: Math.round(timestampMs) / 1000, // seconds
        cue,
        expressionHint: CUE_TO_EXPRESSION[cue] ?? "neutral expression",
      });
    }

    cumulativeMs += result.durationMs;
  }

  return cues;
}

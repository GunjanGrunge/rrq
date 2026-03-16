import type { AudioGenOutputType } from "@rrq/lambda-types";

export function buildSRT(
  sections: Array<{ id: string; script: string }>,
  audioOutput: AudioGenOutputType
): string {
  const lines: string[] = [];
  let index = 1;
  let cumulativeMs = 0;

  for (const section of sections) {
    const audioSection = audioOutput.sectionAudioUrls.find(
      (a: { sectionId: string; s3Key: string; durationMs: number }) => a.sectionId === section.id
    );
    const durationMs = audioSection?.durationMs ?? 5000;

    // Split into ~10-word subtitle chunks
    const words = section.script.replace(/\[.*?\]/g, "").split(/\s+/).filter(Boolean);
    const chunkSize = 10;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      const chunkStartRatio = i / words.length;
      const chunkEndRatio = Math.min((i + chunkSize) / words.length, 1);

      const startMs = cumulativeMs + Math.round(chunkStartRatio * durationMs);
      const endMs = cumulativeMs + Math.round(chunkEndRatio * durationMs);

      lines.push(String(index++));
      lines.push(`${fmtSRT(startMs)} --> ${fmtSRT(endMs)}`);
      lines.push(chunk);
      lines.push("");
    }

    cumulativeMs += durationMs;
  }

  return lines.join("\n");
}

export function fmtSRT(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const ml = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ml).padStart(3, "0")}`;
}

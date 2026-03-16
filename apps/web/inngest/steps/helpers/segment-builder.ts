import type { AudioGenOutputType } from "@rrq/lambda-types";

export interface BuiltSegment {
  sectionId: string;
  displayMode: "avatar-fullscreen" | "broll-with-corner-avatar" | "broll-only" | "visual-asset";
  startMs: number;
  endMs: number;
  avatarS3Key: undefined;
  brollS3Key: undefined;
  visualS3Key: undefined;
}

export function buildSegments(
  sections: Array<{ id: string; displayMode: string }>,
  audioOutput: AudioGenOutputType
): BuiltSegment[] {
  let cumulativeMs = 0;
  return sections.map((section) => {
    const audioSection = audioOutput.sectionAudioUrls.find(
      (a: { sectionId: string; s3Key: string; durationMs: number }) => a.sectionId === section.id
    );
    const durationMs = audioSection?.durationMs ?? 5000;
    const startMs = cumulativeMs;
    const endMs = cumulativeMs + durationMs;
    cumulativeMs = endMs;

    return {
      sectionId: section.id,
      displayMode: section.displayMode as BuiltSegment["displayMode"],
      startMs,
      endMs,
      avatarS3Key: undefined,
      brollS3Key: undefined,
      visualS3Key: undefined,
    };
  });
}

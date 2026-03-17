import type { AudioGenOutputType, SkyReelsSegmentType, Wan2SegmentType } from "@rrq/lambda-types";

export interface BuiltSegment {
  sectionId: string;
  displayMode: "avatar-fullscreen" | "broll-with-corner-avatar" | "broll-only" | "visual-asset";
  startMs: number;
  endMs: number;
  avatarS3Key: string | undefined;
  brollS3Key: string | undefined;
  visualS3Key: undefined;
}

export function buildSegments(
  sections: Array<{ id: string; displayMode: string }>,
  audioOutput: AudioGenOutputType,
  skyreelsSegments: SkyReelsSegmentType[] = [],
  wan2Segments: Wan2SegmentType[] = []
): BuiltSegment[] {
  let cumulativeMs = 0;
  return sections.map((section) => {
    const audioSection = audioOutput.sectionAudioUrls.find(
      (a) => a.sectionId === section.id
    );
    const durationMs = audioSection?.durationMs ?? 5000;
    const startMs = cumulativeMs;
    const endMs = cumulativeMs + durationMs;
    cumulativeMs = endMs;

    const skyreelsSeg = skyreelsSegments.find((s) => s.sectionId === section.id);
    const wan2Seg = wan2Segments.find((s) => s.sectionId === section.id);

    return {
      sectionId: section.id,
      displayMode: section.displayMode as BuiltSegment["displayMode"],
      startMs,
      endMs,
      avatarS3Key: skyreelsSeg?.s3Key,
      brollS3Key: wan2Seg?.s3Key,
      visualS3Key: undefined,
    };
  });
}

import type {
  AudioGenOutputType,
  SkyReelsSegmentType,
  Wan2SegmentType,
  VisualGenOutputType,
  ResearchVisualOutputType,
} from "@rrq/lambda-types";

export interface BuiltSegment {
  sectionId: string;
  displayMode: "avatar-fullscreen" | "broll-with-corner-avatar" | "broll-only" | "visual-asset";
  startMs: number;
  endMs: number;
  avatarS3Key: string | undefined;
  brollS3Key: string | undefined;
  visualS3Key: string | undefined;
}

export function buildSegments(
  sections: Array<{ id: string; displayMode: string }>,
  audioOutput: AudioGenOutputType,
  skyreelsSegments: SkyReelsSegmentType[] = [],
  wan2Segments: Wan2SegmentType[] = [],
  visualGenAssets: VisualGenOutputType["assets"] = [],
  researchVisualAssets: ResearchVisualOutputType["assets"] = []
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

    // Resolve visual S3 key: prefer visual-gen output, fall back to research-visual
    const visualGenAsset = visualGenAssets.find((a) => a.id === section.id);
    const researchVisualAsset = researchVisualAssets.find((a) => a.beatId === section.id);
    const visualS3Key = visualGenAsset?.s3Key ?? researchVisualAsset?.s3Key;

    return {
      sectionId: section.id,
      displayMode: section.displayMode as BuiltSegment["displayMode"],
      startMs,
      endMs,
      avatarS3Key: skyreelsSeg?.s3Key,
      brollS3Key: wan2Seg?.s3Key,
      visualS3Key,
    };
  });
}

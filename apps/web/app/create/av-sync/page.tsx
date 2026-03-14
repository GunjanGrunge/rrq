"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function AVSyncPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(10); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={10}
      title="AV Sync"
      description="FFmpeg Lambda stitches all media segments — avatar talking-head, b-roll, FLUX images, and visual assets — with the voiceover audio. Burns in subtitles and produces the final YouTube-ready MP4."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      }
      infraTags={[
        { label: "av-sync Lambda — FFmpeg stitch", phase: "Phase 3", status: "ready" },
        { label: "Subtitle burn-in (SRT → video)", phase: "Phase 3", status: "ready" },
        { label: "All Phase 4 media outputs required as input", phase: "Phase 4", status: "pending" },
      ]}
      subTasks={[
        { label: "Collect all media from S3: avatar MP4, b-roll, images, visuals", done: false },
        { label: "Build FFmpeg concat manifest from MuseBlueprint beat order", done: false },
        { label: "Stitch segments with voiceover audio track", done: false },
        { label: "Burn in subtitles from voiceover timestamps", done: false },
        { label: "Upload final_youtube.mp4 to S3 jobs/{jobId}/", done: false },
      ]}
      estimatedTime="~3 minutes"
      prerequisiteStep={9}
      prerequisiteLabel="Visual Assets (Step 09)"
    />
  );
}

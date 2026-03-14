"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function ShortsPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(12); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={12}
      title="Shorts Generation"
      description="Two paths: Option A converts the best 45–60s clip from the main video using FFmpeg (fast, zero extra cost). Option B generates a fresh vertical Short via Haiku script + Edge-TTS when the main video doesn't have a strong standalone clip. Shorts are published 2–3 hours before the main video."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="2" width="12" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      }
      infraTags={[
        { label: "shorts-gen Lambda — FFmpeg convert (Option A)", phase: "Phase 3", status: "ready" },
        { label: "Haiku script + Edge-TTS (Option B — fresh Short)", phase: "Phase 3", status: "ready" },
        { label: "9:16 vertical crop, 45–60 second max", phase: "Phase 3", status: "ready" },
      ]}
      subTasks={[
        { label: "Evaluate main video for a strong standalone 45–60s clip", done: false },
        { label: "Option A: FFmpeg crop + reformat to 9:16 vertical", done: false },
        { label: "Option B: Haiku generates Short script, Edge-TTS records audio", done: false },
        { label: "Upload final_short.mp4 to S3 jobs/{jobId}/", done: false },
        { label: "Schedule Short upload 2–3 hours before main video", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={11}
      prerequisiteLabel="Vera QA (Step 11)"
    />
  );
}

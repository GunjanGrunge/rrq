"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function UploadPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(13); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={13}
      title="YouTube Upload"
      description="YouTube Data API v3 — uploads Short first (2–3 hrs early), then main video at the scheduled slot. Sets title, description, tags, thumbnail, and playlist from the SEO step. Theo pins the opening comment and posts a community update."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      }
      infraTags={[
        { label: "uploader Lambda — YouTube Data API v3", phase: "Phase 3", status: "ready" },
        { label: "YouTube OAuth token from DynamoDB user-tokens", phase: "Phase 3", status: "ready" },
        { label: "THEO agent — comment pin + community post", phase: "Phase 7", status: "pending" },
      ]}
      subTasks={[
        { label: "Upload final_short.mp4 as YouTube Short (unlisted, scheduled)", done: false },
        { label: "Upload final_youtube.mp4 as main video with full metadata", done: false },
        { label: "Set thumbnail (thumbnail_a.jpg from FLUX step)", done: false },
        { label: "Assign to playlist from Regum's schedule", done: false },
        { label: "Theo pins opening comment + posts community update", done: false },
        { label: "Report video IDs back to Zeus for monitoring", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={12}
      prerequisiteLabel="Shorts Generation (Step 12)"
    />
  );
}

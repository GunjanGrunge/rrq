"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function ImagesPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(8); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={8}
      title="Image Generation"
      description="FLUX.2 [klein] 4B FP8 on EC2 g4dn.xlarge (always-on, 1yr reserved). Section cards, concept images, and thumbnail source PNGs. Max 3 retries per image with Vera QA inline after each attempt. Runs in parallel with Avatar (Step 06) and B-Roll (Step 07)."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      }
      infraTags={[
        { label: "EC2 g4dn.xlarge reserved — FLUX.2 [klein] 4B FP8", phase: "Phase 4c", status: "pending" },
        { label: "FastAPI inference server on :8080 (always hot)", phase: "Phase 4c", status: "pending" },
        { label: "Vera QA inline after each generation attempt", phase: "Phase 4c", status: "pending" },
      ]}
      subTasks={[
        { label: "Parse SECTION_CARD / CONCEPT_IMAGE / THUMBNAIL_SRC beats from MuseBlueprint", done: false },
        { label: "Build FLUX.2 prompt per beat (quality preset: high, 40 steps)", done: false },
        { label: "Generate image via FastAPI server", done: false },
        { label: "Vera QA inline — max 3 retries with prompt refinement on failure", done: false },
        { label: "Upload PNGs to S3 jobs/{jobId}/visuals/", done: false },
      ]}
      estimatedTime="~3 minutes (parallel with Avatar + B-Roll)"
      prerequisiteStep={5}
      prerequisiteLabel="Audio Generation (Step 05)"
    />
  );
}

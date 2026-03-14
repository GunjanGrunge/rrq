"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function BRollPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(7); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={7}
      title="B-Roll Generation"
      description="Wan2.2-T2V-A14B FP8 on EC2 g5.2xlarge spot. Text prompts from the MuseBlueprint → atmospheric video b-roll segments at 720p. VBench score 84.7%. Runs in parallel with Avatar (Step 06) and Images (Step 08)."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
        </svg>
      }
      infraTags={[
        { label: "EC2 g5.2xlarge spot — Wan2.2-T2V-A14B FP8", phase: "Phase 4b", status: "pending" },
        { label: "1× A10G GPU, 24 GB VRAM", phase: "Phase 4b", status: "pending" },
        { label: "Haiku prompt builder (visualNote → Wan2.2 prompt)", phase: "Phase 4b", status: "pending" },
      ]}
      subTasks={[
        { label: "Parse B_ROLL beats from MuseBlueprint", done: false },
        { label: "Build structured Wan2.2 prompt via Haiku", done: false },
        { label: "Launch EC2 spot instance from AMI", done: false },
        { label: "Run Wan2.2 T2V inference (~10 min)", done: false },
        { label: "Upload b-roll MP4s to S3 jobs/{jobId}/broll/", done: false },
        { label: "Self-terminate EC2 instance", done: false },
      ]}
      estimatedTime="~10 minutes (parallel with Avatar + Images)"
      prerequisiteStep={5}
      prerequisiteLabel="Audio Generation (Step 05)"
    />
  );
}

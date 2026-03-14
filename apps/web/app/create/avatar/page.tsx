"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function AvatarPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(6); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={6}
      title="Avatar Generation"
      description="SkyReels V2-I2V-14B-720P on EC2 g5.12xlarge spot instance. Static reference portrait + voiceover audio → talking head MP4 segments with 33 expression modes. Instance launches per job and self-terminates on completion."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      }
      infraTags={[
        { label: "EC2 g5.12xlarge spot — SkyReels V2-I2V-14B-720P", phase: "Phase 4a", status: "pending" },
        { label: "4× A10G GPUs, 96 GB VRAM", phase: "Phase 4a", status: "pending" },
        { label: "Avatar portrait in S3 avatars/{id}/reference.jpg", phase: "Phase 4a", status: "pending" },
      ]}
      subTasks={[
        { label: "Select avatar persona by topic (tech / lifestyle / finance / beauty / documentary)", done: false },
        { label: "Launch EC2 spot instance from AMI", done: false },
        { label: "Run SkyReels V2 I2V inference (~12 min)", done: false },
        { label: "Upload talking-head MP4 segments to S3", done: false },
        { label: "Self-terminate EC2 instance", done: false },
      ]}
      estimatedTime="~12 minutes"
      prerequisiteStep={5}
      prerequisiteLabel="Audio Generation (Step 05)"
    />
  );
}

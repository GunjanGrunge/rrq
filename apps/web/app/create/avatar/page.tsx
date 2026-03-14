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
      title="Creating Your Presenter"
      description="A photorealistic presenter is being animated to deliver your script. The presenter's face, expressions, and delivery are matched to the voiceover to create natural talking-head segments for your video."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      }
      subTasks={[
        { label: "Select presenter based on your topic and niche", done: false },
        { label: "Sync facial expressions to voiceover timing", done: false },
        { label: "Render presenter video segments", done: false },
        { label: "Save presenter clips for final assembly", done: false },
      ]}
      estimatedTime="~12 minutes"
      prerequisiteStep={5}
      prerequisiteLabel="Voiceover (Step 05)"
    />
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";

export default function AvatarPage() {
  const { setStep, stepStatuses, rerunStep } = usePipelineStore();
  const router = useRouter();
  useEffect(() => { setStep(6); }, [setStep]);

  if (stepStatuses[6] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={6}
          stepLabel="Avatar"
          errorMessage="Avatar generation failed. This may be a temporary EC2 issue."
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[6].length}
          onRerunStep={() => { rerunStep(6); router.push("/create/avatar"); }}
        />
      </div>
    );
  }

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

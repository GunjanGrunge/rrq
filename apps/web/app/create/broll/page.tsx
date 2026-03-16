"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";

export default function BRollPage() {
  const { setStep, stepStatuses, rerunStep } = usePipelineStore();
  const router = useRouter();
  useEffect(() => { setStep(7); }, [setStep]);

  if (stepStatuses[7] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={7}
          stepLabel="B-Roll"
          errorMessage="B-Roll generation failed. This may be a temporary EC2 issue."
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[7].length}
          onRerunStep={() => { rerunStep(7); router.push("/create/broll"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={7}
      title="Generating B-Roll Footage"
      description="Atmospheric video clips are being created to support your script's key moments — cinematic visuals that reinforce the story and keep viewers engaged between presenter segments. Runs at the same time as your presenter and graphics."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
        </svg>
      }
      subTasks={[
        { label: "Identify scenes in your script that need visual support", done: false },
        { label: "Build a visual brief for each scene", done: false },
        { label: "Generate cinematic video clips", done: false },
        { label: "Save clips for final video assembly", done: false },
      ]}
      estimatedTime="~10 minutes (runs in parallel)"
      prerequisiteStep={5}
      prerequisiteLabel="Voiceover (Step 05)"
    />
  );
}

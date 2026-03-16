"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function AVSyncPage() {
  const { setStep, stepStatuses, rerunStep } = usePipelineStore();
  const router = useRouter();
  useEffect(() => { setStep(10); }, [setStep]);

  if (stepStatuses[10] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={10}
          stepLabel="AV Sync"
          errorMessage="AV Sync generation failed."
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[10].length}
          onRerunStep={() => { rerunStep(10); router.push("/create/av-sync"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={10}
      title="Assembling Your Video"
      description="All produced assets — presenter segments, b-roll footage, graphics, and visual overlays — are being assembled in the correct order and synced with the voiceover. Subtitles are added and the final video is packaged ready for quality review."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      }
      subTasks={[
        { label: "Gather all produced assets — presenter, b-roll, graphics, visuals", done: false },
        { label: "Arrange assets in script order", done: false },
        { label: "Sync all visual segments to the voiceover track", done: false },
        { label: "Burn in subtitles with accurate timing", done: false },
        { label: "Package final video for quality review", done: false },
      ]}
      estimatedTime="~3 minutes"
      prerequisiteStep={9}
      prerequisiteLabel="Data Visuals (Step 09)"
    />
  );
}

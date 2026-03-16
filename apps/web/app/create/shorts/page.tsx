"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function ShortsPage() {
  const { setStep, stepStatuses, rerunStep } = usePipelineStore();
  const router = useRouter();
  useEffect(() => { setStep(12); }, [setStep]);

  if (stepStatuses[12] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={12}
          stepLabel="Shorts"
          errorMessage="Shorts generation failed."
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[12].length}
          onRerunStep={() => { rerunStep(12); router.push("/create/shorts"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={12}
      title="Creating Your Short"
      description="Your video is being adapted into a vertical Short. If there's a strong standalone moment in the main video, it's extracted and reformatted. If not, a fresh Short is written and produced specifically for the vertical format. Shorts go live 2–3 hours before the main video to build early momentum."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="2" width="12" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      }
      subTasks={[
        { label: "Review the main video for a strong 45–60 second standalone clip", done: false },
        { label: "Extract and reformat the best clip to vertical 9:16", done: false },
        { label: "If no strong clip found — write and produce a fresh Short instead", done: false },
        { label: "Package the Short for upload", done: false },
        { label: "Schedule Short to publish 2–3 hours ahead of the main video", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={11}
      prerequisiteLabel="Quality Check (Step 11)"
    />
  );
}

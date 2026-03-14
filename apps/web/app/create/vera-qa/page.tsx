"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function VeraQAPage() {
  const { setStep, stepStatuses } = usePipelineStore();
  const { proceedAfterVeraQA } = useDirectorNavigation();

  useEffect(() => { setStep(11); }, [setStep]);

  useEffect(() => {
    if (stepStatuses[11] === "complete") {
      proceedAfterVeraQA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepStatuses[11]]);

  return (
    <PipelineStepWaiting
      stepNumber={11}
      title="Final Quality Check"
      description="A dedicated quality agent reviews your completed video across three areas before it can be published: audio clarity and pacing, visual quality and timing, and platform standards including brand consistency and compliance. If anything falls short, only the affected areas are re-checked — nothing is re-done unnecessarily."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      }
      subTasks={[
        { label: "Review audio — clarity, pacing, and expression accuracy", done: false },
        { label: "Review visuals — resolution, quality, and timing", done: false },
        { label: "Review standards — brand consistency, copyright, platform compliance", done: false },
        { label: "Confirm all areas pass before sending to publish", done: false },
        { label: "Flag and re-check any areas that don't meet the standard", done: false },
      ]}
      estimatedTime="~1 minute"
      prerequisiteStep={10}
      prerequisiteLabel="Video Assembly (Step 10)"
    />
  );
}

"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function VisualsPage() {
  const { setStep, stepStatuses } = usePipelineStore();
  const { proceedAfterVisuals } = useDirectorNavigation();

  useEffect(() => { setStep(9); }, [setStep]);

  useEffect(() => {
    if (stepStatuses[9] === "complete") {
      proceedAfterVisuals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepStatuses[9]]);

  return (
    <PipelineStepWaiting
      stepNumber={9}
      title="Rendering Data Visuals"
      description="Charts, diagrams, slides, and any data-driven visuals referenced in your script are being rendered. These are matched to your video's dark visual theme and exported as high-quality assets ready for the final edit."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      }
      subTasks={[
        { label: "Identify charts, diagrams, and slides in the script", done: false },
        { label: "Apply your video's visual theme to each asset", done: false },
        { label: "Render all visuals at full quality", done: false },
        { label: "Export as images or short animations as needed", done: false },
        { label: "Save visuals for final video assembly", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={5}
      prerequisiteLabel="Voiceover (Step 05)"
    />
  );
}

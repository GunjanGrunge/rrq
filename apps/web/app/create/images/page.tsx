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
      title="Building Graphics & Images"
      description="Custom graphics, section cards, charts, and your thumbnail source image are being created to match your script's structure and visual style. Each asset is quality-checked before being included in the video. Runs at the same time as your presenter and b-roll."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      }
      subTasks={[
        { label: "Identify sections that need visual callouts or data graphics", done: false },
        { label: "Design section cards and concept visuals", done: false },
        { label: "Create thumbnail source image", done: false },
        { label: "Quality-check all graphics — retry if needed", done: false },
        { label: "Save assets for final video assembly", done: false },
      ]}
      estimatedTime="~3 minutes (runs in parallel)"
      prerequisiteStep={5}
      prerequisiteLabel="Voiceover (Step 05)"
    />
  );
}

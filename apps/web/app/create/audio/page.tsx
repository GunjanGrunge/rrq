"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function AudioPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(5); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={5}
      title="Generating Voiceover"
      description="Your script is being converted into a natural-sounding voiceover. Tone, pacing, and emotional emphasis are applied based on your brief and content structure."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      }
      subTasks={[
        { label: "Analyse script for tone and pacing cues", done: false },
        { label: "Select the best voice for your content style", done: false },
        { label: "Generate full voiceover with natural expression", done: false },
        { label: "Apply fallback voice if needed", done: false },
        { label: "Save audio for video production", done: false },
      ]}
      estimatedTime="~45 seconds"
      prerequisiteStep={4}
      prerequisiteLabel="Quality Review (Step 04)"
    />
  );
}

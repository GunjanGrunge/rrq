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
      title="Audio Generation"
      description="ElevenLabs across 4 rotating accounts (40k free chars each). Voice cue markers (RISE / PEAK / DROP / WARM / QUESTION / PIVOT) parsed from the script and mapped to ElevenLabs expression settings. Edge-TTS fallback if all accounts are exhausted."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      }
      infraTags={[
        { label: "ElevenLabs — 4-account rotation", phase: "Phase 3", status: "ready" },
        { label: "Edge-TTS — fallback synthesis", phase: "Phase 3", status: "ready" },
        { label: "audio-gen Lambda worker", phase: "Phase 3", status: "ready" },
      ]}
      subTasks={[
        { label: "Parse voice cue markers from script (RISE/PEAK/DROP/WARM/QUESTION/PIVOT)", done: false },
        { label: "Select ElevenLabs account with lowest char usage", done: false },
        { label: "Generate voiceover with expression settings", done: false },
        { label: "Fallback to Edge-TTS if quota exceeded", done: false },
        { label: "Upload MP3 to S3 jobs/{jobId}/voiceover.mp3", done: false },
      ]}
      estimatedTime="~45 seconds"
      prerequisiteStep={4}
      prerequisiteLabel="Quality Gate (Step 04)"
    />
  );
}

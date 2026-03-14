"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function UploadPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(13); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={13}
      title="Publishing to YouTube"
      description="Your Short and main video are being uploaded to your connected YouTube channel. All metadata — title, description, tags, thumbnail, and playlist — is applied from the SEO step. Your channel manager pins the opening comment and posts a community update to drive early engagement."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      }
      subTasks={[
        { label: "Upload Short — scheduled to go live 2–3 hours early", done: false },
        { label: "Upload main video with full title, description, and tags", done: false },
        { label: "Set the approved thumbnail", done: false },
        { label: "Assign to the correct playlist", done: false },
        { label: "Pin opening comment and post a community update", done: false },
        { label: "Hand off to Zeus for ongoing performance monitoring", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={12}
      prerequisiteLabel="Shorts (Step 12)"
    />
  );
}

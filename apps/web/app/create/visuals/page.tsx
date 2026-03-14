"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function VisualsPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(9); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={9}
      title="Visual Assets"
      description="Puppeteer Lambda with Chart.js, Mermaid, and 8 dark-themed HTML templates. Handles CHART, DIAGRAM, SLIDE, GRAPHIC_OVERLAY, and SCREEN_RECORD beats from the MuseBlueprint. Browser-quality render, CSS animations, any visual type."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      }
      infraTags={[
        { label: "visual-gen Lambda — Puppeteer + Chromium", phase: "Phase 3", status: "ready" },
        { label: "Chart.js / Mermaid / HTML templates (8 dark themes)", phase: "Phase 3", status: "ready" },
        { label: "research-visual Lambda — Puppeteer screen capture", phase: "Phase 3", status: "ready" },
      ]}
      subTasks={[
        { label: "Parse CHART / DIAGRAM / SLIDE / GRAPHIC_OVERLAY / SCREEN_RECORD beats", done: false },
        { label: "Select template per beat type", done: false },
        { label: "Render via Puppeteer headless Chrome", done: false },
        { label: "Export to PNG or MP4 depending on beat type", done: false },
        { label: "Upload to S3 jobs/{jobId}/visuals/", done: false },
      ]}
      estimatedTime="~2 minutes"
      prerequisiteStep={5}
      prerequisiteLabel="Audio Generation (Step 05)"
    />
  );
}

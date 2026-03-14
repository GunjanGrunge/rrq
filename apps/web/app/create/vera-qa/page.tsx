"use client";

import { useEffect } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";

export default function VeraQAPage() {
  const { setStep } = usePipelineStore();
  useEffect(() => { setStep(11); }, [setStep]);

  return (
    <PipelineStepWaiting
      stepNumber={11}
      title="Vera QA"
      description="Final pre-publish quality pass across three domains: Audio QA (clarity, pacing, cue accuracy), Visual QA (resolution, artefacts, timing), and Standards QA (brand, copyright, compliance). CLEARED → Theo. FAILED → precise failure report back to Qeon. Only failed domains are re-checked."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      }
      infraTags={[
        { label: "VERA agent — Bedrock Haiku (checklist execution)", phase: "Phase 12", status: "pending" },
        { label: "Audio QA domain — clarity, pacing, voice cue accuracy", phase: "Phase 12", status: "pending" },
        { label: "Visual QA domain — resolution, artefacts, beat timing", phase: "Phase 12", status: "pending" },
        { label: "Standards QA domain — brand, copyright, platform compliance", phase: "Phase 12", status: "pending" },
      ]}
      subTasks={[
        { label: "Run Audio QA domain — check clarity, pacing, cue accuracy", done: false },
        { label: "Run Visual QA domain — check resolution, artefacts, timing", done: false },
        { label: "Run Standards QA domain — check brand, copyright, compliance", done: false },
        { label: "Aggregate domain results — all PASS → CLEARED signal to Theo", done: false },
        { label: "On FAIL — send precise failure report to Qeon (failed domains only)", done: false },
      ]}
      estimatedTime="~1 minute"
      prerequisiteStep={10}
      prerequisiteLabel="AV Sync (Step 10)"
    />
  );
}

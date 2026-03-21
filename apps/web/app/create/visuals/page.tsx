"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";

const SUBTASK_LABELS = [
  "Identify charts, diagrams, and slides in the script",
  "Apply your video's visual theme to each asset",
  "Render all visuals at full quality",
  "Export as images or short animations as needed",
  "Save visuals for final video assembly",
];

export default function VisualsPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const { proceedAfterVisuals } = useDirectorNavigation();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(9); }, [setStep]);

  useEffect(() => {
    if (outputs[9]) {
      if (stepStatuses[9] !== "complete") setStepStatus(9, "complete");
      proceedAfterVisuals();
      return;
    }
    if (stepStatuses[9] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(9, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Visuals API returned ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as {
                type: string; stageIndex?: number; message?: string; data?: unknown; error?: string;
              };
              if (event.type === "stage_complete" && typeof event.stageIndex === "number") {
                setSubTasksDone((prev) => {
                  const next = [...prev];
                  next[event.stageIndex!] = true;
                  return next;
                });
              }
              if (event.type === "result") {
                setStepOutput(9, event.data);
                setStepStatus(9, "complete");
                proceedAfterVisuals();
              }
              if (event.type === "error") throw new Error(event.error ?? "Visuals generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Visuals generation failed");
        setStepStatus(9, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[9], stepStatuses[9]]);

  if (error || stepStatuses[9] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={9}
          stepLabel="Visuals"
          errorMessage={error ?? "Visuals generation failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[9].length}
          onRerunStep={() => { rerunStep(9); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); router.push("/create/visuals"); }}
        />
      </div>
    );
  }

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
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~2 minutes"
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";

const SUBTASK_LABELS = [
  "Identify sections that need visual callouts or data graphics",
  "Design section cards and concept visuals",
  "Create thumbnail source image",
  "Quality-check all graphics — retry if needed",
  "Save assets for final video assembly",
];

export default function ImagesPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(8); }, [setStep]);

  useEffect(() => {
    if (outputs[8]) {
      if (stepStatuses[8] !== "complete") setStepStatus(8, "complete");
      router.push("/create/visuals");
      return;
    }
    if (stepStatuses[8] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(8, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Images API returned ${res.status}`);

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
                setStepOutput(8, event.data);
                setStepStatus(8, "complete");
                router.push("/create/visuals");
              }
              if (event.type === "error") throw new Error(event.error ?? "Images generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Images generation failed");
        setStepStatus(8, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[8], stepStatuses[8]]);

  if (error || stepStatuses[8] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={8}
          stepLabel="Images"
          errorMessage={error ?? "Images generation failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[8].length}
          onRerunStep={() => { rerunStep(8); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); router.push("/create/images"); }}
        />
      </div>
    );
  }

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
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~3 minutes (runs in parallel)"
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";

const SUBTASK_LABELS = [
  "Identify scenes in your script that need visual support",
  "Build a visual brief for each scene",
  "Generate cinematic video clips",
  "Save clips for final video assembly",
];

export default function BRollPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(7); }, [setStep]);

  useEffect(() => {
    if (outputs[7]) {
      if (stepStatuses[7] !== "complete") setStepStatus(7, "complete");
      router.push("/create/images");
      return;
    }
    if (stepStatuses[7] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(7, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/broll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`B-Roll API returned ${res.status}`);

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
                setStepOutput(7, event.data);
                setStepStatus(7, "complete");
                router.push("/create/images");
              }
              if (event.type === "error") throw new Error(event.error ?? "B-Roll generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "B-Roll generation failed");
        setStepStatus(7, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[7], stepStatuses[7]]);

  if (error || stepStatuses[7] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={7}
          stepLabel="B-Roll"
          errorMessage={error ?? "B-Roll generation failed. This may be a temporary EC2 issue."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[7].length}
          onRerunStep={() => { rerunStep(7); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); router.push("/create/broll"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={7}
      title="Generating B-Roll Footage"
      description="Atmospheric video clips are being created to support your script's key moments — cinematic visuals that reinforce the story and keep viewers engaged between presenter segments. Runs at the same time as your presenter and graphics."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
        </svg>
      }
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~10 minutes (runs in parallel)"
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { AvSyncOutputType } from "@rrq/lambda-types";

const SUBTASK_LABELS = [
  "Review audio — clarity, pacing, and expression accuracy",
  "Review visuals — resolution, quality, and timing",
  "Review standards — brand consistency, copyright, platform compliance",
  "Confirm all areas pass before sending to publish",
];

export default function VeraQAPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const { proceedAfterVeraQA } = useDirectorNavigation();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(11); }, [setStep]);

  useEffect(() => {
    if (outputs[11]) {
      if (stepStatuses[11] !== "complete") setStepStatus(11, "complete");
      proceedAfterVeraQA();
      return;
    }
    if (stepStatuses[11] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(11, "running");

    const avSyncOutput = outputs[10] as AvSyncOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/vera-qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, avSyncOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Vera QA API returned ${res.status}`);

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
                const qaResult = event.data as { passed: boolean };
                if (!qaResult.passed) {
                  setError("Vera QA failed — video did not meet quality standards. Check audio, visual, or standards issues.");
                  setStepStatus(11, "error");
                  return;
                }
                setStepOutput(11, event.data);
                setStepStatus(11, "complete");
                proceedAfterVeraQA();
              }
              if (event.type === "error") throw new Error(event.error ?? "Vera QA failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Vera QA failed");
        setStepStatus(11, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[11], stepStatuses[11]]);

  if (error || stepStatuses[11] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={11}
          stepLabel="Vera QA"
          errorMessage={error ?? "Vera QA failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[11].length}
          onRerunStep={() => { rerunStep(11); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); router.push("/create/vera-qa"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={11}
      title="Final Quality Check"
      description="A dedicated quality agent reviews your completed video across three areas before it can be published: audio clarity and pacing, visual quality and timing, and platform standards including brand consistency and compliance. If anything falls short, only the affected areas are re-checked — nothing is re-done unnecessarily."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      }
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~1 minute"
    />
  );
}

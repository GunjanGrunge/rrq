"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput, SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType } from "@rrq/lambda-types";

const SUBTASK_LABELS = [
  "Review the main video for a strong 45–60 second standalone clip",
  "Extract and reformat the best clip to vertical 9:16",
  "If no strong clip found — write and produce a fresh Short instead",
  "Package the Short for upload",
];

export default function ShortsPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(12); }, [setStep]);

  useEffect(() => {
    if (outputs[12]) {
      if (stepStatuses[12] !== "complete") setStepStatus(12, "complete");
      router.push("/create/upload");
      return;
    }
    if (stepStatuses[12] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(12, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;
    const seoOutput = outputs[3] as SEOOutput | undefined;
    const avSyncOutput = outputs[10] as AvSyncOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/shorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput, seoOutput, avSyncOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Shorts API returned ${res.status}`);

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
                setStepOutput(12, event.data);
                setStepStatus(12, "complete");
                router.push("/create/upload");
              }
              if (event.type === "error") throw new Error(event.error ?? "Shorts generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Shorts generation failed");
        setStepStatus(12, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[12], stepStatuses[12]]);

  if (error || stepStatuses[12] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={12}
          stepLabel="Shorts"
          errorMessage={error ?? "Shorts generation failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[12].length}
          onRerunStep={() => { rerunStep(12); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); router.push("/create/shorts"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={12}
      title="Creating Your Short"
      description="Your video is being adapted into a vertical Short. If there's a strong standalone moment in the main video, it's extracted and reformatted. If not, a fresh Short is written and produced specifically for the vertical format. Shorts go live 2–3 hours before the main video to build early momentum."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="2" width="12" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      }
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~2 minutes"
    />
  );
}

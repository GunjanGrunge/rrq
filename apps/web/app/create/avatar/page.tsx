"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import type { AudioGenOutputType } from "@rrq/lambda-types";

const SUBTASK_LABELS = [
  "Select presenter based on your topic and niche",
  "Sync facial expressions to voiceover timing",
  "Render presenter video segments",
  "Save presenter clips for final assembly",
];

export default function AvatarPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(6); }, [setStep]);

  useEffect(() => {
    if (outputs[6]) {
      if (stepStatuses[6] !== "complete") setStepStatus(6, "complete");
      router.push("/create/broll");
      return;
    }
    if (stepStatuses[6] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(6, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;
    const audioOutput = outputs[5] as AudioGenOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput, audioOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Avatar API returned ${res.status}`);

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
                setStepOutput(6, event.data);
                setStepStatus(6, "complete");
                router.push("/create/broll");
              }
              if (event.type === "error") throw new Error(event.error ?? "Avatar generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Avatar generation failed");
        setStepStatus(6, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[6], stepStatuses[6]]);

  if (error || stepStatuses[6] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={6}
          stepLabel="Avatar"
          errorMessage={error ?? "Avatar generation failed. This may be a temporary EC2 issue."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[6].length}
          onRerunStep={() => { rerunStep(6); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); router.push("/create/avatar"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={6}
      title="Creating Your Presenter"
      description="A photorealistic presenter is being animated to deliver your script. The presenter's face, expressions, and delivery are matched to the voiceover to create natural talking-head segments for your video."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      }
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~12 minutes"
    />
  );
}

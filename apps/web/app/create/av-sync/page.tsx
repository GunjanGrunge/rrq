"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import type { AudioGenOutputType } from "@rrq/lambda-types";

const SUBTASK_LABELS = [
  "Gather all produced assets — presenter, b-roll, graphics, visuals",
  "Arrange assets in script order",
  "Sync all visual segments to the voiceover track",
  "Burn in subtitles with accurate timing",
  "Package final video for quality review",
];

export default function AVSyncPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(10); }, [setStep]);

  useEffect(() => {
    if (outputs[10]) {
      if (stepStatuses[10] !== "complete") setStepStatus(10, "complete");
      router.push("/create/vera-qa");
      return;
    }
    if (stepStatuses[10] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(10, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;
    const audioOutput = outputs[5] as AudioGenOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/av-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput, audioOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`AV Sync API returned ${res.status}`);

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
                setStepOutput(10, event.data);
                setStepStatus(10, "complete");
                router.push("/create/vera-qa");
              }
              if (event.type === "error") throw new Error(event.error ?? "AV Sync failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "AV Sync failed");
        setStepStatus(10, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[10], stepStatuses[10]]);

  if (error || stepStatuses[10] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={10}
          stepLabel="AV Sync"
          errorMessage={error ?? "AV Sync generation failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[10].length}
          onRerunStep={() => { rerunStep(10); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); router.push("/create/av-sync"); }}
        />
      </div>
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={10}
      title="Assembling Your Video"
      description="All produced assets — presenter segments, b-roll footage, graphics, and visual overlays — are being assembled in the correct order and synced with the voiceover. Subtitles are added and the final video is packaged ready for quality review."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      }
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~3 minutes"
    />
  );
}

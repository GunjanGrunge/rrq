"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType, ShortsGenOutputType } from "@rrq/lambda-types";

const SUBTASK_LABELS = [
  "Upload Short — scheduled to go live 2–3 hours early",
  "Upload main video with full title, description, and tags",
  "Set the approved thumbnail",
  "Assign to the correct playlist",
  "Pin opening comment and post a community update",
  "Hand off to Zeus for ongoing performance monitoring",
];

export default function UploadPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(13); }, [setStep]);

  useEffect(() => {
    if (outputs[13]) {
      if (stepStatuses[13] !== "complete") setStepStatus(13, "complete");
      router.push("/create");
      return;
    }
    if (stepStatuses[13] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(13, "running");

    const seoOutput = outputs[3] as SEOOutput | undefined;
    const avSyncOutput = outputs[10] as AvSyncOutputType | undefined;
    const shortsOutput = outputs[12] as ShortsGenOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, seoOutput, avSyncOutput, shortsOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Upload API returned ${res.status}`);

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
                setStepOutput(13, event.data);
                setStepStatus(13, "complete");
                router.push("/create");
              }
              if (event.type === "error") throw new Error(event.error ?? "Upload failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStepStatus(13, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[13], stepStatuses[13]]);

  if (error || stepStatuses[13] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={13}
          stepLabel="Upload"
          errorMessage={error ?? "Upload failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[13].length}
          onRerunStep={() => { rerunStep(13); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false, false]); router.push("/create/upload"); }}
        />
      </div>
    );
  }

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
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~2 minutes"
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput, SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType, ShortsGenOutputType } from "@rrq/lambda-types";
import { CheckCircle, ArrowRight, Smartphone } from "lucide-react";

const SUBTASK_LABELS = [
  "Review the main video for a strong 45–60 second standalone clip",
  "Extract and reformat the best clip to vertical 9:16",
  "If no strong clip found — write and produce a fresh Short instead",
  "Package the Short for upload",
];

function ShortsResult({
  output,
  onContinue,
  onRerun,
}: {
  output: ShortsGenOutputType;
  onContinue: () => void;
  onRerun: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Short Ready</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            Your Short has been produced and is ready for upload alongside the main video.
          </p>
        </div>
      </div>

      <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-bg-border">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">Short Output</span>
        </div>
        <div className="p-4 space-y-3">
          {output.method && (
            <div className="flex items-center justify-between">
              <span className="font-dm-mono text-xs text-text-secondary">Method</span>
              <span className="font-dm-mono text-xs text-text-primary capitalize">{output.method}</span>
            </div>
          )}
          {output.shortsS3Key && (
            <div className="flex items-center justify-between">
              <span className="font-dm-mono text-xs text-text-secondary">S3 Key</span>
              <span className="font-dm-mono text-xs text-text-primary truncate max-w-xs">{output.shortsS3Key}</span>
            </div>
          )}
          {output.durationMs && (
            <div className="flex items-center justify-between">
              <span className="font-dm-mono text-xs text-text-secondary">Duration</span>
              <span className="font-dm-mono text-xs text-text-primary">
                {Math.round(output.durationMs / 1000)}s
              </span>
            </div>
          )}
          {output.title && (
            <div className="flex flex-col gap-1">
              <span className="font-dm-mono text-xs text-text-secondary">Title</span>
              <span className="font-lora text-sm text-text-primary">{output.title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Regenerate Short
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
        >
          UPLOAD <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(12); }, [setStep]);

  const shortsOutput = outputs[12] as ShortsGenOutputType | undefined;

  useEffect(() => {
    // If output already exists — show result, don't re-run
    if (shortsOutput) {
      if (stepStatuses[12] !== "complete") setStepStatus(12, "complete");
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
          onRerunStep={() => { rerunStep(12); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); }}
        />
      </div>
    );
  }

  if (shortsOutput) {
    return (
      <ShortsResult
        output={shortsOutput}
        onContinue={() => router.push("/create/upload")}
        onRerun={() => { rerunStep(12); hasRun.current = false; setSubTasksDone([false, false, false, false]); }}
      />
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={12}
      title="Creating Your Short"
      description="Your video is being adapted into a vertical Short. If there's a strong standalone moment in the main video, it's extracted and reformatted. If not, a fresh Short is written and produced specifically for the vertical format."
      icon={<Smartphone size={22} strokeWidth={1.5} />}
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~2 minutes"
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import type { AudioGenOutputType } from "@rrq/lambda-types";
import { CheckCircle, ArrowRight } from "lucide-react";

const SUBTASK_LABELS = [
  "Select presenter based on your topic and niche",
  "Sync facial expressions to voiceover timing",
  "Render presenter video segments",
  "Save presenter clips for final assembly",
];

interface AvatarOutput {
  segments?: Array<{ sectionId: string; s3Key?: string; durationMs?: number }>;
  avatarId?: string;
  totalSegments?: number;
}

function AvatarResult({
  output,
  onContinue,
  onRerun,
}: {
  output: AvatarOutput;
  onContinue: () => void;
  onRerun: () => void;
}) {
  const segments = output.segments ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Presenter Ready</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            {segments.length > 0
              ? `${segments.length} presenter segment${segments.length > 1 ? "s" : ""} rendered and saved to S3.`
              : "Presenter clips generated and saved for final assembly."}
          </p>
        </div>
      </div>

      {output.avatarId && (
        <div className="bg-bg-surface border border-bg-border rounded-md p-4">
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-xs text-text-secondary">Presenter ID</span>
            <span className="font-dm-mono text-xs text-text-primary">{output.avatarId}</span>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-bg-border">
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
              Presenter Segments ({segments.length})
            </span>
          </div>
          <div className="divide-y divide-bg-border max-h-64 overflow-y-auto">
            {segments.map((seg, i) => (
              <div key={seg.sectionId ?? i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-xs font-bold text-text-primary truncate">{seg.sectionId}</p>
                  {seg.durationMs && (
                    <p className="font-dm-mono text-[10px] text-text-tertiary">
                      {(seg.durationMs / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
                {seg.s3Key && (
                  <span className="font-dm-mono text-[10px] text-accent-success shrink-0">✓ S3</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Re-render presenter
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
        >
          B-ROLL <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function AvatarPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(6); }, [setStep]);

  const avatarOutput = outputs[6] as AvatarOutput | undefined;

  useEffect(() => {
    if (avatarOutput) {
      if (stepStatuses[6] !== "complete") setStepStatus(6, "complete");
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
          onRerunStep={() => { rerunStep(6); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); }}
        />
      </div>
    );
  }

  if (avatarOutput) {
    return (
      <AvatarResult
        output={avatarOutput}
        onContinue={() => router.push("/create/broll")}
        onRerun={() => { rerunStep(6); hasRun.current = false; setSubTasksDone([false, false, false, false]); }}
      />
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

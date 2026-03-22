"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import { CheckCircle, ArrowRight } from "lucide-react";

const SUBTASK_LABELS = [
  "Identify sections that need visual callouts or data graphics",
  "Design section cards and concept visuals",
  "Create thumbnail source image",
  "Quality-check all graphics — retry if needed",
  "Save assets for final video assembly",
];

interface ImagesOutput {
  assets?: Array<{ id: string; type: string; s3Key?: string; status?: string }>;
  thumbnailS3Key?: string;
  generatedCount?: number;
  failedCount?: number;
}

function ImagesResult({
  output,
  onContinue,
  onRerun,
}: {
  output: ImagesOutput;
  onContinue: () => void;
  onRerun: () => void;
}) {
  const assets = output.assets ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Graphics Ready</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            {assets.length > 0
              ? `${assets.length} graphic asset${assets.length > 1 ? "s" : ""} generated and saved to S3.`
              : "Graphics and images processed and saved for final assembly."}
          </p>
        </div>
      </div>

      {output.thumbnailS3Key && (
        <div className="bg-bg-surface border border-bg-border rounded-md p-4">
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-xs text-text-secondary">Thumbnail Source</span>
            <span className="font-dm-mono text-[10px] text-accent-success">✓ S3</span>
          </div>
          <p className="font-dm-mono text-[10px] text-text-tertiary mt-1 truncate">{output.thumbnailS3Key}</p>
        </div>
      )}

      {assets.length > 0 && (
        <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-bg-border flex items-center justify-between">
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
              Assets ({assets.length})
            </span>
            {(output.failedCount ?? 0) > 0 && (
              <span className="font-dm-mono text-[10px] text-accent-error">
                {output.failedCount} failed
              </span>
            )}
          </div>
          <div className="divide-y divide-bg-border max-h-64 overflow-y-auto">
            {assets.map((asset) => (
              <div key={asset.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  asset.status === "success" ? "bg-accent-success" :
                  asset.status === "failed" ? "bg-accent-error" :
                  "bg-text-tertiary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-syne text-xs font-bold text-text-primary truncate">{asset.id}</p>
                  <p className="font-dm-mono text-[10px] text-text-tertiary capitalize">{asset.type}</p>
                </div>
                {asset.s3Key && (
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
          Regenerate graphics
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
        >
          DATA VISUALS <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ImagesPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(8); }, [setStep]);

  const imagesOutput = outputs[8] as ImagesOutput | undefined;

  useEffect(() => {
    if (imagesOutput) {
      if (stepStatuses[8] !== "complete") setStepStatus(8, "complete");
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
          onRerunStep={() => { rerunStep(8); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); }}
        />
      </div>
    );
  }

  if (imagesOutput) {
    return (
      <ImagesResult
        output={imagesOutput}
        onContinue={() => router.push("/create/visuals")}
        onRerun={() => { rerunStep(8); hasRun.current = false; setSubTasksDone([false, false, false, false, false]); }}
      />
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

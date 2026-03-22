"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import { CheckCircle, ArrowRight, BarChart2 } from "lucide-react";

const SUBTASK_LABELS = [
  "Identify charts, diagrams, and slides in the script",
  "Apply your video's visual theme to each asset",
  "Render all visuals at full quality",
  "Export as images or short animations as needed",
  "Save visuals for final video assembly",
];

interface VisualGenOutput {
  assets?: Array<{ id: string; type: string; s3Key?: string; status?: string }>;
  generatedCount?: number;
  failedCount?: number;
}

function VisualsResult({
  output,
  scriptOutput,
  onContinue,
  onRerun,
}: {
  output: VisualGenOutput;
  scriptOutput: ScriptOutput | undefined;
  onContinue: () => void;
  onRerun: () => void;
}) {
  const visualAssets = scriptOutput?.visualAssets ?? [];
  const generatedAssets = output.assets ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Visuals Rendered</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            {generatedAssets.length > 0
              ? `${generatedAssets.length} visual asset${generatedAssets.length > 1 ? "s" : ""} generated and saved to S3.`
              : visualAssets.length === 0
              ? "No infographic assets were defined in this script — sections use avatar or b-roll visuals."
              : "Visual assets processed."}
          </p>
        </div>
      </div>

      {/* Visual assets from script */}
      {visualAssets.length > 0 && (
        <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-bg-border flex items-center justify-between">
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
              Infographic Assets ({visualAssets.length})
            </span>
          </div>
          <div className="divide-y divide-bg-border max-h-72 overflow-y-auto">
            {visualAssets.map((asset) => {
              const generated = generatedAssets.find((g) => g.id === asset.id);
              return (
                <div key={asset.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    generated?.status === "success" ? "bg-accent-success" :
                    generated?.status === "failed" ? "bg-accent-error" :
                    "bg-text-tertiary"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-xs font-bold text-text-primary truncate">{asset.id}</p>
                    <p className="font-dm-mono text-[10px] text-text-tertiary capitalize">{asset.type}</p>
                  </div>
                  {generated?.s3Key && (
                    <span className="font-dm-mono text-[10px] text-accent-success shrink-0">✓ S3</span>
                  )}
                  {!generated && (
                    <span className="font-dm-mono text-[10px] text-text-tertiary shrink-0">skipped</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No infographics notice */}
      {visualAssets.length === 0 && (
        <div className="bg-bg-surface border border-bg-border rounded-md p-4">
          <p className="font-dm-mono text-xs text-text-secondary">
            This script does not include any infographic-type visual assets. Charts, diagrams, and slides are added by the script writer when relevant to the content.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Re-render visuals
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
        >
          ASSEMBLE VIDEO <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function VisualsPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const { proceedAfterVisuals } = useDirectorNavigation();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(9); }, [setStep]);

  const visualsOutput = outputs[9] as VisualGenOutput | undefined;
  const scriptOutput = outputs[2] as ScriptOutput | undefined;

  useEffect(() => {
    // If output exists — show result, don't re-run
    if (visualsOutput) {
      if (stepStatuses[9] !== "complete") setStepStatus(9, "complete");
      return;
    }
    if (stepStatuses[9] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(9, "running");

    (async () => {
      try {
        const res = await fetch("/api/pipeline/visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, scriptOutput }),
        });

        if (!res.ok || !res.body) throw new Error(`Visuals API returned ${res.status}`);

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
                setStepOutput(9, event.data);
                setStepStatus(9, "complete");
              }
              if (event.type === "error") throw new Error(event.error ?? "Visuals generation failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Visuals generation failed");
        setStepStatus(9, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[9], stepStatuses[9]]);

  if (error || stepStatuses[9] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={9}
          stepLabel="Visuals"
          errorMessage={error ?? "Visuals generation failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[9].length}
          onRerunStep={() => { rerunStep(9); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); }}
        />
      </div>
    );
  }

  if (visualsOutput) {
    return (
      <VisualsResult
        output={visualsOutput}
        scriptOutput={scriptOutput}
        onContinue={() => proceedAfterVisuals()}
        onRerun={() => { rerunStep(9); hasRun.current = false; setSubTasksDone([false, false, false, false, false]); }}
      />
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={9}
      title="Rendering Data Visuals"
      description="Charts, diagrams, slides, and any data-driven visuals referenced in your script are being rendered. These are matched to your video's dark visual theme and exported as high-quality assets ready for the final edit."
      icon={<BarChart2 size={22} strokeWidth={1.5} />}
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~2 minutes"
    />
  );
}

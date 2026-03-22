"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { AvSyncOutputType } from "@rrq/lambda-types";
import { CheckCircle, XCircle, ArrowRight, ShieldCheck } from "lucide-react";

const SUBTASK_LABELS = [
  "Review audio — clarity, pacing, and expression accuracy",
  "Review visuals — resolution, quality, and timing",
  "Review standards — brand consistency, copyright, platform compliance",
  "Confirm all areas pass before sending to publish",
];

interface QAResult {
  passed: boolean;
  domains: Record<string, { passed: boolean; notes?: string }>;
  overallNotes?: string;
}

function VeraQAResult({
  result,
  onContinue,
  onRerun,
}: {
  result: QAResult;
  onContinue: () => void;
  onRerun: () => void;
}) {
  const domainLabels: Record<string, string> = {
    audio: "Audio — clarity, pacing, expression",
    visual: "Visuals — resolution, quality, timing",
    standards: "Standards — brand, copyright, compliance",
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-start gap-4 mb-8">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          result.passed
            ? "bg-accent-success/10 border border-accent-success/30"
            : "bg-accent-error/10 border border-accent-error/30"
        }`}>
          {result.passed
            ? <CheckCircle size={18} className="text-accent-success" />
            : <XCircle size={18} className="text-accent-error" />
          }
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">
            {result.passed ? "Quality Check Passed" : "Quality Check — Issues Found"}
          </h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            {result.passed
              ? "All three QA domains cleared. Your video is ready for publishing."
              : "Some areas need attention before publishing. Review the notes below."}
          </p>
        </div>
      </div>

      {/* Domain breakdown */}
      <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-bg-border">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">QA Domains</span>
        </div>
        <div className="divide-y divide-bg-border">
          {Object.entries(result.domains).map(([key, domain]) => (
            <div key={key} className="px-4 py-3 flex items-start gap-3">
              <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 ${
                domain.passed
                  ? "border-accent-success/40 bg-accent-success/10"
                  : "border-accent-error/40 bg-accent-error/10"
              }`}>
                {domain.passed ? (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-accent-success">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-accent-error">
                    <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-syne text-xs font-bold text-text-primary">
                  {domainLabels[key] ?? key}
                </span>
                {domain.notes && (
                  <p className="font-dm-mono text-[11px] text-text-secondary mt-1">{domain.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.overallNotes && (
        <div className="bg-bg-surface border border-bg-border rounded-md p-4 mb-6">
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-2">Overall Notes</span>
          <p className="font-lora text-sm text-text-secondary leading-relaxed">{result.overallNotes}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Re-run QA
        </button>
        {result.passed && (
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
          >
            CREATE SHORT <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function VeraQAPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const { proceedAfterVeraQA } = useDirectorNavigation();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(11); }, [setStep]);

  const qaResult = outputs[11] as QAResult | undefined;

  useEffect(() => {
    // If output already exists — show result, don't re-run
    if (qaResult) {
      if (stepStatuses[11] !== "complete") setStepStatus(11, "complete");
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
                const result = event.data as QAResult;
                setStepOutput(11, result);
                setStepStatus(11, "complete");
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
          onRerunStep={() => { rerunStep(11); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false]); }}
        />
      </div>
    );
  }

  if (qaResult) {
    return (
      <VeraQAResult
        result={qaResult}
        onContinue={() => proceedAfterVeraQA()}
        onRerun={() => { rerunStep(11); hasRun.current = false; setSubTasksDone([false, false, false, false]); }}
      />
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={11}
      title="Final Quality Check"
      description="A dedicated quality agent reviews your completed video across three areas before it can be published: audio clarity and pacing, visual quality and timing, and platform standards including brand consistency and compliance."
      icon={<ShieldCheck size={22} strokeWidth={1.5} />}
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~1 minute"
    />
  );
}

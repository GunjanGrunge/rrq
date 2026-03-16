"use client";

import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { Check, RotateCcw } from "lucide-react";
import { STEPS, STEP_SLUGS } from "@/lib/pipeline-steps";

export default function PipelineProgress() {
  const { currentStep, stepStatuses, rerunStep } = usePipelineStore();
  const router = useRouter();

  function handleRerun(stepNumber: number) {
    rerunStep(stepNumber);
    router.push(`/create/${STEP_SLUGS[stepNumber]}`);
  }

  return (
    <nav className="flex items-center gap-1" aria-label="Pipeline progress">
      {STEPS.map((step, index) => {
        const status = stepStatuses[step.number] ?? "ready";
        const isActive = currentStep === step.number;
        const isComplete = status === "complete";
        const isRunning = status === "running";
        const isError = status === "error";
        const isStale = status === "stale";
        const isRerunnable = isComplete || isError || isStale;

        return (
          <div key={step.number} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-0.5 group relative">
              <div
                onClick={isRerunnable ? () => handleRerun(step.number) : undefined}
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  font-dm-mono text-[10px] font-500 transition-all duration-200
                  ${isComplete
                    ? "bg-accent-success text-text-inverse cursor-pointer hover:ring-2 hover:ring-accent-success/40"
                    : isRunning
                    ? "bg-accent-primary text-text-inverse animate-pulse-amber"
                    : isError
                    ? "bg-accent-error text-white cursor-pointer hover:ring-2 hover:ring-accent-error/40"
                    : isStale
                    ? "bg-accent-primary/40 text-text-inverse cursor-pointer hover:ring-2 hover:ring-accent-primary/40"
                    : isActive
                    ? "bg-bg-elevated border border-accent-primary text-accent-primary ring-2 ring-accent-primary ring-opacity-30"
                    : "bg-bg-elevated border border-bg-border text-text-secondary"
                  }
                `}
              >
                {isComplete ? (
                  <Check size={10} strokeWidth={3} />
                ) : isStale ? (
                  <RotateCcw size={9} strokeWidth={2.5} />
                ) : (
                  step.number
                )}
              </div>

              {/* Tooltip label on hover */}
              <span className="absolute top-7 font-dm-mono text-[9px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                {isRerunnable ? `↺ Rerun` : step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div className="relative w-4 h-px mx-0.5 bg-bg-border overflow-hidden">
                <div
                  className="absolute inset-0 bg-accent-success origin-left transition-transform duration-500 ease-out"
                  style={{ transform: isComplete ? "scaleX(1)" : "scaleX(0)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import { usePipelineStore } from "@/lib/pipeline-store";
import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Research" },
  { number: 2, label: "Script" },
  { number: 3, label: "SEO" },
  { number: 4, label: "Quality" },
  { number: 5, label: "Audio" },
  { number: 6, label: "Avatar" },
  { number: 7, label: "B-Roll" },
  { number: 8, label: "Images" },
  { number: 9, label: "Visuals" },
  { number: 10, label: "AV Sync" },
  { number: 11, label: "Vera QA" },
  { number: 12, label: "Shorts" },
  { number: 13, label: "Upload" },
];

export default function PipelineProgress() {
  const { currentStep, stepStatuses } = usePipelineStore();

  return (
    <nav className="flex items-center gap-1" aria-label="Pipeline progress">
      {STEPS.map((step, index) => {
        const status = stepStatuses[step.number] ?? "ready";
        const isActive = currentStep === step.number;
        const isComplete = status === "complete";
        const isRunning = status === "running";
        const isError = status === "error";

        return (
          <div key={step.number} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-0.5 group relative">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  font-dm-mono text-[10px] font-500 transition-all duration-200
                  ${isComplete
                    ? "bg-accent-success text-text-inverse"
                    : isRunning
                    ? "bg-accent-primary text-text-inverse animate-pulse-amber"
                    : isError
                    ? "bg-accent-error text-white"
                    : isActive
                    ? "bg-bg-elevated border border-accent-primary text-accent-primary ring-2 ring-accent-primary ring-opacity-30"
                    : "bg-bg-elevated border border-bg-border text-text-secondary"
                  }
                `}
              >
                {isComplete ? (
                  <Check size={10} strokeWidth={3} />
                ) : (
                  step.number
                )}
              </div>

              {/* Tooltip label on hover */}
              <span className="absolute top-7 font-dm-mono text-[9px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                {step.label}
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

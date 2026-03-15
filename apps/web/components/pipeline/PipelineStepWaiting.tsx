"use client";

import { usePipelineStore } from "@/lib/pipeline-store";

type SubTask = {
  label: string;
  done: boolean;
};

interface PipelineStepWaitingProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  subTasks?: SubTask[];
  estimatedTime?: string;
  prerequisiteStep?: number;
  prerequisiteLabel?: string;
}

export default function PipelineStepWaiting({
  title,
  description,
  icon,
  subTasks,
  estimatedTime,
  prerequisiteStep,
  prerequisiteLabel,
}: PipelineStepWaitingProps) {
  const { stepStatuses } = usePipelineStore();

  const prerequisiteStatus = prerequisiteStep !== undefined
    ? stepStatuses[prerequisiteStep]
    : undefined;

  const prerequisitePassed = prerequisiteStatus === "complete";

  return (
    <div className="flex-1 flex flex-col p-8 max-w-2xl mx-auto w-full">
      {/* Step header */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-full bg-bg-surface border border-bg-border flex items-center justify-center shrink-0 text-text-tertiary">
          {icon}
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary mb-1">
            {title}
          </h1>
          <p className="font-lora text-sm text-text-secondary leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Prerequisite gate */}
      {prerequisiteStep !== undefined && (
        <div
          className={`mb-6 p-4 border flex items-center gap-3 ${
            prerequisitePassed
              ? "border-accent-success bg-accent-success/5"
              : "border-bg-border bg-bg-surface"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              prerequisitePassed
                ? "bg-accent-success"
                : "bg-text-tertiary animate-pulse"
            }`}
          />
          <div>
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase block mb-0.5">
              Waiting for
            </span>
            <span
              className={`font-dm-mono text-xs ${
                prerequisitePassed ? "text-accent-success" : "text-text-secondary"
              }`}
            >
              {prerequisiteLabel ?? `Step ${prerequisiteStep}`}{" "}
              {prerequisitePassed ? "— complete ✓" : "— not yet complete"}
            </span>
          </div>
        </div>
      )}

      {/* Sub-tasks checklist */}
      {subTasks && subTasks.length > 0 && (
        <div className="mb-6 bg-bg-surface border border-bg-border p-5">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase block mb-4">
            What happens here
          </span>
          <div className="space-y-3">
            {subTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                    task.done
                      ? "border-accent-success bg-accent-success/10"
                      : "border-bg-border-hover"
                  }`}
                >
                  {task.done && (
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      className="text-accent-success"
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`font-lora text-sm ${
                    task.done ? "text-text-tertiary line-through" : "text-text-secondary"
                  }`}
                >
                  {task.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimated time */}
      {estimatedTime && (
        <div className="flex items-center justify-between px-1">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
            Estimated time
          </span>
          <span className="font-dm-mono text-xs text-accent-primary">
            {estimatedTime}
          </span>
        </div>
      )}
    </div>
  );
}

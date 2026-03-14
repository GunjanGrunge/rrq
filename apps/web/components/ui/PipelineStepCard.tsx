"use client";

import { Check, AlertCircle } from "lucide-react";
import StatusPill from "./StatusPill";

type Status = "ready" | "running" | "complete" | "error";

interface PipelineStepCardProps {
  stepNumber: number;
  label: string;
  status: Status;
  isActive?: boolean;
  onClick?: () => void;
}

export default function PipelineStepCard({
  stepNumber,
  label,
  status,
  isActive = false,
  onClick,
}: PipelineStepCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-lg
        border transition-all duration-200 text-left group
        ${isActive
          ? "border-accent-primary bg-bg-elevated"
          : status === "complete"
          ? "border-accent-success/30 bg-bg-surface hover:border-accent-success/60"
          : status === "error"
          ? "border-accent-error/30 bg-bg-surface hover:border-accent-error/60"
          : "border-bg-border bg-bg-surface hover:border-bg-border-hover"
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* Step number */}
        <div
          className={`
            w-7 h-7 rounded-full flex items-center justify-center shrink-0
            font-dm-mono text-xs font-500 transition-all duration-200
            ${status === "complete"
              ? "bg-accent-success text-text-inverse"
              : status === "error"
              ? "bg-accent-error text-white"
              : isActive
              ? "border-2 border-accent-primary text-accent-primary"
              : "border border-bg-border text-text-tertiary"
            }
          `}
        >
          {status === "complete" ? (
            <Check size={12} strokeWidth={3} />
          ) : status === "error" ? (
            <AlertCircle size={12} />
          ) : (
            stepNumber
          )}
        </div>

        {/* Label */}
        <span
          className={`
            font-syne text-sm font-500 transition-colors duration-200
            ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}
          `}
        >
          {label}
        </span>
      </div>

      <StatusPill status={status} />
    </button>
  );
}

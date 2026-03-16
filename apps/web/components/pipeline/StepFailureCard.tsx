"use client";

import { STEP_DOWNSTREAM } from "@/lib/pipeline-store";

interface StepFailureCardProps {
  stepNumber: number;
  stepLabel: string;
  errorMessage: string;
  onRerunStep: () => void;
  onRerunFromHere?: () => void;
  showDownstreamWarning?: boolean;
  downstreamCount?: number;
}

export function StepFailureCard({
  stepNumber,
  stepLabel,
  errorMessage,
  onRerunStep,
  onRerunFromHere,
  showDownstreamWarning,
  downstreamCount,
}: StepFailureCardProps) {
  const downstream = downstreamCount ?? STEP_DOWNSTREAM[stepNumber]?.length ?? 0;

  return (
    <div className="border border-accent-error/30 bg-accent-error/5 rounded-xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-accent-error text-base">⚠</span>
        <span className="font-syne text-base text-accent-error">
          Step {stepNumber} — {stepLabel} Failed
        </span>
      </div>

      {/* Error message */}
      <p className="font-dm-mono text-sm text-accent-error/80 leading-relaxed">
        {errorMessage}
      </p>

      {/* Downstream warning */}
      {showDownstreamWarning && downstream > 0 && (
        <p className="font-dm-mono text-xs text-text-muted">
          ↓ {downstream} downstream step{downstream !== 1 ? "s" : ""} will be re-queued
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onRerunStep}
          className="px-3 py-1.5 bg-accent-primary text-bg-base font-dm-mono text-xs rounded-md hover:opacity-90 transition-opacity"
        >
          ↺ Rerun Step {stepNumber}
        </button>
        {onRerunFromHere && (
          <button
            onClick={onRerunFromHere}
            className="px-3 py-1.5 border border-accent-error/40 text-accent-error font-dm-mono text-xs rounded-md hover:bg-accent-error/10 transition-colors"
          >
            Rerun from here
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

interface StepProgressCardProps {
  stages: string[];
  completedStages: number[];
  statusLine: string;
}

export default function StepProgressCard({
  stages,
  completedStages,
  statusLine,
}: StepProgressCardProps) {
  const completedSet = new Set(completedStages);
  const activeStage = stages.findIndex((_, i) => !completedSet.has(i));
  const progressPct = stages.length > 0
    ? Math.round((completedStages.length / stages.length) * 100)
    : 0;

  return (
    <div className="w-full py-16 flex justify-center">
      <div className="w-full max-w-sm">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
              Progress
            </span>
            <span className="font-dm-mono text-[10px] text-accent-primary">
              {progressPct}%
            </span>
          </div>
          <div className="h-px bg-bg-elevated w-full overflow-hidden">
            <div
              className="h-full bg-accent-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3 mb-6">
          {stages.map((label, i) => {
            const isDone = completedSet.has(i);
            const isActive = i === activeStage;

            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`
                    w-4 h-4 rounded-sm border flex items-center justify-center shrink-0
                    transition-all duration-300
                    ${isDone
                      ? "border-accent-success bg-accent-success/15"
                      : isActive
                      ? "border-accent-primary animate-pulse"
                      : "border-bg-border"
                    }
                  `}
                >
                  {isDone && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-accent-success"
                      />
                    </svg>
                  )}
                </div>

                <span
                  className={`
                    font-dm-mono text-xs transition-colors duration-300
                    ${isDone
                      ? "text-text-tertiary line-through"
                      : isActive
                      ? "text-text-primary"
                      : "text-text-secondary opacity-50"
                    }
                  `}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status line */}
        {statusLine && (
          <div className="flex items-center gap-1 pl-1">
            <span className="font-lora text-sm text-accent-primary italic">
              {statusLine}
            </span>
            <span className="w-px h-3.5 bg-accent-primary inline-block animate-[cursorBlink_1s_steps(1)_infinite]" />
          </div>
        )}
      </div>
    </div>
  );
}

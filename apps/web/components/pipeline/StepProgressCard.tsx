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
  // The active stage is the first one not yet completed
  const activeStage = stages.findIndex((_, i) => !completedSet.has(i));

  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="w-full max-w-sm">
        {/* Checklist */}
        <div className="space-y-3 mb-6">
          {stages.map((label, i) => {
            const isDone = completedSet.has(i);
            const isActive = i === activeStage;

            return (
              <div key={i} className="flex items-center gap-3">
                {/* Checkbox */}
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

                {/* Label */}
                <span
                  className={`
                    font-dm-mono text-xs transition-colors duration-300
                    ${isDone
                      ? "text-text-tertiary line-through"
                      : isActive
                      ? "text-text-primary"
                      : "text-text-secondary"
                    }
                  `}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Typewriter status line */}
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

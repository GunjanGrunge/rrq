"use client";

type Status = "ready" | "running" | "complete" | "error";

interface StatusPillProps {
  status: Status;
  label?: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  Status,
  { dot: string; text: string; border: string; label: string }
> = {
  ready: {
    dot: "bg-text-tertiary",
    text: "text-text-tertiary",
    border: "border-bg-border-hover",
    label: "READY",
  },
  running: {
    dot: "bg-accent-primary animate-pulse-amber",
    text: "text-accent-primary",
    border: "border-accent-primary",
    label: "RUNNING",
  },
  complete: {
    dot: "bg-accent-success",
    text: "text-accent-success",
    border: "border-accent-success",
    label: "DONE",
  },
  error: {
    dot: "bg-accent-error",
    text: "text-accent-error",
    border: "border-accent-error",
    label: "ERROR",
  },
};

export default function StatusPill({ status, label, compact = false }: StatusPillProps) {
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          status === "ready" ? "opacity-0" : config.dot
        }`}
      />
    );
  }

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm
        border ${config.border} transition-all duration-200
      `}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className={`font-dm-mono text-[9px] tracking-widest ${config.text}`}>
        {label ?? config.label}
      </span>
    </div>
  );
}

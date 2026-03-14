"use client";

interface ProgressBarProps {
  value: number; // 0-100
  loading?: boolean;
  className?: string;
}

export default function ProgressBar({ value, loading = false, className = "" }: ProgressBarProps) {
  return (
    <div className={`h-1 bg-bg-elevated rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${
          loading ? "shimmer w-full" : "bg-accent-primary"
        }`}
        style={!loading ? { width: `${Math.min(100, Math.max(0, value))}%` } : undefined}
      />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePipelineStore } from "@/lib/pipeline-store";
import {
  useNotificationStore,
} from "@/lib/notifications/notification-store";
import { STEP_SLUGS, STEPS } from "@/lib/pipeline-steps";
import StatusPill from "@/components/ui/StatusPill";
import RRQSignature from "@/components/ui/RRQSignature";

// Per-step agent status lines
const STEP_AGENT_LINES: Record<number, string> = {
  1:  "Rex is scanning for signals...",
  2:  "Muse is writing the script...",
  3:  "Regum is optimising metadata...",
  4:  "Vera is checking uniqueness...",
  5:  "Audio generation in progress...",
  6:  "SkyReels is rendering avatar...",
  7:  "Wan2.2 is generating b-roll...",
  8:  "TONY is building visuals...",
  9:  "Puppeteer is rendering charts...",
  10: "FFmpeg is stitching the cut...",
  11: "Vera is running final QA...",
  12: "Generating Shorts cut...",
  13: "Uploading to YouTube...",
};

export default function HomePage() {
  const router = useRouter();
  const { sessions } = usePipelineStore();
  const { messages } = useNotificationStore();
  const unreadCount = useNotificationStore(
    (s) => s.messages.filter((m) => !m.read && !m.deletedAt).length
  );

  // Active sessions: at least one step is "running"
  const activeSessions = Object.values(sessions).filter((session) =>
    Object.values(session.stepStatuses).some((s) => s === "running")
  );

  function handleJobCardClick(sessionCurrentStep: number) {
    const slug = STEP_SLUGS[sessionCurrentStep];
    if (!slug) return;
    router.push(`/create/${slug}`);
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[720px] mx-auto space-y-6">

        {/* Studio Mode hero */}
        <div className="border border-accent-primary/30 bg-accent-primary/5 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-dm-mono text-[10px] text-accent-primary tracking-[2px] uppercase mb-1">
                Studio Mode
              </p>
              <h1 className="font-syne font-bold text-xl text-text-primary mb-2">
                Start a new video from topic to upload.
              </h1>
              <p className="font-dm-mono text-xs text-text-secondary">
                Research → Script → SEO → Quality Gate → Production → Upload
              </p>
            </div>
            <Link
              href="/create"
              className="shrink-0 bg-accent-primary text-bg-base font-dm-mono text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-accent-primary/90 transition-colors whitespace-nowrap"
            >
              → Start New Video
            </Link>
          </div>
        </div>

        {/* Nav cards row */}
        <div className="grid grid-cols-4 gap-4">
          {/* GO RRQ */}
          <Link
            href="/zeus"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group"
          >
            <p className="font-dm-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2">
              GO RRQ
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Autopilot mode
            </p>
          </Link>

          {/* Analytics */}
          <Link
            href="/analytics"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group"
          >
            <p className="font-dm-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2">
              Analytics
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Channel &amp; agents
            </p>
          </Link>

          {/* Inbox */}
          <Link
            href="/inbox"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group relative"
          >
            {unreadCount > 0 && (
              <span className="absolute top-4 right-4 bg-accent-primary text-bg-base font-dm-mono text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
            <p className="font-dm-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2">
              Inbox
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Agent updates
            </p>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group"
          >
            <p className="font-dm-mono text-[10px] text-text-secondary uppercase tracking-widest mb-2">
              Settings
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Account &amp; preferences
            </p>
          </Link>
        </div>

        {/* RRQ signature — draw-on animation, always visible */}
        <RRQSignature />

        {/* Active Jobs — only shown when at least one session is running */}
        {activeSessions.length > 0 && (
          <div>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
              <p className="font-dm-mono text-[10px] text-accent-primary tracking-[2px] uppercase">
                Live Now
              </p>
            </div>

            <div className="space-y-3">
              {activeSessions.map((session) => {
                const currentStep = session.currentStep;
                const slug = STEP_SLUGS[currentStep];
                const isClickable = currentStep !== 0 && slug !== undefined;
                const stepLabel = STEPS.find((s) => s.number === currentStep)?.label ?? "—";
                const agentLine = STEP_AGENT_LINES[currentStep] ?? "Processing...";
                const topic =
                  session.brief !== null ? session.brief.topic : "Starting up...";
                const progress = Math.round((currentStep / 13) * 100);

                return (
                  <div
                    key={session.jobId}
                    onClick={isClickable ? () => handleJobCardClick(currentStep) : undefined}
                    onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") handleJobCardClick(currentStep); } : undefined}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    className={`border border-bg-border bg-bg-surface rounded-xl p-5 ${
                      isClickable
                        ? "cursor-pointer hover:border-accent-primary/30 transition-colors"
                        : "cursor-default"
                    }`}
                  >
                    {/* Topic + step pill row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-syne font-bold text-sm text-text-primary truncate">
                          {topic}
                        </p>
                        <p className="font-dm-mono text-[10px] text-text-secondary mt-0.5">
                          {agentLine}
                        </p>
                      </div>
                      <StatusPill status="running" label={stepLabel} />
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="font-dm-mono text-[9px] text-text-tertiary mt-1 text-right">
                      Step {currentStep} of 13
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

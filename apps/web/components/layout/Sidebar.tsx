"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useUIStore } from "@/lib/ui-store";
import { Zap, ChevronRight, ChevronDown, X, Inbox, Plus, Trash2, Home } from "lucide-react";
import StatusPill from "@/components/ui/StatusPill";
import type { GateId, GateStatus, SessionState } from "@/lib/pipeline-store";

const PIPELINE_STEPS = [
  { number: 0, label: "Creative Brief", slug: "" },
  { number: 1, label: "Research", slug: "research" },
  { number: 2, label: "Script", slug: "script" },
  { number: 3, label: "SEO", slug: "seo" },
  { number: 4, label: "Quality Gate", slug: "quality" },
  { number: 5, label: "Audio", slug: "audio" },
  { number: 6, label: "Avatar", slug: "avatar" },
  { number: 7, label: "B-Roll", slug: "broll" },
  { number: 8, label: "Images", slug: "images" },
  { number: 9, label: "Visuals", slug: "visuals" },
  { number: 10, label: "Video Assembly", slug: "av-sync" },
  { number: 11, label: "Quality Check", slug: "vera-qa" },
  { number: 12, label: "Shorts", slug: "shorts" },
  { number: 13, label: "Upload", slug: "upload" },
];

interface GateEntry {
  type: "gate";
  gateId: GateId;
  label: string;
  slug: string;
  afterStep: number;
  status: GateStatus;
}

interface StepEntry {
  type: "step";
  number: number;
  label: string;
  slug: string;
}

type SidebarEntry = StepEntry | GateEntry;

function injectGates(
  steps: typeof PIPELINE_STEPS,
  approvalGates: Record<GateId, { status: GateStatus }>,
  directorMode: boolean
): SidebarEntry[] {
  if (!directorMode) {
    return steps.map((s) => ({ type: "step" as const, ...s }));
  }

  const gates: Array<{ afterStep: number; gateId: GateId; label: string; slug: string }> = [
    { afterStep: 2, gateId: "gate-script", label: "Your Approval", slug: "approve-script" },
    { afterStep: 3, gateId: "gate-seo", label: "Your Approval", slug: "approve-seo" },
    { afterStep: 9, gateId: "gate-visuals", label: "Your Approval", slug: "approve-visuals" },
    { afterStep: 11, gateId: "gate-publish", label: "Your Approval", slug: "approve-publish" },
  ];

  const result: SidebarEntry[] = [];
  for (const step of steps) {
    result.push({ type: "step", ...step });
    const gate = gates.find((g) => g.afterStep === step.number);
    if (gate) {
      result.push({
        type: "gate",
        gateId: gate.gateId,
        label: gate.label,
        slug: gate.slug,
        afterStep: gate.afterStep,
        status: approvalGates[gate.gateId].status,
      });
    }
  }
  return result;
}

function sessionLabel(session: SessionState): string {
  return session.brief?.topic
    ? session.brief.topic.length > 24
      ? session.brief.topic.slice(0, 24) + "…"
      : session.brief.topic
    : "New clip";
}

function sessionStepLabel(session: SessionState): string {
  const step = session.currentStep;
  if (step === 0) return "Brief";
  const found = PIPELINE_STEPS.find((s) => s.number === step);
  return found ? found.label : `Step ${step}`;
}

function sessionIsRunning(session: SessionState): boolean {
  return Object.values(session.stepStatuses).some((s) => s === "running");
}

export default function Sidebar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const {
    sessions,
    activeJobId,
    currentStep,
    stepStatuses,
    brief,
    approvalGates,
    pendingGate,
    newSession,
    switchSession,
    deleteSession,
  } = usePipelineStore();

  const { sidebarOpen, closeSidebar } = useUIStore();

  const [stepsCollapsed, setStepsCollapsed] = useState(false);

  const plan = (user?.publicMetadata?.plan as string) ?? "free";
  const directorMode = brief?.directorMode ?? false;
  const anyRunning = Object.values(stepStatuses).some((s) => s === "running");

  const entries = injectGates(PIPELINE_STEPS, approvalGates, directorMode);

  // Sorted sessions — most recent first
  const sessionList = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  function handleNewClip() {
    newSession();
    router.push("/create");
  }

  function handleSwitchSession(jobId: string) {
    switchSession(jobId);
    router.push("/create");
  }

  function handleDeleteSession(e: React.MouseEvent, jobId: string) {
    e.stopPropagation();
    deleteSession(jobId);
    // If we deleted the active session, go to /create (newSession or blank)
    if (jobId === activeJobId) {
      router.push("/create");
    }
  }

  function GateDiamond({ status }: { status: GateStatus }) {
    if (status === "approved") {
      return <span className="text-[10px] text-accent-success">◆</span>;
    }
    if (status === "pending") {
      return <span className="text-[10px] text-accent-primary animate-pulse">◆</span>;
    }
    return <span className="text-[10px] text-text-tertiary">◇</span>;
  }

  const sidebarContent = (
    <aside className="w-60 bg-bg-surface border-r border-bg-border flex flex-col h-full overflow-y-auto">
      {/* Running indicator bar */}
      {anyRunning && (
        <div className="h-0.5 w-full bg-accent-primary animate-pulse shrink-0" />
      )}

      {/* Plan badge */}
      <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
        {isLoaded ? (
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            {plan} plan
          </span>
        ) : (
          <div className="h-3 w-16 bg-bg-elevated rounded animate-pulse" />
        )}
        {/* Mobile close button */}
        <button
          onClick={closeSidebar}
          className="md:hidden text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Close menu"
        >
          <X size={14} />
        </button>
      </div>

      {/* Home */}
      <div className="px-3 py-2 border-b border-bg-border">
        <Link
          href="/home"
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200
            ${pathname === "/home"
              ? "bg-accent-primary text-text-inverse"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }
          `}
        >
          <Home size={14} />
          <span className="font-syne font-bold text-sm tracking-widest uppercase">
            Home
          </span>
        </Link>
      </div>

      {/* Zeus Command Center */}
      <div className="px-3 py-2 border-b border-bg-border">
        <Link
          href="/zeus"
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200
            ${pathname === "/zeus"
              ? "bg-accent-primary text-text-inverse"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }
          `}
        >
          <Zap size={14} />
          <span className="font-syne font-bold text-sm tracking-widest uppercase">
            GO RRQ
          </span>
        </Link>
      </div>

      {/* Inbox link */}
      <div className="px-3 py-2 border-b border-bg-border">
        <Link
          href="/inbox"
          className={`
            flex items-center justify-between gap-2 px-3 py-2 rounded-md transition-all duration-200
            ${pathname === "/inbox"
              ? "bg-accent-primary text-text-inverse"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }
          `}
        >
          <div className="flex items-center gap-2">
            <Inbox size={14} />
            <span className="font-syne font-bold text-xs tracking-wider uppercase">
              Inbox
            </span>
          </div>
        </Link>
      </div>

      {/* Sessions */}
      <div className="border-b border-bg-border">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
            Clips
          </span>
          <button
            onClick={handleNewClip}
            className="flex items-center gap-1 text-text-tertiary hover:text-accent-primary transition-colors"
            title="New clip"
          >
            <Plus size={12} />
            <span className="font-dm-mono text-[10px] tracking-wider">New</span>
          </button>
        </div>

        {sessionList.length === 0 ? (
          <div className="px-4 pb-3">
            <span className="font-dm-mono text-[10px] text-text-tertiary">No clips yet</span>
          </div>
        ) : (
          <div className="pb-1">
            {sessionList.map((session) => {
              const isActive = session.jobId === activeJobId;
              const running = sessionIsRunning(session);

              return (
                <div
                  key={session.jobId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSwitchSession(session.jobId)}
                  onKeyDown={(e) => e.key === "Enter" && handleSwitchSession(session.jobId)}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-left transition-all duration-200 group cursor-pointer
                    ${isActive
                      ? "bg-bg-elevated border-l-2 border-l-accent-primary"
                      : "hover:bg-bg-elevated border-l-2 border-l-transparent"
                    }
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {running && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse shrink-0" />
                      )}
                      <span className={`font-dm-mono text-[11px] truncate ${
                        isActive ? "text-text-primary" : "text-text-secondary"
                      }`}>
                        {sessionLabel(session)}
                      </span>
                    </div>
                    <span className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5 block">
                      {running ? "Running…" : sessionStepLabel(session)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.jobId)}
                    className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent-error transition-all duration-150 ml-1 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pipeline steps (for active session) */}
      <div className="flex-1 py-2">
        {/* Steps header — click to collapse/expand */}
        <button
          onClick={() => setStepsCollapsed((c) => !c)}
          className="w-full px-4 py-2 flex items-center justify-between group"
        >
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
            Steps
          </span>
          <div className="flex items-center gap-2">
            {stepsCollapsed && pendingGate && (
              <span className="font-dm-mono text-[9px] text-accent-primary animate-pulse tracking-wider">
                ◆ Approval
              </span>
            )}
            {stepsCollapsed && !pendingGate && anyRunning && (
              <span className="font-dm-mono text-[9px] text-accent-primary animate-pulse tracking-wider">
                Step {currentStep}
              </span>
            )}
            {stepsCollapsed ? (
              <ChevronRight size={11} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
            ) : (
              <ChevronDown size={11} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
            )}
          </div>
        </button>

        {/* Collapsed summary — shows current step or pending gate */}
        {stepsCollapsed && (
          <div className="px-4 py-2">
            {pendingGate ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent-primary/5 border border-accent-primary/30">
                <span className="text-[10px] text-accent-primary animate-pulse">◆</span>
                <div>
                  <span className="font-lora text-xs italic text-accent-primary block">Your Approval</span>
                  <span className="font-dm-mono text-[9px] text-text-tertiary">Director Gate pending</span>
                </div>
              </div>
            ) : currentStep > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated border border-bg-border">
                <span className="font-dm-mono text-[10px] text-text-tertiary w-4">
                  {String(currentStep).padStart(2, "0")}
                </span>
                <div>
                  <span className="font-syne text-xs text-text-primary block">
                    {PIPELINE_STEPS.find((s) => s.number === currentStep)?.label ?? `Step ${currentStep}`}
                  </span>
                  {anyRunning && (
                    <span className="font-dm-mono text-[9px] text-accent-primary animate-pulse">Running now</span>
                  )}
                </div>
              </div>
            ) : (
              <span className="font-dm-mono text-[10px] text-text-tertiary px-1">No active step</span>
            )}
          </div>
        )}

        {!stepsCollapsed && entries.map((entry) => {
          if (entry.type === "gate") {
            const isPending = entry.status === "pending";
            const isApproved = entry.status === "approved";
            const isActive = pendingGate === entry.gateId;

            return (
              <Link
                key={`gate-${entry.gateId}`}
                href={`/create/${entry.slug}`}
                className={`
                  flex items-center justify-between px-4 py-2.5 transition-all duration-200 group
                  relative border-l-2 ml-0
                  ${isActive
                    ? "step-active-border bg-bg-elevated text-text-primary border-l-accent-primary"
                    : isPending
                    ? "gate-pending-border bg-bg-elevated text-accent-primary border-l-accent-primary"
                    : isApproved
                    ? "text-accent-success border-l-accent-success bg-bg-elevated"
                    : "text-text-tertiary border-l-transparent hover:text-text-secondary hover:bg-bg-elevated"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <GateDiamond status={entry.status} />
                  <span className="font-lora text-xs italic">{entry.label}</span>
                </div>
                {isActive && <ChevronRight size={12} className="text-accent-primary" />}
              </Link>
            );
          }

          // Regular step entry
          const status = stepStatuses[entry.number] ?? "ready";
          const isActive = currentStep === entry.number;

          return (
            <Link
              key={entry.number}
              href={entry.slug ? `/create/${entry.slug}` : `/create`}
              className={`
                flex items-center justify-between px-4 py-2.5 transition-all duration-200 group
                relative
                ${isActive
                  ? "step-active-border bg-bg-elevated text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="font-dm-mono text-[11px] text-text-tertiary w-4 shrink-0">
                  {String(entry.number).padStart(2, "0")}
                </span>
                <div className="flex flex-col">
                  <span className="font-syne text-xs font-500">
                    {entry.label}
                  </span>
                  {status === "running" && (
                    <span className="font-dm-mono text-[9px] text-accent-primary tracking-wider animate-pulse">
                      Running now
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill status={status} compact />
                {isActive && (
                  <ChevronRight size={12} className="text-accent-primary" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden md:flex shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: slide-in overlay */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <div className="md:hidden fixed inset-y-0 left-0 z-50 flex">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useUIStore } from "@/lib/ui-store";
import { Zap, ChevronRight, X, Inbox } from "lucide-react";
import StatusPill from "@/components/ui/StatusPill";
import type { GateId, GateStatus } from "@/lib/pipeline-store";

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

export default function Sidebar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const { currentStep, stepStatuses, brief, approvalGates, pendingGate } = usePipelineStore();
  const { sidebarOpen, closeSidebar } = useUIStore();

  const plan = (user?.publicMetadata?.plan as string) ?? "free";
  const directorMode = brief?.directorMode ?? false;
  const anyRunning = Object.values(stepStatuses).some((s) => s === "running");

  const entries = injectGates(PIPELINE_STEPS, approvalGates, directorMode);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

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

      {/* Pipeline steps */}
      <div className="flex-1 py-2">
        <div className="px-4 py-2">
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            Pipeline
          </span>
        </div>

        {entries.map((entry) => {
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

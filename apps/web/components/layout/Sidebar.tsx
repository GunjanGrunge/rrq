"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useUIStore } from "@/lib/ui-store";
import { Zap, ChevronRight, X } from "lucide-react";
import StatusPill from "@/components/ui/StatusPill";

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
  { number: 10, label: "AV Sync", slug: "av-sync" },
  { number: 11, label: "Vera QA", slug: "vera-qa" },
  { number: 12, label: "Shorts", slug: "shorts" },
  { number: 13, label: "Upload", slug: "upload" },
];

export default function Sidebar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const { currentStep, stepStatuses } = usePipelineStore();
  const { sidebarOpen, closeSidebar } = useUIStore();

  const plan = (user?.publicMetadata?.plan as string) ?? "free";

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  const sidebarContent = (
    <aside className="w-60 bg-bg-surface border-r border-bg-border flex flex-col h-full overflow-y-auto">
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

      {/* Pipeline steps */}
      <div className="flex-1 py-2">
        <div className="px-4 py-2">
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            Pipeline
          </span>
        </div>

        {PIPELINE_STEPS.map((step) => {
          const status = stepStatuses[step.number] ?? "ready";
          const isActive = currentStep === step.number;

          return (
            <Link
              key={step.number}
              href={step.slug ? `/create/${step.slug}` : `/create`}
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
                  {String(step.number).padStart(2, "0")}
                </span>
                <span className="font-syne text-xs font-500">
                  {step.label}
                </span>
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

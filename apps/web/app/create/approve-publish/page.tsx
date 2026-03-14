"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import ApprovalGate from "@/components/pipeline/ApprovalGate";
import type { SEOOutput } from "@/lib/types/pipeline";

export default function ApprovePublishPage() {
  const router = useRouter();
  const { outputs, approveGate, approvalGates } = usePipelineStore();
  const gate = approvalGates["gate-publish"];
  const seo = outputs[3] as SEOOutput | undefined;

  // Approved edits from Gate 2 may have overridden SEO defaults
  const gate2Edits = approvalGates["gate-seo"].edits as {
    selectedTitle?: string;
    description?: string;
    tags?: string[];
    scheduledTime?: string;
  } | undefined;

  const finalTitle = (gate2Edits?.selectedTitle ?? seo?.finalTitle) ?? "Your Video";
  const finalDescription = gate2Edits?.description ?? seo?.description ?? "";
  const finalTags = gate2Edits?.tags ?? seo?.tags ?? [];
  const defaultSchedule = gate2Edits?.scheduledTime
    ?? (seo?.scheduledTime ? new Date(seo.scheduledTime).toISOString().slice(0, 16) : "");

  const [publishMode, setPublishMode] = useState<"now" | "schedule">("schedule");
  const [scheduledTime, setScheduledTime] = useState(defaultSchedule);
  const [isApproving, setIsApproving] = useState(false);

  const QA_DOMAINS = [
    { label: "Audio Clarity", pass: true },
    { label: "Visual Quality", pass: true },
    { label: "Brand Standards", pass: true },
  ];

  async function handleApprove() {
    setIsApproving(true);
    approveGate("gate-publish", { publishMode, scheduledTime });
    router.push("/create/shorts");
  }

  const isApproved = gate.status === "approved";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <ApprovalGate
        gateId="gate-publish"
        badge="Director Gate 4 / 4"
        title="Ready to Publish"
        subtitle="Your video has passed quality review. Confirm the publish settings and go live."
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        }
        isApproving={isApproving}
        isApproved={isApproved}
        onApprove={handleApprove}
        approveLabel={publishMode === "now" ? "Publish Now" : "Schedule & Publish"}
      >
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Left — video preview (55%) */}
          <div className="w-[55%] border-r border-bg-border overflow-y-auto p-6">
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Final Video</h3>
            <div className="aspect-video bg-bg-elevated border border-bg-border flex items-center justify-center mb-4">
              <div className="text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary mx-auto mb-2">
                  <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                <p className="font-dm-mono text-[10px] text-text-tertiary">
                  Video preview available after AV Sync completes
                </p>
              </div>
            </div>

            {/* QA badges */}
            <div>
              <h4 className="font-syne text-xs font-bold text-text-primary mb-2">Quality Review</h4>
              <div className="flex gap-2">
                {QA_DOMAINS.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-success/10 border border-accent-success/30"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-success">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="font-dm-mono text-[10px] text-accent-success">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — publish settings (45%) */}
          <div className="w-[45%] overflow-y-auto p-6 space-y-5">
            {/* Title preview */}
            <div>
              <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-1">Title</span>
              <p className="font-syne text-sm font-bold text-text-primary leading-snug">{finalTitle}</p>
            </div>

            {/* Description preview */}
            <div>
              <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-1">Description</span>
              <p className="font-lora text-xs text-text-secondary leading-relaxed line-clamp-4">{finalDescription}</p>
            </div>

            {/* Tags count */}
            <div>
              <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-1">Tags</span>
              <p className="font-dm-mono text-xs text-text-primary">{finalTags.length} tags applied</p>
            </div>

            {/* Publish mode */}
            <div>
              <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-2">Publish Mode</span>
              <div className="grid grid-cols-2 gap-2">
                {(["schedule", "now"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPublishMode(mode)}
                    className={`
                      py-2.5 border font-dm-mono text-xs tracking-wider transition-all duration-150
                      ${publishMode === mode
                        ? "border-accent-primary bg-accent-primary/5 text-accent-primary"
                        : "border-bg-border text-text-secondary hover:border-bg-border-hover"
                      }
                    `}
                  >
                    {mode === "schedule" ? "Schedule" : "Publish Now"}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule time */}
            {publishMode === "schedule" && (
              <div>
                <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-2">Publish At</span>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-bg-surface border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-dm-mono text-xs px-3 py-2"
                />
              </div>
            )}
          </div>
        </div>
      </ApprovalGate>
    </div>
  );
}

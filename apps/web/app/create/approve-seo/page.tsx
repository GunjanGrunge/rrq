"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import ApprovalGate from "@/components/pipeline/ApprovalGate";
import type { SEOOutput } from "@/lib/types/pipeline";
import MetadataChip from "@/components/ui/MetadataChip";

export default function ApproveSEOPage() {
  const router = useRouter();
  const { outputs, approveGate, approvalGates } = usePipelineStore();
  const seo = outputs[3] as SEOOutput | undefined;
  const gate = approvalGates["gate-seo"];

  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [description, setDescription] = useState(seo?.description ?? "");
  const [tags, setTags] = useState<string[]>(seo?.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [scheduledTime, setScheduledTime] = useState(
    seo?.scheduledTime ? new Date(seo.scheduledTime).toISOString().slice(0, 16) : ""
  );
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (seo) {
      setDescription(seo.description);
      setTags(seo.tags);
      if (seo.scheduledTime) {
        setScheduledTime(new Date(seo.scheduledTime).toISOString().slice(0, 16));
      }
    }
  }, [seo]);

  if (!seo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Complete the SEO step first.
        </p>
      </div>
    );
  }

  const allTitles = [seo.finalTitle, ...(seo.titleVariants?.map((v) => v.title) ?? [])].slice(0, 3);
  const selectedTitle = allTitles[selectedTitleIndex] ?? seo.finalTitle;

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function addTag() {
    const t = newTag.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setNewTag("");
  }

  async function handleApprove() {
    setIsApproving(true);
    approveGate("gate-seo", { selectedTitle, description, tags, scheduledTime });
    router.push("/create/quality");
  }

  const isApproved = gate.status === "approved";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <ApprovalGate
        gateId="gate-seo"
        badge="Director Gate 2 / 4"
        title="Review Your Metadata"
        subtitle="Pick a title, edit the description, trim tags, and confirm the publish schedule."
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
        isApproving={isApproving}
        isApproved={isApproved}
        onApprove={handleApprove}
        approveLabel="Approve Metadata & Run Quality Gate"
      >
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Title picker */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-syne text-sm font-bold text-text-primary">Select a Title</h3>
              <div className="flex items-center gap-2">
                <MetadataChip label={`CTR: ${seo.expectedCTR}`} variant="keyword" />
                <MetadataChip label={`SEO: ${seo.seoStrengthScore}/10`} variant="tag" />
              </div>
            </div>
            <div className="space-y-2">
              {allTitles.map((title, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTitleIndex(i)}
                  className={`
                    w-full text-left p-4 border transition-all duration-150
                    ${selectedTitleIndex === i
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-bg-border hover:border-bg-border-hover bg-bg-surface"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-syne text-sm text-text-primary flex-1">{title}</p>
                    {selectedTitleIndex === i && (
                      <div className="w-4 h-4 border border-accent-primary bg-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className="font-dm-mono text-[10px] text-text-tertiary mt-1 block">
                    {title.length} characters
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-syne text-sm font-bold text-text-primary">Description</h3>
              <span className="font-dm-mono text-[10px] text-text-tertiary">{description.length} / 5000</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={8}
              className="w-full bg-bg-surface border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-4 py-3 resize-none placeholder:text-text-tertiary"
            />
          </div>

          {/* Tags */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <div key={tag} className="flex items-center gap-1 px-2 py-1 bg-bg-surface border border-bg-border">
                  <span className="font-dm-mono text-xs text-text-secondary">{tag}</span>
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-text-tertiary hover:text-accent-error transition-colors ml-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="+ Add tag"
                className="flex-1 bg-bg-surface border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-dm-mono text-xs px-3 py-2 placeholder:text-text-tertiary"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 border border-bg-border text-text-secondary font-dm-mono text-xs hover:border-accent-primary hover:text-accent-primary transition-all"
              >
                Add
              </button>
            </div>
          </div>

          {/* Scheduled time */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-2">Publish Schedule</h3>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="bg-bg-surface border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-dm-mono text-xs px-3 py-2 w-full"
            />
          </div>
        </div>
      </ApprovalGate>
    </div>
  );
}

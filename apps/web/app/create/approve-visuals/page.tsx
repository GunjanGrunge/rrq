"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import ApprovalGate from "@/components/pipeline/ApprovalGate";

export default function ApproveVisualsPage() {
  const router = useRouter();
  const { outputs, approveGate, approvalGates } = usePipelineStore();
  const gate = approvalGates["gate-visuals"];

  // Visual assets come from outputs[8] (images) and outputs[9] (visuals)
  // In Phase 4+ these will have presigned S3 URLs — placeholder for now
  const imageAssets = (outputs[8] as Array<{ id: string; label: string; url?: string }> | undefined) ?? [];
  const visualAssets = (outputs[9] as Array<{ id: string; label: string; url?: string }> | undefined) ?? [];
  const allAssets = [...imageAssets, ...visualAssets].slice(0, 6);

  const [approvedAssets] = useState(allAssets);
  const [isApproving, setIsApproving] = useState(false);

  async function handleApprove() {
    setIsApproving(true);
    approveGate("gate-visuals", { approvedAssets });
    router.push("/create/av-sync");
  }

  async function handleRegenerate(notes: string) {
    console.log("Regenerate visuals with notes:", notes);
  }

  const isApproved = gate.status === "approved";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <ApprovalGate
        gateId="gate-visuals"
        badge="Director Gate 3 / 4"
        title="Review Your Visual Assets"
        subtitle="Preview the thumbnail and section visuals. Regenerate any asset before production starts."
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        }
        isApproving={isApproving}
        isApproved={isApproved}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        approveLabel="Approve Visuals & Start Production"
      >
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Thumbnail */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Thumbnail</h3>
            <div className="aspect-video bg-bg-elevated border border-bg-border flex items-center justify-center max-w-md">
              <div className="text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary mx-auto mb-2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="font-dm-mono text-[10px] text-text-tertiary">Thumbnail ready in Phase 4</p>
              </div>
            </div>
          </div>

          {/* Asset grid */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Section Visuals</h3>
            {allAssets.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {allAssets.map((asset, i) => (
                  <div key={asset.id ?? i} className="bg-bg-surface border border-bg-border p-3">
                    <div className="aspect-video bg-bg-elevated border border-bg-border mb-2 flex items-center justify-center">
                      {asset.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt={asset.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-dm-mono text-[10px] text-text-tertiary">Preview</span>
                      )}
                    </div>
                    <p className="font-dm-mono text-[10px] text-text-secondary truncate">{asset.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-bg-surface border border-bg-border border-dashed p-3">
                    <div className="aspect-video bg-bg-elevated flex items-center justify-center mb-2">
                      <span className="font-dm-mono text-[10px] text-text-tertiary">Asset {i + 1}</span>
                    </div>
                    <p className="font-dm-mono text-[10px] text-text-tertiary">Available in Phase 4</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Council panel */}
          <div className="bg-bg-surface border border-bg-border p-4">
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Production Council</h3>
            <p className="font-lora text-xs text-text-secondary">
              The production council reviewed this video before visuals were generated. All agents signed off on the script and angle. Live council feedback will appear here in Phase 5.
            </p>
          </div>
        </div>
      </ApprovalGate>
    </div>
  );
}

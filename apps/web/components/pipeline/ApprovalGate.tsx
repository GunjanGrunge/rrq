"use client";

import { useState } from "react";

interface ApprovalGateProps {
  gateId: string;
  badge: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isApproving?: boolean;
  isApproved?: boolean;
  onApprove: () => void;
  onRegenerate?: (notes: string) => void;
  approveLabel?: string;
  children?: React.ReactNode;
}

export default function ApprovalGate({
  badge,
  title,
  subtitle,
  icon,
  isApproving = false,
  isApproved = false,
  onApprove,
  onRegenerate,
  approveLabel = "Approve",
  children,
}: ApprovalGateProps) {
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenNotes, setRegenNotes] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    await onRegenerate(regenNotes);
    setIsRegenerating(false);
    setShowRegenerate(false);
    setRegenNotes("");
  }

  return (
    <div
      className={`
        flex flex-col h-full border-l-2 transition-all duration-300
        ${isApproved
          ? "border-l-accent-success gate-approved-flash"
          : "border-l-accent-primary gate-pending-border"
        }
      `}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-bg-border bg-bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-8 h-8 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
              {icon}
            </div>
          )}
          <div>
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-[0.3em] uppercase block">
              {badge}
            </span>
            <h1 className="font-syne font-bold text-lg text-text-primary leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="font-lora text-xs text-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {isApproved && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-success/10 border border-accent-success/30">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-success" />
            <span className="font-dm-mono text-[10px] text-accent-success tracking-widest uppercase">
              Approved
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Footer */}
      {!isApproved && (
        <div className="px-6 py-4 border-t border-bg-border bg-bg-surface shrink-0 space-y-3">
          {/* Regenerate row */}
          {onRegenerate && (
            <div>
              {showRegenerate ? (
                <div className="space-y-2">
                  <textarea
                    value={regenNotes}
                    onChange={(e) => setRegenNotes(e.target.value)}
                    placeholder="What should be changed? (optional)"
                    rows={2}
                    className="w-full bg-bg-elevated border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-3 py-2 resize-none placeholder:text-text-tertiary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="flex-1 py-2 border border-bg-border text-text-secondary font-dm-mono text-xs tracking-wider hover:border-accent-primary hover:text-accent-primary transition-all duration-150 disabled:opacity-50"
                    >
                      {isRegenerating ? "Regenerating..." : "Regenerate"}
                    </button>
                    <button
                      onClick={() => setShowRegenerate(false)}
                      className="px-4 py-2 border border-bg-border text-text-tertiary font-dm-mono text-xs hover:text-text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRegenerate(true)}
                  className="w-full py-2 border border-bg-border text-text-tertiary font-dm-mono text-xs tracking-wider hover:border-bg-border-hover hover:text-text-secondary transition-all duration-150"
                >
                  Regenerate with notes
                </button>
              )}
            </div>
          )}

          {/* Approve CTA */}
          <button
            onClick={onApprove}
            disabled={isApproving || isRegenerating}
            className="w-full py-4 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm tracking-widest uppercase transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isApproving ? "Approving..." : approveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

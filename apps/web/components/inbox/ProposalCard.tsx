"use client";

import { useState } from "react";
import type { InboxMessage } from "@/lib/notifications/notification-store";

interface ProposalCardProps {
  message: InboxMessage;
  onAccept: () => void;
  onDecline: () => void;
  onAsk: (question: string) => void;
}

export default function ProposalCard({ message, onAccept, onDecline, onAsk }: ProposalCardProps) {
  const [showAskInput, setShowAskInput] = useState(false);
  const [question, setQuestion] = useState("");
  const proposal = message.proposalData;

  if (!proposal) return null;

  const isPending = proposal.status === "pending";
  const isApproved = proposal.status === "approved";
  const isDeclined = proposal.status === "declined";

  function handleAsk() {
    if (question.trim()) {
      onAsk(question.trim());
      setQuestion("");
      setShowAskInput(false);
    }
  }

  return (
    <div className="bg-bg-surface border border-bg-border">
      {/* Proposal header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
            Proposal
          </span>
          <span className="font-dm-mono text-[10px] text-text-tertiary">·</span>
          <span className="font-dm-mono text-[10px] text-text-tertiary capitalize">
            {message.agentSource}
          </span>
        </div>
        {isApproved && (
          <span className="font-dm-mono text-[10px] text-accent-success tracking-widest uppercase">Accepted</span>
        )}
        {isDeclined && (
          <span className="font-dm-mono text-[10px] text-accent-error tracking-widest uppercase">Declined</span>
        )}
        {!isPending && proposal.autoApplyAt && proposal.status === "pending" && (
          <span className="font-dm-mono text-[10px] text-text-tertiary">
            Auto-applies {new Date(proposal.autoApplyAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Before / After diff */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase block mb-2">Current</span>
          <div className="bg-bg-elevated border border-bg-border p-3">
            <p className="font-lora text-sm text-text-secondary leading-relaxed">{proposal.current}</p>
          </div>
        </div>
        <div>
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase block mb-2">Proposed</span>
          <div className="bg-accent-primary/5 border border-accent-primary/30 p-3">
            <p className="font-lora text-sm text-text-primary leading-relaxed">{proposal.proposed}</p>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="px-4 pb-4">
        <p className="font-dm-mono text-[10px] text-text-tertiary">
          <span className="text-text-secondary">Reason:</span> {proposal.reason}
        </p>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="px-4 pb-4 space-y-3 border-t border-bg-border pt-4">
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 py-2 bg-accent-primary text-text-inverse font-dm-mono text-xs tracking-wider hover:bg-accent-primary-hover transition-all"
            >
              Accept Update
            </button>
            <button
              onClick={onDecline}
              className="flex-1 py-2 border border-bg-border text-text-secondary font-dm-mono text-xs tracking-wider hover:border-accent-error hover:text-accent-error transition-all"
            >
              Decline
            </button>
            <button
              onClick={() => setShowAskInput(!showAskInput)}
              className="px-4 py-2 border border-bg-border text-text-tertiary font-dm-mono text-xs tracking-wider hover:border-bg-border-hover hover:text-text-secondary transition-all"
            >
              Ask
            </button>
          </div>

          {showAskInput && (
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="Ask a question about this proposal..."
                className="flex-1 bg-bg-elevated border border-bg-border focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-3 py-2 placeholder:text-text-tertiary"
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim()}
                className="px-4 py-2 bg-accent-primary text-text-inverse font-dm-mono text-xs disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

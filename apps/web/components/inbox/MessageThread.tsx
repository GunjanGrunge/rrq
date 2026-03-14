"use client";

import { useState } from "react";
import type { InboxMessage } from "@/lib/notifications/notification-store";
import ProposalCard from "./ProposalCard";

interface MessageThreadProps {
  message: InboxMessage;
  onAcceptProposal: () => void;
  onDeclineProposal: () => void;
  onReply: (content: string) => void;
  onAskProposal: (question: string) => void;
  onDelete: () => void;
  onRestore?: () => void; // present when viewing from Trash
  isTrashView?: boolean;
}

const AGENT_LABELS: Record<string, string> = {
  oracle: "Oracle",
  zeus: "Zeus",
  rex: "Rex",
  council: "Council",
  system: "System",
};

const TIER_BADGE: Record<string, string> = {
  critical: "bg-accent-error/10 border-accent-error/30 text-accent-error",
  high: "bg-accent-primary/10 border-accent-primary/30 text-accent-primary",
  normal: "bg-bg-elevated border-bg-border text-text-secondary",
  low: "bg-bg-elevated border-bg-border text-text-tertiary",
};

export default function MessageThread({
  message,
  onAcceptProposal,
  onDeclineProposal,
  onReply,
  onAskProposal,
  onDelete,
  onRestore,
  isTrashView = false,
}: MessageThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSend() {
    const text = replyText.trim();
    if (!text) return;
    onReply(text);
    setReplyText("");
  }

  function handleDeleteClick() {
    if (isTrashView) {
      // From trash — permanently delete, no extra confirm needed (already in trash)
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bg-border bg-bg-surface shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-dm-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border ${TIER_BADGE[message.tier]}`}>
                {message.tier}
              </span>
              <span className="font-dm-mono text-[10px] text-text-tertiary capitalize">
                from {AGENT_LABELS[message.agentSource] ?? message.agentSource}
              </span>
            </div>
            <h2 className="font-syne font-bold text-lg text-text-primary">{message.title}</h2>
          </div>

          {/* Right side: timestamp + actions */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-dm-mono text-[10px] text-text-tertiary">
              {new Date(message.createdAt).toLocaleString()}
            </span>

            {isTrashView && onRestore && (
              <button
                onClick={onRestore}
                className="font-dm-mono text-[10px] text-text-tertiary hover:text-accent-success transition-colors tracking-wider uppercase"
                title="Restore to inbox"
              >
                Restore
              </button>
            )}

            {/* Trash / permanent delete icon */}
            <button
              onClick={handleDeleteClick}
              className={`p-1.5 transition-colors ${
                isTrashView
                  ? "text-accent-error/50 hover:text-accent-error"
                  : "text-text-tertiary hover:text-accent-error"
              }`}
              title={isTrashView ? "Delete permanently" : "Move to trash"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Trash notice */}
        {isTrashView && message.deletedAt && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-bg-elevated border border-bg-border">
            <span className="font-dm-mono text-[10px] text-text-tertiary">
              In Trash · auto-deletes in{" "}
              {(() => {
                const MS_90 = 90 * 24 * 60 * 60 * 1000;
                const days = Math.max(0, Math.ceil((message.deletedAt + MS_90 - Date.now()) / (24 * 60 * 60 * 1000)));
                return `${days} day${days !== 1 ? "s" : ""}`;
              })()}
            </span>
          </div>
        )}

        {/* Inline delete confirm (inbox view only) */}
        {confirmDelete && (
          <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-accent-error/5 border border-accent-error/20">
            <span className="font-dm-mono text-[10px] text-text-secondary flex-1">
              Move to Trash? You can restore it within 90 days.
            </span>
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              className="font-dm-mono text-[10px] text-accent-error hover:text-accent-error tracking-wider uppercase"
            >
              Move to Trash
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="font-dm-mono text-[10px] text-text-tertiary hover:text-text-secondary tracking-wider uppercase"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Thread body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Original message */}
        <div className="flex gap-3">
          <div className="w-7 h-7 bg-bg-elevated border border-bg-border flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-dm-mono text-[9px] text-text-secondary uppercase">
              {(AGENT_LABELS[message.agentSource] ?? "S")[0]}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-dm-mono text-xs text-text-primary">
                {AGENT_LABELS[message.agentSource] ?? message.agentSource}
              </span>
              <span className="font-dm-mono text-[10px] text-text-tertiary">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="font-lora text-sm text-text-secondary leading-relaxed">{message.body}</p>
          </div>
        </div>

        {/* Proposal card */}
        {message.type === "proposal" && message.proposalData && !isTrashView && (
          <ProposalCard
            message={message}
            onAccept={onAcceptProposal}
            onDecline={onDeclineProposal}
            onAsk={onAskProposal}
          />
        )}

        {/* Thread messages */}
        {message.thread.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "user"
                ? "bg-accent-primary/10 border border-accent-primary/20"
                : "bg-bg-elevated border border-bg-border"
            }`}>
              <span className={`font-dm-mono text-[9px] uppercase ${
                msg.role === "user" ? "text-accent-primary" : "text-text-secondary"
              }`}>
                {msg.role === "user" ? "You" : (AGENT_LABELS[message.agentSource] ?? "A")[0]}
              </span>
            </div>
            <div className={`max-w-[75%] px-4 py-2.5 font-lora text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-accent-primary/10 border border-accent-primary/20 text-text-primary"
                : "bg-bg-elevated text-text-secondary"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Pending Zeus response hint */}
        {!isTrashView &&
          message.thread.some((m) => m.role === "user") &&
          message.thread[message.thread.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-bg-elevated border border-bg-border flex items-center justify-center shrink-0">
              <span className="font-dm-mono text-[9px] text-text-secondary">Z</span>
            </div>
            <div className="px-4 py-2.5 bg-bg-elevated border border-bg-border">
              <p className="font-dm-mono text-[10px] text-text-tertiary animate-pulse">
                Zeus will respond on the next scheduled run
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reply box — hidden in trash view and for FYI messages */}
      {message.type !== "fyi" && !isTrashView && (
        <div className="px-6 py-4 border-t border-bg-border bg-bg-surface shrink-0">
          <div className="flex gap-3">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Reply..."
              className="flex-1 bg-bg-elevated border border-bg-border hover:border-bg-border-hover focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-4 py-2.5 transition-all placeholder:text-text-tertiary"
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim()}
              className={`px-4 py-2.5 transition-all duration-150 font-dm-mono text-xs tracking-wider ${
                replyText.trim()
                  ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse"
                  : "bg-bg-elevated text-text-tertiary cursor-not-allowed border border-bg-border"
              }`}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

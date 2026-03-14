"use client";

import type { InboxMessage, ArchiveEntry, MessageType, InboxView } from "@/lib/notifications/notification-store";
import { filterMessages, getTrashedMessages, trashDaysRemaining } from "@/lib/notifications/notification-store";

const TIER_STYLES: Record<string, string> = {
  critical: "border-l-2 border-l-accent-error",
  high: "border-l-2 border-l-accent-primary",
  normal: "",
  low: "",
};

const TIER_DOT: Record<string, string> = {
  critical: "bg-accent-error",
  high: "bg-accent-primary",
  normal: "bg-text-secondary",
  low: "bg-text-tertiary",
};

const TYPE_LABEL: Record<MessageType | "system", string> = {
  fyi: "FYI",
  alert: "Alert",
  proposal: "Proposal",
  system: "System",
};

const INBOX_FILTERS: Array<{ value: "all" | MessageType | "system"; label: string }> = [
  { value: "all", label: "All" },
  { value: "proposal", label: "Proposals" },
  { value: "fyi", label: "FYI" },
  { value: "alert", label: "Alerts" },
  { value: "system", label: "System" },
];

interface MessageListProps {
  messages: InboxMessage[];
  archiveEntries: ArchiveEntry[];
  activeId: string | null;
  filter: "all" | MessageType | "system";
  view: InboxView;
  onFilterChange: (f: "all" | MessageType | "system") => void;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}

export default function MessageList({
  messages,
  archiveEntries,
  activeId,
  filter,
  view,
  onFilterChange,
  onSelect,
  onRestore,
  onPurge,
}: MessageListProps) {

  // ── Inbox view ────────────────────────────────────────────────────────────
  if (view === "inbox") {
    const filtered = filterMessages(messages, filter);

    return (
      <div className="flex flex-col h-full">
        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-3 border-b border-bg-border shrink-0 overflow-x-auto">
          {INBOX_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`
                font-dm-mono text-[10px] tracking-widest uppercase px-3 py-1.5 shrink-0 transition-all duration-150
                ${filter === f.value
                  ? "bg-accent-primary text-text-inverse"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated"
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="font-dm-mono text-xs text-text-tertiary">No messages</p>
            </div>
          ) : (
            filtered.map((msg) => (
              <MessageRow
                key={msg.messageId}
                msg={msg}
                isActive={activeId === msg.messageId}
                onClick={() => onSelect(msg.messageId)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Trash view ────────────────────────────────────────────────────────────
  if (view === "trash") {
    const trashed = getTrashedMessages(messages);

    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-bg-border shrink-0">
          <p className="font-dm-mono text-[10px] text-text-tertiary leading-relaxed">
            Messages auto-delete after 90 days. Zeus archives a one-line record before purging.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {trashed.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="font-dm-mono text-xs text-text-tertiary">Trash is empty</p>
            </div>
          ) : (
            trashed.map((msg) => {
              const days = msg.deletedAt ? trashDaysRemaining(msg.deletedAt) : 90;
              return (
                <div key={msg.messageId} className="border-b border-bg-border">
                  <button
                    onClick={() => onSelect(msg.messageId)}
                    className={`w-full text-left px-4 py-3 transition-all duration-150 hover:bg-bg-elevated ${
                      activeId === msg.messageId ? "bg-bg-elevated" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
                            {TYPE_LABEL[msg.type]}
                          </span>
                          <span className="font-dm-mono text-[10px] text-text-tertiary">·</span>
                          <span className="font-dm-mono text-[10px] text-text-tertiary capitalize">
                            {msg.agentSource}
                          </span>
                        </div>
                        <p className="font-syne text-sm font-bold text-text-tertiary truncate">{msg.title}</p>
                        <span className="font-dm-mono text-[10px] text-accent-error/60 mt-1 block">
                          {days > 0 ? `Deletes in ${days}d` : "Deletes soon"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Restore / Purge row */}
                  <div className="flex gap-3 px-4 pb-3">
                    <button
                      onClick={() => onRestore(msg.messageId)}
                      className="font-dm-mono text-[10px] text-text-tertiary hover:text-accent-success transition-colors tracking-wider uppercase"
                    >
                      Restore
                    </button>
                    <span className="font-dm-mono text-[10px] text-text-tertiary">·</span>
                    <button
                      onClick={() => onPurge(msg.messageId)}
                      className="font-dm-mono text-[10px] text-text-tertiary hover:text-accent-error transition-colors tracking-wider uppercase"
                    >
                      Delete permanently
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Archive view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-bg-border shrink-0">
        <p className="font-dm-mono text-[10px] text-text-tertiary leading-relaxed">
          One-line receipts written by Zeus. Auto-clear after 365 days.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {archiveEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-dm-mono text-xs text-text-tertiary">No archive entries yet</p>
          </div>
        ) : (
          archiveEntries.map((entry) => (
            <div key={entry.archiveId} className="px-4 py-3 border-b border-bg-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-dm-mono text-[10px] tracking-widest uppercase ${
                      entry.tier === "critical" ? "text-accent-error" :
                      entry.tier === "high" ? "text-accent-primary" :
                      "text-text-tertiary"
                    }`}>
                      {entry.tier}
                    </span>
                    <span className="font-dm-mono text-[10px] text-text-tertiary">·</span>
                    <span className="font-dm-mono text-[10px] text-text-tertiary capitalize">
                      {entry.agentSource}
                    </span>
                  </div>
                  <p className="font-lora text-sm text-text-tertiary leading-relaxed">{entry.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-dm-mono text-[10px] text-text-tertiary">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`font-dm-mono text-[9px] tracking-widest uppercase ${
                    entry.action === "accepted" ? "text-accent-success" :
                    entry.action === "declined" ? "text-accent-error" :
                    "text-text-tertiary"
                  }`}>
                    {entry.action}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Shared row component for inbox view
function MessageRow({
  msg,
  isActive,
  onClick,
}: {
  msg: InboxMessage;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-4 py-4 border-b border-bg-border transition-all duration-150
        ${TIER_STYLES[msg.tier]}
        ${isActive ? "bg-bg-elevated" : "hover:bg-bg-elevated"}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!msg.read ? (
            <div className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[msg.tier]}`} />
          ) : (
            <div className="w-1.5 h-1.5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-dm-mono text-[10px] tracking-widest uppercase ${
              msg.tier === "critical" ? "text-accent-error" :
              msg.tier === "high" ? "text-accent-primary" :
              "text-text-tertiary"
            }`}>
              {msg.tier === "critical" || msg.tier === "high"
                ? msg.tier.toUpperCase()
                : TYPE_LABEL[msg.type]
              }
            </span>
            <span className="font-dm-mono text-[10px] text-text-tertiary">·</span>
            <span className="font-dm-mono text-[10px] text-text-tertiary capitalize">
              {msg.agentSource}
            </span>
          </div>

          <p className={`font-syne text-sm font-bold truncate ${
            msg.read ? "text-text-secondary" : "text-text-primary"
          }`}>
            {msg.title}
          </p>

          <p className="font-lora text-xs text-text-tertiary mt-0.5 line-clamp-2">
            {msg.body}
          </p>

          <span className="font-dm-mono text-[10px] text-text-tertiary mt-1 block">
            {new Date(msg.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    </button>
  );
}

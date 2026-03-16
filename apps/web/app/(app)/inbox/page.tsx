"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useNotificationStore,
  getUnreadCount,
  getTrashedMessages,
} from "@/lib/notifications/notification-store";
import type { InboxMessage, MessageType } from "@/lib/notifications/notification-store";
import MessageList from "@/components/inbox/MessageList";
import MessageThread from "@/components/inbox/MessageThread";

// Seed demo messages for Phase 1 UI
const DEMO_MESSAGES: InboxMessage[] = [
  {
    messageId: "demo-1",
    type: "proposal",
    tier: "high",
    title: "Oracle has a recommendation for your channel",
    body: "Proposing a script structure update based on retention data from your last 3 videos.",
    agentSource: "oracle",
    proposalData: {
      current: "Hook-first structure with 30-second open",
      proposed: "Data-lead structure with 45-second open showing the key insight first",
      reason: "Last 3 videos with data-lead hooks had +18% avg retention at the 2-minute mark.",
      targetAgent: "muse",
      status: "pending",
    },
    thread: [],
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60,
    emailSent: true,
  },
  {
    messageId: "demo-2",
    type: "fyi",
    tier: "normal",
    title: "Council minutes — Video #14 complete",
    body: "All agents signed off. Zeus approved the final cut. Quality score: 8.4/10.",
    agentSource: "council",
    thread: [],
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    emailSent: false,
  },
  {
    messageId: "demo-3",
    type: "alert",
    tier: "critical",
    title: "Action required — Pipeline paused at Step 6",
    body: "Avatar generation has not completed after 25 minutes. Pipeline paused automatically.",
    agentSource: "system",
    relatedJobId: "job-abc123",
    thread: [],
    read: true,
    createdAt: Date.now() - 1000 * 60 * 2,
    emailSent: true,
  },
  {
    messageId: "demo-4",
    type: "fyi",
    tier: "low",
    title: "Rex watchlist update",
    body: "Rex added 3 topics to your watchlist. No action needed — Rex will surface these when ready.",
    agentSource: "rex",
    thread: [],
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    emailSent: false,
  },
];

const VIEW_LABELS = {
  inbox: "Inbox",
  trash: "Trash",
  archive: "Archive",
} as const;

function InboxDeepLink() {
  const searchParams = useSearchParams();
  const { messages, setActiveMessage } = useNotificationStore();

  useEffect(() => {
    const id = searchParams.get("message");
    // Guard: only call setActiveMessage if message exists in store.
    // Note: if store hydrates after mount (e.g. demo seed in useEffect), this will
    // silently not deep-link — this is intentional per spec ("no action taken if not found").
    if (id && messages.find((m) => m.messageId === id)) {
      setActiveMessage(id);
    }
  // Intentionally runs on mount only — query param does not change after navigation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function InboxPage() {
  const {
    messages,
    archiveEntries,
    activeMessageId,
    filter,
    view,
    setMessages,
    setActiveMessage,
    setFilter,
    setView,
    markRead,
    markAllRead,
    updateProposalStatus,
    appendThreadMessage,
    deleteMessage,
    restoreMessage,
    purgeMessage,
  } = useNotificationStore();

  // Seed demo data on first load
  useEffect(() => {
    if (messages.length === 0) {
      setMessages(DEMO_MESSAGES);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveMessages = messages.filter((m) => !m.deletedAt);
  const trashedMessages = getTrashedMessages(messages);
  const unreadCount = getUnreadCount(messages);
  const trashCount = trashedMessages.length;

  // Active message — search all messages (inbox + trash)
  const activeMessage = messages.find((m) => m.messageId === activeMessageId) ?? null;
  const isTrashView = view === "trash";

  function handleSelect(id: string) {
    setActiveMessage(id);
    if (!isTrashView) markRead(id);
  }

  async function handleDelete() {
    if (!activeMessageId) return;
    if (isTrashView) {
      // Permanent delete from trash
      purgeMessage(activeMessageId);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge", messageId: activeMessageId }),
      }).catch(() => {});
    } else {
      // Soft delete — move to trash
      deleteMessage(activeMessageId);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", messageId: activeMessageId }),
      }).catch(() => {});
    }
  }

  async function handleRestore() {
    if (!activeMessageId) return;
    restoreMessage(activeMessageId);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", messageId: activeMessageId }),
    }).catch(() => {});
  }

  // List-level restore / purge (from trash list buttons, not thread)
  async function handleListRestore(id: string) {
    restoreMessage(id);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", messageId: id }),
    }).catch(() => {});
  }

  async function handleListPurge(id: string) {
    purgeMessage(id);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge", messageId: id }),
    }).catch(() => {});
  }

  async function handleAcceptProposal() {
    if (!activeMessageId) return;
    updateProposalStatus(activeMessageId, "approved");
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept-proposal", messageId: activeMessageId }),
    }).catch(() => {});
  }

  async function handleDeclineProposal() {
    if (!activeMessageId) return;
    updateProposalStatus(activeMessageId, "declined");
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline-proposal", messageId: activeMessageId }),
    }).catch(() => {});
  }

  async function handleReply(content: string) {
    if (!activeMessageId) return;
    const msg = { role: "user" as const, content, timestamp: Date.now() };
    appendThreadMessage(activeMessageId, msg);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", messageId: activeMessageId, content }),
    }).catch(() => {});
  }

  async function handleAskProposal(question: string) {
    if (!activeMessageId) return;
    const msg = { role: "user" as const, content: question, timestamp: Date.now() };
    appendThreadMessage(activeMessageId, msg);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", messageId: activeMessageId, content: question }),
    }).catch(() => {});
  }

  return (
    <div className="flex h-full bg-bg-base">
      <Suspense fallback={null}>
        <InboxDeepLink />
      </Suspense>
      {/* Left panel */}
      <div className="w-[380px] shrink-0 border-r border-bg-border flex flex-col">

        {/* Header row */}
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-syne font-bold text-base text-text-primary tracking-wider uppercase">
              {VIEW_LABELS[view]}
            </h1>
            {view === "inbox" && unreadCount > 0 && (
              <span className="font-dm-mono text-[10px] text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5">
                {unreadCount}
              </span>
            )}
            {view === "trash" && trashCount > 0 && (
              <span className="font-dm-mono text-[10px] text-text-tertiary bg-bg-elevated border border-bg-border px-2 py-0.5">
                {trashCount}
              </span>
            )}
          </div>
          {view === "inbox" && unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="font-dm-mono text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Folder nav */}
        <div className="flex border-b border-bg-border shrink-0">
          {(["inbox", "trash", "archive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2.5 font-dm-mono text-[10px] tracking-widest uppercase transition-all duration-150 ${
                view === v
                  ? "text-text-primary border-b border-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {v === "inbox" ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Inbox
                </span>
              ) : v === "trash" ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                  Trash
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  Archive
                </span>
              )}
            </button>
          ))}
        </div>

        <MessageList
          messages={view === "inbox" ? liveMessages : messages}
          archiveEntries={archiveEntries}
          activeId={activeMessageId}
          filter={filter}
          view={view}
          onFilterChange={setFilter}
          onSelect={handleSelect}
          onRestore={handleListRestore}
          onPurge={handleListPurge}
        />
      </div>

      {/* Right panel — thread */}
      <div className="flex-1 overflow-hidden">
        {activeMessage ? (
          <MessageThread
            message={activeMessage}
            onAcceptProposal={handleAcceptProposal}
            onDeclineProposal={handleDeclineProposal}
            onReply={handleReply}
            onAskProposal={handleAskProposal}
            onDelete={handleDelete}
            onRestore={isTrashView ? handleRestore : undefined}
            isTrashView={isTrashView}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {view === "trash" ? (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary mx-auto mb-3">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                  <p className="font-dm-mono text-xs text-text-tertiary">Select a message to preview</p>
                </>
              ) : view === "archive" ? (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary mx-auto mb-3">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <p className="font-dm-mono text-xs text-text-tertiary">Zeus-authored archive receipts</p>
                  <p className="font-dm-mono text-[10px] text-text-tertiary mt-1 opacity-60">Auto-clear after 365 days</p>
                </>
              ) : (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-tertiary mx-auto mb-3">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <p className="font-dm-mono text-xs text-text-tertiary">Select a message to read</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

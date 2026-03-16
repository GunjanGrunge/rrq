"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import Link from "next/link";
import {
  useNotificationStore,
  getUnreadCount,
} from "@/lib/notifications/notification-store";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BellNotification() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { messages, markRead, deleteMessage } = useNotificationStore();
  const unreadCount = getUnreadCount(messages);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // filter deleted, sort newest first, cap at 5
  const visibleMessages = messages
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  function handleClearRead() {
    messages
      .filter((m) => m.read && !m.deletedAt)
      .forEach((m) => deleteMessage(m.messageId));
  }

  function handleItemClick(messageId: string) {
    markRead(messageId);
    setOpen(false);
    router.push(`/inbox?message=${messageId}`);
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-text-secondary hover:text-text-primary transition-colors duration-200"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-accent-primary text-bg-base font-dm-mono text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-8 w-[340px] bg-bg-surface border border-bg-border rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
            <span className="font-syne font-bold text-sm text-text-primary">
              Notifications
            </span>
            <button
              onClick={handleClearRead}
              className="font-dm-mono text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Clear read
            </button>
          </div>

          {/* Message list */}
          {visibleMessages.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-dm-mono text-xs text-text-tertiary">No notifications</p>
            </div>
          ) : (
            <div>
              {visibleMessages.map((m) => (
                <button
                  key={m.messageId}
                  onClick={() => handleItemClick(m.messageId)}
                  className={`w-full text-left px-4 py-3 border-b border-bg-border flex gap-2.5 items-start transition-colors hover:bg-bg-elevated ${
                    !m.read ? "bg-accent-primary/5" : "opacity-40"
                  }`}
                >
                  {/* Dot */}
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                      !m.read ? "bg-accent-primary" : "bg-bg-border"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`font-dm-mono text-[10px] font-bold uppercase ${
                          m.tier === "critical" ? "text-accent-primary" : "text-text-tertiary"
                        }`}
                      >
                        {m.agentSource}
                      </span>
                      <span className="font-dm-mono text-[9px] text-text-tertiary">
                        {formatRelativeTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="font-dm-mono text-[11px] text-text-primary mb-0.5 truncate">
                      {m.title}
                    </p>
                    <p className="font-dm-mono text-[10px] text-text-secondary truncate">
                      {m.body}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 text-center">
            <Link
              href="/inbox"
              onClick={() => setOpen(false)}
              className="font-dm-mono text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors tracking-wide"
            >
              View all in Inbox →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

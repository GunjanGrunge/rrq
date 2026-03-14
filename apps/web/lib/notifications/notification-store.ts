import { create } from "zustand";

export type MessageType = "fyi" | "alert" | "proposal";
export type MessageTier = "critical" | "high" | "normal" | "low";
export type AgentSource = "oracle" | "zeus" | "rex" | "council" | "system";
export type ProposalStatus = "pending" | "approved" | "declined" | "auto-applied";

export interface ProposalData {
  current: string;
  proposed: string;
  reason: string;
  targetAgent: string;
  status: ProposalStatus;
  autoApplyAt?: number;
}

export interface ThreadMessage {
  role: "agent" | "user";
  content: string;
  timestamp: number;
}

export interface InboxMessage {
  messageId: string;
  type: MessageType;
  tier: MessageTier;
  title: string;
  body: string;
  agentSource: AgentSource;
  relatedJobId?: string;
  proposalData?: ProposalData;
  thread: ThreadMessage[];
  read: boolean;
  createdAt: number;
  emailSent: boolean;
  // Lifecycle
  deletedAt?: number;   // set on soft delete — message moves to Trash
  archivedAt?: number;  // set by Zeus cron when stub is written to inbox-archive table
}

// One-line receipt Zeus writes when a message is purged from Trash after 90 days.
// Stored in DynamoDB inbox-archive table (TTL = 365 days).
export interface ArchiveEntry {
  archiveId: string;
  originalMessageId: string;
  agentSource: AgentSource;
  tier: MessageTier;
  title: string;
  // Zeus-authored one-liner: "Oracle proposed script restructure on Jan 3 — accepted."
  summary: string;
  createdAt: number;   // original message createdAt
  archivedAt: number;  // timestamp Zeus wrote this stub
  action: "accepted" | "declined" | "read" | "deleted";
}

export type InboxView = "inbox" | "trash" | "archive";

interface NotificationState {
  messages: InboxMessage[];
  archiveEntries: ArchiveEntry[];
  activeMessageId: string | null;
  filter: "all" | MessageType | "system";
  view: InboxView;
  isLoading: boolean;

  // Inbox actions
  setMessages: (messages: InboxMessage[]) => void;
  appendMessage: (message: InboxMessage) => void;
  setActiveMessage: (id: string | null) => void;
  setFilter: (filter: "all" | MessageType | "system") => void;
  setView: (view: InboxView) => void;
  markRead: (messageId: string) => void;
  markAllRead: () => void;
  updateProposalStatus: (messageId: string, status: ProposalStatus) => void;
  appendThreadMessage: (messageId: string, msg: ThreadMessage) => void;

  // Delete / restore / purge
  deleteMessage: (messageId: string) => void;
  restoreMessage: (messageId: string) => void;
  purgeMessage: (messageId: string) => void; // permanent — removes from store entirely

  // Archive
  setArchiveEntries: (entries: ArchiveEntry[]) => void;
  appendArchiveEntry: (entry: ArchiveEntry) => void;

  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  messages: [],
  archiveEntries: [],
  activeMessageId: null,
  filter: "all",
  view: "inbox",
  isLoading: false,

  setMessages: (messages) => set({ messages }),

  appendMessage: (message) =>
    set((state) => ({ messages: [message, ...state.messages] })),

  setActiveMessage: (id) => set({ activeMessageId: id }),

  setFilter: (filter) => set({ filter }),

  setView: (view) => set({ view, activeMessageId: null }),

  markRead: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId ? { ...m, read: true } : m
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.deletedAt ? m : { ...m, read: true }
      ),
    })),

  updateProposalStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId && m.proposalData
          ? { ...m, proposalData: { ...m.proposalData, status } }
          : m
      ),
    })),

  appendThreadMessage: (messageId, msg) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId
          ? { ...m, thread: [...m.thread, msg] }
          : m
      ),
    })),

  deleteMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId ? { ...m, deletedAt: Date.now(), read: true } : m
      ),
      // Clear active selection if deleted message was open
      activeMessageId:
        state.activeMessageId === messageId ? null : state.activeMessageId,
    })),

  restoreMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId ? { ...m, deletedAt: undefined } : m
      ),
    })),

  purgeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.messageId !== messageId),
      activeMessageId:
        state.activeMessageId === messageId ? null : state.activeMessageId,
    })),

  setArchiveEntries: (entries) => set({ archiveEntries: entries }),

  appendArchiveEntry: (entry) =>
    set((state) => ({
      archiveEntries: [entry, ...state.archiveEntries],
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));

// Selectors
export function getUnreadCount(messages: InboxMessage[]): number {
  return messages.filter((m) => !m.read && !m.deletedAt).length;
}

export function filterMessages(
  messages: InboxMessage[],
  filter: "all" | MessageType | "system"
): InboxMessage[] {
  // Inbox view — exclude deleted
  const live = messages.filter((m) => !m.deletedAt);
  if (filter === "all") return live;
  if (filter === "system") return live.filter((m) => m.agentSource === "system");
  return live.filter((m) => m.type === filter);
}

export function getTrashedMessages(messages: InboxMessage[]): InboxMessage[] {
  return messages
    .filter((m) => !!m.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

// Days remaining before a trashed message is auto-purged (90-day window)
export function trashDaysRemaining(deletedAt: number): number {
  const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
  const remaining = deletedAt + MS_90_DAYS - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

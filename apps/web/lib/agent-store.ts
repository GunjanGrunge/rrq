import { create } from "zustand";

export type AgentName = "zeus" | "rex" | "regum" | "qeon";
export type AgentStatus = "idle" | "running" | "error";

export interface AgentActivity {
  id: string;
  agent: AgentName;
  message: string;
  timestamp: number;
}

export interface WatchlistItem {
  topic: string;
  confidence: number; // 0-1
  status: "watching" | "ready" | "greenlit";
  trend: "up" | "stable" | "down";
}

export interface AgentScore {
  agent: AgentName;
  score: number; // 0-100
  trend: "improving" | "stable" | "declining";
  lastWin: string;
  weeklyPoints: number;
}

interface AgentState {
  // GO RRQ mode
  isAutonomousMode: boolean;
  selectedNiches: string[];

  // Agent statuses
  agentStatuses: Record<AgentName, AgentStatus>;
  agentScores: AgentScore[];

  // Live activity feed
  activities: AgentActivity[];

  // Rex watchlist
  watchlist: WatchlistItem[];

  // Zeus comment insights
  commentInsights: {
    total: number;
    genuine: number;
    topRequest: string | null;
    topPraise: string | null;
    sentiment: { positive: number; neutral: number; negative: number };
  } | null;

  // Memory log
  memoryLog: Array<{
    agent: AgentName;
    lesson: string;
    timestamp: number;
  }>;

  // Actions
  setAutonomousMode: (active: boolean) => void;
  toggleNiche: (niche: string) => void;
  clearNiches: () => void;
  setAgentStatus: (agent: AgentName, status: AgentStatus) => void;
  addActivity: (activity: Omit<AgentActivity, "id" | "timestamp">) => void;
  clearOldActivities: () => void;
  setWatchlist: (items: WatchlistItem[]) => void;
  setAgentScores: (scores: AgentScore[]) => void;
  setCommentInsights: (insights: AgentState["commentInsights"]) => void;
  addMemoryEntry: (entry: Omit<AgentState["memoryLog"][0], "timestamp">) => void;
  setMemoryLog: (entries: AgentState["memoryLog"]) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  isAutonomousMode: false,
  selectedNiches: [],

  agentStatuses: {
    zeus: "idle",
    rex: "idle",
    regum: "idle",
    qeon: "idle",
  },

  agentScores: [],
  activities: [],
  watchlist: [],
  commentInsights: null,
  memoryLog: [],

  setAutonomousMode: (active) => set({ isAutonomousMode: active }),

  toggleNiche: (niche) =>
    set((state) => ({
      selectedNiches: state.selectedNiches.includes(niche)
        ? state.selectedNiches.filter((n) => n !== niche)
        : [...state.selectedNiches, niche],
    })),

  clearNiches: () => set({ selectedNiches: [] }),

  setAgentStatus: (agent, status) =>
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agent]: status },
    })),

  addActivity: (activity) =>
    set((state) => ({
      activities: [
        {
          ...activity,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
        },
        ...state.activities.slice(0, 49), // keep last 50
      ],
    })),

  clearOldActivities: () =>
    set((state) => ({
      activities: state.activities.filter(
        (a) => Date.now() - a.timestamp < 30_000
      ),
    })),

  setWatchlist: (items) => set({ watchlist: items }),

  setAgentScores: (scores) => set({ agentScores: scores }),

  setCommentInsights: (insights) => set({ commentInsights: insights }),

  addMemoryEntry: (entry) =>
    set((state) => ({
      memoryLog: [
        { ...entry, timestamp: Date.now() },
        ...state.memoryLog.slice(0, 4), // keep last 5
      ],
    })),

  setMemoryLog: (entries) => set({ memoryLog: entries }),
}));

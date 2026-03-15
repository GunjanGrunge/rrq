import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StepStatus = "ready" | "running" | "complete" | "error";

export type Tone = "informative" | "entertaining" | "documentary" | "controversial" | "persuasive";

export type GateId = "gate-script" | "gate-seo" | "gate-visuals" | "gate-publish";
export type GateStatus = "idle" | "pending" | "approved" | "editing" | "regenerating";

export interface ApprovalGateState {
  status: GateStatus;
  arrivedAt: number | null;
  approvedAt: number | null;
  edits: Record<string, unknown>;
}

export interface ChatMessage {
  role: "zeus" | "user";
  content: string;
}

export interface PipelineStep {
  number: number;
  label: string;
  status: StepStatus;
}

export interface RexScoreDimension {
  score: number;
  note: string;
}

export interface RexScoreData {
  overall: number;
  verdict: "STRONG" | "SOLID" | "RISKY";
  dimensions: Record<string, RexScoreDimension>;
  recommendation: string;
}

export interface BriefData {
  topic: string;
  duration: number;
  tone: Tone;
  tones: Tone[];
  selectedNiches: string[];
  generateShorts: boolean;
  shortsType: "convert" | "fresh";
  qualityThreshold: number;
  chatMessages: ChatMessage[];
  directorMode: boolean;
  voiceMode: "ai" | "self";
  rexScore?: RexScoreData;
}

const INITIAL_GATE: ApprovalGateState = {
  status: "idle",
  arrivedAt: null,
  approvedAt: null,
  edits: {},
};

const INITIAL_GATES: Record<GateId, ApprovalGateState> = {
  "gate-script": { ...INITIAL_GATE },
  "gate-seo": { ...INITIAL_GATE },
  "gate-visuals": { ...INITIAL_GATE },
  "gate-publish": { ...INITIAL_GATE },
};

const INITIAL_STEP_STATUSES: Record<number, StepStatus> = Object.fromEntries(
  Array.from({ length: 13 }, (_, i) => [i + 1, "ready" as StepStatus])
);

// ─── Per-session state ───────────────────────────────────────────────────────

export interface SessionState {
  jobId: string;
  createdAt: number;
  currentStep: number;
  stepStatuses: Record<number, StepStatus>;
  brief: BriefData | null;
  outputs: Record<number, unknown>;
  approvalGates: Record<GateId, ApprovalGateState>;
  pendingGate: GateId | null;
}

function newSession(jobId: string): SessionState {
  return {
    jobId,
    createdAt: Date.now(),
    currentStep: 0,
    stepStatuses: { ...INITIAL_STEP_STATUSES },
    brief: null,
    outputs: {},
    approvalGates: {
      "gate-script": { ...INITIAL_GATE },
      "gate-seo": { ...INITIAL_GATE },
      "gate-visuals": { ...INITIAL_GATE },
      "gate-publish": { ...INITIAL_GATE },
    },
    pendingGate: null,
  };
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface PipelineStore {
  // Multi-session
  sessions: Record<string, SessionState>;
  activeJobId: string | null;

  // Derived helpers (read from active session)
  jobId: string | null;
  currentStep: number;
  stepStatuses: Record<number, StepStatus>;
  brief: BriefData | null;
  outputs: Record<number, unknown>;
  approvalGates: Record<GateId, ApprovalGateState>;
  pendingGate: GateId | null;

  // Session management
  newSession: () => string;               // creates + activates, returns jobId
  switchSession: (jobId: string) => void;
  deleteSession: (jobId: string) => void;

  // Pipeline actions (operate on active session)
  startJob: (jobId: string) => void;
  setBrief: (brief: BriefData) => void;
  setStep: (step: number) => void;
  setStepStatus: (step: number, status: StepStatus) => void;
  setStepOutput: (step: number, output: unknown) => void;
  resetPipeline: () => void;

  // Director Mode gate actions
  openGate: (gateId: GateId) => void;
  approveGate: (gateId: GateId, edits?: Record<string, unknown>) => void;
  setGateStatus: (gateId: GateId, status: GateStatus) => void;
  resetGates: () => void;
  enableDirectorMode: () => void;
}

// ─── Derived field sync helper ───────────────────────────────────────────────

function syncDerived(sessions: Record<string, SessionState>, activeJobId: string | null) {
  const active = activeJobId ? sessions[activeJobId] : null;
  return {
    jobId: active?.jobId ?? null,
    currentStep: active?.currentStep ?? 0,
    stepStatuses: active?.stepStatuses ?? { ...INITIAL_STEP_STATUSES },
    brief: active?.brief ?? null,
    outputs: active?.outputs ?? {},
    approvalGates: active?.approvalGates ?? { ...INITIAL_GATES },
    pendingGate: active?.pendingGate ?? null,
  };
}

// ─── Update a single session field ──────────────────────────────────────────

function patchSession(
  sessions: Record<string, SessionState>,
  activeJobId: string | null,
  patch: Partial<SessionState>
): Record<string, SessionState> {
  if (!activeJobId || !sessions[activeJobId]) return sessions;
  return {
    ...sessions,
    [activeJobId]: { ...sessions[activeJobId], ...patch },
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      activeJobId: null,

      // Derived fields (synced from active session)
      jobId: null,
      currentStep: 0,
      stepStatuses: { ...INITIAL_STEP_STATUSES },
      brief: null,
      outputs: {},
      approvalGates: { ...INITIAL_GATES },
      pendingGate: null,

      // ── Session management ──────────────────────────────────────────────

      newSession: () => {
        const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const session = newSession(jobId);
        set((state) => {
          const sessions = { ...state.sessions, [jobId]: session };
          return {
            sessions,
            activeJobId: jobId,
            ...syncDerived(sessions, jobId),
          };
        });
        return jobId;
      },

      switchSession: (jobId) => {
        set((state) => {
          if (!state.sessions[jobId]) return state;
          return {
            activeJobId: jobId,
            ...syncDerived(state.sessions, jobId),
          };
        });
      },

      deleteSession: (jobId) => {
        set((state) => {
          const sessions = { ...state.sessions };
          delete sessions[jobId];
          const ids = Object.keys(sessions);
          const nextId = ids.length > 0 ? ids[ids.length - 1] : null;
          return {
            sessions,
            activeJobId: nextId,
            ...syncDerived(sessions, nextId),
          };
        });
      },

      // ── Pipeline actions ────────────────────────────────────────────────

      startJob: (jobId) => {
        set((state) => {
          const sessions = patchSession(state.sessions, state.activeJobId, {
            jobId,
            currentStep: 1,
            stepStatuses: { ...INITIAL_STEP_STATUSES },
            outputs: {},
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      setBrief: (brief) => {
        set((state) => {
          const sessions = patchSession(state.sessions, state.activeJobId, { brief });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      setStep: (step) => {
        set((state) => {
          const sessions = patchSession(state.sessions, state.activeJobId, { currentStep: step });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      setStepStatus: (step, status) => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            stepStatuses: { ...active.stepStatuses, [step]: status },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      setStepOutput: (step, output) => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            outputs: { ...active.outputs, [step]: output },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      resetPipeline: () => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            currentStep: 0,
            stepStatuses: { ...INITIAL_STEP_STATUSES },
            brief: null,
            outputs: {},
            approvalGates: {
              "gate-script": { ...INITIAL_GATE },
              "gate-seo": { ...INITIAL_GATE },
              "gate-visuals": { ...INITIAL_GATE },
              "gate-publish": { ...INITIAL_GATE },
            },
            pendingGate: null,
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      // ── Director Mode gate actions ──────────────────────────────────────

      openGate: (gateId) => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            pendingGate: gateId,
            approvalGates: {
              ...active.approvalGates,
              [gateId]: {
                ...active.approvalGates[gateId],
                status: "pending",
                arrivedAt: Date.now(),
              },
            },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      approveGate: (gateId, edits = {}) => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            pendingGate: null,
            approvalGates: {
              ...active.approvalGates,
              [gateId]: {
                ...active.approvalGates[gateId],
                status: "approved",
                approvedAt: Date.now(),
                edits,
              },
            },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      setGateStatus: (gateId, status) => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            approvalGates: {
              ...active.approvalGates,
              [gateId]: { ...active.approvalGates[gateId], status },
            },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      resetGates: () => {
        set((state) => {
          const sessions = patchSession(state.sessions, state.activeJobId, {
            approvalGates: {
              "gate-script": { ...INITIAL_GATE },
              "gate-seo": { ...INITIAL_GATE },
              "gate-visuals": { ...INITIAL_GATE },
              "gate-publish": { ...INITIAL_GATE },
            },
            pendingGate: null,
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },

      enableDirectorMode: () => {
        set((state) => {
          const active = state.activeJobId ? state.sessions[state.activeJobId] : null;
          if (!active?.brief) return state;
          const sessions = patchSession(state.sessions, state.activeJobId, {
            brief: { ...active.brief, directorMode: true },
          });
          return { sessions, ...syncDerived(sessions, state.activeJobId) };
        });
      },
    }),
    {
      name: "rrq-pipeline-v2",
      partialize: (state) => ({
        sessions: state.sessions,
        activeJobId: state.activeJobId,
      }),
      // Re-derive flat fields on rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          const derived = syncDerived(state.sessions, state.activeJobId);
          Object.assign(state, derived);
        }
      },
    }
  )
);

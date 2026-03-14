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

export interface BriefData {
  topic: string;
  duration: number; // minutes
  tone: Tone;              // primary tone (backward compat)
  tones: Tone[];           // all selected tones
  selectedNiches: string[];
  generateShorts: boolean;
  shortsType: "convert" | "fresh";
  qualityThreshold: number;
  chatMessages: ChatMessage[];
  directorMode: boolean;
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

interface PipelineState {
  // Current job
  jobId: string | null;
  currentStep: number;
  stepStatuses: Record<number, StepStatus>;

  // Brief data
  brief: BriefData | null;

  // Step outputs (typed loosely — will be refined per step)
  outputs: Record<number, unknown>;

  // Director Mode gates
  approvalGates: Record<GateId, ApprovalGateState>;
  pendingGate: GateId | null;

  // Actions
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

const INITIAL_STEP_STATUSES: Record<number, StepStatus> = Object.fromEntries(
  Array.from({ length: 13 }, (_, i) => [i + 1, "ready" as StepStatus])
);

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set) => ({
      jobId: null,
      currentStep: 1,
      stepStatuses: { ...INITIAL_STEP_STATUSES },
      brief: null,
      outputs: {},
      approvalGates: { ...INITIAL_GATES },
      pendingGate: null,

      startJob: (jobId) =>
        set({
          jobId,
          currentStep: 1,
          stepStatuses: { ...INITIAL_STEP_STATUSES },
          outputs: {},
        }),

      setBrief: (brief) => set({ brief }),

      setStep: (step) => set({ currentStep: step }),

      setStepStatus: (step, status) =>
        set((state) => ({
          stepStatuses: { ...state.stepStatuses, [step]: status },
        })),

      setStepOutput: (step, output) =>
        set((state) => ({
          outputs: { ...state.outputs, [step]: output },
        })),

      resetPipeline: () =>
        set({
          jobId: null,
          currentStep: 1,
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
        }),

      openGate: (gateId) =>
        set((state) => ({
          pendingGate: gateId,
          approvalGates: {
            ...state.approvalGates,
            [gateId]: {
              ...state.approvalGates[gateId],
              status: "pending",
              arrivedAt: Date.now(),
            },
          },
        })),

      approveGate: (gateId, edits = {}) =>
        set((state) => ({
          pendingGate: null,
          approvalGates: {
            ...state.approvalGates,
            [gateId]: {
              ...state.approvalGates[gateId],
              status: "approved",
              approvedAt: Date.now(),
              edits,
            },
          },
        })),

      setGateStatus: (gateId, status) =>
        set((state) => ({
          approvalGates: {
            ...state.approvalGates,
            [gateId]: {
              ...state.approvalGates[gateId],
              status,
            },
          },
        })),

      resetGates: () =>
        set({
          approvalGates: {
            "gate-script": { ...INITIAL_GATE },
            "gate-seo": { ...INITIAL_GATE },
            "gate-visuals": { ...INITIAL_GATE },
            "gate-publish": { ...INITIAL_GATE },
          },
          pendingGate: null,
        }),

      enableDirectorMode: () =>
        set((state) => ({
          brief: state.brief ? { ...state.brief, directorMode: true } : null,
        })),
    }),
    {
      name: "rrq-pipeline",
      partialize: (state) => ({
        jobId: state.jobId,
        currentStep: state.currentStep,
        stepStatuses: state.stepStatuses,
        brief: state.brief,
        approvalGates: state.approvalGates,
        pendingGate: state.pendingGate,
      }),
    }
  )
);

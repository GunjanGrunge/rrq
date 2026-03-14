import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StepStatus = "ready" | "running" | "complete" | "error";

export interface PipelineStep {
  number: number;
  label: string;
  status: StepStatus;
}

export interface BriefData {
  topic: string;
  duration: number; // minutes
  tone: "informative" | "entertaining" | "documentary" | "controversial" | "persuasive";
  generateShorts: boolean;
  shortsType: "convert" | "fresh";
  qualityThreshold: number;
}

interface PipelineState {
  // Current job
  jobId: string | null;
  currentStep: number;
  stepStatuses: Record<number, StepStatus>;

  // Brief data
  brief: BriefData | null;

  // Step outputs (typed loosely — will be refined per step)
  outputs: Record<number, unknown>;

  // Actions
  startJob: (jobId: string) => void;
  setBrief: (brief: BriefData) => void;
  setStep: (step: number) => void;
  setStepStatus: (step: number, status: StepStatus) => void;
  setStepOutput: (step: number, output: unknown) => void;
  resetPipeline: () => void;
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
        }),
    }),
    {
      name: "rrq-pipeline",
      partialize: (state) => ({
        jobId: state.jobId,
        currentStep: state.currentStep,
        stepStatuses: state.stepStatuses,
        brief: state.brief,
      }),
    }
  )
);

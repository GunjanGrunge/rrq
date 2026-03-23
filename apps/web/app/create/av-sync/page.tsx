"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput } from "@/lib/types/pipeline";
import type {
  AudioGenOutputType,
  AvSyncOutputType,
  SkyReelsOutputType,
  Wan2OutputType,
  VisualGenOutputType,
  ResearchVisualOutputType,
} from "@rrq/lambda-types";
import { CheckCircle, ArrowRight, Film } from "lucide-react";

const SUBTASK_LABELS = [
  "Gather all produced assets — presenter, b-roll, graphics, visuals",
  "Arrange assets in script order",
  "Sync all visual segments to the voiceover track",
  "Burn in subtitles with accurate timing",
  "Package final video for quality review",
];

function AVSyncResult({
  output,
  onContinue,
  onRerun,
}: {
  output: AvSyncOutputType;
  onContinue: () => void;
  onRerun: () => void;
}) {
  const durationSec = output.durationMs ? Math.round(output.durationMs / 1000) : null;
  const fileSizeMb = output.fileSize ? (output.fileSize / 1024 / 1024).toFixed(1) : null;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Video Assembled</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            All segments have been stitched, synced, and subtitled. Ready for quality review.
          </p>
        </div>
      </div>

      <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-bg-border">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">Output</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-xs text-text-secondary">S3 Key</span>
            <span className="font-dm-mono text-xs text-text-primary truncate max-w-xs">{output.finalVideoS3Key}</span>
          </div>
          {durationSec && (
            <div className="flex items-center justify-between">
              <span className="font-dm-mono text-xs text-text-secondary">Duration</span>
              <span className="font-dm-mono text-xs text-text-primary">
                {Math.floor(durationSec / 60)}m {durationSec % 60}s
              </span>
            </div>
          )}
          {fileSizeMb && (
            <div className="flex items-center justify-between">
              <span className="font-dm-mono text-xs text-text-secondary">File size</span>
              <span className="font-dm-mono text-xs text-text-primary">{fileSizeMb} MB</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-xs text-text-secondary">Resolution</span>
            <span className="font-dm-mono text-xs text-text-primary">{output.resolution ?? "720p"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Re-assemble
        </button>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
        >
          QUALITY CHECK <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function AVSyncPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep(10); }, [setStep]);

  const avSyncOutput = outputs[10] as AvSyncOutputType | undefined;

  useEffect(() => {
    // If output already exists — show result, don't re-run
    if (avSyncOutput) {
      if (stepStatuses[10] !== "complete") setStepStatus(10, "complete");
      return;
    }
    if (stepStatuses[10] === "running") return;
    if (hasRun.current || !jobId) return;
    hasRun.current = true;

    setStepStatus(10, "running");

    const scriptOutput = outputs[2] as ScriptOutput | undefined;
    const audioOutput = outputs[5] as AudioGenOutputType | undefined;
    // Pull all prior media step outputs so av-sync can wire S3 keys into each segment
    const avatarOutput = outputs[6] as SkyReelsOutputType | undefined;
    const brollOutput = outputs[7] as Wan2OutputType | undefined;
    const visualsOutput = outputs[9] as VisualGenOutputType | undefined;
    const researchVisualsOutput = outputs[8] as ResearchVisualOutputType | undefined;

    (async () => {
      try {
        const res = await fetch("/api/pipeline/av-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            scriptOutput,
            audioOutput,
            avatarOutput,
            brollOutput,
            visualsOutput,
            researchVisualsOutput,
          }),
        });

        if (!res.ok || !res.body) throw new Error(`AV Sync API returned ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as {
                type: string; stageIndex?: number; message?: string; data?: unknown; error?: string;
              };
              if (event.type === "stage_complete" && typeof event.stageIndex === "number") {
                setSubTasksDone((prev) => {
                  const next = [...prev];
                  next[event.stageIndex!] = true;
                  return next;
                });
              }
              if (event.type === "result") {
                setStepOutput(10, event.data);
                setStepStatus(10, "complete");
              }
              if (event.type === "error") throw new Error(event.error ?? "AV Sync failed");
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "AV Sync failed");
        setStepStatus(10, "error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, outputs[10], stepStatuses[10]]);

  if (error || stepStatuses[10] === "error") {
    return (
      <div className="flex-1 p-8">
        <StepFailureCard
          stepNumber={10}
          stepLabel="AV Sync"
          errorMessage={error ?? "AV Sync failed."}
          showDownstreamWarning
          downstreamCount={STEP_DOWNSTREAM[10].length}
          onRerunStep={() => { rerunStep(10); hasRun.current = false; setError(null); setSubTasksDone([false, false, false, false, false]); }}
        />
      </div>
    );
  }

  if (avSyncOutput) {
    return (
      <AVSyncResult
        output={avSyncOutput}
        onContinue={() => router.push("/create/vera-qa")}
        onRerun={() => { rerunStep(10); hasRun.current = false; setSubTasksDone([false, false, false, false, false]); }}
      />
    );
  }

  return (
    <PipelineStepWaiting
      stepNumber={10}
      title="Assembling Your Video"
      description="All produced assets — presenter segments, b-roll footage, graphics, and visual overlays — are being assembled in the correct order and synced with the voiceover. Subtitles are added and the final video is packaged ready for quality review."
      icon={<Film size={22} strokeWidth={1.5} />}
      subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
      estimatedTime="~3 minutes"
    />
  );
}
